"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function HouseholdSwitcher({
  activeHouseholdId,
  households,
}: {
  activeHouseholdId: string;
  households: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(activeHouseholdId);
  async function switchHousehold() {
    const response = await fetch("/api/household/active", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ householdId: selected }),
    });
    if (response.ok) { router.push("/"); router.refresh(); }
  }
  return <Card className="p-5"><h2 className="font-semibold">Active household</h2><div className="mt-4 flex gap-3"><select className="min-h-10 flex-1 rounded border bg-muted px-3 text-sm" onChange={(event) => setSelected(event.target.value)} value={selected}>{households.map((household) => <option key={household.id} value={household.id}>{household.name}</option>)}</select><Button onClick={switchHousehold} type="button">Switch</Button></div></Card>;
}
