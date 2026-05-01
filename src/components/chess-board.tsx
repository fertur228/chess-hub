import { Chessboard } from "react-chessboard";

type Props = {
  fen: string;
  orientation: "white" | "black";
  onMove: (from: string, to: string, promotion?: string) => boolean;
  disabled?: boolean;
};

export function ChessBoard({ fen, orientation, onMove, disabled }: Props) {
  return (
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
          boardStyle: {
            borderRadius: "8px",
            boxShadow: "0 4px 24px -8px oklch(0 0 0 / 0.2)",
            overflow: "hidden",
          },
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            if (!targetSquare || disabled) return false;
            return onMove(sourceSquare, targetSquare, "q");
          },
        }}
      />
    </div>
  );
}
