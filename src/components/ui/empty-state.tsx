import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="grid place-items-center gap-2 rounded border border-dashed bg-muted/20 p-8 text-center">
      <Inbox aria-hidden="true" className="size-6 text-subdued" strokeWidth={1.5} />
      <p className="font-medium">{title}</p>
      {description ? <p className="max-w-sm text-sm text-subdued">{description}</p> : null}
      {action}
    </div>
  );
}
