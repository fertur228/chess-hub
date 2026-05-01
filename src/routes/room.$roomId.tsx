import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Chess } from "chess.js";
import { ChessBoard } from "@/components/chess-board";
import { Button } from "@/components/ui/button";
import { Copy, Loader2, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { GameTypeBadge } from "@/components/badges";
import { eloChange, generateReview } from "@/lib/chess-helpers";

export const Route = createFileRoute("/room/$roomId")({
  head: () => ({ meta: [{ title: "Online game — ChessCoach Arena" }] }),
  component: () => <RequireAuth><AppShell><RoomPage /></AppShell></RequireAuth>,
});

function RoomPage() {
  const { roomId } = Route.useParams();
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [room, setRoom] = useState<any>(null);
  const [savedGameId, setSavedGameId] = useState<string | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const fetchRoom = async () => {
      const { data } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
      if (!cancelled) setRoom(data);
    };
    fetchRoom();
    const ch = supabase.channel(`room:${roomId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        (payload) => setRoom(payload.new))
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [roomId]);

  // When game finishes, save it once
  useEffect(() => {
    if (!room || !user || !profile) return;
    if (room.status !== "finished" || savingRef.current || savedGameId) return;
    if (room.white_user_id !== user.id) return; // only white saves
    savingRef.current = true;
    (async () => {
      const c = new Chess();
      try { c.loadPgn(room.pgn || ""); } catch { /* ignore */ }
      const moves = c.history().length;
      const result = room.result as "white" | "black" | "draw";
      // Look up both ratings
      const { data: rows } = await supabase.from("profiles").select("user_id,rating")
        .in("user_id", [room.white_user_id, room.black_user_id]);
      const whiteRating = rows?.find((r) => r.user_id === room.white_user_id)?.rating || 800;
      const blackRating = rows?.find((r) => r.user_id === room.black_user_id)?.rating || 800;
      let whiteAfter = whiteRating, blackAfter = blackRating;
      if (room.game_mode === "ranked") {
        const wScore = result === "white" ? 1 : result === "draw" ? 0.5 : 0;
        const wDelta = eloChange(whiteRating, blackRating, wScore as 1 | 0.5 | 0);
        whiteAfter = whiteRating + wDelta; blackAfter = blackRating - wDelta;
      }
      const review = generateReview({ pgn: room.pgn || "", movesCount: moves, result: result === "draw" ? "draw" : "win", endReason: room.end_reason || "" });
      const { data: g } = await supabase.from("games").insert({
        game_type: room.game_mode === "ranked" ? "Ranked" : "Casual",
        white_user_id: room.white_user_id, black_user_id: room.black_user_id,
        white_username: room.white_username, black_username: room.black_username,
        result, end_reason: room.end_reason, pgn: room.pgn, moves_count: moves,
        white_rating_before: room.game_mode === "ranked" ? whiteRating : null,
        white_rating_after: room.game_mode === "ranked" ? whiteAfter : null,
        black_rating_before: room.game_mode === "ranked" ? blackRating : null,
        black_rating_after: room.game_mode === "ranked" ? blackAfter : null,
        key_moments: review.keyMoments, coach_note: review.coachNote,
      }).select("id").single();
      // Update profiles
      for (const uid of [room.white_user_id, room.black_user_id]) {
        const isWhite = uid === room.white_user_id;
        const won = (result === "white" && isWhite) || (result === "black" && !isWhite);
        const draw = result === "draw";
        const rating = isWhite ? whiteAfter : blackAfter;
        const { data: p } = await supabase.from("profiles").select("*").eq("user_id", uid).single();
        if (p) {
          await supabase.from("profiles").update({
            rating: room.game_mode === "ranked" ? rating : p.rating,
            highest_rating: Math.max(p.highest_rating, rating),
            games_played: p.games_played + 1,
            wins: p.wins + (won && !draw ? 1 : 0),
            losses: p.losses + (!won && !draw ? 1 : 0),
            draws: p.draws + (draw ? 1 : 0),
          }).eq("user_id", uid);
        }
      }
      if (g?.id) setSavedGameId(g.id);
      refreshProfile();
    })();
  }, [room, user, profile, savedGameId, refreshProfile]);

  if (!room) return <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (room.status === "waiting") return <WaitingRoom room={room} />;
  if (room.status === "cancelled") return <div className="p-8 text-center">This room was cancelled. <Link to="/play" className="text-primary underline">Back to lobby</Link></div>;
  return <OnlineGame room={room} user={user!} profile={profile!} navigate={navigate} savedGameId={savedGameId} />;
}

function WaitingRoom({ room }: { room: any }) {
  const navigate = useNavigate();
  const link = typeof window !== "undefined" ? `${window.location.origin}/play/join?code=${room.code}` : "";
  const cancel = async () => {
    await supabase.from("rooms").update({ status: "cancelled" }).eq("id", room.id);
    navigate({ to: "/play" });
  };
  return (
    <div className="mx-auto max-w-xl px-4 md:px-6 py-10">
      <div className="card-surface p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-accent-foreground mb-4">
          <Users className="h-6 w-6" />
        </div>
        <h1 className="font-display text-2xl font-bold">Waiting for opponent</h1>
        <p className="text-muted-foreground mt-1">Share the link or code with a friend to start the game.</p>

        <div className="mt-6 space-y-3 text-left">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Room code</div>
            <div className="flex gap-2">
              <div className="flex-1 px-4 py-3 bg-muted rounded-lg font-mono text-2xl font-bold text-center tracking-widest">{room.code}</div>
              <Button variant="outline" size="icon" className="h-auto" onClick={() => { navigator.clipboard.writeText(room.code); toast.success("Code copied"); }}><Copy className="h-4 w-4" /></Button>
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Invite link</div>
            <div className="flex gap-2">
              <div className="flex-1 px-3 py-2.5 bg-muted rounded-lg text-sm truncate">{link}</div>
              <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copied"); }}><Copy className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-center gap-2 text-xs">
          <span className="px-2.5 py-1 bg-primary-soft text-accent-foreground rounded-full font-semibold">{room.game_mode === "ranked" ? "Ranked" : "Casual"}</span>
          <span className="px-2.5 py-1 bg-muted rounded-full font-semibold">Color: {room.host_color}</span>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Waiting for another player to join…
        </div>

        <Button variant="ghost" className="mt-6" onClick={cancel}>Cancel game</Button>
      </div>
    </div>
  );
}

function OnlineGame({ room, user, profile, navigate, savedGameId }: any) {
  const chessRef = useRef(new Chess());
  const [, force] = useState(0);
  const [thinking] = useState(false);

  // Sync FEN/PGN from room
  useEffect(() => {
    const c = new Chess();
    if (room.pgn) { try { c.loadPgn(room.pgn); } catch { c.load(room.fen); } }
    chessRef.current = c;
    force((x) => x + 1);
  }, [room.pgn, room.fen]);

  const myColor: "white" | "black" = room.white_user_id === user.id ? "white" : "black";
  const myTurn = (chessRef.current.turn() === "w" && myColor === "white") || (chessRef.current.turn() === "b" && myColor === "black");
  const opponent = myColor === "white" ? room.black_username : room.white_username;
  const isOver = room.status === "finished";

  const onMove = (from: string, to: string, promotion?: string): boolean => {
    if (isOver || !myTurn) return false;
    try {
      const m = chessRef.current.move({ from, to, promotion });
      if (!m) return false;
    } catch { return false; }
    force((x) => x + 1);
    pushMove();
    return true;
  };

  const pushMove = async () => {
    const c = chessRef.current;
    let result: string | null = null;
    let endReason: string | null = null;
    let status = "playing";
    if (c.isCheckmate()) { status = "finished"; endReason = "checkmate"; result = c.turn() === "w" ? "black" : "white"; }
    else if (c.isStalemate() || c.isDraw()) { status = "finished"; endReason = c.isStalemate() ? "stalemate" : "draw"; result = "draw"; }
    await supabase.from("rooms").update({ fen: c.fen(), pgn: c.pgn(), status, result, end_reason: endReason }).eq("id", room.id);
  };

  const resign = async () => {
    const winner = myColor === "white" ? "black" : "white";
    await supabase.from("rooms").update({ status: "finished", result: winner, end_reason: "resignation" }).eq("id", room.id);
  };

  const turnText = isOver ? "Game over" : (chessRef.current.inCheck() ? (myTurn ? "You are in check!" : "Opponent is in check") : (myTurn ? "Your move" : "Opponent's turn"));
  const history = chessRef.current.history();
  const myWon = isOver && room.result !== "draw" && ((room.result === "white" && myColor === "white") || (room.result === "black" && myColor === "black"));
  const draw = isOver && room.result === "draw";

  return (
    <div className="mx-auto max-w-7xl px-4 md:px-6 py-6 md:py-8">
      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <ChessBoard fen={chessRef.current.fen()} orientation={myColor} onMove={onMove} disabled={isOver || !myTurn || thinking} />
        <div className="space-y-4">
          <div className="card-surface p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground font-bold">{(opponent || "?")[0]}</div>
            <div className="flex-1"><div className="font-semibold">{opponent || "Waiting…"}</div><div className="text-xs text-muted-foreground">Opponent</div></div>
            {!myTurn && !isOver && <div className="text-xs font-semibold text-primary">TURN</div>}
          </div>
          <div className="card-surface p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-accent-foreground font-bold">{profile.username[0].toUpperCase()}</div>
            <div className="flex-1"><div className="font-semibold">{profile.username} <span className="text-xs font-normal text-muted-foreground">(you)</span></div><div className="text-xs text-muted-foreground"><Trophy className="h-3 w-3 inline" /> {profile.rating} • {myColor}</div></div>
            {myTurn && !isOver && <div className="text-xs font-semibold text-primary">TURN</div>}
          </div>

          <div className="card-surface p-4">
            <GameTypeBadge type={room.game_mode === "ranked" ? "Ranked" : "Casual"} />
            <div className="mt-3 font-semibold">{turnText}</div>
          </div>

          <div className="card-surface p-4 max-h-48 overflow-auto">
            <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">Moves</div>
            {history.length === 0 ? <p className="text-sm text-muted-foreground">No moves yet.</p> : (
              <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-1 text-sm font-mono">
                {Array.from({ length: Math.ceil(history.length / 2) }).map((_, i) => (
                  <div key={i} className="contents"><div className="text-muted-foreground">{i + 1}.</div><div>{history[i * 2] || ""}</div><div>{history[i * 2 + 1] || ""}</div></div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={resign} disabled={isOver}>Resign</Button>
            <Button variant="ghost" asChild><Link to="/dashboard">Dashboard</Link></Button>
          </div>
        </div>
      </div>

      {isOver && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card-surface p-8 max-w-md w-full text-center">
            <div className="font-display text-3xl font-bold mb-2">
              {draw ? "It's a draw" : myWon ? "🎉 You won!" : "Game over"}
            </div>
            <p className="text-muted-foreground mb-4">{room.end_reason}</p>
            <p className="text-sm bg-muted rounded-lg p-3 mb-5">
              {room.game_mode === "ranked" ? "Rating updated based on this game." : "Casual games do not affect your rating."}
            </p>
            <div className="flex flex-col gap-2">
              {savedGameId && <Button asChild><Link to="/review/$gameId" params={{ gameId: savedGameId }}>View game review</Link></Button>}
              <Button variant="outline" onClick={() => navigate({ to: "/play" })}>Play again</Button>
              <Button variant="ghost" asChild><Link to="/dashboard">Back to dashboard</Link></Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
