import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/play/join")({
  head: () => ({ meta: [{ title: "Join game — ChessCoach Arena" }] }),
  component: () => <RequireAuth><AppShell><JoinGame /></AppShell></RequireAuth>,
});

function JoinGame() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    setBusy(true);
    const upper = code.trim().toUpperCase();
    const { data: room } = await supabase.from("rooms").select("*").eq("code", upper).maybeSingle();
    if (!room) { setBusy(false); toast.error("This room does not exist."); return; }
    if (room.status === "finished" || room.status === "cancelled") { setBusy(false); toast.error("This game has already ended."); return; }
    if (room.guest_user_id && room.guest_user_id !== user.id) { setBusy(false); toast.error("This game already has two players."); return; }

    if (room.host_user_id === user.id) {
      navigate({ to: "/room/$roomId", params: { roomId: room.id } });
      return;
    }

    // Determine colors based on host preference
    let whiteId = room.host_user_id, whiteName = room.host_username;
    let blackId = user.id, blackName = profile.username;
    if (room.host_color === "black") {
      whiteId = user.id; whiteName = profile.username;
      blackId = room.host_user_id; blackName = room.host_username;
    } else if (room.host_color === "random") {
      if (Math.random() < 0.5) {
        whiteId = user.id; whiteName = profile.username;
        blackId = room.host_user_id; blackName = room.host_username;
      }
    }

    const { error } = await supabase.from("rooms").update({
      guest_user_id: user.id, guest_username: profile.username,
      white_user_id: whiteId, black_user_id: blackId,
      white_username: whiteName, black_username: blackName,
      status: "playing",
    }).eq("id", room.id);
    setBusy(false);
    if (error) { toast.error("Could not join room"); return; }
    navigate({ to: "/room/$roomId", params: { roomId: room.id } });
  };

  return (
    <PageContainer>
      <PageHeader title="Join game" subtitle="Enter the 6-letter room code from your friend." />
      <form onSubmit={join} className="card-surface p-6 md:p-8 max-w-md space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="c">Room code</Label>
          <Input id="c" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} placeholder="ABC123" className="text-center font-mono text-lg tracking-widest" />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={busy || code.length < 4}>Join game</Button>
      </form>
    </PageContainer>
  );
}
