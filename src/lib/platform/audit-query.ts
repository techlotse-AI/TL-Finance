/**
 * Pure helpers for the admin audit-log view: normalizing URL query params into
 * filters + pagination, building the Prisma `where`, and computing pagination
 * metadata. Kept free of Prisma/Next imports so the parsing and paging math are
 * unit-tested deterministically.
 */

export const AUDIT_PAGE_SIZES = [10, 20, 50] as const;
export type AuditPageSize = (typeof AUDIT_PAGE_SIZES)[number];
export const DEFAULT_AUDIT_PAGE_SIZE: AuditPageSize = 20;

export interface AuditFilters {
  action?: string;
  resourceType?: string;
  /** Inclusive lower bound on createdAt (start of the chosen day). */
  from?: string;
  /** Inclusive upper bound on createdAt (end of the chosen day). */
  to?: string;
}

export interface AuditQuery extends AuditFilters {
  page: number;
  size: AuditPageSize;
}

type RawParam = string | string[] | undefined;

function firstString(value: RawParam): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function clampPageSize(value: RawParam): AuditPageSize {
  const parsed = Number(firstString(value));
  return (AUDIT_PAGE_SIZES as readonly number[]).includes(parsed)
    ? (parsed as AuditPageSize)
    : DEFAULT_AUDIT_PAGE_SIZE;
}

function clampPage(value: RawParam): number {
  const parsed = Math.floor(Number(firstString(value)));
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
}

/** Normalize raw query params into validated filters + pagination. */
export function parseAuditQuery(params: Record<string, RawParam>): AuditQuery {
  return {
    action: firstString(params.auditAction),
    resourceType: firstString(params.auditResource),
    from: firstString(params.auditFrom),
    to: firstString(params.auditTo),
    page: clampPage(params.auditPage),
    size: clampPageSize(params.auditSize),
  };
}

export interface AuditWhere {
  action?: string;
  resourceType?: string;
  createdAt?: { gte?: Date; lte?: Date };
}

/** Build the Prisma-compatible `where` from filters. Returns {} when unfiltered. */
export function buildAuditWhere(filters: { action?: string; resourceType?: string; fromDate?: Date; toDate?: Date }): AuditWhere {
  const where: AuditWhere = {};
  if (filters.action) where.action = filters.action;
  if (filters.resourceType) where.resourceType = filters.resourceType;
  if (filters.fromDate || filters.toDate) {
    where.createdAt = {};
    if (filters.fromDate) where.createdAt.gte = filters.fromDate;
    if (filters.toDate) where.createdAt.lte = filters.toDate;
  }
  return where;
}

/** Convert a yyyy-mm-dd day string into an inclusive day bound (UTC). */
export function dayBound(day: string | undefined, edge: "start" | "end"): Date | undefined {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return undefined;
  const date = new Date(`${day}T${edge === "start" ? "00:00:00.000" : "23:59:59.999"}Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export interface PaginationMeta {
  page: number;
  size: number;
  total: number;
  totalPages: number;
  skip: number;
  hasPrev: boolean;
  hasNext: boolean;
}

/**
 * Pagination metadata for a total row count. The page is clamped into
 * [1, totalPages] so an out-of-range `?auditPage=` never yields an empty view
 * or a negative skip.
 */
export function paginationMeta(total: number, page: number, size: number): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / size));
  const clampedPage = Math.min(Math.max(1, page), totalPages);
  return {
    page: clampedPage,
    size,
    total,
    totalPages,
    skip: (clampedPage - 1) * size,
    hasPrev: clampedPage > 1,
    hasNext: clampedPage < totalPages,
  };
}
