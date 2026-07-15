import {
  ArrowLeftRight,
  BarChart3,
  CircleDollarSign,
  Gauge,
  Landmark,
  LayoutDashboard,
  ListTree,
  Settings,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { LogoutButton } from "@/components/logout-button";

const navigation = [
  { href: "/", label: "Monthly plan", icon: LayoutDashboard },
  { href: "/income", label: "Income", icon: CircleDollarSign },
  { href: "/accounts", label: "Accounts", icon: Landmark },
  { href: "/transfers", label: "Transfers", icon: ArrowLeftRight },
  { href: "/categories", label: "Categories", icon: ListTree },
  { href: "/budget", label: "Budget items", icon: WalletCards },
  { href: "/analysis", label: "Analyze", icon: BarChart3 },
  { href: "/optimize", label: "Optimize", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/admin", label: "Admin", icon: ShieldCheck },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-[1480px] lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b bg-card/80 px-4 py-4 backdrop-blur lg:min-h-screen lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
        <Link className="mb-6 flex items-center gap-3 px-2" href="/">
          <span className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-brand-violet to-brand-teal">
            <Gauge aria-hidden="true" className="size-5 text-white" strokeWidth={1.5} />
          </span>
          <span>
            <span className="block text-sm font-semibold">TL Finance</span>
            <span className="block text-xs text-subdued">Household plan</span>
          </span>
        </Link>
        <nav aria-label="Primary navigation">
          <ul className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-1">
            {navigation.map(({ href, icon: Icon, label }) => (
              <li key={href}>
                <Link
                  className="flex min-h-10 items-center gap-3 rounded px-3 text-sm text-subdued transition hover:bg-muted hover:text-foreground"
                  href={href}
                >
                  <Icon aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.5} />
                  <span className="truncate">{label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-6 border-t pt-3">
          <LogoutButton />
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
    </div>
  );
}
