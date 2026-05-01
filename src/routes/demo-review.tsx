import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { MarketingLayout } from "@/components/marketing-layout";
import { AppShell } from "@/components/app-shell";
import { PageContainer } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { BookOpen, Sparkles } from "lucide-react";

export const Route = createFileRoute("/demo-review")({
  head: () => ({ meta: [{ title: "Demo Review — ChessCoach Arena" }] }),
  component: DemoRoute,
});

function DemoRoute() {
  const { user } = useAuth();
  const Wrapper = user ? AppShell : MarketingLayout;
  return <Wrapper><PageContainer><Demo /></PageContainer></Wrapper>;
}

const moments = [
  { t: "Opening", d: "You played the Italian opening. A friendly opening for beginners — easy to remember." },
  { t: "Middlegame", d: "On move 14 you traded a knight for a bishop. A fair trade in most positions." },
  { t: "Endgame", d: "You finished with a back-rank checkmate. A classic pattern — well spotted." },
];

function Demo() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-soft text-accent-foreground text-xs font-semibold mb-3">
          <BookOpen className="h-3 w-3" /> Sample game review
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-bold">This is what every game looks like.</h1>
        <p className="text-muted-foreground mt-3">Plain-English breakdowns of what went well and what to improve next time.</p>
      </div>

      <div className="card-surface p-6 md:p-8 mb-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Result</div>
            <div className="font-display text-2xl font-bold mt-0.5">Win vs Coach Bot</div>
          </div>
          <span className="px-3 py-1.5 rounded-md bg-success/15 text-success text-xs font-bold uppercase">Win</span>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t">
          <div><div className="text-xs text-muted-foreground">Type</div><div className="font-semibold mt-0.5">Ranked</div></div>
          <div><div className="text-xs text-muted-foreground">Moves</div><div className="font-semibold mt-0.5">28</div></div>
          <div><div className="text-xs text-muted-foreground">Date</div><div className="font-semibold mt-0.5">Today</div></div>
        </div>
      </div>

      <div className="card-surface p-6 md:p-8 mb-5">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rating change</div>
        <div className="flex items-baseline gap-3 mt-1">
          <div className="font-display text-4xl font-bold">812</div>
          <div className="text-sm text-muted-foreground">→</div>
          <div className="font-display text-4xl font-bold">830</div>
          <div className="text-success font-display text-xl font-bold ml-2">+18</div>
        </div>
        <p className="text-sm text-muted-foreground mt-2">You gained rating because you defeated a slightly stronger opponent.</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mb-5">
        {moments.map((m) => (
          <div key={m.t} className="card-surface p-5">
            <div className="text-xs font-semibold text-primary uppercase tracking-wider">{m.t}</div>
            <div className="text-sm mt-2">{m.d}</div>
          </div>
        ))}
      </div>

      <div className="card-surface p-6 bg-gradient-to-br from-primary-soft to-card mb-8">
        <div className="flex items-center gap-2 text-xs font-semibold text-accent-foreground uppercase tracking-wide mb-2">
          <Sparkles className="h-3.5 w-3.5" /> Coach note
        </div>
        <p className="font-medium">In your next game, focus on protecting your pieces before attacking. You played well — keep that calm style.</p>
      </div>

      <div className="text-center bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-2xl p-8 md:p-10">
        <h2 className="font-display text-2xl md:text-3xl font-bold">Ready to review your own games?</h2>
        <p className="opacity-90 mt-2">Create an account and start playing. Free.</p>
        <div className="mt-5 flex gap-2 justify-center">
          <Button asChild size="lg" variant="secondary"><Link to="/signup">Create account</Link></Button>
          <Button asChild size="lg" variant="outline" className="bg-transparent text-primary-foreground border-primary-foreground/40 hover:bg-primary-foreground/10 hover:text-primary-foreground">
            <Link to="/">Start playing</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
