import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { parseWalletRpc, type WalletSnapshot } from "@/lib/cosmetics";

type CosmeticWalletValue = {
  snapshot: WalletSnapshot | null;
  loading: boolean;
  refresh: () => Promise<WalletSnapshot | null>;
};

const CosmeticWalletContext = createContext<CosmeticWalletValue | null>(null);

export function CosmeticWalletProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [snapshot, setSnapshot] = useState<WalletSnapshot | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setSnapshot(null);
      setLoading(false);
      return null;
    }
    const { data, error } = await supabase.rpc("ensure_my_wallet");
    if (error) {
      console.error("[ensure_my_wallet]", error);
      setSnapshot(null);
      setLoading(false);
      return null;
    }
    const snap = parseWalletRpc(data);
    setSnapshot(snap);
    setLoading(false);
    return snap;
  }, [user]);

  useEffect(() => {
    if (!user) {
      setSnapshot(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    void refresh();
  }, [user, refresh]);

  return (
    <CosmeticWalletContext.Provider value={{ snapshot, loading, refresh }}>
      {children}
    </CosmeticWalletContext.Provider>
  );
}

export function useCosmeticWallet(): CosmeticWalletValue {
  const ctx = useContext(CosmeticWalletContext);
  if (!ctx) {
    throw new Error("useCosmeticWallet must be used inside CosmeticWalletProvider (AppShell)");
  }
  return ctx;
}
