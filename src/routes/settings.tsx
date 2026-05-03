import { createFileRoute, Link } from "@tanstack/react-router";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/app-shell";
import { PageContainer, PageHeader } from "@/components/page-header";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — ChessCoach Arena" }] }),
  component: () => <RequireAuth><AppShell><SettingsPage /></AppShell></RequireAuth>,
});

function SettingsPage() {
  const { user, signOut } = useAuth();
  return (
    <PageContainer>
      <PageHeader title="Settings" subtitle="Manage your account and preferences." />
      <div className="space-y-5 max-w-2xl">
        <Section title="Account">
          <Row label="Email" value={user?.email || ""} />
          <p className="text-sm text-muted-foreground pt-1">
            Board themes and avatar frames:{" "}
            <Link to="/store" className="font-medium text-foreground underline underline-offset-2">
              Cosmetic store
            </Link>
            {" "}(Arena Coins — mock checkout in this demo).
          </p>
          <div className="pt-3">
            <Button variant="outline" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </Section>

        <Section title="Game preferences">
          <Toggle label="Move highlights" defaultChecked />
          <Toggle label="Sound effects" defaultChecked />
          <Toggle label="Show legal moves" defaultChecked />
        </Section>

        <Section title="Notifications">
          <Toggle label="Game invites" defaultChecked />
          <Toggle label="Rating updates" defaultChecked />
          <Toggle label="Product updates" />
        </Section>
      </div>
    </PageContainer>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card-surface p-6">
      <h2 className="font-display text-lg font-semibold mb-4">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between py-2 text-sm"><span className="text-muted-foreground">{label}</span><span className="font-medium">{value}</span></div>;
}
function Toggle({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <Label htmlFor={label} className="font-medium">{label}</Label>
      <Switch id={label} defaultChecked={defaultChecked} />
    </div>
  );
}
