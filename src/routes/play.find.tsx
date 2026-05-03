import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/play/find")({
  head: () => ({ meta: [{ title: "Find Match - ChessCoach Arena" }] }),
  component: FindMatch,
});

type GameMode = "casual" | "ranked";

function FindMatch() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState<"idle" | "searching" | "error">("idle");
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);

  const doFind = async (mode: GameMode) => {
    if (!user || status === "searching") return;
    setSelectedMode(mode);
    setStatus("searching");

    const { data, error } = await supabase.rpc("find_or_create_public_room", {
      p_game_mode: mode,
      p_host_color: "random",
    });

    if (error) {
      setStatus("error");
      toast.error("Could not find or create a match.");
      return;
    }

    const result = data as {
      action: string;
      room_id: string;
      status: string;
      role: string;
      game_mode: GameMode;
      player_color: string | null;
    };

    if (result.action === "joined") {
      toast.success("Matched! Starting game");
    } else if (result.action === "existing") {
      toast.message("Returning to your waiting room...");
    }

    navigate({ to: "/room/$roomId", params: { roomId: result.room_id } });
  };

  const loadingText =
    selectedMode === "ranked"
      ? "Finding a ranked opponent near your rating..."
      : "Finding a casual opponent...";

  return (
    <PageContainer>
      <PageHeader title="Find Match" subtitle="Choose casual practice or ranked matchmaking." />
      <div className="grid md:grid-cols-2 gap-4 max-w-3xl">
        <MatchCard
          icon={<Users className="h-6 w-6" />}
          title="Casual Match"
          desc="Practice online. Rating unchanged."
          disabled={!user || status === "searching"}
          active={selectedMode === "casual" && status === "searching"}
          onClick={() => doFind("casual")}
        />
        <MatchCard
          icon={<Trophy className="h-6 w-6" />}
          title="Ranked Match"
          desc="Get matched by rating. Results affect your rating."
          disabled={!user || status === "searching"}
          active={selectedMode === "ranked" && status === "searching"}
          onClick={() => doFind("ranked")}
        />
      </div>

      <div className="card-surface p-6 max-w-3xl mt-6">
        {status === "searching" && (
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span>{loadingText}</span>
          </div>
        )}

        {status === "idle" && !user && (
          <p className="text-muted-foreground">Please log in to find a match.</p>
        )}

        {status === "idle" && user && (
          <p className="text-sm text-muted-foreground">
            Ranked games are only available here through public matchmaking. Private rooms stay casual.
          </p>
        )}

        {status === "error" && (
          <div className="space-y-3">
            <p className="text-muted-foreground">Something went wrong. Please try again.</p>
            <div className="flex flex-wrap gap-2">
              {selectedMode && <Button onClick={() => doFind(selectedMode)}>Try again</Button>}
              <Button variant="outline" onClick={() => navigate({ to: "/play" })}>
                Back to play
              </Button>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}

function MatchCard({
  icon,
  title,
  desc,
  disabled,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  disabled: boolean;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "card-surface p-6 text-left transition-all disabled:opacity-60 disabled:cursor-not-allowed",
        active ? "ring-2 ring-primary/30" : "hover:shadow-md",
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-accent-foreground mb-4">{icon}</div>
      <h3 className="font-display text-lg font-bold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1.5">{desc}</p>
      {active && (
        <div className="mt-5 flex items-center gap-2 text-sm font-medium text-primary">
          <Loader2 className="h-4 w-4 animate-spin" /> Searching
        </div>
      )}
    </button>
  );
}
