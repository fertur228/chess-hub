import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";
import { PageContainer, PageHeader } from "@/components/page-header";
import { useCosmeticWallet } from "@/lib/cosmetic-wallet-context";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import {
  MOCK_COIN_PACKS,
  boardSkinStyles,
  mapCosmeticPurchaseError,
  mapMockPurchaseError,
} from "@/lib/cosmetics";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Coins, Info, Sparkles } from "lucide-react";

export const Route = createFileRoute("/store")({
  head: () => ({ meta: [{ title: "Store — ChessCoach Arena" }] }),
  component: () => (
    <RequireAuth>
      <AppShell>
        <StorePage />
      </AppShell>
    </RequireAuth>
  ),
});

type CosmeticItem = Tables<"cosmetic_items">;

function StorePage() {
  const { snapshot, loading: walletLoading, refresh } = useCosmeticWallet();
  const [items, setItems] = useState<CosmeticItem[] | null>(null);
  const [catalogLoad, setCatalogLoad] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("cosmetic_items")
        .select("*")
        .order("kind")
        .order("price_coins");
      if (cancelled) return;
      if (error) {
        console.error("[store] catalog", error);
        setItems([]);
      } else {
        setItems(data ?? []);
      }
      setCatalogLoad(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const ownedSet = useMemo(() => new Set(snapshot?.inventoryItemIds ?? []), [snapshot?.inventoryItemIds]);

  const boardSkins = useMemo(() => (items ?? []).filter((i) => i.kind === "board_skin"), [items]);
  const frames = useMemo(() => (items ?? []).filter((i) => i.kind === "avatar_frame"), [items]);

  const mockBuy = async (slug: (typeof MOCK_COIN_PACKS)[number]["slug"]) => {
    setBusyId(slug);
    const { data, error } = await supabase.rpc("mock_purchase_coins", { p_pack_slug: slug });
    setBusyId(null);
    if (error) {
      toast.error(mapMockPurchaseError(error.message));
      return;
    }
    const added = data && typeof data === "object" && "added" in data ? Number((data as { added: unknown }).added) : null;
    toast.success(added != null && !Number.isNaN(added) ? `Mock checkout complete — +${added} coins` : "Mock checkout complete");
    await refresh();
  };

  const buyCosmetic = async (id: string) => {
    setBusyId(id);
    const { error } = await supabase.rpc("purchase_cosmetic", { p_item_id: id });
    setBusyId(null);
    if (error) {
      toast.error(mapCosmeticPurchaseError(error.message));
      return;
    }
    toast.success("Purchase complete.");
    await refresh();
  };

  const equip = async (id: string) => {
    setBusyId(id);
    const { error } = await supabase.rpc("equip_cosmetic", { p_item_id: id });
    setBusyId(null);
    if (error) {
      toast.error(mapCosmeticPurchaseError(error.message));
      return;
    }
    toast.success("Equipped!");
    await refresh();
  };

  const balance = snapshot?.balance ?? null;
  const showWalletSkeleton = walletLoading && snapshot == null;

  return (
    <PageContainer>
      <PageHeader
        title="Cosmetic store"
        subtitle="Spend Arena Coins on board themes and avatar frames. Gameplay stays fair — cosmetics only."
      />

      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex gap-3 text-sm mb-6">
        <Info className="h-5 w-5 flex-shrink-0 text-amber-700 dark:text-amber-400" />
        <div>
          <p className="font-medium text-amber-950 dark:text-amber-100">Mock checkout — no real payment is processed in this demo.</p>
          <p className="text-muted-foreground mt-1">
            Coins are purchased with real money in production. This demo uses mock checkout and does not process real payments.
          </p>
        </div>
      </div>

      <div className="card-surface p-5 md:p-6 mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-accent-foreground">
            <Coins className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your balance</div>
            {showWalletSkeleton ? (
              <Skeleton className="h-9 w-28 mt-1" />
            ) : (
              <div className="font-display text-3xl font-bold">{balance ?? "—"}</div>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={walletLoading}>
          Refresh
        </Button>
      </div>

      <section className="mb-10">
        <h2 className="font-display text-xl font-bold mb-3 flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Mock coin packs
        </h2>
        <p className="text-sm text-muted-foreground mb-4">One-click demo top-up — recorded as <code className="text-xs">mock_coin_purchase</code> in your transaction history.</p>
        <div className="grid sm:grid-cols-3 gap-4">
          {MOCK_COIN_PACKS.map((pack) => (
            <div key={pack.slug} className="card-surface p-5 flex flex-col gap-3">
              <div className="font-display text-2xl font-bold">{pack.coins}</div>
              <div className="text-sm text-muted-foreground">coins • {pack.usdLabel} mock</div>
              <Button
                className="w-full mt-auto"
                disabled={busyId != null || showWalletSkeleton}
                onClick={() => void mockBuy(pack.slug)}
              >
                {busyId === pack.slug ? "Working…" : "Mock Buy"}
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="font-display text-xl font-bold mb-4">Board skins</h2>
        {catalogLoad ? (
          <div className="grid sm:grid-cols-3 gap-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-48 w-full" />)}</div>
        ) : (
          <div className="grid sm:grid-cols-3 gap-4">
            {boardSkins.map((item) => {
              const owned = ownedSet.has(item.id);
              const equipped = item.slug === snapshot?.activeBoardSkinSlug;
              const canBuy = balance != null && !owned && balance >= item.price_coins;
              return (
                <CosmeticCard
                  key={item.id}
                  title={item.name}
                  description={item.description}
                  price={item.price_coins}
                  busy={busyId === item.id}
                  preview={<BoardSwatch slug={item.slug} />}
                  actions={
                    <>
                      {!owned && (
                        <Button
                          className="flex-1"
                          disabled={!canBuy || busyId != null || showWalletSkeleton}
                          onClick={() => void buyCosmetic(item.id)}
                        >
                          Buy
                        </Button>
                      )}
                      {owned && !equipped && (
                        <Button className="flex-1" variant="secondary" disabled={busyId != null} onClick={() => void equip(item.id)}>
                          Equip
                        </Button>
                      )}
                      {owned && equipped && (
                        <Button className="flex-1" variant="outline" disabled>
                          Equipped
                        </Button>
                      )}
                    </>
                  }
                />
              );
            })}
          </div>
        )}
      </section>

      <section className="mb-10">
        <h2 className="font-display text-xl font-bold mb-4">Avatar frames</h2>
        {catalogLoad ? (
          <div className="grid sm:grid-cols-3 gap-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-44 w-full" />)}</div>
        ) : (
          <div className="grid sm:grid-cols-3 gap-4">
            {frames.map((item) => {
              const owned = ownedSet.has(item.id);
              const equipped = item.slug === snapshot?.activeAvatarFrameSlug;
              const canBuy = balance != null && !owned && balance >= item.price_coins;
              return (
                <CosmeticCard
                  key={item.id}
                  title={item.name}
                  description={item.description}
                  price={item.price_coins}
                  busy={busyId === item.id}
                  preview={<FrameSwatch slug={item.slug} />}
                  actions={
                    <>
                      {!owned && (
                        <Button
                          className="flex-1"
                          disabled={!canBuy || busyId != null || showWalletSkeleton}
                          onClick={() => void buyCosmetic(item.id)}
                        >
                          Buy
                        </Button>
                      )}
                      {owned && !equipped && (
                        <Button className="flex-1" variant="secondary" disabled={busyId != null} onClick={() => void equip(item.id)}>
                          Equip
                        </Button>
                      )}
                      {owned && equipped && (
                        <Button className="flex-1" variant="outline" disabled>
                          Equipped
                        </Button>
                      )}
                    </>
                  }
                />
              );
            })}
          </div>
        )}
      </section>

      <p className="text-sm text-muted-foreground text-center">
        Core play and learning features stay free. <Link to="/pricing" className="underline font-medium">See pricing</Link> for subscription plans.
      </p>
    </PageContainer>
  );
}

function CosmeticCard({
  title,
  description,
  price,
  preview,
  actions,
  busy,
}: {
  title: string;
  description: string | null;
  price: number;
  preview: ReactNode;
  actions: ReactNode;
  busy: boolean;
}) {
  return (
    <div className={cn("card-surface p-5 flex flex-col gap-3", busy && "opacity-80")}>
      <div className="flex justify-center">{preview}</div>
      <div>
        <div className="font-display font-semibold text-lg">{title}</div>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      <div className="flex items-center justify-between text-sm mt-auto pt-2 border-t">
        <span className="inline-flex items-center gap-1 font-semibold">
          <Coins className="h-4 w-4" /> {price}
        </span>
      </div>
      <div className="flex gap-2">{actions}</div>
    </div>
  );
}

function BoardSwatch({ slug }: { slug: string }) {
  const s = boardSkinStyles(slug);
  return (
    <div className="rounded-md overflow-hidden flex shadow-sm border w-24 h-24" style={s.boardStyle}>
      <div className="flex-1 grid grid-rows-2">
        <div className="grid grid-cols-2">
          <div style={s.lightSquareStyle} />
          <div style={s.darkSquareStyle} />
        </div>
        <div className="grid grid-cols-2">
          <div style={s.darkSquareStyle} />
          <div style={s.lightSquareStyle} />
        </div>
      </div>
    </div>
  );
}

function FrameSwatch({ slug }: { slug: string }) {
  const ring =
    slug === "bronze_ring"
      ? "ring-4 ring-amber-700/70"
      : slug === "crystal_frame"
        ? "ring-4 ring-cyan-400/80 shadow-[0_0_10px_rgba(34,211,238,0.4)]"
        : slug === "crown_frame"
          ? "ring-4 ring-yellow-500/80"
          : "ring-2 ring-muted";
  return (
    <div className={cn("rounded-full p-1", ring)}>
      <div className="h-14 w-14 rounded-full bg-gradient-to-br from-primary-soft to-primary/40 flex items-center justify-center text-lg font-bold">
        ♔
      </div>
    </div>
  );
}
