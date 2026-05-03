import { createFileRoute, Link } from "@tanstack/react-router";
import { PageContainer, PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Bot, Users, Hash, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/play/")(({
  head: () => ({ meta: [{ title: "Play — ChessCoach Arena" }] }),
  component: PlayLobby,
}));

function PlayLobby() {
  return (
    <PageContainer>
      <PageHeader title="Play a game" subtitle="How would you like to play?" />
      <div className="grid md:grid-cols-2 gap-4">
        <Card
          icon={<Bot className="h-6 w-6" />}
          title="Play vs AI"
          desc="Best for practice. Does not affect rating."
          cta="Start AI Game"
          href="/play/ai"
          highlighted
        />
        <Card
          icon={<Search className="h-6 w-6" />}
          title="Find Match"
          desc="Play casual or ranked against another player."
          cta="Find Match"
          href="/play/find"
        />
        <Card
          icon={<Users className="h-6 w-6" />}
          title="Create Private Room"
          desc="Create a casual room and invite a friend with a link."
          cta="Create room"
          href="/play/create"
        />
        <Card
          icon={<Hash className="h-6 w-6" />}
          title="Join by Code"
          desc="Already have a room code? Join here."
          cta="Join game"
          href="/play/join"
        />
      </div>

      <div className="mt-8 card-surface p-5 text-sm">
        <div className="font-semibold mb-1.5">About game types</div>
        <ul className="text-muted-foreground space-y-1">
          <li>
            • <strong className="text-foreground">Ranked</strong> games affect your rating.
          </li>
          <li>
            • <strong className="text-foreground">Casual</strong> games do not affect rating.
          </li>
          <li>
            • <strong className="text-foreground">AI Training</strong> games do not affect rating.
          </li>
        </ul>
      </div>
    </PageContainer>
  );
}

function Card({
  icon,
  title,
  desc,
  cta,
  href,
  highlighted,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  cta: string;
  href: string;
  highlighted?: boolean;
}) {
  return (
    <Link
      to={href}
      className={cn(
        "card-surface p-6 hover:shadow-md transition-all block",
        highlighted ? "ring-2 ring-primary/20" : "",
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-accent-foreground mb-4">{icon}</div>
      <h3 className="font-display text-lg font-bold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1.5">{desc}</p>
      <div
        className={cn(
          buttonVariants({ variant: highlighted ? "default" : "outline" }),
          "mt-5 w-full pointer-events-none",
        )}
      >
        {cta}
      </div>
    </Link>
  );
}
