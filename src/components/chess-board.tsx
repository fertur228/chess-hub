import { useCallback, useEffect, useMemo, useState } from "react";
import { Chessboard } from "react-chessboard";
import { Chess, type Move, type PieceSymbol, type Square } from "chess.js";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type LastMove = { from: Square; to: Square };

type PendingPromotion = {
  from: Square;
  to: Square;
  choices: PieceSymbol[];
};

const PROMOTION_ORDER: PieceSymbol[] = ["q", "r", "b", "n"];

const PROMOTION_LABEL: Record<"q" | "r" | "b" | "n", string> = {
  q: "Queen",
  r: "Rook",
  b: "Bishop",
  n: "Knight",
};

function promotionChoicesForTarget(moves: Move[], from: Square, to: Square): PieceSymbol[] {
  const found = new Set<PieceSymbol>();
  for (const m of moves) {
    if (m.from === from && m.to === to && m.promotion) found.add(m.promotion);
  }
  return PROMOTION_ORDER.filter((p) => found.has(p));
}

type Props = {
  fen: string;
  orientation: "white" | "black";
  onMove: (from: string, to: string, promotion?: string) => boolean;
  disabled?: boolean;
  /** Human player's color — used to restrict selection, hints, and dragging to own pieces on your turn. */
  playerColor: "white" | "black";
  /** Last move on the board (from → to). Updated by parent after each half-move. */
  lastMove?: LastMove | null;
};

const LAST_MOVE_BG = "oklch(0.9 0.08 90 / 0.38)";
const CHECK_BG = "oklch(0.78 0.14 25 / 0.5)";
const SELECT_RING = "inset 0 0 0 3px oklch(0.52 0.14 200 / 0.92)";
const CAPTURE_RING = "inset 0 0 0 3px oklch(0.55 0.14 35 / 0.78)";
const QUIET_DOT =
  "radial-gradient(circle at center, oklch(0.42 0.08 230 / 0.58) 0%, oklch(0.42 0.08 230 / 0.58) 21%, transparent 22%)";

function kingSquareInCheck(game: Chess): Square | null {
  if (!game.inCheck()) return null;
  const side = game.turn();
  const files = "abcdefgh";
  for (let rank = 1; rank <= 8; rank++) {
    for (let fi = 0; fi < 8; fi++) {
      const sq = `${files[fi]}${rank}` as Square;
      const p = game.get(sq);
      if (p?.type === "k" && p.color === side) return sq;
    }
  }
  return null;
}

function mergeSquareStyle(
  existing: React.CSSProperties | undefined,
  add: React.CSSProperties,
): React.CSSProperties {
  if (!existing) return { ...add };
  const next = { ...existing, ...add };
  if (existing.boxShadow && add.boxShadow) {
    next.boxShadow = `${existing.boxShadow}, ${add.boxShadow}`;
  }
  if (existing.backgroundImage && add.backgroundImage) {
    next.backgroundImage = `${existing.backgroundImage}, ${add.backgroundImage}`;
  }
  return next;
}

function buildSquareStyles(
  selectedSquare: string | null,
  legalVerbose: { to: string; captured?: string }[],
  lastMove: LastMove | null | undefined,
  checkSquare: string | null,
): Record<string, React.CSSProperties> {
  const styles: Record<string, React.CSSProperties> = {};

  if (lastMove) {
    styles[lastMove.from] = { backgroundColor: LAST_MOVE_BG };
    styles[lastMove.to] = mergeSquareStyle(styles[lastMove.to], { backgroundColor: LAST_MOVE_BG });
  }

  for (const m of legalVerbose) {
    const to = m.to as Square;
    if (m.captured) {
      styles[to] = mergeSquareStyle(styles[to], {
        boxShadow: CAPTURE_RING,
        borderRadius: 2,
      });
    } else {
      styles[to] = mergeSquareStyle(styles[to], { backgroundImage: QUIET_DOT });
    }
  }

  if (selectedSquare) {
    styles[selectedSquare] = mergeSquareStyle(styles[selectedSquare], { boxShadow: SELECT_RING });
  }

  if (checkSquare) {
    styles[checkSquare] = mergeSquareStyle(styles[checkSquare], { backgroundColor: CHECK_BG });
  }

  return styles;
}

export function ChessBoard({ fen, orientation, onMove, disabled, playerColor, lastMove }: Props) {
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);

  const game = useMemo(() => {
    const c = new Chess();
    try {
      c.load(fen);
    } catch {
      return null;
    }
    return c;
  }, [fen]);

  const myChar: "w" | "b" = playerColor === "white" ? "w" : "b";

  useEffect(() => {
    setSelectedSquare(null);
    setPendingPromotion(null);
  }, [fen]);

  useEffect(() => {
    if (disabled) {
      setSelectedSquare(null);
      setPendingPromotion(null);
    }
  }, [disabled]);

  const legalFromSelection = useMemo(() => {
    if (!game || !selectedSquare || disabled) return [];
    try {
      return game.moves({ square: selectedSquare, verbose: true });
    } catch {
      return [];
    }
  }, [game, selectedSquare, disabled]);

  const checkSquare = useMemo(() => (game ? kingSquareInCheck(game) : null), [game]);

  const squareStyles = useMemo(() => {
    const legal = legalFromSelection.map((m) => ({ to: m.to, captured: m.captured }));
    return buildSquareStyles(selectedSquare, legal, lastMove ?? null, checkSquare);
  }, [selectedSquare, legalFromSelection, lastMove, checkSquare]);

  const tryCompleteMove = useCallback(
    (from: Square, to: Square): boolean => {
      if (!game) return false;
      return onMove(from, to, undefined);
    },
    [game, onMove],
  );

  const openPromotionPicker = useCallback((from: Square, to: Square, choices: PieceSymbol[]) => {
    if (choices.length === 0) return;
    setSelectedSquare(null);
    setPendingPromotion({ from, to, choices });
  }, []);

  const choosePromotion = useCallback(
    (piece: PieceSymbol) => {
      if (!pendingPromotion || !pendingPromotion.choices.includes(piece)) return;
      const { from, to } = pendingPromotion;
      setPendingPromotion(null);
      const ok = onMove(from, to, piece);
      if (ok) setSelectedSquare(null);
    },
    [pendingPromotion, onMove],
  );

  const onSquareClick = useCallback(
    ({ square }: { piece: { pieceType: string } | null; square: string }) => {
      if (disabled || !game) {
        setSelectedSquare(null);
        return;
      }

      const sq = square as Square;
      const turn = game.turn();
      const boardPiece = game.get(sq);

      if (selectedSquare && selectedSquare !== sq) {
        const isLegalDest = legalFromSelection.some((m) => m.to === sq);
        if (isLegalDest) {
          const choices = promotionChoicesForTarget(legalFromSelection, selectedSquare, sq);
          if (choices.length > 0) {
            openPromotionPicker(selectedSquare, sq, choices);
            return;
          }
          if (tryCompleteMove(selectedSquare, sq)) setSelectedSquare(null);
          return;
        }
      }

      if (!boardPiece) {
        setSelectedSquare(null);
        return;
      }

      if (boardPiece.color !== turn || boardPiece.color !== myChar) {
        setSelectedSquare(null);
        return;
      }

      if (selectedSquare === sq) {
        setSelectedSquare(null);
        return;
      }

      setSelectedSquare(sq);
    },
    [disabled, game, selectedSquare, legalFromSelection, tryCompleteMove, myChar, openPromotionPicker],
  );

  const canDragPiece = useCallback(
    ({ square }: { square: string | null }) => {
      if (disabled || !game || !square) return false;
      const boardPiece = game.get(square as Square);
      if (!boardPiece) return false;
      return boardPiece.color === game.turn() && boardPiece.color === myChar;
    },
    [disabled, game, myChar],
  );

  const onPieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
      if (!targetSquare || disabled || !game) return false;
      const src = sourceSquare as Square;
      const tgt = targetSquare as Square;
      if (!canDragPiece({ square: sourceSquare })) return false;

      const moves = game.moves({ square: src, verbose: true });
      const isLegal = moves.some((m) => m.from === src && m.to === tgt);
      if (!isLegal) return false;

      const choices = promotionChoicesForTarget(moves, src, tgt);
      if (choices.length > 0) {
        openPromotionPicker(src, tgt, choices);
        return false;
      }

      const ok = onMove(src, tgt, undefined);
      if (ok) setSelectedSquare(null);
      return ok;
    },
    [disabled, game, onMove, canDragPiece, openPromotionPicker],
  );

  const promotionDialogOpen = pendingPromotion !== null;

  return (
    <>
      <div className="w-full max-w-[640px] mx-auto aspect-square">
        <Chessboard
          options={{
            position: fen,
            boardOrientation: orientation,
            allowDragging: !disabled,
            animationDurationInMs: 200,
            showNotation: true,
            lightSquareStyle: { backgroundColor: "oklch(0.94 0.02 90)" },
            darkSquareStyle: { backgroundColor: "oklch(0.55 0.06 150)" },
            squareStyles,
            boardStyle: {
              borderRadius: "8px",
              boxShadow: "0 4px 24px -8px oklch(0 0 0 / 0.2)",
              overflow: "hidden",
            },
            canDragPiece,
            onSquareClick,
            onPieceDrop,
          }}
        />
      </div>

      <Dialog
        open={promotionDialogOpen}
        onOpenChange={(open) => {
          if (!open) setPendingPromotion(null);
        }}
      >
        <DialogContent className="sm:max-w-md" aria-describedby="promotion-dialog-desc">
          <DialogHeader>
            <DialogTitle>Pawn promotion</DialogTitle>
            <DialogDescription id="promotion-dialog-desc">
              Choose a piece. The move is not played until you confirm.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-col gap-2 sm:space-x-0">
            {pendingPromotion?.choices.map((p) => (
              <Button
                key={p}
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => choosePromotion(p)}
              >
                {PROMOTION_LABEL[p as keyof typeof PROMOTION_LABEL]}
              </Button>
            ))}
            <Button type="button" variant="ghost" className="w-full" onClick={() => setPendingPromotion(null)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
