import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions, className }: {
  title: string; subtitle?: string; actions?: ReactNode; className?: string;
}) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6", className)}>
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto max-w-6xl px-4 md:px-6 py-6 md:py-8", className)}>{children}</div>;
}
