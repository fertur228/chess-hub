-- Phase 8C: Mock coins + cosmetic store (no real payments). All mutations via SECURITY DEFINER RPCs.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
CREATE TABLE public.cosmetic_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('board_skin', 'avatar_frame')),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  price_coins integer NOT NULL CHECK (price_coins >= 0),
  preview_class text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 500 CHECK (balance >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.coin_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  transaction_type text NOT NULL
    CHECK (transaction_type IN ('starting_grant', 'mock_coin_purchase', 'cosmetic_purchase')),
  amount integer NOT NULL,
  balance_after integer,
  cosmetic_item_id uuid REFERENCES public.cosmetic_items (id) ON DELETE SET NULL,
  mock_price_cents integer,
  mock_currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'completed',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX coin_transactions_user_created_idx ON public.coin_transactions (user_id, created_at DESC);

CREATE TABLE public.user_cosmetics (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  cosmetic_item_id uuid NOT NULL REFERENCES public.cosmetic_items (id) ON DELETE CASCADE,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, cosmetic_item_id)
);

CREATE TABLE public.user_cosmetic_loadouts (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  active_board_skin_id uuid REFERENCES public.cosmetic_items (id) ON DELETE SET NULL,
  active_avatar_frame_id uuid REFERENCES public.cosmetic_items (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Kind validity enforced in equip_cosmetic / purchase RPCs only.

CREATE TRIGGER update_user_wallets_updated_at
  BEFORE UPDATE ON public.user_wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_cosmetic_loadouts_updated_at
  BEFORE UPDATE ON public.user_cosmetic_loadouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.cosmetic_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_cosmetics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_cosmetic_loadouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY cosmetic_items_select_active ON public.cosmetic_items
  FOR SELECT USING (is_active = true);

CREATE POLICY user_wallets_select_own ON public.user_wallets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY coin_transactions_select_own ON public.coin_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY user_cosmetics_select_own ON public.user_cosmetics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY user_cosmetic_loadouts_select_own ON public.user_cosmetic_loadouts
  FOR SELECT USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Seed catalog (stable slugs for RPC packs + UI)
-- ---------------------------------------------------------------------------
INSERT INTO public.cosmetic_items (kind, slug, name, description, price_coins, preview_class, metadata) VALUES
  ('board_skin', 'classic_walnut', 'Classic Walnut', 'Warm wood tones for the board.', 150, 'skin-classic-walnut', '{}'),
  ('board_skin', 'neon_arena', 'Neon Arena', 'Electric cyberpunk squares.', 250, 'skin-neon-arena', '{}'),
  ('board_skin', 'royal_marble', 'Royal Marble', 'Cool marble elegance.', 400, 'skin-royal-marble', '{}'),
  ('avatar_frame', 'bronze_ring', 'Bronze Ring', 'A warm bronze frame for your avatar.', 100, 'frame-bronze-ring', '{}'),
  ('avatar_frame', 'crystal_frame', 'Crystal Frame', 'Icy crystal highlight.', 200, 'frame-crystal', '{}'),
  ('avatar_frame', 'crown_frame', 'Crown Frame', 'Regal gold accent.', 350, 'frame-crown', '{}');

-- ---------------------------------------------------------------------------
-- Backfill wallets + loadouts + starting_grant for existing profiles
-- ---------------------------------------------------------------------------
INSERT INTO public.user_wallets (user_id, balance)
SELECT p.user_id, 500
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.user_wallets w WHERE w.user_id = p.user_id);

INSERT INTO public.user_cosmetic_loadouts (user_id)
SELECT p.user_id
FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.user_cosmetic_loadouts l WHERE l.user_id = p.user_id);

INSERT INTO public.coin_transactions (
  user_id, transaction_type, amount, balance_after, status, metadata
)
SELECT w.user_id, 'starting_grant', 500, w.balance, 'completed',
  jsonb_build_object('source', 'migration_backfill', 'phase', '8c')
FROM public.user_wallets w
WHERE NOT EXISTS (
  SELECT 1 FROM public.coin_transactions c
  WHERE c.user_id = w.user_id AND c.transaction_type = 'starting_grant'
);

-- ---------------------------------------------------------------------------
-- New users: extend handle_new_user
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username TEXT;
BEGIN
  v_username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = v_username) LOOP
    v_username := v_username || floor(random() * 1000)::text;
  END LOOP;

  INSERT INTO public.profiles (user_id, username) VALUES (NEW.id, v_username);

  INSERT INTO public.user_wallets (user_id, balance) VALUES (NEW.id, 500);
  INSERT INTO public.user_cosmetic_loadouts (user_id) VALUES (NEW.id);
  INSERT INTO public.coin_transactions (
    user_id, transaction_type, amount, balance_after, status, metadata
  ) VALUES (
    NEW.id,
    'starting_grant',
    500,
    500,
    'completed',
    jsonb_build_object('source', 'signup')
  );

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: ensure_my_wallet (+ loadout row)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_my_wallet()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_bal integer;
  v_inv jsonb;
  v_board_slug text;
  v_frame_slug text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_wallets WHERE user_id = v_uid) THEN
    INSERT INTO public.user_wallets (user_id, balance) VALUES (v_uid, 500);
    INSERT INTO public.coin_transactions (
      user_id, transaction_type, amount, balance_after, status, metadata
    ) VALUES (
      v_uid, 'starting_grant', 500, 500, 'completed', jsonb_build_object('source', 'ensure_my_wallet')
    );
  END IF;

  INSERT INTO public.user_cosmetic_loadouts (user_id) VALUES (v_uid)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT w.balance INTO v_bal FROM public.user_wallets w WHERE w.user_id = v_uid FOR UPDATE;

  SELECT jsonb_agg(uc.cosmetic_item_id ORDER BY uc.acquired_at)
  INTO v_inv
  FROM public.user_cosmetics uc
  WHERE uc.user_id = v_uid;

  SELECT bs.slug, af.slug
  INTO v_board_slug, v_frame_slug
  FROM public.user_cosmetic_loadouts l
  LEFT JOIN public.cosmetic_items bs ON bs.id = l.active_board_skin_id
  LEFT JOIN public.cosmetic_items af ON af.id = l.active_avatar_frame_id
  WHERE l.user_id = v_uid;

  RETURN jsonb_build_object(
    'balance', v_bal,
    'inventory_item_ids', COALESCE(v_inv, '[]'::jsonb),
    'active_board_skin_slug', v_board_slug,
    'active_avatar_frame_slug', v_frame_slug
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: mock_purchase_coins
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mock_purchase_coins(p_pack_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_amt integer;
  v_cents integer;
  v_bal integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  CASE p_pack_slug
    WHEN 'coins_500_mock_099' THEN v_amt := 500; v_cents := 99;
    WHEN 'coins_1200_mock_199' THEN v_amt := 1200; v_cents := 199;
    WHEN 'coins_3000_mock_499' THEN v_amt := 3000; v_cents := 499;
    ELSE RAISE EXCEPTION 'INVALID_PACK_SLUG';
  END CASE;

  SELECT balance INTO v_bal FROM public.user_wallets WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'WALLET_MISSING';
  END IF;

  v_bal := v_bal + v_amt;

  UPDATE public.user_wallets SET balance = v_bal, updated_at = now() WHERE user_id = v_uid;

  INSERT INTO public.coin_transactions (
    user_id, transaction_type, amount, balance_after, mock_price_cents, status, metadata
  ) VALUES (
    v_uid,
    'mock_coin_purchase',
    v_amt,
    v_bal,
    v_cents,
    'mock_paid',
    jsonb_build_object('demo', true, 'pack_slug', p_pack_slug, 'disclaimer', 'No real payment processed')
  );

  RETURN jsonb_build_object('balance', v_bal, 'added', v_amt);
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: purchase_cosmetic
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purchase_cosmetic(p_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_item public.cosmetic_items%ROWTYPE;
  v_bal integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_item FROM public.cosmetic_items WHERE id = p_item_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ITEM_NOT_FOUND';
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_cosmetics WHERE user_id = v_uid AND cosmetic_item_id = p_item_id) THEN
    RAISE EXCEPTION 'ALREADY_OWNED';
  END IF;

  SELECT balance INTO v_bal FROM public.user_wallets WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'WALLET_MISSING';
  END IF;

  IF v_bal < v_item.price_coins THEN
    RAISE EXCEPTION 'INSUFFICIENT_FUNDS';
  END IF;

  v_bal := v_bal - v_item.price_coins;

  UPDATE public.user_wallets SET balance = v_bal, updated_at = now() WHERE user_id = v_uid;

  INSERT INTO public.user_cosmetics (user_id, cosmetic_item_id) VALUES (v_uid, p_item_id);

  INSERT INTO public.coin_transactions (
    user_id, transaction_type, amount, balance_after, cosmetic_item_id, status, metadata
  ) VALUES (
    v_uid,
    'cosmetic_purchase',
    -v_item.price_coins,
    v_bal,
    p_item_id,
    'completed',
    jsonb_build_object('slug', v_item.slug, 'kind', v_item.kind)
  );

  RETURN jsonb_build_object('balance', v_bal, 'item_id', p_item_id, 'slug', v_item.slug);
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC: equip_cosmetic
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.equip_cosmetic(p_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_item public.cosmetic_items%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_cosmetics WHERE user_id = v_uid AND cosmetic_item_id = p_item_id) THEN
    RAISE EXCEPTION 'NOT_OWNED';
  END IF;

  SELECT * INTO v_item FROM public.cosmetic_items WHERE id = p_item_id AND is_active = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ITEM_NOT_FOUND';
  END IF;

  INSERT INTO public.user_cosmetic_loadouts (user_id) VALUES (v_uid)
  ON CONFLICT (user_id) DO NOTHING;

  IF v_item.kind = 'board_skin' THEN
    UPDATE public.user_cosmetic_loadouts
    SET active_board_skin_id = p_item_id, updated_at = now()
    WHERE user_id = v_uid;
  ELSIF v_item.kind = 'avatar_frame' THEN
    UPDATE public.user_cosmetic_loadouts
    SET active_avatar_frame_id = p_item_id, updated_at = now()
    WHERE user_id = v_uid;
  ELSE
    RAISE EXCEPTION 'INVALID_ITEM_KIND';
  END IF;

  RETURN public.ensure_my_wallet();
END;
$$;

-- Grants
REVOKE ALL ON FUNCTION public.ensure_my_wallet() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_my_wallet() TO authenticated;

REVOKE ALL ON FUNCTION public.mock_purchase_coins(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mock_purchase_coins(text) TO authenticated;

REVOKE ALL ON FUNCTION public.purchase_cosmetic(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purchase_cosmetic(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.equip_cosmetic(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.equip_cosmetic(uuid) TO authenticated;
