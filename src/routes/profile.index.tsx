import { createFileRoute, Link } from "@tanstack/react-router";
import { PageContainer, PageHeader } from "@/components/page-header";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { GameRow } from "./dashboard";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Edit, Sparkles } from "lucide-react";

export const Route = createFileRoute("/profile/")({
  head: () => ({ meta: [{ title: "Profile - ChessCoach Arena" }] }),
  component: ProfilePage,
});

function leagueName(rating: number) {
  if (rating < 900) return "Bronze";
  if (rating < 1100) return "Silver";
  if (rating < 1400) return "Gold";
  if (rating < 1700) return "Platinum";
  return "Diamond";
}

function ProfilePage() {
  const { user, profile, loading } = useAuth();
  const [games, setGames] = useState<any[] | null>(null);

  useEffect(() => {
    if (!user) {
      setGames([]);
      return;
    }
    supabase.from("games").select("*").or(`white_user_id.eq.${user.id},black_user_id.eq.${user.id}`)
      .order("created_at", { ascending: false }).limit(5).then(({ data, error }) => {
        if (error) {
          console.error("[Profile] Failed to load recent games", error);
          setGames([]);
          return;
        }
        setGames(data || []);
      });
  }, [user]);

  if (loading || !profile || !user) {
    return (
      <PageContainer>
        <PageHeader title="Profile" subtitle="Your identity, rating, and progress." />
        <div className="space-y-6">
          <Skeleton className="h-36 w-full" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </PageContainer>
    );
  }
  const winRate = profile.games_played > 0 ? Math.round((profile.wins / profile.games_played) * 100) : 0;

  return (
    <PageContainer>
      <PageHeader title="Profile" subtitle="Your identity, rating, and progress." />

      <div className="card-surface p-6 md:p-8 mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-3xl font-display font-bold">
            {profile.username.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h2 className="font-display text-2xl font-bold">{profile.username}</h2>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-soft text-accent-foreground text-sm font-semibold">
                <Trophy className="h-3.5 w-3.5" /> {profile.rating}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-warning/20 text-warning-foreground text-sm font-semibold">
                {leagueName(profile.rating)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">Member since {new Date(profile.created_at).toLocaleDateString()}</p>
          </div>
          <Button asChild variant="outline"><Link to="/profile/edit"><Edit className="h-4 w-4 mr-1.5" />Edit profile</Link></Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <StatBox label="Highest rating" value={profile.highest_rating} />
        <StatBox label="Games played" value={profile.games_played} />
        <StatBox label="Wins" value={profile.wins} />
        <StatBox label="Win rate" value={`${winRate}%`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card-surface p-6">
          <h3 className="font-display text-lg font-semibold mb-4">Recent games</h3>
          {games == null ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : games.length === 0 ? (
            <EmptyState title="Your chess profile will grow as you play more games"
              description="Play a game to see recent matches here."
              action={<Button asChild><Link to="/play/ai">Play first game</Link></Button>} />
          ) : (
            <div className="space-y-2">{games.map((g) => <GameRow key={g.id} g={g} uid={user.id} />)}</div>
          )}
        </div>
        <div className="card-surface p-6 bg-gradient-to-br from-primary-soft to-card">
          <div className="flex items-center gap-2 text-xs font-semibold text-accent-foreground uppercase tracking-wide mb-2">
            <Sparkles className="h-3.5 w-3.5" /> Player style
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {["Aggressive opener", "Improving consistency", "Often loses material"].map((tag) => (
              <span key={tag} className="px-3 py-1 rounded-full bg-card border text-sm font-medium">{tag}</span>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-4">Tags update as you play more games.</p>
        </div>
      </div>
    </PageContainer>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card-surface p-4">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="font-display text-2xl font-bold mt-1.5">{value}</div>
    </div>
  );
}
