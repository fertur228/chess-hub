import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth";
import { useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { ChessBoard } from "@/components/chess-board";
import { Button } from "@/components/ui/button";
import { aiMove, generateReview, type Difficulty } from "@/lib/chess-helpers";
import { supabase } from "@/integrations/supabase/client";
import { Bot, Loader2, Trophy } from "lucide-react";
import { GameTypeBadge } from "@/components/badges";
import { toast } from "sonner";
import { useCosmeticWallet } from "@/lib/cosmetic-wallet-context";
import { avatarFrameRingClass } from "@/lib/cosmetics";

type Search = { difficulty: Difficulty; color: "white" | "black" };

function normalizeSearch(s: Record<string, unknown>): Search {
  const rawD = s.difficulty;
  let difficulty: Difficulty = "Easy";
  if (typeof rawD === "string") {
    const d = rawD.charAt(0).toUpperCase() + rawD.slice(1).toLowerCase();
    if (d === "Easy" || d === "Medium" || d === "Hard") difficulty = d as Difficulty;
  }
  const rawC = s.color;
  let color: "white" | "black" = "white";
  if (rawC === "black" || rawC === "white") {
    color = rawC;
  } else if (typeof rawC === "string") {
    const c = rawC.toLowerCase();
    if (c === "black") color = "black";
    else if (c === "white") color = "white";
  }
  return { difficulty, color };
}

export const Route = createFileRoute("/game/ai")({
  validateSearch: (s: Record<string, unknown>): Search => normalizeSearch(s),
  head: () => ({ meta: [{ title: "AI Game — ChessCoach Arena" }] }),
  component: () => (
    <RequireAuth>
      <AppShell>
        <AIGame />
      </AppShell>
    </RequireAuth>
  ),
});

function AIGame() {
  const { difficulty, color } = Route.useSearch();
  const { user, profile, refreshProfile } = useAuth();
  const { snapshot: walletSnap } = useCosmeticWallet();
  const youFrameClass = avatarFrameRingClass(walletSnap?.activeAvatarFrameSlug);
  const navigate = useNavigate();
  const chessRef = useRef(new Chess());
  const finalizedRef = useRef(false);
  const [fen, setFen] = useState(chessRef.current.fen());
  const [thinking, setThinking] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [endResult, setEndResult] = useState<{ result: "win" | "loss" | "draw"; reason: string } | null>(null);
  const [savedGameId, setSavedGameId] = useState<string | undefined>(undefined);
  const [savePending, setSavePending] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [, force] = useState(0);
  const aiColor: "w" | "b" = color === "white" ? "b" : "w";

  const history = chessRef.current.history();

  // If AI plays first
  useEffect(() => {
    if (chessRef.current.turn() === aiColor && !gameOver) {
      void makeAIMove();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finalizeGame = async (result: "win" | "loss" | "draw", reason: string) => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;

    setGameOver(true);
    setEndResult({ result, reason });
    setSavePending(true);
    setSaveError(null);
    setSavedGameId(undefined);

    if (!user) {
      finalizedRef.current = false;
      setSavePending(false);
      setSaveError("You are not signed in.");
      toast.error("Could not save game: not signed in.");
      return;
    }

    const c = chessRef.current;
    const review = generateReview({ pgn: c.pgn(), movesCount: c.history().length, result, endReason: reason });

    const { data: gameId, error } = await supabase.rpc("finalize_ai_training_game", {
      p_human_color: color,
      p_ai_difficulty: difficulty,
      p_user_result: result,
      p_end_reason: reason,
      p_pgn: c.pgn(),
      p_moves_count: c.history().length,
      p_key_moments: review.keyMoments,
      p_coach_note: review.coachNote,
    });

    if (error) {
      finalizedRef.current = false;
      setSavePending(false);
      setSaveError(error.message);
      toast.error(`Could not save game: ${error.message}`);
      return;
    }

    if (gameId == null || typeof gameId !== "string") {
      finalizedRef.current = false;
      setSavePending(false);
      setSaveError("Unexpected response from server.");
      toast.error("Could not save game: unexpected response.");
      return;
    }

    setSavedGameId(gameId);
    setSavePending(false);
    await refreshProfile();
    toast.success("Training game saved.");
  };

  const checkEnd = (): boolean => {
    const c = chessRef.current;
    if (!c.isGameOver()) return false;
    let result: "win" | "loss" | "draw" = "draw";
    let reason = "draw";
    if (c.isCheckmate()) {
      const loser = c.turn();
      const userLost = (loser === "w" && color === "white") || (loser === "b" && color === "black");
      result = userLost ? "loss" : "win";
      reason = "checkmate";
    } else if (c.isStalemate()) {
      result = "draw";
      reason = "stalemate";
    } else if (c.isDraw()) {
      result = "draw";
      reason = "draw";
    }
    void finalizeGame(result, reason);
    return true;
  };

  const makeAIMove = async () => {
    setThinking(true);
    await new Promise((r) => setTimeout(r, 450));
    const san = aiMove(chessRef.current.fen(), difficulty);
    if (san) {
      try {
        chessRef.current.move(san);
      } catch {
        /* skip */
      }
      setFen(chessRef.current.fen());
      force((x) => x + 1);
    }
    setThinking(false);
    checkEnd();
  };

  const onMove = (from: string, to: string, promotion?: string) => {
    if (gameOver || thinking) return false;
    if (chessRef.current.turn() === aiColor) return false;
    try {
      const m = chessRef.current.move({ from, to, promotion });
      if (!m) return false;
    } catch {
      return false;
    }
    setFen(chessRef.current.fen());
    force((x) => x + 1);
    if (checkEnd()) return true;
    setTimeout(() => {
      void makeAIMove();
    }, 250);
    return true;
  };

  const resign = () => {
    if (gameOver || finalizedRef.current) return;
    void finalizeGame("loss", "resignation");
  };

  const retrySave = () => {
    if (!endResult || savePending) return;
    finalizedRef.current = false;
    void finalizeGame(endResult.result, endResult.reason);
  };

  const turnText = useMemo(() => {
    if (gameOver) return "Game over";
    if (thinking) return "Coach Bot is thinking…";
    const yourTurn = chessRef.current.turn() !== aiColor;
    if (chessRef.current.inCheck()) return yourTurn ? "You are in check!" : "Coach Bot is in check";
    return yourTurn ? "Your move" : "Coach Bot's turn";
  }, [thinking, gameOver, fen, aiColor]);

  const lastMove = useMemo((): { from: Square; to: Square } | null => {
    const hist = chessRef.current.history({ verbose: true });
    const m = hist[hist.length - 1];
    if (!m) return null;
    return { from: m.from as Square, to: m.to as Square };
  }, [fen]);

  const displayResult = endResult?.result;
  const displayReason = endResult?.reason;

  return (
    <div className="mx-auto max-w-7xl px-4 md:px-6 py-6 md:py-8">
      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <div>
          <ChessBoard
            fen={fen}
            orientation={color}
            playerColor={color}
            lastMove={lastMove}
            boardSkinSlug={walletSnap?.activeBoardSkinSlug}
            onMove={onMove}
            disabled={gameOver || thinking || chessRef.current.turn() === aiColor}
          />
        </div>
        <div className="space-y-4">
          <PlayerCard
            name="Coach Bot"
            sub={`AI • ${difficulty}`}
            icon={<Bot className="h-5 w-5" />}
            active={chessRef.current.turn() === aiColor && !gameOver}
          />
          <PlayerCard
            name={profile?.username ?? "You"}
            sub={`Rating ${profile?.rating ?? 800} • unchanged in training`}
            icon={<Trophy className="h-5 w-5" />}
            active={chessRef.current.turn() !== aiColor && !gameOver}
            you
            avatarFrameClass={youFrameClass}
          />

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
            <Button variant="outline" onClick={resign} disabled={gameOver}>
              Resign
            </Button>
            <Button variant="outline" asChild>
              <Link to="/play/ai">New AI game</Link>
            </Button>
          </div>
          <Button variant="ghost" className="w-full" asChild>
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </div>

      {gameOver && endResult && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card-surface p-8 max-w-md w-full text-center">
            <div className="font-display text-3xl font-bold mb-2">
              {displayResult === "win" ? "🎉 You won!" : displayResult === "loss" ? "Game over" : "It's a draw"}
            </div>
            <p className="text-muted-foreground mb-4">
              {chessRef.current.history().length} moves • {displayReason}
            </p>
            <p className="text-sm bg-muted rounded-lg p-3 mb-5">AI training games do not affect your rating.</p>

            {savePending && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-5">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving your game…
              </div>
            )}

            {saveError && !savePending && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 mb-4 text-sm text-left">
                <p className="font-medium text-destructive">Could not save this game</p>
                <p className="text-muted-foreground mt-1">{saveError}</p>
                <Button className="mt-3 w-full" variant="secondary" onClick={retrySave}>
                  Retry save
                </Button>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {savedGameId && !savePending && !saveError && (
                <Button asChild>
                  <Link to="/review/$gameId" params={{ gameId: savedGameId }}>
                    View game review
                  </Link>
                </Button>
              )}
              <Button variant="outline" onClick={() => navigate({ to: "/play/ai" })} disabled={savePending}>
                Play again vs AI
              </Button>
              <Button variant="ghost" asChild>
                <Link to="/dashboard">Back to dashboard</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerCard({
  name,
  sub,
  icon,
  active,
  you,
  avatarFrameClass,
}: {
  name: string;
  sub: string;
  icon: React.ReactNode;
  active?: boolean;
  you?: boolean;
  avatarFrameClass?: string;
}) {
  const wrap = avatarFrameClass && you;
  return (
    <div className={`card-surface p-4 flex items-center gap-3 ${active ? "ring-2 ring-primary" : ""}`}>
      {wrap ? (
        <span className={`inline-flex rounded-lg ${avatarFrameClass}`}>
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-accent-foreground">{icon}</span>
        </span>
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-accent-foreground">{icon}</div>
      )}
      <div className="flex-1">
        <div className="font-semibold flex items-center gap-2">
          {name}
          {you && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
        </div>
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
