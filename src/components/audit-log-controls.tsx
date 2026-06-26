"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { AUDIT_PAGE_SIZES } from "@/lib/platform/audit-query";

const input = "min-h-10 w-full rounded border bg-muted px-3 text-sm";

export interface AuditControlsState {
  action?: string;
  resourceType?: string;
  from?: string;
  to?: string;
  size: number;
  page: number;
  totalPages: number;
  total: number;
  hasPrev: boolean;
  hasNext: boolean;
}

/**
 * Filter, page-size, and pagination controls for the admin audit log. All state
 * lives in the URL (`audit*` query params) so the server can filter and
 * paginate at the database; this component only rewrites the query string.
 */
export function AuditLogControls({
  actions,
  resourceTypes,
  current,
}: {
  actions: string[];
  resourceTypes: string[];
  current: AuditControlsState;
}) {
  const router = useRouter();

  function navigate(overrides: Partial<Record<string, string | number | undefined>>) {
    const merged: Record<string, string | number | undefined> = {
      auditAction: current.action,
      auditResource: current.resourceType,
      auditFrom: current.from,
      auditTo: current.to,
      auditSize: current.size,
      auditPage: current.page,
      ...overrides,
    };
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) {
      if (value !== undefined && value !== "") params.set(key, String(value));
    }
    router.push(`/admin?${params.toString()}#audit`);
  }

  function applyFilters(data: FormData) {
    navigate({
      auditAction: String(data.get("action") ?? ""),
      auditResource: String(data.get("resourceType") ?? ""),
      auditFrom: String(data.get("from") ?? ""),
      auditTo: String(data.get("to") ?? ""),
      auditPage: 1, // reset to first page when filters change
    });
  }

  function reset() {
    router.push("/admin#audit");
  }

  return (
    <div className="grid gap-4 border-b px-5 py-4">
      <form action={applyFilters} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <label className="grid gap-1 text-xs text-subdued">Action<select className={input} defaultValue={current.action ?? ""} name="action">
          <option value="">All actions</option>
          {actions.map((value) => <option key={value} value={value}>{value}</option>)}
        </select></label>
        <label className="grid gap-1 text-xs text-subdued">Resource<select className={input} defaultValue={current.resourceType ?? ""} name="resourceType">
          <option value="">All resources</option>
          {resourceTypes.map((value) => <option key={value} value={value}>{value}</option>)}
        </select></label>
        <label className="grid gap-1 text-xs text-subdued">From<input className={input} defaultValue={current.from ?? ""} name="from" type="date" /></label>
        <label className="grid gap-1 text-xs text-subdued">To<input className={input} defaultValue={current.to ?? ""} name="to" type="date" /></label>
        <div className="flex gap-2">
          <Button type="submit">Apply</Button>
          <Button onClick={reset} type="button" variant="secondary">Reset</Button>
        </div>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-subdued">
          <span>Per page:</span>
          {AUDIT_PAGE_SIZES.map((size) => (
            <button
              key={size}
              className={`rounded px-2 py-1 ${size === current.size ? "bg-gradient-to-br from-brand-violet to-brand-teal text-white" : "bg-muted text-subdued hover:text-foreground"}`}
              onClick={() => navigate({ auditSize: size, auditPage: 1 })}
              type="button"
            >
              {size}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs text-subdued">
          <span>Page {current.page} of {current.totalPages} · {current.total} event{current.total === 1 ? "" : "s"}</span>
          <Button disabled={!current.hasPrev} onClick={() => navigate({ auditPage: current.page - 1 })} type="button" variant="secondary">Prev</Button>
          <Button disabled={!current.hasNext} onClick={() => navigate({ auditPage: current.page + 1 })} type="button" variant="secondary">Next</Button>
        </div>
      </div>
    </div>
  );
}
