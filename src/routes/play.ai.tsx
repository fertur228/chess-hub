import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export const Route = createFileRoute("/play/ai")({
  head: () => ({ meta: [{ title: "Train against Coach Bot — ChessCoach Arena" }] }),
  component: () => <RequireAuth><AppShell><AISetup /></AppShell></RequireAuth>,
});

const difficulties = [
  { id: "Easy", desc: "Good for beginners.", recommended: true },
  { id: "Medium", desc: "For users who know the rules." },
  { id: "Hard", desc: "More challenging practice." },
];
const colors = [{ id: "white", label: "White" }, { id: "random", label: "Random" }, { id: "black", label: "Black" }];

function AISetup() {
  const navigate = useNavigate();
  const [diff, setDiff] = useState("Easy");
  const [color, setColor] = useState("white");

  const start = () => {
    const c = color === "random" ? (Math.random() < 0.5 ? "white" : "black") : color;
    navigate({ to: "/game/ai", search: { difficulty: diff, color: c } });
  };

  return (
    <PageContainer>
      <PageHeader title="Train against Coach Bot" subtitle="Practice without affecting your rating." />
      <div className="card-surface p-6 md:p-8 max-w-3xl">
        <div className="mb-6">
          <Label>Difficulty</Label>
          <div className="grid sm:grid-cols-3 gap-3 mt-2">
            {difficulties.map((d) => (
              <button key={d.id} onClick={() => setDiff(d.id)} type="button"
                className={cn("text-left p-4 rounded-lg border-2 transition-colors", diff === d.id ? "border-primary bg-primary-soft" : "border-border hover:border-primary/40")}>
                <div className="flex items-center justify-between">
                  <div className="font-display font-bold text-lg">{d.id}</div>
                  {diff === d.id && <Check className="h-4 w-4 text-primary" />}
                </div>
                <div className="text-sm text-muted-foreground mt-1">{d.desc}</div>
                {d.recommended && <div className="mt-2 text-xs font-semibold text-primary">Recommended</div>}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <Label>Your color</Label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {colors.map((c) => (
              <button key={c.id} type="button" onClick={() => setColor(c.id)}
                className={cn("p-3 rounded-lg border-2 font-medium transition-colors",
                  color === c.id ? "border-primary bg-primary-soft" : "border-border hover:border-primary/40")}>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg bg-warning/10 text-warning-foreground p-4 text-sm border border-warning/20 mb-6">
          AI games are training games. They do not affect your online rating.
        </div>

        <Button size="lg" onClick={start}>Start AI game</Button>
      </div>
    </PageContainer>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="font-semibold text-sm">{children}</div>;
}
