# Transfer and FX Matching Strategy

Planned account transfers in v0.1.0 are routing allocations and never count as
income or spending.

Actual transaction transfer and FX matching starts in v0.2.0. Matching will be
deterministic and household-scoped. High-confidence candidates may
auto-confirm, medium-confidence candidates require confirmation, and
low-confidence candidates remain unmatched. Confirmed actual matches are
excluded from income, spending, and adherence totals.
