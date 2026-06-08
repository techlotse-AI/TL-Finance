# Sample statements

Ready-to-import CSVs for testing the Analyze tier. They use the same sanitized
formats as the parser golden fixtures.

| File | Parser | Import into |
| --- | --- | --- |
| `ubs-checking-2026-05.csv` | UBS account | a CHF account (e.g. "UBS Checking") |
| `ubs-savings-2026-05.csv` | UBS account | a second CHF account (e.g. "UBS Savings") |
| `revolut-2026-05.csv` | Revolut | a CHF account (e.g. "Revolut") |

What they exercise:

- **Review / allocation** — salary, rent, groceries, insurance, Netflix.
- **Duplicate finding** — two identical CHF 54.00 Coop charges two days apart.
- **Transfer matching** — the CHF 2,000 "Transfer to savings" debit in
  `ubs-checking` matches the CHF 2,000 credit in `ubs-savings`. Run a transfer
  scan, then confirm the candidate.
- **Adherence** — add budget items (e.g. Groceries, Health insurance) to see
  planned-versus-actual and an over-budget status.

See `docs/operations/LOCAL_TEST.md` for the full walkthrough.
