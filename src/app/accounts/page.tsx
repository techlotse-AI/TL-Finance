import { Badge } from "@/components/ui/badge";
import { AccountActions } from "@/components/account-actions";
import { AccountCreateForm, PocketCreateForm } from "@/components/create-forms";
import { EntityListPage } from "@/components/entity-list-page";
import { loadAccountLifecycleSummary } from "@/lib/accounts/lifecycle";
import { requirePageContext } from "@/lib/auth/page-context";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const context = await requirePageContext();
  const [household, accounts] = await Promise.all([
    prisma.household.findUniqueOrThrow({ where: { id: context.householdId }, select: { baseCurrency: true } }),
    prisma.account.findMany({
      where: { householdId: context.householdId, deletedAt: null },
      include: { pockets: { where: { deletedAt: null }, orderBy: { currency: "asc" } } },
      orderBy: { name: "asc" },
    }),
  ]);
  const lifecycleByAccount = new Map(
    await Promise.all(accounts.map(async (account) => [
      account.id,
      await loadAccountLifecycleSummary(prisma, context.householdId, account.id),
    ] as const)),
  );
  return (
    <EntityListPage
      caption="Planned payment-route accounts and supported currencies"
      description="Add each account and select the currencies it supports. TL Finance manages the internal currency routes automatically. Budget does not store balances."
      headers={["Account", "Type", "Institution", "Statement reference", "Supported currencies", "Status", "Actions"]}
      note={<div className="grid gap-4 lg:grid-cols-2"><AccountCreateForm baseCurrency={household.baseCurrency} /><PocketCreateForm accounts={accounts.map(({ id, name }) => ({ id, name }))} baseCurrency={household.baseCurrency} /></div>}
      rows={accounts.map((account) => [
        account.name,
        <span key={`${account.id}-type`} className="inline-flex items-center gap-2">{account.type.toLowerCase().replace("_", " ")}{account.spending ? <Badge tone="success">Spending</Badge> : null}</span>,
        account.institution ?? "—",
        account.maskedReference ?? "—",
        account.pockets.map((pocket) => pocket.currency).join(", ") || "No currencies",
        <Badge key={account.id} tone={account.active ? "success" : "neutral"}>{account.active ? "Active" : "Inactive"}</Badge>,
        <AccountActions
          account={{
            id: account.id,
            name: account.name,
            type: account.type.toLowerCase(),
            institution: account.institution,
            maskedReference: account.maskedReference,
            spending: account.spending,
          }}
          key={`${account.id}-actions`}
          lifecycle={lifecycleByAccount.get(account.id)!}
        />,
      ])}
      title="Accounts"
    />
  );
}
