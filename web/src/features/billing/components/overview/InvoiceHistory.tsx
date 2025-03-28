import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Download, Filter } from "lucide-react";
import { api } from "@/src/utils/api";
import { useRouter } from "next/router";
// import { useState } from "react";

export const InvoiceHistory = () => {
  const router = useRouter();
  const orgId = router.query.organizationId as string | undefined;

  const { data: subscriptionHistory, isLoading } = api.cloudBilling.getSubscriptionHistory.useQuery(
    { 
      orgId: orgId || '', 
      limit: 10 
    },
    {
      // Only enable the query if orgId is truthy
      enabled: !!orgId,
      onSuccess: (data: any) => {
        console.log('InvoiceHistory - Subscription History:', {
          subscriptions: data?.subscriptions.map((sub: any) => ({
            id: sub.id,
            status: sub.status,
            planName: sub.plan?.name
          }))
        });
      }
    }
  );

  const handleDownloadInvoice = async (pdfUrl: string | null) => {
    if (!pdfUrl) {
      alert('No PDF available for this invoice.');
      return;
    }

    try {
      // Open the PDF in a new tab/window
      window.open(pdfUrl, '_blank');
    } catch (error) {
      console.error('Failed to download invoice:', error);
      alert('Failed to download invoice. Please try again later.');
    }
  };

  if (!orgId) {
    return (
      <Card className="mt-6">
        <div className="p-6 text-center text-muted-foreground">
          No organization selected
        </div>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="mt-6">
        <div className="p-6 text-center">Loading invoice history...</div>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Invoice History</h3>
            <p className="text-sm text-muted-foreground">View and download past invoices</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>
              <Filter className="mr-2 h-4 w-4" />
              Filter
            </Button>
            <Button variant="outline" size="sm" disabled>
              Export All
            </Button>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          {subscriptionHistory?.subscriptions.length === 0 ? (
            <p className="text-center text-muted-foreground">No invoice history available</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="pb-2 text-left text-sm font-medium text-muted-foreground">Invoice</th>
                  <th className="pb-2 text-left text-sm font-medium text-muted-foreground">Plan</th>
                  <th className="pb-2 text-left text-sm font-medium text-muted-foreground">Billing Period</th>
                  <th className="pb-2 text-left text-sm font-medium text-muted-foreground">Amount</th>
                  <th className="pb-2 text-left text-sm font-medium text-muted-foreground">Status</th>
                  <th className="pb-2 text-right text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subscriptionHistory?.subscriptions?.map((subscription: any) => (
                  <tr key={subscription.id} className="border-b">
                    <td className="py-4 text-sm">
                      {subscription.latestInvoice?.number || subscription.id}
                    </td>
                    <td className="py-4 text-sm">{subscription.plan.name}</td>
                    <td className="py-4 text-sm">
                      {subscription.plan.billingPeriod
                        ? (() => {
                            // Check for scheduled cancellation
                            if (subscription.cancel_at) {
                              return `Active until ${new Date(subscription.cancel_at).toLocaleDateString()}`;
                            }

                            switch(subscription.status) {
                              case 'canceled':
                                return `Active until ${new Date(subscription.plan.billingPeriod.end).toLocaleDateString()}`;
                              case 'trialing':
                                return `Trial until ${new Date(subscription.plan.billingPeriod.end).toLocaleDateString()}`;
                              case 'past_due':
                              case 'unpaid':
                                return `Overdue since ${new Date(subscription.plan.billingPeriod.end).toLocaleDateString()}`;
                              case 'paused':
                                return `Paused since ${new Date(subscription.plan.billingPeriod.start).toLocaleDateString()}`;
                              case 'incomplete':
                              case 'incomplete_expired':
                                return 'Pending activation';
                              default:
                                return `${new Date(subscription.plan.billingPeriod.start).toLocaleDateString()} - ${new Date(subscription.plan.billingPeriod.end).toLocaleDateString()}`;
                            }
                          })()
                        : 'N/A'}
                    </td>
                    <td className="py-4 text-sm">
                      ${(subscription.plan as any).amount?.toFixed(2) ?? 'N/A'}
                    </td>
                    <td className="py-4">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                        (() => {
                          // Add special styling for scheduled cancellation
                          if (subscription.cancel_at) {
                            return 'bg-orange-100 text-orange-800';
                          }

                          switch(subscription.status) {
                            case 'active':
                              return 'bg-green-100 text-green-800';
                            case 'trialing':
                              return 'bg-blue-100 text-blue-800';
                            case 'canceled':
                              return 'bg-gray-100 text-gray-800';
                            case 'past_due':
                            case 'unpaid':
                              return 'bg-yellow-100 text-yellow-800';
                            case 'incomplete':
                            case 'incomplete_expired':
                              return 'bg-red-100 text-red-800';
                            case 'paused':
                              return 'bg-purple-100 text-purple-800';
                            default:
                              return 'bg-gray-100 text-gray-800';
                          }
                        })()
                      }`}>
                        {(() => {
                          // Show "Canceling" status for scheduled cancellation
                          if (subscription.cancel_at) {
                            return 'Canceling';
                          }

                          switch(subscription.status) {
                            case 'past_due':
                              return 'Past Due';
                            case 'incomplete_expired':
                              return 'Failed';
                            case 'incomplete':
                              return 'Processing';
                            default:
                              return subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1);
                          }
                        })()}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDownloadInvoice((subscription as any).latestInvoice?.pdfUrl || null)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {subscriptionHistory?.hasMore && (
          <div className="mt-4 text-center">
            <Button variant="outline" size="sm">
              Load More
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}; 