import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger";
}

export function Button({ children, className = "", variant = "primary", ...props }: ButtonProps) {
  const variants = {
    primary:
      "bg-gradient-to-br from-brand-violet to-brand-teal text-white hover:brightness-110",
    secondary: "border border-border bg-muted text-foreground hover:bg-card",
    danger: "border border-status-danger/40 bg-status-danger/10 text-status-danger",
  };

  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
