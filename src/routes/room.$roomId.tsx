import { createFileRoute, Link, useNavigate, useBlocker } from "@tanstack/react-router";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Chess, type Square } from "chess.js";
import { ChessBoard } from "@/components/chess-board";
import { Button } from "@/components/ui/button";
import { Copy, Loader2, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { GameTypeBadge } from "@/components/badges";
import { eloChange, generateReview } from "@/lib/chess-helpers";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/room/$roomId")({
  head: () => ({ meta: [{ title: "Online game — ChessCoach Arena" }] }),
  component: () => <RequireAuth><AppShell><RoomPage /></AppShell></RequireAuth>,
});

function RoomPage() {
  const { roomId } = Route.useParams();
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [room, setRoom] = useState<any>(null);
  const [roomLoad, setRoomLoad] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [savedGameId, setSavedGameId] = useState<string | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchRoom() {
      const { data, error } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
      if (cancelled) return;
      if (error) {
        setRoomLoad("error");
        setRoom(null);
        return;
      }
      if (!data) {
        setRoomLoad("missing");
        setRoom(null);
        return;
      }
      setRoom(data);
      setRoomLoad("ready");
    }

    void fetchRoom();

    const poll = window.setInterval(() => {
      if (!cancelled) void fetchRoom();
    }, 4500);

    const ch = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          setRoom(payload.new as Record<string, unknown>);
          setRoomLoad("ready");
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      void supabase.removeChannel(ch);
    };
  }, [roomId]);

  // When game finishes and server has finalized it, provide the review link
  useEffect(() => {
    if (room?.status === "finished" && (room as any)?.game_id && !savedGameId) {
      setSavedGameId((room as any).game_id);
      refreshProfile();
    }
  }, [room?.status, (room as any)?.game_id, savedGameId, refreshProfile]);

  if (roomLoad === "loading" || (roomLoad === "ready" && !room))
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  if (roomLoad === "missing") {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <p className="font-medium">Room not found</p>
        <p className="text-sm text-muted-foreground mt-2">This link may be wrong or the room was removed.</p>
        <Button asChild className="mt-6">
          <Link to="/play">Back to play</Link>
        </Button>
      </div>
    );
  }

  if (roomLoad === "error" || !room) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <p className="font-medium">Could not load room</p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/play">Back to play</Link>
        </Button>
      </div>
    );
  }

  if (room.status === "cancelled") {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center card-surface p-8">
        <p className="font-medium">This room was cancelled.</p>
        <p className="text-sm text-muted-foreground mt-2">The host cancelled the waiting room or the game ended before it started.</p>
        <Button asChild className="mt-6">
          <Link to="/play">Back to play</Link>
        </Button>
      </div>
    );
  }

  if (room.status === "waiting") {
    if (user?.id !== room.host_user_id) return <WaitingGuestHint room={room} />;
    return <WaitingRoom room={room} />;
  }

  const isParticipant = user?.id === room.white_user_id || user?.id === room.black_user_id;
  if (!isParticipant) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center card-surface p-8 space-y-3">
        <p className="font-medium">You are not in this game</p>
        <p className="text-sm text-muted-foreground">
          Rooms are limited to two players. Ask the host for the invite link with the room code if you intended to join.
        </p>
        <Button asChild variant="default">
          <Link to="/play/join">Go to Join game</Link>
        </Button>
        <div>
          <Button asChild variant="ghost">
            <Link to="/play">Back to play</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <OnlineGame room={room} user={user!} profile={profile!} navigate={navigate} savedGameId={savedGameId} refreshProfile={refreshProfile} />;
}

function WaitingGuestHint({ room }: { room: { code: string; host_username?: string } }) {
  return (
    <div className="mx-auto max-w-xl px-4 md:px-6 py-10">
      <div className="card-surface p-8 text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground mb-2">
          <Users className="h-6 w-6" />
        </div>
        <h1 className="font-display text-2xl font-bold">Game not started yet</h1>
        <p className="text-muted-foreground">
          Another player is hosting. Join with the{" "}
          <span className="font-mono font-semibold tracking-widest text-foreground">{room.code}</span> code so you are paired correctly.
        </p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Button asChild>
            <Link to="/play/join" search={{ code: room.code }}>
              Join room {room.code}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/play">Back to play</Link>
          </Button>
        </div>
        {room.host_username && (
          <p className="text-xs text-muted-foreground pt-4">Hosted by {room.host_username}</p>
        )}
      </div>
    </div>
  );
}

function WaitingRoom({ room }: { room: any }) {
  const navigate = useNavigate();
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = `${origin}/play/join?code=${encodeURIComponent(room.code)}`;
  const isPublic = room.visibility === "public";
  const isRanked = room.game_mode === "ranked";
  const cancel = async () => {
    const { error } = await supabase.rpc("cancel_room", { p_room_id: room.id });
    if (error) {
      toast.error(error.message || "Failed to cancel room");
      return;
    }
    toast.success(isPublic ? "Matchmaking cancelled" : "Room cancelled");
    navigate({ to: "/play" });
  };
  return (
    <div className="mx-auto max-w-xl px-4 md:px-6 py-10">
      <div className="card-surface p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-accent-foreground mb-4">
          <Users className="h-6 w-6" />
        </div>

        {isPublic ? (
          <>
            <h1 className="font-display text-2xl font-bold">{isRanked ? "Finding ranked opponent..." : "Finding opponent..."}</h1>
            <p className="text-muted-foreground mt-1">
              {isRanked
                ? "You're in the ranked matchmaking queue. Another player near your rating will be paired with you automatically."
                : "You're in the casual matchmaking queue. Another player will be paired with you automatically."}
            </p>
            <div className="mt-4 inline-block px-3 py-1 bg-muted rounded-full text-xs font-semibold text-muted-foreground">
              Public {isRanked ? "ranked" : "casual"} matchmaking room
            </div>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl font-bold">Waiting for opponent</h1>
            <p className="text-muted-foreground mt-1">Private rooms are casual and do not affect rating. Share the invite link or code; this page updates automatically when your friend joins.</p>

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
          </>
        )}

        <div className="mt-6 flex justify-center gap-2 text-xs">
          <span className="px-2.5 py-1 bg-primary-soft text-accent-foreground rounded-full font-semibold">{room.game_mode === "ranked" ? "Ranked" : "Casual"}</span>
          {!isPublic && <span className="px-2.5 py-1 bg-muted rounded-full font-semibold">Color: {room.host_color}</span>}
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {isPublic ? (isRanked ? "Finding ranked opponent..." : "Finding opponent...") : "Waiting for another player to join..."}
        </div>
        <p className="mt-4 text-xs text-muted-foreground max-w-sm mx-auto">
          If this screen does not update, check your connection — the app also rechecks every few seconds.
        </p>

        <Button variant="ghost" className="mt-6" onClick={cancel}>
          {isPublic ? "Cancel matchmaking" : "Cancel room"}
        </Button>
      </div>
    </div>
  );
}

function mapDrawRpcError(message: string): string {
  if (message.includes("DRAW_OFFER_RESPOND_FIRST")) return "Your opponent offered a draw — accept or decline first.";
  if (message.includes("DRAW_OFFER_INVALID_STATE")) return "Draw offer is not available in this room state.";
  if (message.includes("DRAW_OFFER_NONE")) return "There is no pending draw offer.";
  if (message.includes("DRAW_OFFER_CANNOT_ACCEPT_OWN")) return "You cannot accept your own draw offer.";
  return message;
}

function OnlineGame({ room, user, profile, navigate, savedGameId, refreshProfile }: any) {
  const chessRef = useRef(new Chess());
  const [, force] = useState(0);
  const [thinking, setThinking] = useState(false);
  const [drawBusy, setDrawBusy] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const allowNavigationRef = useRef(false);

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

  const isParticipant = user && (room.white_user_id === user.id || room.black_user_id === user.id);
  const isActiveGame = room.status === "playing";

  const blocker = useBlocker({
    shouldBlockFn: () => {
      console.debug("shouldBlockFn evaluated", { isActiveGame, isParticipant, allowNavigation: allowNavigationRef.current });
      if (isActiveGame && isParticipant && !allowNavigationRef.current) {
        console.debug("Navigation blocked by useBlocker");
        setShowLeaveDialog(true);
        return true;
      }
      return false;
    },
    withResolver: true
  });

  const confirmLeave = async () => {
    setThinking(true);
    const { data, error } = await supabase.functions.invoke("forfeit-game", {
      body: { room_id: room.id, reason: "abandon" }
    });
    setThinking(false);
    if (error || data?.error) {
      toast.error(data?.error || "Failed to leave and resign");
      return;
    }
    await refreshProfile();
    setShowLeaveDialog(false);
    allowNavigationRef.current = true;
    if (blocker.proceed) blocker.proceed();
  };

  const cancelLeave = () => {
    setShowLeaveDialog(false);
    if (blocker.reset) blocker.reset();
  };

  useEffect(() => {
    if (!room || !isParticipant || !isActiveGame) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [room, isParticipant, isActiveGame]);

  const onMove = (from: string, to: string, promotion?: string): boolean => {
    if (isOver || !myTurn || thinking) return false;
    try {
      const m = chessRef.current.move({ from, to, promotion });
      if (!m) return false;
    } catch { return false; }
    force((x) => x + 1); // Optimistic local UI update
    void pushMove(from, to, promotion);
    return true;
  };

  const pushMove = async (from: string, to: string, promotion?: string) => {
    setThinking(true);
    const { data, error } = await supabase.functions.invoke("record-move", {
      body: { room_id: room.id, from, to, promotion }
    });
    setThinking(false);

    if (error || data?.error) {
      toast.error(data?.error || "Failed to record move");
      // Revert to stable room state
      const c = new Chess();
      if (room.pgn) { try { c.loadPgn(room.pgn); } catch { c.load(room.fen); } }
      chessRef.current = c;
      force((x) => x + 1);
    }
  };

  const resign = async () => {
    setThinking(true);
    const { data, error } = await supabase.functions.invoke("forfeit-game", {
      body: { room_id: room.id, reason: "resignation" }
    });
    setThinking(false);
    if (error || data?.error) {
      toast.error(data?.error || "Failed to resign");
      return;
    }
    await refreshProfile();
  };

  const drawOfferBy: string | null = room.draw_offer_by ?? null;
  const myDrawOfferSent = drawOfferBy === user.id;
  const opponentDrawOffer = !!drawOfferBy && drawOfferBy !== user.id;

  const offerDraw = async () => {
    if (isOver || drawBusy || thinking || opponentDrawOffer || myDrawOfferSent) return;
    setDrawBusy(true);
    const { error } = await supabase.rpc("offer_draw", { p_room_id: room.id });
    setDrawBusy(false);
    if (error) {
      toast.error(mapDrawRpcError(error.message));
      return;
    }
    toast.success("Draw offer sent.");
  };

  const respondDraw = async (accept: boolean) => {
    if (isOver || drawBusy || thinking || !opponentDrawOffer) return;
    setDrawBusy(true);
    const { error } = await supabase.rpc("respond_draw_offer", {
      p_room_id: room.id,
      p_accept: accept,
    });
    setDrawBusy(false);
    if (error) {
      toast.error(mapDrawRpcError(error.message));
      return;
    }
    if (accept) {
      toast.success("Draw accepted — game over.");
      await refreshProfile();
    } else {
      toast.success("Draw offer declined.");
    }
  };

  const turnText = isOver ? "Game over" : (chessRef.current.inCheck() ? (myTurn ? "You are in check!" : "Opponent is in check") : (myTurn ? "Your move" : "Opponent's turn"));
  const history = chessRef.current.history();
  const lastMove = useMemo((): { from: Square; to: Square } | null => {
    const hist = chessRef.current.history({ verbose: true });
    const m = hist[hist.length - 1];
    if (!m) return null;
    return { from: m.from as Square, to: m.to as Square };
  }, [room.pgn, room.fen, history.length]);
  const winningColor = room.result === "white_win" ? "white" : room.result === "black_win" ? "black" : room.result;
  const myWon = isOver && winningColor !== "draw" && ((winningColor === "white" && myColor === "white") || (winningColor === "black" && myColor === "black"));
  const draw = isOver && room.result === "draw";

  return (
    <div className="mx-auto max-w-7xl px-4 md:px-6 py-6 md:py-8">
      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <ChessBoard
          fen={chessRef.current.fen()}
          orientation={myColor}
          playerColor={myColor}
          lastMove={lastMove}
          onMove={onMove}
          disabled={isOver || !myTurn || thinking}
        />
        <div className="space-y-4">
          <div className="card-surface p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground font-bold">{(opponent || "?")[0]}</div>
            <div className="flex-1"><div className="font-semibold">{opponent || "Waiting…"}</div><div className="text-xs text-muted-foreground">Opponent</div></div>
            {!myTurn && !isOver && <div className="text-xs font-semibold text-primary">TURN</div>}
          </div>
          <div className="card-surface p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-accent-foreground font-bold">{profile.username[0].toUpperCase()}</div>
            <div className="flex-1">
              <div className="font-semibold">
                {profile.username} <span className="text-xs font-normal text-muted-foreground">(you)</span>
              </div>
              <div className="text-xs text-muted-foreground">
                <Trophy className="h-3 w-3 inline" /> {profile.rating}
              </div>
              <div className="text-xs font-medium text-foreground mt-0.5">
                You play <span className="capitalize">{myColor}</span> · bottom of the board is your side
              </div>
            </div>
            {myTurn && !isOver && <div className="text-xs font-semibold text-primary">TURN</div>}
          </div>

          <div className="card-surface p-4">
            <GameTypeBadge type={room.game_mode === "ranked" ? "Ranked" : "Casual"} />
            <div className="mt-3 font-semibold">{turnText}</div>
            {isActiveGame && opponentDrawOffer && (
              <p className="mt-2 text-sm text-amber-900 dark:text-amber-200/90 bg-amber-500/15 rounded-md px-3 py-2">
                Opponent offered a draw. Accept or decline.
              </p>
            )}
            {isActiveGame && myDrawOfferSent && !opponentDrawOffer && (
              <p className="mt-2 text-sm text-muted-foreground">Draw offer sent — waiting for response.</p>
            )}
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

          {isActiveGame && (
            <div className="space-y-2">
              {opponentDrawOffer ? (
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => void respondDraw(true)} disabled={drawBusy || thinking}>
                    Accept draw
                  </Button>
                  <Button variant="outline" onClick={() => void respondDraw(false)} disabled={drawBusy || thinking}>
                    Decline
                  </Button>
                </div>
              ) : (
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => void offerDraw()}
                  disabled={drawBusy || thinking || myDrawOfferSent}
                >
                  {myDrawOfferSent ? "Draw offer sent" : "Offer draw"}
                </Button>
              )}
            </div>
          )}
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
              {draw ? (room.end_reason === "draw_agreement" ? "Draw by agreement" : "It's a draw") : myWon ? (room.end_reason === "resignation" ? "🎉 You won by resignation" : room.end_reason === "abandon" ? "🎉 You won because opponent left" : "🎉 You won!") : "Game over"}
            </div>
            <p className="text-muted-foreground mb-4">
              {draw && room.end_reason === "draw_agreement"
                ? "Both players agreed to a draw."
                : room.end_reason === "resignation" && !myWon ? "You resigned" :
               room.end_reason === "abandon" && !myWon ? "You left the game" :
               room.end_reason === "resignation" && myWon ? "Opponent resigned" :
               room.end_reason === "abandon" && myWon ? "Opponent left the game" : room.end_reason}
            </p>
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

      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave this game?</AlertDialogTitle>
            <AlertDialogDescription>Leaving now will count as a resignation.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelLeave}>Stay in game</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLeave} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Leave and resign</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
