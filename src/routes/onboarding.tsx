import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Sparkles, Check } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Welcome — ChessCoach Arena" }] }),
  component: () => <RequireAuth><AppShell><Onboarding /></AppShell></RequireAuth>,
});

const levels = [
  { id: "new", label: "I am new to chess" },
  { id: "rules", label: "I know the rules" },
  { id: "sometimes", label: "I play sometimes" },
  { id: "improve", label: "I want to improve my rating" },
];
const goals = [
  { id: "casual", label: "Play casually" },
  { id: "improve", label: "Improve step by step" },
  { id: "compete", label: "Compete with others" },
  { id: "track", label: "Track my progress" },
];

function Onboarding() {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [level, setLevel] = useState<string>("");
  const [goal, setGoal] = useState<string>("");

  const finish = async (skip = false) => {
    if (!user) return;
    await supabase.from("profiles").update({
      skill_level: skip ? null : level,
      goal: skip ? null : goal,
      onboarded: true,
    }).eq("user_id", user.id);
    await refreshProfile();
    toast.success("All set! Let's play.");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="mx-auto max-w-2xl px-4 md:px-6 py-10 md:py-16">
      <div className="card-surface p-8 md:p-10">
        {step === 0 && (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-accent-foreground mb-5"><Sparkles className="h-6 w-6" /></div>
            <h1 className="font-display text-3xl font-bold">Welcome to ChessCoach Arena</h1>
            <p className="text-muted-foreground mt-2">Let's set up your account in 30 seconds. We'll use this to personalize your experience.</p>
            <div className="mt-8 flex gap-2">
              <Button size="lg" onClick={() => setStep(1)}>Get started</Button>
              <Button size="lg" variant="ghost" onClick={() => finish(true)}>Skip</Button>
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <div className="text-xs font-semibold text-primary uppercase tracking-wider">Step 1 of 2</div>
            <h2 className="font-display text-2xl font-bold mt-1">What's your chess experience?</h2>
            <div className="mt-6 grid gap-2">
              {levels.map((l) => (
                <button key={l.id} type="button" onClick={() => setLevel(l.id)}
                  className={cn("flex items-center justify-between p-4 rounded-lg border text-left transition-colors",
                    level === l.id ? "border-primary bg-primary-soft" : "hover:bg-muted")}>
                  <span className="font-medium">{l.label}</span>
                  {level === l.id && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
            <div className="mt-8 flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => finish(true)}>Skip</Button>
              <Button onClick={() => setStep(2)} disabled={!level}>Next</Button>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <div className="text-xs font-semibold text-primary uppercase tracking-wider">Step 2 of 2</div>
            <h2 className="font-display text-2xl font-bold mt-1">What's your goal?</h2>
            <div className="mt-6 grid gap-2">
              {goals.map((g) => (
                <button key={g.id} type="button" onClick={() => setGoal(g.id)}
                  className={cn("flex items-center justify-between p-4 rounded-lg border text-left transition-colors",
                    goal === g.id ? "border-primary bg-primary-soft" : "hover:bg-muted")}>
                  <span className="font-medium">{g.label}</span>
                  {goal === g.id && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </div>
            <div className="mt-8 flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => finish(true)}>Skip</Button>
              <Button onClick={() => finish()} disabled={!goal}>Finish setup</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
