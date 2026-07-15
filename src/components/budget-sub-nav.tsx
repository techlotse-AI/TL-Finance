"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const BUDGET_LINKS = [
  { href: "/", label: "Monthly plan" },
  { href: "/income", label: "Income" },
  { href: "/accounts", label: "Accounts" },
  { href: "/transfers", label: "Transfers" },
  { href: "/categories", label: "Categories" },
  { href: "/budget", label: "Budget items" },
] as const;

/** Cross-links the six Budget-tier pages so they read as one workspace, not disconnected routes. */
export function BudgetSubNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Budget sections" className="flex flex-wrap gap-2 border-b pb-2">
      {BUDGET_LINKS.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={`rounded px-3 py-1.5 text-sm font-medium transition ${
              active
                ? "bg-gradient-to-br from-brand-violet to-brand-teal text-white"
                : "bg-muted text-subdued hover:text-foreground"
            }`}
            href={href}
            key={href}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
