import { Link, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { Crown, Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";

const links = [
  { to: "/", label: "Home" },
  { to: "/demo-review", label: "Demo Review" },
  { to: "/leaderboard", label: "Leaderboard" },
  { to: "/pricing", label: "Pricing" },
] as const;

export function MarketingLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-40">
        <div className="mx-auto max-w-6xl px-4 md:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Crown className="h-5 w-5" />
            </div>
            <span className="font-display text-lg font-bold">ChessCoach Arena</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  path === l.to ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-2">
            {user ? (
              <Button asChild><Link to="/dashboard">Open app</Link></Button>
            ) : (
              <>
                <Button asChild variant="ghost"><Link to="/login">Log in</Link></Button>
                <Button asChild><Link to="/signup">Sign up</Link></Button>
              </>
            )}
          </div>
          <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
        {open && (
          <div className="md:hidden border-t bg-background px-4 py-3 space-y-1">
            {links.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setOpen(false)}
                className="block px-3 py-2 text-sm font-medium rounded-md hover:bg-muted">
                {l.label}
              </Link>
            ))}
            <div className="pt-2 flex flex-col gap-2">
              {user ? (
                <Button asChild><Link to="/dashboard">Open app</Link></Button>
              ) : (
                <>
                  <Button asChild variant="ghost"><Link to="/login">Log in</Link></Button>
                  <Button asChild><Link to="/signup">Sign up</Link></Button>
                </>
              )}
            </div>
          </div>
        )}
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t py-8 mt-12">
        <div className="mx-auto max-w-6xl px-4 md:px-6 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4" />
            <span>ChessCoach Arena</span>
          </div>
          <div>Play chess. Track your rating. Understand your progress.</div>
        </div>
      </footer>
    </div>
  );
}
