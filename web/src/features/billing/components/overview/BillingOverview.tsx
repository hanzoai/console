import { Card } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { useQueryOrganization } from "@/src/features/organizations/hooks";
import { api } from "@/src/utils/api";
import { numberFormatter } from "@/src/utils/numbers";
import { MAX_EVENTS_FREE_PLAN } from "@/src/features/billing/constants";
import { ExternalLink, TrendingUp } from "lucide-react";
import type { Plan } from "@hanzo/console";

/**
 * Compact billing overview widget for the org settings main page.
 * Shows plan, usage, and a link to the full billing portal.
 */
export const BillingOverview = () => {
  const organization = useQueryOrganization();

  const usage = api.cloudBilling.getUsage.useQuery(
    { orgId: organization?.id as string },
    { enabled: !!organization?.id, trpc: { context: { skipBatch: true } } },
  );

  const subscription = api.cloudBilling.getSubscription.useQuery(
    { orgId: organization?.id as string },
    { enabled: !!organization?.id, trpc: { context: { skipBatch: true } } },
  );

  if (usage.data === null && subscription.data === null) return null;

  const plan: Plan = organization?.plan ?? "cloud:hobby";
  const hobbyLimit = organization?.cloudConfig?.monthlyObservationLimit ?? MAX_EVENTS_FREE_PLAN;
  const count = usage.data?.usageCount ?? 0;
  const pct = plan === "cloud:hobby" ? Math.min((count / hobbyLimit) * 100, 100) : 0;

  const sub = subscription.data;
  const planName = sub?.plan?.name ?? (plan === "cloud:hobby" ? "Hobby" : plan);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Billing</h3>
        </div>
        <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
          <a href="https://billing.hanzo.ai" target="_blank" rel="noopener noreferrer">
            Details <ExternalLink className="ml-1 h-3 w-3" />
          </a>
        </Button>
      </div>

      <div className="flex items-baseline gap-3">
        <span className="text-lg font-bold">{planName}</span>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary capitalize">
          {sub?.status ?? "active"}
        </span>
      </div>

      {usage.data !== undefined && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{numberFormatter(count, 0)} events</span>
            {plan === "cloud:hobby" && <span>{Math.round(pct)}%</span>}
          </div>
          {plan === "cloud:hobby" && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${
                  pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-yellow-500" : "bg-primary"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
