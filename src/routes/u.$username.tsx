import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { MarketingLayout } from "@/components/marketing-layout";
import { AppShell } from "@/components/app-shell";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Trophy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/u/$username")({
  head: () => ({ meta: [{ title: "Player profile — ChessCoach Arena" }] }),
  component: PublicProfileRoute,
});

function PublicProfileRoute() {
  const { user } = useAuth();
  const Wrapper = user ? AppShell : MarketingLayout;
  return <Wrapper><PageContainer><PublicProfile /></PageContainer></Wrapper>;
}

function PublicProfile() {
  const { username } = Route.useParams();
  const [p, setP] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("profiles").select("id,user_id,username,rating,highest_rating,games_played,wins,losses,draws,created_at")
      .eq("username", username).maybeSingle().then(({ data }) => { setP(data); setLoading(false); });
  }, [username]);

  if (loading) return <Skeleton className="h-40 w-full" />;
  if (!p) return <div className="text-center py-12 text-muted-foreground">Player not found.</div>;

  const wr = p.games_played > 0 ? Math.round((p.wins / p.games_played) * 100) : 0;

  return (
    <>
      <PageHeader title={p.username} subtitle="Public player profile." />
      <div className="card-surface p-6 md:p-8 mb-6">
        <div className="flex items-center gap-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-2xl font-display font-bold">
            {p.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold">{p.username}</h2>
            <div className="flex items-center gap-1.5 mt-1 text-primary font-semibold">
              <Trophy className="h-4 w-4" /> Rating {p.rating}
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Highest" value={p.highest_rating} />
        <Stat label="Games" value={p.games_played} />
        <Stat label="Wins" value={p.wins} />
        <Stat label="Win rate" value={`${wr}%`} />
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card-surface p-4">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="font-display text-2xl font-bold mt-1.5">{value}</div>
    </div>
  );
}
