import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MarketingLayout } from "@/components/marketing-layout";
import { AppShell } from "@/components/app-shell";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({ meta: [{ title: "Leaderboard — ChessCoach Arena" }] }),
  component: LeaderboardRoute,
});

function LeaderboardRoute() {
  const { user } = useAuth();
  const Wrapper = user ? AppShell : MarketingLayout;
  return (
    <Wrapper>
      <PageContainer>
        <Leaderboard />
      </PageContainer>
    </Wrapper>
  );
}

function Leaderboard() {
  const { user, profile } = useAuth();
  const [rows, setRows] = useState<any[] | null>(null);

  useEffect(() => {
    supabase.from("profiles").select("*").order("rating", { ascending: false }).limit(50)
      .then(({ data }) => setRows(data || []));
  }, []);

  const myRank = rows && profile ? rows.findIndex((r) => r.user_id === profile.user_id) + 1 : 0;

  return (
    <>
      <PageHeader title="Leaderboard" subtitle="Top players by rating." />
      {profile && (
        <div className="card-surface p-5 mb-6 flex items-center justify-between bg-gradient-to-r from-primary-soft to-card">
          <div>
            <div className="text-xs font-semibold text-accent-foreground uppercase tracking-wider">Your position</div>
            <div className="font-display text-xl font-bold mt-1">
              {myRank > 0 ? `#${myRank}` : "Unranked"} • Rating {profile.rating}
            </div>
          </div>
          <Trophy className="h-8 w-8 text-primary opacity-60" />
        </div>
      )}

      {rows == null ? (
        <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState title="No players yet" description="Be the first to climb the leaderboard."
          action={<Button asChild><Link to="/play">Play a game</Link></Button>} />
      ) : (
        <div className="card-surface overflow-hidden">
          <div className="grid grid-cols-12 px-5 py-3 border-b text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30">
            <div className="col-span-1">#</div>
            <div className="col-span-6 sm:col-span-5">Player</div>
            <div className="col-span-3 sm:col-span-2 text-right">Rating</div>
            <div className="hidden sm:block sm:col-span-2 text-right">Games</div>
            <div className="col-span-2 text-right">Win %</div>
          </div>
          {rows.map((r, i) => {
            const wr = r.games_played > 0 ? Math.round((r.wins / r.games_played) * 100) : 0;
            const isMe = user && r.user_id === user.id;
            return (
              <div key={r.id} className={cn("grid grid-cols-12 px-5 py-3 border-b last:border-0 items-center text-sm",
                isMe && "bg-primary-soft/50")}>
                <div className="col-span-1 font-bold font-display">{i + 1}</div>
                <div className="col-span-6 sm:col-span-5">
                  <Link to="/u/$username" params={{ username: r.username }} className="font-medium hover:underline">{r.username}</Link>
                  {isMe && <span className="ml-2 text-xs text-primary font-semibold">You</span>}
                </div>
                <div className="col-span-3 sm:col-span-2 text-right font-bold font-display">{r.rating}</div>
                <div className="hidden sm:block sm:col-span-2 text-right text-muted-foreground">{r.games_played}</div>
                <div className="col-span-2 text-right text-muted-foreground">{wr}%</div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
