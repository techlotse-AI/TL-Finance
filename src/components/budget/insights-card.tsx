import { Card } from "@/components/ui/card";

export function InsightsCard({ insights }: { insights: string[] }) {
  if (insights.length === 0) return null;
  return (
    <Card className="space-y-2 p-5">
      <h3 className="font-semibold">Insights</h3>
      <ul className="list-disc space-y-1 pl-5 text-sm text-subdued">
        {insights.map((insight, index) => <li key={index}>{insight}</li>)}
      </ul>
    </Card>
  );
}
