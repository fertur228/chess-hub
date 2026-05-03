import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Crown, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Log in — ChessCoach Arena" }] }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    navigate({ to: profile?.onboarded === false ? "/onboarding" : "/dashboard" });
  }, [loading, user, profile, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pwd });
    setBusy(false);
    if (error) { toast.error(error.message || "Invalid email or password"); return; }
    toast.success("Welcome back!");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-10">
      <Link to="/" className="flex items-center gap-2 mb-8">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Crown className="h-5 w-5" /></div>
        <span className="font-display text-xl font-bold">ChessCoach Arena</span>
      </Link>
      <div className="w-full max-w-md card-surface p-8">
        <h1 className="font-display text-2xl font-bold">Welcome back</h1>
        <p className="text-muted-foreground text-sm mt-1">Log in to continue your chess journey.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="pwd">Password</Label>
              <span className="text-xs text-muted-foreground">Forgot? Contact support.</span>
            </div>
            <Input id="pwd" type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Log in
          </Button>
        </form>
        <div className="text-sm text-center mt-5 text-muted-foreground">
          Don't have an account? <Link to="/signup" className="text-primary font-medium hover:underline">Sign up</Link>
        </div>
      </div>
    </div>
  );
}
