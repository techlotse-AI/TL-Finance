import type { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "locked";
}

export function Badge({ children, tone = "neutral" }: BadgeProps) {
  const tones = {
    neutral: "border-border bg-muted text-subdued",
    success: "border-status-success/40 bg-status-success/10 text-status-success",
    warning: "border-status-warning/40 bg-status-warning/10 text-status-warning",
    danger: "border-status-danger/40 bg-status-danger/10 text-status-danger",
    locked: "border-brand-violet/40 bg-brand-violet/10 text-brand-teal",
  };

  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
