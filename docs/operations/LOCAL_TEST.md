# Local test (Docker)

One command brings up PostgreSQL, runs migrations, and serves the app.

```bash
docker compose up --build
```

Then open http://localhost:3000. The build generates the Prisma client and
compiles the production bundle inside the image, so no local Node setup or
database is required. PostgreSQL is also exposed on `localhost:5432`.

## Walk through Analyze

1. **Sign up as the instance admin.** On a fresh local database, the first
   registered user becomes the instance administrator. Complete onboarding and
   pick the **Swiss** preset — it seeds Pillar 3a, Quellensteuer, Nebenkosten,
   and other Swiss categories.
2. **Unlock the Analyze tier.** Open **/admin**, find your household, and assign
   it the **Analyze** (or Optimize) tier. Analyze is server-side entitlement
   gated; without this the Analyze page stays locked.
3. **Create accounts.** Under **Accounts**, add a CHF account named
   `UBS Checking`, a second CHF account `UBS Savings`, and optionally `Revolut`.
   Currency pockets are created automatically.
4. **(Optional) Add budget items** under **Budget** — e.g. Groceries and Health
   insurance — so the Adherence tab has a plan to compare against.
5. **Import.** Go to **Analyze → Import**, upload `samples/ubs-checking-2026-05.csv`,
   choose `UBS Checking`, **Preview**, then **Commit**. Repeat with
   `samples/ubs-savings-2026-05.csv` into `UBS Savings`.
6. **Review.** In **Review**, categorize transactions, or add an allocation rule
   (e.g. merchant contains `coop` → Groceries) and **Apply rules**.
7. **Transfers.** In **Transfers**, **Scan**. The CHF 2,000 checking→savings pair
   appears as a candidate; **Confirm** it. Confirmed transfers are excluded from
   spending.
8. **Adherence & Findings.** Review planned-versus-actual per category and the
   deterministic money-leak findings (the duplicate CHF 54.00 Coop charges show
   up here).

## Reset

```bash
docker compose down -v   # also removes the postgres volume
```
