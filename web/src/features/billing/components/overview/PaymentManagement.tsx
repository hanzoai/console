import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { CreditCard, Plus } from "lucide-react";
import { api } from "@/src/utils/api";
import { useQueryOrganization } from "@/src/features/organizations/hooks";
import { billingProducts } from "@/src/features/billing/utils/billingProducts";
import { useRouter } from "next/router";
import { planLabels, type Plan } from "@hanzo/shared";

export const PaymentManagement = () => {
  const router = useRouter();
  const organization = useQueryOrganization();

  // Fetch subscription data
  const { data: subscription } = api.cloudBilling.getSubscriptionInfo.useQuery(
    {
      orgId: organization?.id ?? "",
    },
    {
      enabled: organization !== undefined,
    },
  );

  // Fetch organization details for credits
  const { data: orgDetails } = api.organizations.getDetails.useQuery(
    { orgId: organization?.id ?? "" },
    { enabled: !!organization },
  );

  // Fetch recent invoices
  const { data: invoiceData } = api.cloudBilling.getInvoices.useQuery(
    {
      orgId: organization?.id ?? "",
      limit: 2, // Only fetch 2 recent invoices for the display
    },
    {
      enabled: organization !== undefined,
    },
  );

  // Mutation for creating checkout session
  const createCheckoutSession = api.cloudBilling.createCheckoutSession.useMutation();

  // Update this to use useQuery
  const { data: customerPortalUrl } = api.cloudBilling.getCustomerPortalUrl.useQuery(
    { orgId: organization?.id ?? "" },
    { enabled: !!organization },
  );

  // Add this near your other hooks
  const cancelSubscription = api.cloudBilling.cancelSubscription.useMutation();

  const handleAddCredits = async () => {
    const creditsProduct = billingProducts.find((p) => p.id === "credits-plan");
    if (!creditsProduct) {
      console.error("Credits product not found");
      return;
    }

    const url = await createCheckoutSession.mutateAsync({
      orgId: organization?.id ?? "",
      productId: creditsProduct.productId,
    });

    if (url) window.location.href = url;
  };

  // Update the handler to use the query result
  const handleCustomerPortal = () => {
    if (customerPortalUrl) window.location.href = customerPortalUrl;
  };

  // Get plan from organization
  const currentPlanKey = organization?.plan as Plan | undefined;
  const currentPlan = currentPlanKey ? planLabels[currentPlanKey] : "Free Plan";
  const availableCredits = orgDetails?.credits || 0;

  // Check for active subscription
  const hasActiveSubscription = Boolean(organization?.cloudConfig?.stripe?.activeSubscriptionId);

  // Format billing period end date
  const billingPeriodEnd = subscription?.billingPeriod?.end;
  const nextBillingDate = billingPeriodEnd ? new Date(billingPeriodEnd).toLocaleDateString() : "N/A";

  const invoices = invoiceData?.invoices || [];

  return (
    <div className="space-y-6">
      {/* Current Plan Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Current Plan</h3>
            <h2 className="mt-2 text-2xl font-bold">{currentPlan}</h2>
            <p className="text-sm text-muted-foreground">
              {hasActiveSubscription ? "Active subscription" : "No active subscription"}
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push("/pricing")}>
            Upgrade Plan
          </Button>
        </div>
        <div className="mt-4 flex items-center justify-between border-t pt-4">
          <p className="text-sm text-muted-foreground">Next billing date: {nextBillingDate}</p>
          {hasActiveSubscription && (
            <Button
              variant="ghost"
              className="text-red-500 hover:bg-red-50 hover:text-red-600"
              onClick={() => {
                cancelSubscription.mutate({
                  orgId: organization?.id ?? "",
                });
              }}
            >
              Cancel Subscription
            </Button>
          )}
        </div>
      </Card>

      {/* Credit Balance Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Credit Balance</h3>
          <Button onClick={handleAddCredits}>
            <Plus className="mr-2 h-4 w-4" />
            Add Credits
          </Button>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary">
            <span className="text-xl font-bold text-primary-foreground">$</span>
          </div>
          <div>
            <p className="text-2xl font-bold">${availableCredits.toFixed(2)}</p>
            <p className="text-sm text-muted-foreground">Available credits</p>
          </div>
        </div>
      </Card>

      {/* Payment Method Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Payment Method</h3>
          <Button variant="outline" onClick={handleCustomerPortal}>
            Manage
          </Button>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <CreditCard className="h-6 w-6" />
          <div>
            <p className="font-medium">
              {subscription?.hasValidPaymentMethod ? "Payment method on file" : "No payment method"}
            </p>
            <p className="text-sm text-muted-foreground">Manage your payment method in billing portal</p>
          </div>
        </div>
      </Card>

      {/* Recent Invoices Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Recent Invoices</h3>
          <Button variant="link" onClick={handleCustomerPortal}>
            View All
          </Button>
        </div>
        <div className="mt-4 space-y-4">
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices yet</p>
          ) : (
            invoices.map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between border-b pb-4 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="text-sm">
                    <p className="font-medium">{invoice.number || invoice.id}</p>
                    <p className="text-muted-foreground">
                      {invoice.created ? new Date(invoice.created * 1000).toLocaleDateString() : "N/A"}
                    </p>
                    <p className="text-xs capitalize text-muted-foreground">{invoice.status || "Unknown"}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">
                    {invoice.currency?.toUpperCase()} {(invoice.breakdown.totalCents / 100).toFixed(2)}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (invoice.invoicePdfUrl) {
                        window.open(invoice.invoicePdfUrl, "_blank");
                      }
                    }}
                  >
                    Download
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
};
