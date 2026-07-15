import { CategoryActions } from "@/components/category-actions";
import { CategoryCreateForm } from "@/components/create-forms";
import { EntityListPage } from "@/components/entity-list-page";
import { Badge } from "@/components/ui/badge";
import { requirePageContext } from "@/lib/auth/page-context";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const context = await requirePageContext();
  const [groups, categories] = await Promise.all([
    prisma.categoryGroup.findMany({
      where: { householdId: context.householdId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.category.findMany({
      where: { householdId: context.householdId, deletedAt: null },
      select: {
        id: true, name: true, kind: true, essential: true, groupId: true,
        group: { select: { name: true } },
        budgetItems: { where: { deletedAt: null }, select: { id: true }, take: 1 },
        incomeSources: { where: { deletedAt: null }, select: { id: true }, take: 1 },
      },
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);
  return (
    <EntityListPage
      caption="Budget categories"
      description="Group income, expenses, saving, investment, and retirement items for routing and analysis. Category groups are managed in Settings."
      emptyDescription="Add your first category below to start organizing income and budget items."
      emptyTitle="No categories yet"
      headers={["Category", "Kind", "Group", "Essential", "Actions"]}
      note={<CategoryCreateForm groups={groups} />}
      rows={categories.map((category) => [
        category.name,
        category.kind.toLowerCase(),
        category.group?.name ?? "—",
        category.essential ? <Badge key={`${category.id}:ess`} tone="success">Essential</Badge> : "—",
        <CategoryActions
          category={{
            id: category.id,
            name: category.name,
            kind: category.kind.toLowerCase(),
            essential: category.essential,
            groupId: category.groupId,
            inUse: category.budgetItems.length > 0 || category.incomeSources.length > 0,
          }}
          groups={groups}
          key={`${category.id}:actions`}
        />,
      ])}
      title="Categories"
    />
  );
}
