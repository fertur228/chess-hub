-- Phase 4C: Room visibility + public matchmaking RPC.
--
-- 1. Add visibility column to rooms.
-- 2. Add partial index for matchmaking.
-- 3. Create find_or_create_public_room RPC.

-- ── 1. visibility column ───────────────────────────────────────────

ALTER TABLE public.rooms
  ADD COLUMN visibility text NOT NULL DEFAULT 'private';

ALTER TABLE public.rooms
  ADD CONSTRAINT rooms_visibility_check CHECK (visibility IN ('private', 'public'));

-- ── 2. Partial index for efficient matchmaking lookups ─────────────

CREATE INDEX IF NOT EXISTS rooms_public_waiting_idx
  ON public.rooms (created_at)
  WHERE visibility = 'public' AND status = 'waiting' AND guest_user_id IS NULL;

-- ── 3. find_or_create_public_room RPC ──────────────────────────────

CREATE OR REPLACE FUNCTION public.find_or_create_public_room(
  p_game_mode text DEFAULT 'casual',
  p_host_color text DEFAULT 'random'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_uname     text;
  v_mode      text;
  v_color     text;
  v_room      public.rooms%ROWTYPE;
  v_existing  public.rooms%ROWTYPE;
  v_white_id   uuid;
  v_black_id   uuid;
  v_white_name text;
  v_black_name text;
  v_new_code  text;
  v_attempt   int;
  v_chars     text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_i         int;
BEGIN
  -- Auth check
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Normalize inputs
  v_mode := lower(trim(COALESCE(p_game_mode, 'casual')));
  IF v_mode NOT IN ('casual', 'ranked') THEN
    v_mode := 'casual';
  END IF;

  v_color := lower(trim(COALESCE(p_host_color, 'random')));
  IF v_color NOT IN ('white', 'black', 'random') THEN
    v_color := 'random';
  END IF;

  -- Load caller profile
  SELECT pr.username INTO v_uname
  FROM public.profiles pr
  WHERE pr.user_id = v_uid;

  IF v_uname IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- ── Guard: caller already has a public waiting room ──────────────
  SELECT * INTO v_existing
  FROM public.rooms
  WHERE visibility = 'public'
    AND status = 'waiting'
    AND host_user_id = v_uid
    AND guest_user_id IS NULL
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'action',       'existing',
      'room_id',      v_existing.id,
      'status',       v_existing.status,
      'role',         'host',
      'player_color', NULL
    );
  END IF;

  -- ── Try to match with another user's waiting public room ─────────
  SELECT * INTO v_room
  FROM public.rooms
  WHERE visibility = 'public'
    AND status = 'waiting'
    AND guest_user_id IS NULL
    AND host_user_id <> v_uid
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF FOUND THEN
    -- Determine color assignment
    IF v_room.host_color = 'black' THEN
      v_white_id   := v_uid;
      v_white_name := v_uname;
      v_black_id   := v_room.host_user_id;
      v_black_name := v_room.host_username;
    ELSIF v_room.host_color = 'white' THEN
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

    UPDATE public.rooms
    SET guest_user_id  = v_uid,
        guest_username = v_uname,
        white_user_id  = v_white_id,
        black_user_id  = v_black_id,
        white_username = v_white_name,
        black_username = v_black_name,
        status         = 'playing'
    WHERE id = v_room.id;

    RETURN jsonb_build_object(
      'action',       'joined',
      'room_id',      v_room.id,
      'status',       'playing',
      'role',         'guest',
      'player_color', CASE WHEN v_white_id = v_uid THEN 'white' ELSE 'black' END
    );
  END IF;

  -- ── No match found: create a new public waiting room ─────────────
  -- Generate a unique 6-char code with collision retry
  v_new_code := '';
  FOR v_attempt IN 1..10 LOOP
    v_new_code := '';
    FOR v_i IN 1..6 LOOP
      v_new_code := v_new_code || substr(v_chars, floor(random() * length(v_chars))::int + 1, 1);
    END LOOP;
    -- Check uniqueness
    IF NOT EXISTS (SELECT 1 FROM public.rooms WHERE code = v_new_code) THEN
      EXIT;
    END IF;
    v_new_code := '';  -- reset on collision
  END LOOP;

  IF v_new_code = '' THEN
    RAISE EXCEPTION 'ROOM_CODE_GENERATION_FAILED';
  END IF;

  INSERT INTO public.rooms (
    code, host_user_id, host_username, host_color, game_mode, visibility, status
  ) VALUES (
    v_new_code, v_uid, v_uname, v_color, v_mode, 'public', 'waiting'
  )
  RETURNING * INTO v_room;

  RETURN jsonb_build_object(
    'action',       'created',
    'room_id',      v_room.id,
    'status',       'waiting',
    'role',         'host',
    'player_color', NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.find_or_create_public_room(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_or_create_public_room(text, text) TO authenticated;
