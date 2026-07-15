"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** Shared route-level error boundary body. Each route's error.tsx renders this. */
export function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-app">
      <Card className="flex flex-col items-start gap-3 border-status-danger/40 bg-status-danger/5 p-6">
        <div className="flex items-center gap-2 text-status-danger">
          <AlertTriangle aria-hidden="true" className="size-5" strokeWidth={1.5} />
          <h2 className="font-semibold">Something went wrong</h2>
        </div>
        <p className="text-sm text-subdued">
          This page failed to load. Try again, or come back later if the problem persists.
          {error.digest ? ` (Reference: ${error.digest})` : null}
        </p>
        <Button onClick={() => reset()} type="button">
          Try again
        </Button>
      </Card>
    </div>
  );
}
