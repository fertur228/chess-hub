import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Crown, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Sign up — ChessCoach Arena" }] }),
  component: SignUp,
});

function SignUp() {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    navigate({ to: profile?.onboarded === false ? "/onboarding" : "/dashboard" });
  }, [loading, user, profile, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd !== pwd2) { toast.error("Passwords do not match"); return; }
    if (pwd.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (username.length < 3) { toast.error("Username must be at least 3 characters"); return; }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email, password: pwd,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { username },
      },
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    if (!data.session) {
      toast.success("Account created. Check your email to confirm before logging in.");
      navigate({ to: "/login" });
      return;
    }
    toast.success("Account created!");
    navigate({ to: "/onboarding" });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-10">
      <Link to="/" className="flex items-center gap-2 mb-8">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Crown className="h-5 w-5" /></div>
        <span className="font-display text-xl font-bold">ChessCoach Arena</span>
      </Link>
      <div className="w-full max-w-md card-surface p-8">
        <h1 className="font-display text-2xl font-bold">Create your account</h1>
        <p className="text-muted-foreground text-sm mt-1">Create your account and start your first chess game.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div className="space-y-1.5"><Label htmlFor="username">Username</Label><Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} /></div>
          <div className="space-y-1.5"><Label htmlFor="pwd">Password</Label><Input id="pwd" type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} required minLength={6} /></div>
          <div className="space-y-1.5"><Label htmlFor="pwd2">Confirm password</Label><Input id="pwd2" type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} required /></div>
          <Button type="submit" className="w-full" size="lg" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Create account
          </Button>
        </form>
        <div className="text-sm text-center mt-5 text-muted-foreground">
          Already have an account? <Link to="/login" className="text-primary font-medium hover:underline">Log in</Link>
        </div>
      </div>
    </div>
  );
}
