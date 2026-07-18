# Manual end-to-end checklist

Release gate #3 for `1.0.0-alpha.1` (see `docs/strategy/ROADMAP.md`, v0.9.7),
and the working script for owner testing passes before that. Run it top to
bottom on a **real deployment** (Docker, live Postgres) — not the dev shell.
Every unchecked box at the end is either a filed issue or a release blocker.

Conventions: work in a fresh household unless a step says otherwise. Amounts
display whole (rounded to nearest 5); reconciliation tolerates ±5. Note the
app version and date at the bottom when you finish a pass.

## 1. Install & first run

- [ ] Fresh `docker compose up` from the published image succeeds; app healthy
      on first load (`/api/health`).
- [ ] Sign-up → email verification → sign-in round-trip works.
- [ ] Onboarding creates a household (try **Swiss** preset; spot-check a
      second household with **South African** preset shows medical aid / UIF /
      retirement annuity categories, ZAR currency selectable).
- [ ] Sign-out control works; revoked session cannot navigate back in.

## 2. Budget tier

- [ ] Add an account with two currencies → two pockets appear; add income
      routed to a pocket; add a planned transfer between accounts.
- [ ] Add budget items: a monthly expense, a **yearly expense** (must render
      as a provision — short dash in the graph), and a saving item with
      paid-from + paid-to routes.
- [ ] Categories page: create, edit, delete-unused works; delete-in-use is
      blocked with a clear message.
- [ ] Empty states: a brand-new second household shows helpful empty copy on
      income/accounts/transfers/categories/items — never a blank table.
- [ ] Money-flow graph: all three views (Full flow / Pure budget / Account
      minimums) render; zoom in → drag-pan → keyboard arrows → reset;
      legend click isolates a route; SVG export downloads the full graph;
      print preview hides the chrome.
- [ ] Accessible table under the graph matches the currently selected view
      and filters (change both, re-check).
- [ ] Dashboard: reconciliation badge states the ±5 tolerance; analysis
      summary card (savings rate / essential ratio / top insight) matches the
      full analysis on the Budget page.
- [ ] Whole-amount check: every Budget money figure shows zero cents and
      rounds to the nearest 5.

## 3. Analyze tier

- [ ] Entitlement gate: a Budget-tier household sees Analyze locked; an
      entitled one sees the workspace.
- [ ] Import a **real FNB PDF statement** → preview shows correct rows/warnings,
      account suggestion matches by masked reference → commit → re-import the
      same file → **0 new transactions** (idempotent).
- [ ] Import a Revolut CSV and a UBS CSV the same way.
- [ ] Feed the parser something wrong (a random CSV/PDF) → the error names
      which parsers were tried and why each rejected it.
- [ ] Review queue: allocate single; **split one transaction across two
      categories** (amounts must sum); bulk-select → bulk allocate; bulk
      ignore; pagination past 25 rows.
- [ ] Allocation rule: create one, apply, verify matches; unknown rows stay
      in review — nothing silently lands in "Other".
- [ ] Transfers: scan proposes the internal/FX pairs from your imports;
      confirm one, reject one; confirmed pair is excluded from spending.
- [ ] Adherence and money-leak findings render against the committed actuals.

## 4. Optimize tier

- [ ] Every calculator tab loads and computes with a saved input set:
      Scenarios, Wealth planner, Emergency fund (with ALV preset), Pillar 3a,
      Holdings, Forecast, Pensions, Retirement, Debt, Net worth, Goals,
      Advisor.
- [ ] **Wealth planner visual pass** (deferred since v0.9.1 ships here):
      charts have no overlapping end-labels, legends match lines, drawdown
      table is coherent; save → reload → delete a plan.
- [ ] Net worth: comfort threshold shows 0.01% of net worth; missing-rate
      currencies warn rather than silently mixing.
- [ ] Confirm Optimize wrote nothing into Budget (plan unchanged after a full
      Optimize session).

## 5. Platform & operations

- [ ] Household backup export → import restores as a new household with
      matching plan totals.
- [ ] **Full backup → restore rehearsal** per
      `docs/operations/BACKUP_RESTORE.md` on this release candidate
      (RC gate #3b — record the date below).
- [ ] Exchange-rate refresh (Frankfurter) works; stale-rate warning appears
      when a rate lapses.
- [ ] Rate limiting / lockout: repeated bad logins escalate and recover per
      `SECURITY.md`; admin unlock works.
- [ ] Audit log shows the session's actions with filtering and pagination.
- [ ] Mobile-width pass (phone): sub-nav wraps, tables scroll, graph usable.

## Sign-off

| Date | Version | Pass/notes | Issues filed |
| ---- | ------- | ---------- | ------------ |
|      |         |            |              |
