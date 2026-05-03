-- Phase 8B: Draw offers via trusted SECURITY DEFINER RPCs.
-- - offer_draw / respond_draw_offer: authenticated only; no client room UPDATE.
-- - Accept path finishes room then calls finalize_online_room_impl (service-only callable).
-- - finalize_online_room remains a thin service_role wrapper for Edge Functions.
-- - Trigger clears draw_offer_by when FEN changes while status stays playing (any move).

-- 1) Internal finalization (no JWT role check); called only from SQL by other definer functions.
CREATE OR REPLACE FUNCTION public.finalize_online_room_impl(p_room_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room public.rooms%ROWTYPE;
  v_result text;
  v_white_profile public.profiles%ROWTYPE;
  v_black_profile public.profiles%ROWTYPE;
  v_w_expected numeric;
  v_b_expected numeric;
  v_w_score numeric;
  v_b_score numeric;
  v_w_delta integer := 0;
  v_b_delta integer := 0;
  v_w_after integer;
  v_b_after integer;
  v_moves_count integer := 0;
  v_game_id uuid;
BEGIN
  SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  IF v_room.status <> 'finished' THEN
    RAISE EXCEPTION 'Room is not finished';
  END IF;

  IF v_room.finalized_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_finalized', 'game_id', v_room.game_id);
  END IF;

  IF v_room.white_user_id IS NULL OR v_room.black_user_id IS NULL THEN
    RAISE EXCEPTION 'Room missing seated players';
  END IF;

  v_result := CASE v_room.result
    WHEN 'white' THEN 'white'
    WHEN 'black' THEN 'black'
    WHEN 'draw' THEN 'draw'
    WHEN 'white_win' THEN 'white'
    WHEN 'black_win' THEN 'black'
    ELSE NULL
  END;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Room has invalid result for finalization: %', v_room.result;
  END IF;

  SELECT * INTO v_white_profile FROM public.profiles WHERE user_id = v_room.white_user_id FOR UPDATE;
  SELECT * INTO v_black_profile FROM public.profiles WHERE user_id = v_room.black_user_id FOR UPDATE;

  v_w_after := v_white_profile.rating;
  v_b_after := v_black_profile.rating;

  IF v_room.game_mode = 'ranked' THEN
    v_w_expected := 1.0 / (1.0 + power(10.0, (v_black_profile.rating - v_white_profile.rating) / 400.0));
    v_b_expected := 1.0 / (1.0 + power(10.0, (v_white_profile.rating - v_black_profile.rating) / 400.0));

    IF v_result = 'white' THEN
      v_w_score := 1.0; v_b_score := 0.0;
    ELSIF v_result = 'black' THEN
      v_w_score := 0.0; v_b_score := 1.0;
    ELSE
      v_w_score := 0.5; v_b_score := 0.5;
    END IF;

    v_w_delta := round(32.0 * (v_w_score - v_w_expected));
    v_b_delta := round(32.0 * (v_b_score - v_b_expected));
    v_w_after := v_white_profile.rating + v_w_delta;
    v_b_after := v_black_profile.rating + v_b_delta;

    UPDATE public.profiles
    SET rating = v_w_after,
        highest_rating = GREATEST(highest_rating, v_w_after),
        games_played = games_played + 1,
        wins = wins + CASE WHEN v_w_score = 1.0 THEN 1 ELSE 0 END,
        losses = losses + CASE WHEN v_w_score = 0.0 THEN 1 ELSE 0 END,
        draws = draws + CASE WHEN v_w_score = 0.5 THEN 1 ELSE 0 END
    WHERE user_id = v_room.white_user_id;

    UPDATE public.profiles
    SET rating = v_b_after,
        highest_rating = GREATEST(highest_rating, v_b_after),
        games_played = games_played + 1,
        wins = wins + CASE WHEN v_b_score = 1.0 THEN 1 ELSE 0 END,
        losses = losses + CASE WHEN v_b_score = 0.0 THEN 1 ELSE 0 END,
        draws = draws + CASE WHEN v_b_score = 0.5 THEN 1 ELSE 0 END
    WHERE user_id = v_room.black_user_id;
  ELSE
    UPDATE public.profiles
    SET games_played = games_played + 1,
        wins = wins + CASE WHEN v_result = 'white' THEN 1 ELSE 0 END,
        losses = losses + CASE WHEN v_result = 'black' THEN 1 ELSE 0 END,
        draws = draws + CASE WHEN v_result = 'draw' THEN 1 ELSE 0 END
    WHERE user_id = v_room.white_user_id;

    UPDATE public.profiles
    SET games_played = games_played + 1,
        wins = wins + CASE WHEN v_result = 'black' THEN 1 ELSE 0 END,
        losses = losses + CASE WHEN v_result = 'white' THEN 1 ELSE 0 END,
        draws = draws + CASE WHEN v_result = 'draw' THEN 1 ELSE 0 END
    WHERE user_id = v_room.black_user_id;
  END IF;

  INSERT INTO public.games (
    game_type, source_room_id, white_user_id, black_user_id, white_username, black_username,
    result, end_reason, pgn, moves_count,
    white_rating_before, white_rating_after, black_rating_before, black_rating_after
  ) VALUES (
    CASE WHEN v_room.game_mode = 'ranked' THEN 'Ranked' ELSE 'Casual' END,
    v_room.id, v_room.white_user_id, v_room.black_user_id, v_room.white_username, v_room.black_username,
    v_result, COALESCE(v_room.end_reason, 'unknown'), v_room.pgn, v_moves_count,
    CASE WHEN v_room.game_mode = 'ranked' THEN v_white_profile.rating ELSE NULL END,
    CASE WHEN v_room.game_mode = 'ranked' THEN v_w_after ELSE NULL END,
    CASE WHEN v_room.game_mode = 'ranked' THEN v_black_profile.rating ELSE NULL END,
    CASE WHEN v_room.game_mode = 'ranked' THEN v_b_after ELSE NULL END
  ) RETURNING id INTO v_game_id;

  IF v_room.game_mode = 'ranked' THEN
    INSERT INTO public.rating_events (game_id, room_id, user_id, rating_before, rating_after, rating_delta, reason)
    VALUES
      (v_game_id, v_room.id, v_room.white_user_id, v_white_profile.rating, v_w_after, v_w_delta, COALESCE(v_room.end_reason, 'game_over')),
      (v_game_id, v_room.id, v_room.black_user_id, v_black_profile.rating, v_b_after, v_b_delta, COALESCE(v_room.end_reason, 'game_over'));
  END IF;

  UPDATE public.rooms SET finalized_at = now(), game_id = v_game_id WHERE id = p_room_id;

  RETURN jsonb_build_object('status', 'finalized', 'game_id', v_game_id);
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_online_room_impl(uuid) FROM PUBLIC;

-- 2) Service-role entry point (Edge Functions) — unchanged semantics, delegates to impl.
CREATE OR REPLACE FUNCTION public.finalize_online_room(p_room_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' OR auth.role() = 'anon' THEN
    RAISE EXCEPTION 'Not authorized to finalize rooms directly';
  END IF;
  RETURN public.finalize_online_room_impl(p_room_id);
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_online_room(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_online_room(uuid) TO service_role;

-- 3) Draw offer — set draw_offer_by = auth.uid()
CREATE OR REPLACE FUNCTION public.offer_draw(p_room_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room public.rooms%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  IF v_room.status <> 'playing' THEN
    RAISE EXCEPTION 'DRAW_OFFER_INVALID_STATE';
  END IF;

  IF v_room.white_user_id IS DISTINCT FROM auth.uid() AND v_room.black_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;

  IF v_room.draw_offer_by IS NOT NULL AND v_room.draw_offer_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'DRAW_OFFER_RESPOND_FIRST';
  END IF;

  UPDATE public.rooms
  SET draw_offer_by = auth.uid(),
      updated_at = now()
  WHERE id = p_room_id;

  RETURN jsonb_build_object('status', 'offered', 'draw_offer_by', auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.offer_draw(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.offer_draw(uuid) TO authenticated;

-- 4) Accept or decline opponent draw offer (cannot respond to own offer)
CREATE OR REPLACE FUNCTION public.respond_draw_offer(p_room_id uuid, p_accept boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room public.rooms%ROWTYPE;
  v_final jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  IF v_room.status <> 'playing' THEN
    RAISE EXCEPTION 'DRAW_OFFER_INVALID_STATE';
  END IF;

  IF v_room.white_user_id IS DISTINCT FROM auth.uid() AND v_room.black_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;

  IF v_room.draw_offer_by IS NULL THEN
    RAISE EXCEPTION 'DRAW_OFFER_NONE';
  END IF;

  IF v_room.draw_offer_by = auth.uid() THEN
    RAISE EXCEPTION 'DRAW_OFFER_CANNOT_ACCEPT_OWN';
  END IF;

  IF NOT p_accept THEN
    UPDATE public.rooms
    SET draw_offer_by = NULL,
        updated_at = now()
    WHERE id = p_room_id;
    RETURN jsonb_build_object('status', 'declined');
  END IF;

  UPDATE public.rooms
  SET status = 'finished',
      result = 'draw',
      end_reason = 'draw_agreement',
      draw_offer_by = NULL,
      updated_at = now()
  WHERE id = p_room_id;

  v_final := public.finalize_online_room_impl(p_room_id);
  RETURN v_final;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_draw_offer(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_draw_offer(uuid, boolean) TO authenticated;

-- 5) Clear pending draw when a new move is recorded (FEN changes, still playing)
CREATE OR REPLACE FUNCTION public.clear_draw_offer_on_fen_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'playing'
     AND OLD.status = 'playing'
     AND NEW.fen IS DISTINCT FROM OLD.fen
     AND NEW.draw_offer_by IS NOT NULL
  THEN
    NEW.draw_offer_by := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rooms_clear_draw_offer_on_fen ON public.rooms;
CREATE TRIGGER trg_rooms_clear_draw_offer_on_fen
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_draw_offer_on_fen_change();
