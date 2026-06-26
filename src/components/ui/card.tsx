import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  id?: string;
}

export function Card({ children, className = "", id }: CardProps) {
  return <section className={`rounded-lg border bg-card ${className}`} id={id}>{children}</section>;
}
