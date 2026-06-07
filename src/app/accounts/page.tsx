import { Badge } from "@/components/ui/badge";
import { AccountCreateForm, PocketCreateForm } from "@/components/create-forms";
import { EntityListPage } from "@/components/entity-list-page";
import { requirePageContext } from "@/lib/auth/page-context";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const context = await requirePageContext();
  const accounts = await prisma.account.findMany({
    where: { householdId: context.householdId, deletedAt: null },
    include: { pockets: { where: { deletedAt: null }, orderBy: { currency: "asc" } } },
    orderBy: { name: "asc" },
  });
  return (
    <EntityListPage
      caption="Planned payment-route accounts and currency pockets"
      description="Account containers and currency-specific flow nodes. Budget does not store balances."
      headers={["Account", "Type", "Institution", "Currency pockets", "Status"]}
      note={<div className="grid gap-4 lg:grid-cols-2"><AccountCreateForm /><PocketCreateForm accounts={accounts.map(({ id, name }) => ({ id, name }))} /></div>}
      rows={accounts.map((account) => [
        account.name, account.type.toLowerCase().replace("_", " "), account.institution ?? "—",
        account.pockets.map((pocket) => pocket.currency).join(", ") || "No pockets",
        <Badge key={account.id} tone={account.active ? "success" : "neutral"}>{account.active ? "Active" : "Inactive"}</Badge>,
      ])}
      title="Accounts and pockets"
    />
  );
}
