# User Guide

The current v0.1.0 Budget workflow plans where normalized monthly income goes.

1. Create a household and select a base currency and country preset.
2. Create account containers and their currency pockets. Do not enter balances.
3. Add income sources and reconcile each source to receiving pockets.
4. Add planned account-to-account transfers.
5. Add expense, saving, investment, and retirement budget items.
6. Review the normalized monthly table and planned money-flow.

Settings supports active-household switching, categories, members, reporting
exchange rates, and validated JSON export/import. Instance administrators may
assign tiers manually.

One-time items remain visible but are excluded from the recurring monthly
baseline. Unallocated income, account funds, and expenses without a funding
account must remain visible.

Analyze remains locked for Budget households. Entitled households see the
started Analyze foundation, but statement parsing remains unavailable until
fixture-backed institution parsers are production-ready.

Optimize remains locked for Budget and Analyze households. Optimize households
can compare three deterministic projection scenarios using explicit starting
amount, monthly contribution, annual-return, and horizon assumptions. The
calculator compounds an effective monthly rate, applies contributions at month
end, excludes taxes and fees, stores nothing, and never changes the household
budget.
