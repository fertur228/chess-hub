-- Phase 6C Profile stats/RLS hardening

-- 1. Create secure update RPC
CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_username text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL,
  p_skill_level text DEFAULT NULL,
  p_goal text DEFAULT NULL,
  p_onboarded boolean DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.profiles
  SET
    username = COALESCE(p_username, username),
    avatar_url = COALESCE(p_avatar_url, avatar_url),
    skill_level = COALESCE(p_skill_level, skill_level),
    goal = COALESCE(p_goal, goal),
    onboarded = COALESCE(p_onboarded, onboarded),
    updated_at = now()
  WHERE user_id = auth.uid()
  RETURNING * INTO v_profile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  RETURN v_profile;
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_profile(text, text, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_profile(text, text, text, text, boolean) TO authenticated;

-- 2. Drop direct UPDATE UI access
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
