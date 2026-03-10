import Header from "@/src/components/layouts/header";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { useQueryOrganization } from "@/src/features/organizations/hooks";
import { api } from "@/src/utils/api";
import { numberFormatter, compactNumberFormatter } from "@/src/utils/numbers";
import { MAX_EVENTS_FREE_PLAN } from "@/src/features/billing/constants";
import { ExternalLink, CreditCard, BarChart3, Receipt, Zap } from "lucide-react";
import type { Plan } from "@hanzo/shared";

export const BillingSettings = () => {
  const organization = useQueryOrganization();

  const usage = api.cloudBilling.getUsage.useQuery(
    { orgId: organization?.id as string },
    { enabled: !!organization?.id, trpc: { context: { skipBatch: true } } },
  );

  const subscription = api.cloudBilling.getSubscription.useQuery(
    { orgId: organization?.id as string },
    { enabled: !!organization?.id, trpc: { context: { skipBatch: true } } },
  );

  const plan: Plan = organization?.plan ?? "cloud:hobby";
  const hobbyPlanLimit = organization?.cloudConfig?.monthlyObservationLimit ?? MAX_EVENTS_FREE_PLAN;
  const usageCount = usage.data?.usageCount ?? 0;
  const usageType = usage.data?.usageType
    ? usage.data.usageType.charAt(0).toUpperCase() + usage.data.usageType.slice(1)
    : "Events";
  const usagePct = plan === "cloud:hobby" ? Math.min((usageCount / hobbyPlanLimit) * 100, 100) : 0;

  const sub = subscription.data;
  const planName = sub?.plan?.name ?? (plan === "cloud:hobby" ? "Hobby (Free)" : plan);
  const planStatus = sub?.status ?? "active";

  return (
    <div>
      <Header title="Billing" />

      {/* Plan + Balance card */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Zap className="h-4 w-4" />
            <span>Current Plan</span>
          </div>
          <div className="text-2xl font-bold">{planName}</div>
          <div className="mt-1 text-xs text-muted-foreground capitalize">{planStatus}</div>
          {sub?.current_period_end && (
            <div className="mt-2 text-xs text-muted-foreground">
              Renews {new Date(sub.current_period_end).toLocaleDateString()}
            </div>
          )}
          {sub?.price?.amount != null && (
            <div className="mt-1 text-sm font-medium">
              ${(sub.price.amount / 100).toFixed(2)}/{sub.price.currency?.toUpperCase() ?? "USD"} /mo
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <BarChart3 className="h-4 w-4" />
            <span>{usageType} this period</span>
          </div>
          {usage.data !== undefined ? (
            <>
              <div className="text-2xl font-bold">{numberFormatter(usageCount, 0)}</div>
              {plan === "cloud:hobby" && (
                <>
                  <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                    <span>{numberFormatter(usagePct)}%</span>
                    <span>Limit: {compactNumberFormatter(hobbyPlanLimit)}</span>
                  </div>
                  <div
                    className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={usagePct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className={`h-full rounded-full transition-all ${
                        usagePct >= 90 ? "bg-destructive" : usagePct >= 70 ? "bg-yellow-500" : "bg-primary"
                      }`}
                      style={{ width: `${usagePct}%` }}
                    />
                  </div>
                </>
              )}
              {usage.data.upcomingInvoice && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Upcoming invoice: ${usage.data.upcomingInvoice.usdAmount.toFixed(2)} on{" "}
                  {new Date(usage.data.upcomingInvoice.date).toLocaleDateString()}
                </div>
              )}
            </>
          ) : usage.data === null ? (
            <span className="text-sm text-muted-foreground">Billing not configured</span>
          ) : (
            <span className="text-sm text-muted-foreground">Loading...</span>
          )}
        </Card>
      </div>

      {/* Quick actions */}
      <div className="mb-6">
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" size="sm" asChild>
            <a href="https://billing.hanzo.ai/#credits" target="_blank" rel="noopener noreferrer">
              <CreditCard className="mr-2 h-4 w-4" />
              Add Funds
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="https://billing.hanzo.ai/#invoices" target="_blank" rel="noopener noreferrer">
              <Receipt className="mr-2 h-4 w-4" />
              View Invoices
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="https://billing.hanzo.ai/#pricing" target="_blank" rel="noopener noreferrer">
              <Zap className="mr-2 h-4 w-4" />
              Manage Plan
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="https://billing.hanzo.ai/#usage" target="_blank" rel="noopener noreferrer">
              <BarChart3 className="mr-2 h-4 w-4" />
              Detailed Usage
            </a>
          </Button>
        </div>
      </div>

      {/* Full portal link */}
      <Card className="border-dashed p-4">
        <p className="mb-3 text-sm text-muted-foreground">
          For detailed usage analytics, invoices, payment methods, credits, team billing, and subscription management:
        </p>
        <Button asChild>
          <a href="https://billing.hanzo.ai" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Open Full Billing Portal
          </a>
        </Button>
      </Card>
    </div>
  );
};
