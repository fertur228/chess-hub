
-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  rating INTEGER NOT NULL DEFAULT 800,
  highest_rating INTEGER NOT NULL DEFAULT 800,
  games_played INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  draws INTEGER NOT NULL DEFAULT 0,
  skill_level TEXT,
  goal TEXT,
  onboarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- GAMES
CREATE TABLE public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_type TEXT NOT NULL CHECK (game_type IN ('AI Training', 'Casual', 'Ranked')),
  white_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  black_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  white_username TEXT,
  black_username TEXT,
  ai_difficulty TEXT,
  result TEXT NOT NULL CHECK (result IN ('white', 'black', 'draw')),
  end_reason TEXT,
  pgn TEXT,
  moves_count INTEGER NOT NULL DEFAULT 0,
  white_rating_before INTEGER,
  white_rating_after INTEGER,
  black_rating_before INTEGER,
  black_rating_after INTEGER,
  key_moments JSONB,
  coach_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Games viewable by everyone" ON public.games FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert games" ON public.games FOR INSERT
  WITH CHECK (auth.uid() = white_user_id OR auth.uid() = black_user_id);

-- ROOMS
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  host_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  host_username TEXT NOT NULL,
  guest_username TEXT,
  host_color TEXT NOT NULL DEFAULT 'random',
  white_user_id UUID,
  black_user_id UUID,
  white_username TEXT,
  black_username TEXT,
  game_mode TEXT NOT NULL DEFAULT 'casual' CHECK (game_mode IN ('ranked', 'casual')),
  time_control TEXT NOT NULL DEFAULT 'none',
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished', 'cancelled')),
  fen TEXT NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  pgn TEXT NOT NULL DEFAULT '',
  result TEXT,
  end_reason TEXT,
  draw_offer_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rooms viewable by everyone" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "Auth users create rooms" ON public.rooms FOR INSERT
  WITH CHECK (auth.uid() = host_user_id);
CREATE POLICY "Participants update rooms" ON public.rooms FOR UPDATE
  USING (auth.uid() = host_user_id OR auth.uid() = guest_user_id OR (status = 'waiting' AND guest_user_id IS NULL));

ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER TABLE public.rooms REPLICA IDENTITY FULL;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_username TEXT;
BEGIN
  v_username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
  -- Ensure unique username
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = v_username) LOOP
    v_username := v_username || floor(random() * 1000)::text;
  END LOOP;
  INSERT INTO public.profiles (user_id, username) VALUES (NEW.id, v_username);
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
