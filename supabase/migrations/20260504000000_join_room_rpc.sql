-- Phase 4B: Trusted join_room RPC + tightened rooms UPDATE RLS.
--
-- 1. Create SECURITY DEFINER function public.join_room(p_code text).
-- 2. Drop the old broad "Participants update rooms" policy.
-- 3. Add two focused UPDATE policies: host + guest.

-- ── 1. join_room RPC ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.join_room(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_code   text;
  v_room   public.rooms%ROWTYPE;
  v_uname  text;
  v_white_id   uuid;
  v_black_id   uuid;
  v_white_name text;
  v_black_name text;
BEGIN
  -- Auth check
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Normalize & validate code
  v_code := upper(trim(COALESCE(p_code, '')));
  IF v_code !~ '^[A-Z0-9]{6}$' THEN
    RAISE EXCEPTION 'ROOM_INVALID_CODE';
  END IF;

  -- Lock the room row
  SELECT * INTO v_room
  FROM public.rooms
  WHERE code = v_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ROOM_NOT_FOUND';
  END IF;

  -- Re-entry: caller is the host
  IF v_room.host_user_id = v_uid THEN
    RETURN jsonb_build_object(
      'room_id',      v_room.id,
      'room_code',    v_room.code,
      'status',       v_room.status,
      'role',         'host',
      'player_color', CASE
                        WHEN v_room.white_user_id = v_uid THEN 'white'
                        WHEN v_room.black_user_id = v_uid THEN 'black'
                        ELSE v_room.host_color
                      END
    );
  END IF;

  -- Re-entry: caller is already seated as guest / white / black
  IF v_room.guest_user_id = v_uid
     OR v_room.white_user_id = v_uid
     OR v_room.black_user_id = v_uid THEN
    RETURN jsonb_build_object(
      'room_id',      v_room.id,
      'room_code',    v_room.code,
      'status',       v_room.status,
      'role',         'participant',
      'player_color', CASE
                        WHEN v_room.white_user_id = v_uid THEN 'white'
                        WHEN v_room.black_user_id = v_uid THEN 'black'
                        ELSE NULL
                      END
    );
  END IF;

  -- Room must be waiting for a new guest
  IF v_room.status <> 'waiting' THEN
    RAISE EXCEPTION 'ROOM_NOT_AVAILABLE';
  END IF;

  IF v_room.guest_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'ROOM_FULL';
  END IF;

  -- Load caller username
  SELECT pr.username INTO v_uname
  FROM public.profiles pr
  WHERE pr.user_id = v_uid;

  IF v_uname IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- Determine color assignment
  IF v_room.host_color = 'black' THEN
    -- host is black, guest is white
    v_white_id   := v_uid;
    v_white_name := v_uname;
    v_black_id   := v_room.host_user_id;
    v_black_name := v_room.host_username;
  ELSIF v_room.host_color = 'white' THEN
    -- host is white, guest is black
    v_white_id   := v_room.host_user_id;
    v_white_name := v_room.host_username;
    v_black_id   := v_uid;
    v_black_name := v_uname;
  ELSE
    -- random
    IF random() < 0.5 THEN
      v_white_id   := v_uid;
      v_white_name := v_uname;
      v_black_id   := v_room.host_user_id;
      v_black_name := v_room.host_username;
    ELSE
      v_white_id   := v_room.host_user_id;
      v_white_name := v_room.host_username;
      v_black_id   := v_uid;
      v_black_name := v_uname;
    END IF;
  END IF;

  -- Atomic claim: update only if still waiting & no guest
  UPDATE public.rooms
  SET guest_user_id  = v_uid,
      guest_username = v_uname,
      white_user_id  = v_white_id,
      black_user_id  = v_black_id,
      white_username = v_white_name,
      black_username = v_black_name,
      status         = 'playing'
  WHERE id = v_room.id
    AND status = 'waiting'
    AND guest_user_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ROOM_FULL';
  END IF;

  RETURN jsonb_build_object(
    'room_id',      v_room.id,
    'room_code',    v_room.code,
    'status',       'playing',
    'role',         'guest',
    'player_color', CASE WHEN v_white_id = v_uid THEN 'white' ELSE 'black' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.join_room(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_room(text) TO authenticated;


-- ── 2. Replace broad UPDATE policy with focused ones ───────────────

DROP POLICY IF EXISTS "Participants update rooms" ON public.rooms;

-- Host can update any of their own rooms (cancel waiting, push moves, resign).
-- WITH CHECK ensures host_user_id is not mutated away from the caller.
CREATE POLICY "Host updates own room"
  ON public.rooms FOR UPDATE
  USING (auth.uid() = host_user_id)
  WITH CHECK (auth.uid() = host_user_id);

-- Guest can update rooms where they are the seated guest and the game
-- is currently playing.  WITH CHECK is permissive on status so the guest
-- can set status = 'finished' (resign / checkmate) without being blocked.
CREATE POLICY "Guest updates active room"
  ON public.rooms FOR UPDATE
  USING (auth.uid() = guest_user_id AND status = 'playing')
  WITH CHECK (auth.uid() = guest_user_id);
