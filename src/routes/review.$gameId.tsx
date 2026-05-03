import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";
import { PageContainer } from "@/components/page-header";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { gameForUser } from "./dashboard";
import { GameTypeBadge, ResultBadge } from "@/components/badges";
import { Sparkles } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/review/$gameId")({
  head: () => ({ meta: [{ title: "Game review — ChessCoach Arena" }] }),
  component: () => (
    <RequireAuth>
      <AppShell>
        <Review />
      </AppShell>
    </RequireAuth>
  ),
});

function parseKeyMoments(raw: Tables<"games">["Row"]["key_moments"]): { title: string; text: string }[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (item && typeof item === "object" && "title" in item && "text" in item) {
        const title = String((item as { title: unknown }).title);
        const text = String((item as { text: unknown }).text);
        return { title, text };
      }
      return null;
    })
    .filter((x): x is { title: string; text: string } => x != null);
}

function Review() {
  const { gameId } = Route.useParams();
  const { user } = useAuth();
  const [g, setG] = useState<Tables<"games">["Row"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    supabase
      .from("games")
      .select("*")
      .eq("id", gameId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setLoadError(error.message);
          setG(null);
        } else {
          setG(data);
        }
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [gameId]);

  if (loading) {
    return (
      <PageContainer>
        <Skeleton className="h-96 w-full" />
      </PageContainer>
    );
  }

  if (loadError) {
    return (
      <PageContainer>
        <div className="max-w-md mx-auto text-center py-12 space-y-4">
          <p className="text-destructive font-medium">Could not load this review</p>
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <Button asChild variant="outline">
            <Link to="/history">Back to history</Link>
          </Button>
        </div>
      </PageContainer>
    );
  }

  if (!g) {
    return (
      <PageContainer>
        <div className="text-center text-muted-foreground py-12 max-w-md mx-auto space-y-4">
          <p>We could not find that game. It may have been removed, or the link is incorrect.</p>
          <Button asChild variant="outline">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </PageContainer>
    );
  }

  const { opponent, result, delta } = user ? gameForUser(g, user.id) : { opponent: "Opponent", result: "draw" as const, delta: null };
  let moments = parseKeyMoments(g.key_moments);
  if (moments.length === 0) {
    moments = [
      {
        title: "Overview",
        text:
          g.game_type === "AI Training"
            ? "This was an AI training game. Replay the moves on the board mentally and look for one tactic you missed."
            : "Review data was not stored in detail for this game. Open your move list from memory and note one improvement for next time.",
      },
    ];
  }
  const isWhite = g.white_user_id === user?.id;
  const ratingBefore = isWhite ? g.white_rating_before : g.black_rating_before;
  const ratingAfter = isWhite ? g.white_rating_after : g.black_rating_after;
  const coachNote =
    g.coach_note?.trim() ||
    (g.game_type === "AI Training"
      ? "Training games sharpen tactics without moving your official rating — keep playing and watch your consistency improve."
      : "Every game adds pattern recognition. Pick one moment you would play differently next time.");

  return (
    <PageContainer>
      <div className="max-w-3xl mx-auto">
        <div className="text-sm text-muted-foreground mb-1">Game review</div>
        <h1 className="font-display text-3xl font-bold">
          {result === "win" ? "Nice win" : result === "loss" ? "Tough one" : "It's a draw"}
        </h1>

        <div className="card-surface p-6 mt-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Result</div>
              <div className="font-display text-xl font-bold mt-0.5">
                vs {opponent}
                {g.ai_difficulty ? ` (${g.ai_difficulty})` : ""}
              </div>
            </div>
            <ResultBadge result={result} />
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Type</div>
              <div className="mt-0.5">
                <GameTypeBadge type={g.game_type} />
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Moves</div>
              <div className="font-semibold mt-0.5">{g.moves_count}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Date</div>
              <div className="font-semibold mt-0.5">{new Date(g.created_at).toLocaleDateString()}</div>
            </div>
          </div>
        </div>

        <div className="card-surface p-6 mt-5">
          <div className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Rating</div>
          {g.game_type === "Ranked" && ratingBefore != null ? (
            <>
              <div className="flex items-baseline gap-3 mt-1">
                <div className="font-display text-3xl font-bold">{ratingBefore}</div>
                <div className="text-muted-foreground">→</div>
                <div className="font-display text-3xl font-bold">{ratingAfter}</div>
                <div
                  className={`font-display text-xl font-bold ml-2 ${delta && delta > 0 ? "text-success" : delta && delta < 0 ? "text-destructive" : ""}`}
                >
                  {delta != null ? `${delta > 0 ? "+" : ""}${delta}` : ""}
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {result === "win"
                  ? "You gained rating because you won this ranked game."
                  : result === "loss"
                    ? "You lost rating, but every game makes you better."
                    : "Rating barely changed — you drew."}
              </p>
            </>
          ) : (
            <p className="font-semibold mt-1">
              Rating unchanged. {g.game_type === "AI Training" ? "AI training games do not affect rating." : "Casual games do not affect rating."}
            </p>
          )}
        </div>

        <div className="grid sm:grid-cols-3 gap-3 mt-5">
          {moments.map((m, i) => (
            <div key={i} className="card-surface p-5">
              <div className="text-xs font-semibold text-primary uppercase tracking-wider">{m.title}</div>
              <div className="text-sm mt-2">{m.text}</div>
            </div>
          ))}
        </div>

        <div className="card-surface p-6 mt-5 bg-gradient-to-br from-primary-soft to-card">
          <div className="flex items-center gap-2 text-xs font-semibold text-accent-foreground uppercase tracking-wide mb-2">
            <Sparkles className="h-3.5 w-3.5" /> Coach note
          </div>
          <p className="font-medium">{coachNote}</p>
        </div>

        <div className="flex flex-wrap gap-2 mt-8">
          <Button asChild>
            <Link to="/play">Play again</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/profile">View profile</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
