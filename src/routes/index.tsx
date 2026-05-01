import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing-layout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { Bot, Users, Trophy, History, Sparkles, BookOpen, Crown, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ChessCoach Arena — Play chess. Track rating. Improve." },
      { name: "description", content: "A beginner-friendly chess platform. Train against AI, play online matches, and learn from every game." },
    ],
  }),
  component: Index,
});

const features = [
  { icon: Bot, title: "Play vs AI", text: "Train against Coach Bot at your own pace. Three difficulty levels." },
  { icon: Users, title: "Online rooms", text: "Invite a friend with a link or join with a 6-letter code." },
  { icon: Trophy, title: "Ranked games", text: "Climb the leaderboard with rated online matches." },
  { icon: BookOpen, title: "Game review", text: "Plain-English breakdowns of what went well and what to improve." },
  { icon: Sparkles, title: "Personal profile", text: "Track your rating, streak, and progress over time." },
  { icon: History, title: "Game history", text: "Revisit every game with filters and one-click reviews." },
];

const steps = [
  { n: 1, title: "Choose a mode", text: "AI training or online match." },
  { n: 2, title: "Play a game", text: "Make legal moves on a clean board." },
  { n: 3, title: "See your result", text: "Win, loss, or draw — clearly explained." },
  { n: 4, title: "Improve", text: "Read your coach note and play again." },
];

function Index() {
  const { user } = useAuth();
  const startHref = user ? "/dashboard" : "/signup";
  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 md:px-6 pt-12 md:pt-20 pb-12">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-soft text-accent-foreground text-xs font-semibold mb-5">
            <Sparkles className="h-3 w-3" /> Beginner-friendly chess platform
          </div>
          <h1 className="font-display text-4xl md:text-6xl font-bold tracking-tight leading-tight">
            Play chess.<br />
            Track your rating.<br />
            <span className="text-primary">Understand your progress.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
            A beginner-friendly chess platform where you can train against AI, play online matches, and learn from every game.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to={startHref}>Start playing <ArrowRight className="h-4 w-4 ml-1" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/demo-review">View demo review</Link>
            </Button>
          </div>
        </div>

        {/* Product preview */}
        <div className="mt-14 md:mt-20 grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2 card-surface p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Game Review</div>
                <div className="font-semibold text-lg mt-0.5">Win vs Coach Bot</div>
              </div>
              <span className="px-2.5 py-1 rounded-md bg-success/15 text-success text-xs font-bold uppercase">Win</span>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {[
                { t: "Opening", d: "You developed your knights early. Solid start." },
                { t: "Middlegame", d: "You won a free pawn on move 14." },
                { t: "Endgame", d: "Finished with a clean checkmate. Nice." },
              ].map((m) => (
                <div key={m.t} className="rounded-lg border bg-background p-3">
                  <div className="text-xs font-semibold text-primary uppercase tracking-wide">{m.t}</div>
                  <div className="text-sm mt-1.5">{m.d}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg bg-primary-soft p-4">
              <div className="text-xs font-semibold text-accent-foreground uppercase tracking-wide mb-1">Coach note</div>
              <div className="text-sm">In your next game, focus on protecting your pieces before attacking.</div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="card-surface p-5">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Current rating</div>
              <div className="font-display text-3xl font-bold mt-1 flex items-baseline gap-2">
                842 <span className="text-success text-sm font-semibold">+18</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">After your last ranked game</div>
            </div>
            <div className="card-surface p-5">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Win rate</div>
              <div className="font-display text-3xl font-bold mt-1">62%</div>
              <div className="text-xs text-muted-foreground mt-1">Last 12 games</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 md:px-6 py-16">
        <div className="max-w-2xl mb-10">
          <h2 className="font-display text-3xl md:text-4xl font-bold">Everything you need to improve</h2>
          <p className="text-muted-foreground mt-3">Not just a chess board. A learning loop that helps you get better, game by game.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="card-surface p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-soft text-accent-foreground mb-4">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-lg">{f.title}</h3>
                <p className="text-sm text-muted-foreground mt-1.5">{f.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 md:px-6 py-16 border-t">
        <div className="max-w-2xl mb-10">
          <h2 className="font-display text-3xl md:text-4xl font-bold">How it works</h2>
          <p className="text-muted-foreground mt-3">A simple, repeatable loop.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((s) => (
            <div key={s.n} className="relative card-surface p-6">
              <div className="font-display text-4xl font-bold text-primary/20">{String(s.n).padStart(2, "0")}</div>
              <h3 className="font-semibold mt-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 md:px-6 py-16">
        <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-10 md:p-14 text-center text-primary-foreground">
          <Crown className="h-10 w-10 mx-auto mb-4 opacity-90" />
          <h2 className="font-display text-3xl md:text-4xl font-bold">Start your first game</h2>
          <p className="mt-3 opacity-90 max-w-xl mx-auto">Free to start. No credit card. Just play.</p>
          <div className="mt-6">
            <Button asChild size="lg" variant="secondary">
              <Link to={startHref}>Start playing</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
