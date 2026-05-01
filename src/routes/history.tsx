import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";
import { PageContainer, PageHeader } from "@/components/page-header";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { GameRow } from "./dashboard";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { History as HistoryIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "History — ChessCoach Arena" }] }),
  component: () => <RequireAuth><AppShell><HistoryPage /></AppShell></RequireAuth>,
});

const filters = ["All", "Ranked", "Casual", "AI Training", "Wins", "Losses", "Draws"] as const;
type Filter = typeof filters[number];

function HistoryPage() {
  const { user } = useAuth();
  const [games, setGames] = useState<any[] | null>(null);
  const [filter, setFilter] = useState<Filter>("All");

  useEffect(() => {
    if (!user) return;
    supabase.from("games").select("*").or(`white_user_id.eq.${user.id},black_user_id.eq.${user.id}`)
      .order("created_at", { ascending: false }).limit(100).then(({ data }) => setGames(data || []));
  }, [user]);

  const filtered = (games || []).filter((g) => {
    if (filter === "All") return true;
    if (filter === "Ranked" || filter === "Casual" || filter === "AI Training") return g.game_type === filter;
    const isWhite = g.white_user_id === user!.id;
    const won = (g.result === "white" && isWhite) || (g.result === "black" && !isWhite);
    if (filter === "Wins") return g.result !== "draw" && won;
    if (filter === "Losses") return g.result !== "draw" && !won;
    if (filter === "Draws") return g.result === "draw";
    return true;
  });

  return (
    <PageContainer>
      <PageHeader title="Game history" subtitle="Every game you've played, in one place." />
      <div className="flex gap-2 flex-wrap mb-6">
        {filters.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn("px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
              filter === f ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted")}>
            {f}
          </button>
        ))}
      </div>
      {games == null ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<HistoryIcon className="h-5 w-5" />} title="Your game history is empty"
          description="Play a game to see it here." action={<Button asChild><Link to="/play">Start a game</Link></Button>} />
      ) : (
        <div className="space-y-2">{filtered.map((g) => <GameRow key={g.id} g={g} uid={user!.id} />)}</div>
      )}
    </PageContainer>
  );
}
