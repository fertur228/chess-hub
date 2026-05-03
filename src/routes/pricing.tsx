import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { MarketingLayout } from "@/components/marketing-layout";
import { AppShell } from "@/components/app-shell";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Check, Crown } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  head: () => ({ meta: [{ title: "Pricing — ChessCoach Arena" }] }),
  component: PricingRoute,
});

function PricingRoute() {
  const { user } = useAuth();
  const Wrapper = user ? AppShell : MarketingLayout;
  return <Wrapper><PageContainer><Pricing /></PageContainer></Wrapper>;
}

const free = ["Online casual games", "Easy AI training", "Basic rating", "Basic profile", "Limited game history", "Basic game review"];
const pro = ["Medium and Hard AI", "Unlimited ranked games", "Full game history", "Advanced game review", "Deeper progress insights", "Profile customization"];

function Pricing() {
  const { user } = useAuth();
  return (
    <>
      <PageHeader title="Choose how you want to improve" subtitle="Pick a plan that fits your chess journey." />
      <div className="grid md:grid-cols-2 gap-5 max-w-4xl">
        <Plan name="Free" price="$0" tagline="Perfect to get started." features={free} cta={<Button variant="outline" className="w-full" disabled>Current plan</Button>} />
        <Plan name="Pro" price="$6/mo" tagline="For players who want to level up." features={pro} highlighted
          cta={<Button className="w-full" disabled>Upgrade to Pro</Button>} />
      </div>
      <div className="mt-6 text-sm text-muted-foreground max-w-4xl">
        <strong>Pro does not give gameplay advantage.</strong> It only unlocks learning, history, review, and customization features.
        {user && (
          <>
            {" "}
            Try the <Link to="/store" className="font-medium text-foreground underline">Arena Coin store</Link> for demo board skins and avatar frames (mock checkout only).
          </>
        )}
      </div>

      <div className="mt-12 max-w-3xl">
        <h2 className="font-display text-2xl font-bold mb-4">FAQ</h2>
        <div className="space-y-3">
          <Faq q="Can I play for free?" a="Yes. Free includes online casual games and Easy AI training." />
          <Faq q="Does Pro affect rating?" a="No. Pro only unlocks learning and customization features." />
          <Faq q="Can I cancel anytime?" a="Yes, cancel any time from settings." />
          <Faq q="Is Pro pay-to-win?" a="No. Pro never gives gameplay advantage." />
        </div>
      </div>
    </>
  );
}

function Plan({ name, price, tagline, features, cta, highlighted }: { name: string; price: string; tagline: string; features: string[]; cta: React.ReactNode; highlighted?: boolean; }) {
  return (
    <div className={`card-surface p-6 md:p-8 ${highlighted ? "ring-2 ring-primary relative" : ""}`}>
      {highlighted && <div className="absolute -top-3 left-6 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1"><Crown className="h-3 w-3" /> POPULAR</div>}
      <h3 className="font-display text-xl font-bold">{name}</h3>
      <p className="text-sm text-muted-foreground mt-1">{tagline}</p>
      <div className="mt-4 font-display text-4xl font-bold">{price}</div>
      <div className="mt-6">{cta}</div>
      <ul className="mt-6 space-y-2.5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm">
            <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" /><span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div className="card-surface p-5">
      <div className="font-semibold">{q}</div>
      <div className="text-sm text-muted-foreground mt-1">{a}</div>
    </div>
  );
}

// also export Link so unused-import linter is happy in dev (not strictly needed)
export { Link };
