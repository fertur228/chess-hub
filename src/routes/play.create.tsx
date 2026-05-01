import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { generateRoomCode } from "@/lib/chess-helpers";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/play/create")({
  head: () => ({ meta: [{ title: "Create room — ChessCoach Arena" }] }),
  component: () => <RequireAuth><AppShell><CreateRoom /></AppShell></RequireAuth>,
});

function CreateRoom() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"casual" | "ranked">("casual");
  const [color, setColor] = useState<"white" | "black" | "random">("random");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!user || !profile) return;
    setBusy(true);
    const code = generateRoomCode();
    const { data, error } = await supabase.from("rooms").insert({
      code, host_user_id: user.id, host_username: profile.username, host_color: color, game_mode: mode,
    }).select("id").single();
    setBusy(false);
    if (error || !data) { toast.error("Could not create room"); return; }
    navigate({ to: "/room/$roomId", params: { roomId: data.id } });
  };

  return (
    <PageContainer>
      <PageHeader title="Create online room" subtitle="Set up your game and invite a friend." />
      <div className="card-surface p-6 md:p-8 max-w-2xl space-y-6">
        <div>
          <div className="font-semibold text-sm mb-2">Game mode</div>
          <div className="grid grid-cols-2 gap-2">
            <Pick active={mode === "casual"} onClick={() => setMode("casual")} label="Casual" sub="Does not affect rating" />
            <Pick active={mode === "ranked"} onClick={() => setMode("ranked")} label="Ranked" sub="Affects your rating" />
          </div>
        </div>

        <div>
          <div className="font-semibold text-sm mb-2">Your color</div>
          <div className="grid grid-cols-3 gap-2">
            {(["white", "random", "black"] as const).map((c) => (
              <Pick key={c} active={color === c} onClick={() => setColor(c)} label={c[0].toUpperCase() + c.slice(1)} />
            ))}
          </div>
        </div>

        <Button size="lg" onClick={create} disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Create room
        </Button>
      </div>
    </PageContainer>
  );
}

function Pick({ active, onClick, label, sub }: { active: boolean; onClick: () => void; label: string; sub?: string }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("p-4 rounded-lg border-2 text-left transition-colors", active ? "border-primary bg-primary-soft" : "border-border hover:border-primary/40")}>
      <div className="font-semibold">{label}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </button>
  );
}
