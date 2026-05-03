import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type JoinSearch = { code?: string };

export const Route = createFileRoute("/play/join")({
  validateSearch: (raw: Record<string, unknown>): JoinSearch => ({
    code: typeof raw.code === "string" ? raw.code : undefined,
  }),
  head: () => ({ meta: [{ title: "Join game — ChessCoach Arena" }] }),
  component: JoinGame,
});

function JoinGame() {
  const navigate = useNavigate();
  const { code: codeFromSearch } = Route.useSearch();
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const c = codeFromSearch?.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (c) setCode(c.slice(0, 8));
  }, [codeFromSearch]);

  const trimmed = code.trim().toUpperCase();
  const readyToSubmit = trimmed.length === 6;

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const upper = trimmed;
    if (upper.length !== 6) {
      toast.error("Enter the full 6-character room code.");
      return;
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("join_room", { p_code: upper });

      if (error) {
        const msg = error.message || "";
        if (msg.includes("ROOM_NOT_FOUND")) {
          toast.error("This room does not exist.");
        } else if (msg.includes("ROOM_FULL")) {
          toast.error("This game already has two players.");
        } else if (msg.includes("ROOM_NOT_AVAILABLE")) {
          toast.error("This room is no longer available.");
        } else if (msg.includes("ROOM_INVALID_CODE")) {
          toast.error("Invalid room code format.");
        } else {
          toast.error("Could not join room.");
        }
        return;
      }

      const result = data as { room_id: string; room_code: string; status: string; role: string; player_color: string | null };

      if (result.role === "host") {
        toast.message("Returning to your room…");
      } else if (result.role === "participant") {
        toast.message("Returning to your game…");
      } else {
        toast.success("Joined — starting game");
      }

      navigate({ to: "/room/$roomId", params: { roomId: result.room_id } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader title="Join game" subtitle="Enter the 6-letter room code from your friend, or use an invite link." />
      {trimmed.length > 0 && readyToSubmit && (
        <p className="mb-4 text-sm text-muted-foreground max-w-md">
          Joining room <span className="font-mono font-semibold text-foreground tracking-widest">{trimmed}</span>
        </p>
      )}
      <form onSubmit={join} className="card-surface p-6 md:p-8 max-w-md space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="c">Room code</Label>
          <Input
            id="c"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
            maxLength={8}
            placeholder="ABC123"
            className="text-center font-mono text-lg tracking-widest"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">Codes are 6 letters or numbers.</p>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={busy || !readyToSubmit}>
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Joining…
            </>
          ) : (
            "Join game"
          )}
        </Button>
      </form>
    </PageContainer>
  );
}
