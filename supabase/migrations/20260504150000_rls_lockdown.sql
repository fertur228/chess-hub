-- Phase 5C: RLS lockdown for room pieces and states
-- 1. Create trusted `cancel_room` RPC.
-- 2. Drop direct client UPDATE policies on `rooms` (Host & Guest).

-- ── 1. cancel_room RPC ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cancel_room(p_room_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_room public.rooms%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_room
  FROM public.rooms
  WHERE id = p_room_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room not found';
  END IF;

  IF v_room.status <> 'waiting' THEN
    RAISE EXCEPTION 'Room is not waiting';
  END IF;

  IF v_room.host_user_id <> v_uid THEN
    RAISE EXCEPTION 'Not authorized to cancel this room';
  END IF;

  UPDATE public.rooms
  SET status = 'cancelled',
      updated_at = now()
  WHERE id = p_room_id;

  RETURN jsonb_build_object(
    'room_id', p_room_id,
    'status', 'cancelled'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_room(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_room(uuid) TO authenticated;

-- ── 2. Drop direct client UPDATE policies ──────────────────────────────────────

DROP POLICY IF EXISTS "Host updates own room" ON public.rooms;
DROP POLICY IF EXISTS "Guest updates active room" ON public.rooms;
