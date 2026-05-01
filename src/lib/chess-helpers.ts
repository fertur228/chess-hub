import { Chess } from "chess.js";

export type Difficulty = "Easy" | "Medium" | "Hard";

// Simple Coach Bot AI:
// - Easy: random legal move
// - Medium: prefer captures, then random
// - Hard: 1-ply material-greedy with mate-in-1 detection
const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export function aiMove(fen: string, difficulty: Difficulty): string | null {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return null;

  if (difficulty === "Easy") {
    return moves[Math.floor(Math.random() * moves.length)].san;
  }

  if (difficulty === "Medium") {
    const captures = moves.filter((m) => m.captured);
    const pool = captures.length ? captures : moves;
    return pool[Math.floor(Math.random() * pool.length)].san;
  }

  // Hard: score each move
  let best = moves[0];
  let bestScore = -Infinity;
  for (const m of moves) {
    const test = new Chess(fen);
    test.move(m.san);
    let score = m.captured ? PIECE_VALUE[m.captured] * 10 : 0;
    if (test.isCheckmate()) score += 1000;
    else if (test.inCheck()) score += 1;
    // penalize moves that allow opponent capture of high-value piece
    const oppMoves = test.moves({ verbose: true });
    let worstLoss = 0;
    for (const om of oppMoves) {
      if (om.captured) {
        const v = PIECE_VALUE[om.captured] * 10;
        if (v > worstLoss) worstLoss = v;
      }
    }
    score -= worstLoss * 0.8;
    score += Math.random() * 0.5;
    if (score > bestScore) { bestScore = score; best = m; }
  }
  return best.san;
}

export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function eloChange(myRating: number, oppRating: number, score: 1 | 0 | 0.5, k = 32): number {
  const expected = 1 / (1 + Math.pow(10, (oppRating - myRating) / 400));
  return Math.round(k * (score - expected));
}

export type GameReview = {
  keyMoments: { title: string; text: string }[];
  coachNote: string;
};

export function generateReview(opts: {
  pgn: string;
  movesCount: number;
  result: "win" | "loss" | "draw";
  endReason: string;
}): GameReview {
  const { movesCount, result, endReason } = opts;
  const moments: { title: string; text: string }[] = [];

  if (movesCount < 15) {
    moments.push({ title: "Opening", text: "The game ended early. Try to develop your knights and bishops in the first moves." });
  } else {
    moments.push({ title: "Opening", text: "You moved your pieces out and got ready for the middle of the game. Good start." });
  }

  if (movesCount >= 15 && movesCount < 40) {
    moments.push({ title: "Middlegame", text: "The middlegame is when most pieces are traded. Look for safe squares for your king." });
  } else if (movesCount >= 40) {
    moments.push({ title: "Long game", text: "You played a long game. That builds patience — a key chess skill." });
  }

  if (endReason === "checkmate") {
    moments.push({ title: "Endgame", text: result === "win" ? "You finished the game with checkmate. Nicely done." : "Your opponent found a checkmate. Try to keep your king safe with pieces around it." });
  } else if (endReason === "resignation") {
    moments.push({ title: "Endgame", text: result === "win" ? "Your opponent resigned. They felt the position was lost." : "You resigned. Sometimes it's better to fight on — the opponent can make mistakes too." });
  } else if (endReason === "draw" || endReason === "stalemate") {
    moments.push({ title: "Endgame", text: "The game ended in a draw. A draw is half a point — not bad against a tough opponent." });
  } else {
    moments.push({ title: "Endgame", text: "Every game teaches you something new about how pieces work together." });
  }

  let coachNote = "";
  if (result === "win") {
    coachNote = "Nice win! In your next game, try to keep pieces protected before going on the attack.";
  } else if (result === "loss") {
    coachNote = "You lost this one, but every game makes you better. Focus on protecting your queen and king.";
  } else {
    coachNote = "A draw is a fair result. Next game, try to push for a small advantage in the opening.";
  }

  return { keyMoments: moments, coachNote };
}
