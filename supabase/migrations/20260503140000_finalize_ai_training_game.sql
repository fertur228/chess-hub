-- Trusted finalize path for AI Training games: insert game row + update profile stats (no rating change).

CREATE OR REPLACE FUNCTION public.finalize_ai_training_game(
  p_human_color text,
  p_ai_difficulty text,
  p_user_result text,
  p_end_reason text,
  p_pgn text,
  p_moves_count integer,
  p_key_moments jsonb DEFAULT '[]'::jsonb,
  p_coach_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_username text;
  v_board_result text;
  v_game_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_human_color NOT IN ('white', 'black') THEN
    RAISE EXCEPTION 'Invalid human color';
  END IF;

  IF p_user_result NOT IN ('win', 'loss', 'draw') THEN
    RAISE EXCEPTION 'Invalid user result';
  END IF;

  IF p_moves_count < 0 OR p_moves_count > 1000 THEN
    RAISE EXCEPTION 'Invalid moves count';
  END IF;

  IF length(COALESCE(p_pgn, '')) > 50000 THEN
    RAISE EXCEPTION 'PGN too long';
  END IF;

  IF p_coach_note IS NOT NULL AND length(p_coach_note) > 8000 THEN
    RAISE EXCEPTION 'Coach note too long';
  END IF;

  IF p_key_moments IS NOT NULL AND jsonb_typeof(p_key_moments) <> 'array' THEN
    RAISE EXCEPTION 'key_moments must be a JSON array';
  END IF;

  SELECT pr.username INTO v_username
  FROM public.profiles pr
  WHERE pr.user_id = v_uid
  FOR UPDATE;

  IF v_username IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF p_user_result = 'draw' THEN
    v_board_result := 'draw';
  ELSIF p_user_result = 'win' THEN
    v_board_result := CASE WHEN p_human_color = 'white' THEN 'white' ELSE 'black' END;
  ELSE
    v_board_result := CASE WHEN p_human_color = 'white' THEN 'black' ELSE 'white' END;
  END IF;

  INSERT INTO public.games (
    game_type,
    white_user_id,
    black_user_id,
    white_username,
    black_username,
    ai_difficulty,
    result,
    end_reason,
    pgn,
    moves_count,
    key_moments,
    coach_note
  ) VALUES (
    'AI Training',
    CASE WHEN p_human_color = 'white' THEN v_uid ELSE NULL END,
    CASE WHEN p_human_color = 'black' THEN v_uid ELSE NULL END,
    CASE WHEN p_human_color = 'white' THEN v_username ELSE 'Coach Bot' END,
    CASE WHEN p_human_color = 'black' THEN v_username ELSE 'Coach Bot' END,
    NULLIF(trim(p_ai_difficulty), ''),
    v_board_result,
    NULLIF(trim(p_end_reason), ''),
    NULLIF(trim(p_pgn), ''),
    p_moves_count,
    COALESCE(p_key_moments, '[]'::jsonb),
    NULLIF(trim(p_coach_note), '')
  )
  RETURNING id INTO v_game_id;

  UPDATE public.profiles
  SET
    games_played = games_played + 1,
    wins = wins + CASE WHEN p_user_result = 'win' THEN 1 ELSE 0 END,
    losses = losses + CASE WHEN p_user_result = 'loss' THEN 1 ELSE 0 END,
    draws = draws + CASE WHEN p_user_result = 'draw' THEN 1 ELSE 0 END,
    updated_at = now()
  WHERE user_id = v_uid;

  RETURN v_game_id;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_ai_training_game(text, text, text, text, text, integer, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_ai_training_game(text, text, text, text, text, integer, jsonb, text) TO authenticated;
