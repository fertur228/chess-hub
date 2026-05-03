-- Phase 6D: Ranked matchmaking only through public Find Match.
--
-- Private rooms are casual-only. Ranked games are created and matched only
-- through public matchmaking.

UPDATE public.rooms
SET game_mode = 'casual'
WHERE visibility = 'private'
  AND game_mode <> 'casual';

ALTER TABLE public.rooms
  DROP CONSTRAINT IF EXISTS rooms_private_rooms_casual_check;

ALTER TABLE public.rooms
  ADD CONSTRAINT rooms_private_rooms_casual_check
  CHECK (visibility <> 'private' OR game_mode = 'casual');

CREATE INDEX IF NOT EXISTS rooms_public_waiting_mode_idx
  ON public.rooms (game_mode, created_at)
  WHERE visibility = 'public' AND status = 'waiting' AND guest_user_id IS NULL;

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
  v_uid        uuid := auth.uid();
  v_uname      text;
  v_rating     integer;
  v_mode       text;
  v_color      text;
  v_room       public.rooms%ROWTYPE;
  v_existing   public.rooms%ROWTYPE;
  v_white_id   uuid;
  v_black_id   uuid;
  v_white_name text;
  v_black_name text;
  v_new_code   text;
  v_attempt    int;
  v_chars      text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_i          int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_mode := lower(trim(COALESCE(p_game_mode, 'casual')));
  IF v_mode NOT IN ('casual', 'ranked') THEN
    v_mode := 'casual';
  END IF;

  v_color := lower(trim(COALESCE(p_host_color, 'random')));
  IF v_color NOT IN ('white', 'black', 'random') THEN
    v_color := 'random';
  END IF;

  SELECT pr.username, pr.rating
  INTO v_uname, v_rating
  FROM public.profiles pr
  WHERE pr.user_id = v_uid;

  IF v_uname IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- Guard: one public waiting room per user. Return the existing queue entry
  -- instead of creating duplicates, regardless of requested mode.
  SELECT * INTO v_existing
  FROM public.rooms
  WHERE visibility = 'public'
    AND status = 'waiting'
    AND host_user_id = v_uid
    AND guest_user_id IS NULL
  ORDER BY created_at ASC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'action',       'existing',
      'room_id',      v_existing.id,
      'status',       v_existing.status,
      'role',         'host',
      'game_mode',    v_existing.game_mode,
      'player_color', NULL
    );
  END IF;

  IF v_mode = 'ranked' THEN
    SELECT r.* INTO v_room
    FROM public.rooms r
    JOIN public.profiles hp ON hp.user_id = r.host_user_id
    WHERE r.visibility = 'public'
      AND r.status = 'waiting'
      AND r.guest_user_id IS NULL
      AND r.host_user_id <> v_uid
      AND r.game_mode = 'ranked'
    ORDER BY
      CASE
        WHEN abs(hp.rating - v_rating) <= 200 THEN 1
        WHEN abs(hp.rating - v_rating) <= 400 THEN 2
        ELSE 3
      END,
      abs(hp.rating - v_rating),
      r.created_at ASC
    LIMIT 1
    FOR UPDATE OF r SKIP LOCKED;
  ELSE
    SELECT * INTO v_room
    FROM public.rooms
    WHERE visibility = 'public'
      AND status = 'waiting'
      AND guest_user_id IS NULL
      AND host_user_id <> v_uid
      AND game_mode = 'casual'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
  END IF;

  IF FOUND THEN
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
      'game_mode',    v_room.game_mode,
      'player_color', CASE WHEN v_white_id = v_uid THEN 'white' ELSE 'black' END
    );
  END IF;

  v_new_code := '';
  FOR v_attempt IN 1..10 LOOP
    v_new_code := '';
    FOR v_i IN 1..6 LOOP
      v_new_code := v_new_code || substr(v_chars, floor(random() * length(v_chars))::int + 1, 1);
    END LOOP;

    IF NOT EXISTS (SELECT 1 FROM public.rooms WHERE code = v_new_code) THEN
      EXIT;
    END IF;
    v_new_code := '';
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
    'game_mode',    v_room.game_mode,
    'player_color', NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.find_or_create_public_room(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_or_create_public_room(text, text) TO authenticated;
