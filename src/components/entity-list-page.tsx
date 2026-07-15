import { Plus } from "lucide-react";
import type { ReactNode } from "react";

import { BudgetSubNav } from "@/components/budget-sub-nav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";

interface EntityListPageProps {
  title: string;
  description: string;
  actionLabel?: string;
  headers: string[];
  rows: ReactNode[][];
  caption: string;
  note?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function EntityListPage({
  title,
  description,
  actionLabel,
  headers,
  rows,
  caption,
  note,
  emptyTitle,
  emptyDescription,
}: EntityListPageProps) {
  return (
    <div className="mx-auto max-w-app space-y-6">
      <BudgetSubNav />
      <PageHeader
        actions={actionLabel ? (
          <Button disabled title="Persistence workflow is not connected yet">
            <Plus className="size-4" strokeWidth={1.5} />
            {actionLabel}
          </Button>
        ) : undefined}
        description={description}
        title={title}
      />
      {note}
      <Card>
        <DataTable
          caption={caption}
          emptyDescription={emptyDescription}
          emptyTitle={emptyTitle}
          headers={headers}
          rows={rows}
        />
      </Card>
    </div>
  );
}
