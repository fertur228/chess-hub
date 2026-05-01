import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({ icon, title, description, action, className }: {
  icon?: ReactNode; title: string; description?: string; action?: ReactNode; className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-12 px-6 rounded-xl border border-dashed bg-muted/30", className)}>
      {icon && <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-accent-foreground">{icon}</div>}
      <h3 className="font-semibold text-lg">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
