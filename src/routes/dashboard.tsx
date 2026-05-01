import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";
import { PageContainer } from "@/components/page-header";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Bot, Swords, Sparkles, TrendingUp, Trophy, Users } from "lucide-react";
import { GameTypeBadge, ResultBadge, RatingDelta } from "@/components/badges";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — ChessCoach Arena" }] }),
  component: () => <RequireAuth><AppShell><Dashboard /></AppShell></RequireAuth>,
});

type Game = {
  id: string; game_type: string; result: string; moves_count: number; created_at: string;
  white_user_id: string | null; black_user_id: string | null;
  white_username: string | null; black_username: string | null; ai_difficulty: string | null;
  white_rating_before: number | null; white_rating_after: number | null;
  black_rating_before: number | null; black_rating_after: number | null;
};

export function gameForUser(g: Game, uid: string) {
  const isWhite = g.white_user_id === uid;
  const opponent = isWhite ? (g.black_username || "Coach Bot") : (g.white_username || "Opponent");
  let result: "win" | "loss" | "draw" = "draw";
  if (g.result === "draw") result = "draw";
  else if ((g.result === "white" && isWhite) || (g.result === "black" && !isWhite)) result = "win";
  else result = "loss";
  let delta: number | null = null;
  if (g.game_type === "Ranked") {
    if (isWhite && g.white_rating_after != null && g.white_rating_before != null) delta = g.white_rating_after - g.white_rating_before;
    if (!isWhite && g.black_rating_after != null && g.black_rating_before != null) delta = g.black_rating_after - g.black_rating_before;
  }
  return { opponent, result, delta };
}

function Dashboard() {
  const { user, profile } = useAuth();
  const [games, setGames] = useState<Game[] | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("games").select("*").or(`white_user_id.eq.${user.id},black_user_id.eq.${user.id}`)
      .order("created_at", { ascending: false }).limit(5).then(({ data }) => setGames((data || []) as Game[]));
  }, [user]);

  if (!profile) return null;

  const winRate = profile.games_played > 0 ? Math.round((profile.wins / profile.games_played) * 100) : 0;
  const lastRanked = games?.find((g) => g.game_type === "Ranked");
  const lastDelta = lastRanked && user ? gameForUser(lastRanked, user.id).delta : null;

  return (
    <PageContainer>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back</p>
          <h1 className="font-display text-3xl font-bold mt-1">{profile.username}</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild size="lg"><Link to="/play"><Swords className="h-4 w-4 mr-1.5" />Play online</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/play/ai"><Bot className="h-4 w-4 mr-1.5" />Play vs AI</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
        <StatCard label="Current rating" value={profile.rating} icon={Trophy} />
        <StatCard label="Games played" value={profile.games_played} icon={Swords} />
        <StatCard label="Win rate" value={`${winRate}%`} icon={TrendingUp} />
        <StatCard label="Last rating change" value={lastDelta != null ? `${lastDelta > 0 ? "+" : ""}${lastDelta}` : "—"}
          icon={Sparkles} valueClass={lastDelta == null ? "" : lastDelta > 0 ? "text-success" : lastDelta < 0 ? "text-destructive" : ""} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card-surface p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold">Recent games</h2>
            <Button asChild variant="ghost" size="sm"><Link to="/history">View all</Link></Button>
          </div>
          {games == null ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : games.length === 0 ? (
            <EmptyState icon={<Swords className="h-5 w-5" />} title="You have not played any games yet"
              description="Start your first match to build your chess profile." action={<Button asChild><Link to="/play/ai">Play first game</Link></Button>} />
          ) : (
            <div className="space-y-2">{games.map((g) => <GameRow key={g.id} g={g} uid={user!.id} />)}</div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card-surface p-6 bg-gradient-to-br from-primary-soft to-card">
            <div className="flex items-center gap-2 text-xs font-semibold text-accent-foreground uppercase tracking-wide mb-2">
              <Sparkles className="h-3.5 w-3.5" /> Coach insight
            </div>
            <p className="font-medium">Your current focus: protect your pieces before attacking.</p>
            <p className="text-sm text-muted-foreground mt-2">Look at every move with one question: "Is anything I own under attack?"</p>
          </div>
          <div className="card-surface p-6">
            <h3 className="font-semibold mb-3">Quick actions</h3>
            <div className="space-y-2">
              <Button asChild variant="outline" className="w-full justify-start"><Link to="/play"><Users className="h-4 w-4 mr-2" />Create online room</Link></Button>
              <Button asChild variant="outline" className="w-full justify-start"><Link to="/leaderboard"><Trophy className="h-4 w-4 mr-2" />View leaderboard</Link></Button>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

function StatCard({ label, value, icon: Icon, valueClass = "" }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; valueClass?: string; }) {
  return (
    <div className="card-surface p-4 md:p-5">
      <div className="flex items-start justify-between">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</div>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className={`font-display text-2xl md:text-3xl font-bold mt-2 ${valueClass}`}>{value}</div>
    </div>
  );
}

export function GameRow({ g, uid }: { g: Game; uid: string }) {
  const { opponent, result, delta } = gameForUser(g, uid);
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <ResultBadge result={result} />
        <div className="min-w-0">
          <div className="font-medium truncate">vs {opponent}{g.ai_difficulty ? ` (${g.ai_difficulty})` : ""}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
            <GameTypeBadge type={g.game_type} />
            <span>{g.moves_count} moves</span>
            <span>•</span>
            <span>{new Date(g.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {g.game_type === "Ranked" && <RatingDelta delta={delta} />}
        <Button asChild size="sm" variant="ghost"><Link to="/review/$gameId" params={{ gameId: g.id }}>Review</Link></Button>
      </div>
    </div>
  );
}
