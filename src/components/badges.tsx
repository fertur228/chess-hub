import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function GameTypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    "Ranked": "bg-primary-soft text-accent-foreground border-transparent",
    "Casual": "bg-muted text-muted-foreground border-transparent",
    "AI Training": "bg-warning/20 text-warning-foreground border-transparent",
  };
  return <Badge variant="outline" className={cn("font-medium", map[type] || "")}>{type}</Badge>;
}

export function ResultBadge({ result }: { result: "win" | "loss" | "draw" }) {
  const map = {
    win: "bg-success/15 text-success border-success/20",
    loss: "bg-destructive/10 text-destructive border-destructive/20",
    draw: "bg-muted text-muted-foreground border-transparent",
  };
  const label = { win: "Win", loss: "Loss", draw: "Draw" }[result];
  return <Badge variant="outline" className={cn("font-semibold uppercase text-[10px] tracking-wider", map[result])}>{label}</Badge>;
}

export function RatingDelta({ delta }: { delta: number | null | undefined }) {
  if (delta == null) return <span className="text-muted-foreground text-sm">—</span>;
  if (delta === 0) return <span className="text-muted-foreground text-sm font-medium">±0</span>;
  const positive = delta > 0;
  return (
    <span className={cn("text-sm font-semibold", positive ? "text-success" : "text-destructive")}>
      {positive ? "+" : ""}{delta}
    </span>
  );
}
