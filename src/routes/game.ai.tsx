import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth";
import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { ChessBoard } from "@/components/chess-board";
import { Button } from "@/components/ui/button";
import { aiMove, generateReview, type Difficulty } from "@/lib/chess-helpers";
import { supabase } from "@/integrations/supabase/client";
import { Bot, Loader2, Trophy } from "lucide-react";
import { GameTypeBadge } from "@/components/badges";

type Search = { difficulty: Difficulty; color: "white" | "black" };

export const Route = createFileRoute("/game/ai")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    difficulty: (s.difficulty as Difficulty) || "Easy",
    color: (s.color as "white" | "black") || "white",
  }),
  head: () => ({ meta: [{ title: "AI Game — ChessCoach Arena" }] }),
  component: () => <RequireAuth><AppShell><AIGame /></AppShell></RequireAuth>,
});

function AIGame() {
  const { difficulty, color } = Route.useSearch();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const chessRef = useRef(new Chess());
  const [fen, setFen] = useState(chessRef.current.fen());
  const [thinking, setThinking] = useState(false);
  const [status, setStatus] = useState<{ over: boolean; result?: "win" | "loss" | "draw"; reason?: string; gameId?: string }>({ over: false });
  const [, force] = useState(0);
  const aiColor: "w" | "b" = color === "white" ? "b" : "w";

  const history = chessRef.current.history();

  // If AI plays first
  useEffect(() => {
    if (chessRef.current.turn() === aiColor && !status.over) {
      makeAIMove();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkEnd = (): boolean => {
    const c = chessRef.current;
    if (!c.isGameOver()) return false;
    let result: "win" | "loss" | "draw" = "draw";
    let reason = "draw";
    if (c.isCheckmate()) {
      // The side to move was checkmated
      const loser = c.turn(); // 'w' or 'b'
      const userLost = (loser === "w" && color === "white") || (loser === "b" && color === "black");
      result = userLost ? "loss" : "win";
      reason = "checkmate";
    } else if (c.isStalemate()) { result = "draw"; reason = "stalemate"; }
    else if (c.isDraw()) { result = "draw"; reason = "draw"; }
    finalizeGame(result, reason);
    return true;
  };

  const finalizeGame = async (result: "win" | "loss" | "draw", reason: string) => {
    if (!user || !profile) return;
    const c = chessRef.current;
    const review = generateReview({ pgn: c.pgn(), movesCount: c.history().length, result, endReason: reason });
    const dbResult = result === "draw" ? "draw" : (result === "win" ? (color === "white" ? "white" : "black") : (color === "white" ? "black" : "white"));
    const { data, error } = await supabase.from("games").insert({
      game_type: "AI Training",
      white_user_id: color === "white" ? user.id : null,
      black_user_id: color === "black" ? user.id : null,
      white_username: color === "white" ? profile.username : "Coach Bot",
      black_username: color === "black" ? profile.username : "Coach Bot",
      ai_difficulty: difficulty,
      result: dbResult,
      end_reason: reason,
      pgn: c.pgn(),
      moves_count: c.history().length,
      key_moments: review.keyMoments,
      coach_note: review.coachNote,
    }).select("id").single();
    setStatus({ over: true, result, reason, gameId: error ? undefined : data?.id });
  };

  const makeAIMove = async () => {
    setThinking(true);
    await new Promise((r) => setTimeout(r, 450));
    const san = aiMove(chessRef.current.fen(), difficulty);
    if (san) {
      try { chessRef.current.move(san); } catch { /* skip */ }
      setFen(chessRef.current.fen());
      force((x) => x + 1);
    }
    setThinking(false);
    checkEnd();
  };

  const onMove = (from: string, to: string, promotion?: string) => {
    if (status.over || thinking) return false;
    if (chessRef.current.turn() === aiColor) return false;
    try {
      const m = chessRef.current.move({ from, to, promotion });
      if (!m) return false;
    } catch { return false; }
    setFen(chessRef.current.fen());
    force((x) => x + 1);
    if (checkEnd()) return true;
    setTimeout(() => makeAIMove(), 250);
    return true;
  };

  const resign = () => { if (!status.over) finalizeGame("loss", "resignation"); setStatus((s) => ({ ...s, over: true, result: "loss", reason: "resignation" })); };

  const turnText = useMemo(() => {
    if (status.over) return "Game over";
    if (thinking) return "Coach Bot is thinking…";
    const yourTurn = chessRef.current.turn() !== aiColor;
    if (chessRef.current.inCheck()) return yourTurn ? "You are in check!" : "Coach Bot is in check";
    return yourTurn ? "Your move" : "Coach Bot's turn";
  }, [thinking, status.over, fen, aiColor]);

  return (
    <div className="mx-auto max-w-7xl px-4 md:px-6 py-6 md:py-8">
      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <div>
          <ChessBoard fen={fen} orientation={color} onMove={onMove} disabled={status.over || thinking || chessRef.current.turn() === aiColor} />
        </div>
        <div className="space-y-4">
          <PlayerCard name="Coach Bot" sub={`AI • ${difficulty}`} icon={<Bot className="h-5 w-5" />} active={chessRef.current.turn() === aiColor && !status.over} />
          <PlayerCard name={profile?.username || "You"} sub={`Rating ${profile?.rating ?? 800}`} icon={<Trophy className="h-5 w-5" />} active={chessRef.current.turn() !== aiColor && !status.over} you />

          <div className="card-surface p-4">
            <GameTypeBadge type="AI Training" />
            <div className="mt-3 font-semibold flex items-center gap-2">
              {thinking && <Loader2 className="h-4 w-4 animate-spin" />} {turnText}
            </div>
          </div>

          <div className="card-surface p-4 max-h-64 overflow-auto">
            <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">Move history</div>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No moves yet.</p>
            ) : (
              <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-1 text-sm font-mono">
                {Array.from({ length: Math.ceil(history.length / 2) }).map((_, i) => (
                  <Row key={i} n={i + 1} w={history[i * 2]} b={history[i * 2 + 1]} />
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={resign} disabled={status.over}>Resign</Button>
            <Button variant="outline" asChild><Link to="/play/ai">New AI game</Link></Button>
          </div>
          <Button variant="ghost" className="w-full" asChild><Link to="/dashboard">Back to dashboard</Link></Button>
        </div>
      </div>

      {status.over && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card-surface p-8 max-w-md w-full text-center">
            <div className="font-display text-3xl font-bold mb-2">
              {status.result === "win" ? "🎉 You won!" : status.result === "loss" ? "Game over" : "It's a draw"}
            </div>
            <p className="text-muted-foreground mb-4">{chessRef.current.history().length} moves • {status.reason}</p>
            <p className="text-sm bg-muted rounded-lg p-3 mb-5">AI training games do not affect your rating.</p>
            <div className="flex flex-col gap-2">
              {status.gameId && <Button asChild><Link to="/review/$gameId" params={{ gameId: status.gameId }}>View game review</Link></Button>}
              <Button variant="outline" onClick={() => navigate({ to: "/play/ai" })}>Play again vs AI</Button>
              <Button variant="ghost" asChild><Link to="/dashboard">Back to dashboard</Link></Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerCard({ name, sub, icon, active, you }: { name: string; sub: string; icon: React.ReactNode; active?: boolean; you?: boolean }) {
  return (
    <div className={`card-surface p-4 flex items-center gap-3 ${active ? "ring-2 ring-primary" : ""}`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-accent-foreground">{icon}</div>
      <div className="flex-1">
        <div className="font-semibold flex items-center gap-2">{name}{you && <span className="text-xs font-normal text-muted-foreground">(you)</span>}</div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </div>
      {active && <div className="text-xs font-semibold text-primary">TURN</div>}
    </div>
  );
}

function Row({ n, w, b }: { n: number; w?: string; b?: string }) {
  return (
    <>
      <div className="text-muted-foreground">{n}.</div>
      <div>{w || ""}</div>
      <div>{b || ""}</div>
    </>
  );
}
