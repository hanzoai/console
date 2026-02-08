import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Download, Filter } from "lucide-react";
import { api } from "@/src/utils/api";
import { useRouter } from "next/router";

export const InvoiceHistory = () => {
  const router = useRouter();
  const orgId = router.query.organizationId as string | undefined;

  const { data: invoiceData, isLoading } = api.cloudBilling.getInvoices.useQuery(
    {
      orgId: orgId || "",
      limit: 10,
    },
    {
      enabled: !!orgId,
    },
  );

  const handleDownloadInvoice = (pdfUrl: string | null | undefined) => {
    if (!pdfUrl) {
      alert("No PDF available for this invoice.");
      return;
    }
    window.open(pdfUrl, "_blank");
  };

  if (!orgId) {
    return (
      <Card className="mt-6">
        <div className="p-6 text-center text-muted-foreground">No organization selected</div>
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

  const invoices = invoiceData?.invoices || [];

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
          {invoices.length === 0 ? (
            <p className="text-center text-muted-foreground">No invoice history available</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="pb-2 text-left text-sm font-medium text-muted-foreground">Invoice</th>
                  <th className="pb-2 text-left text-sm font-medium text-muted-foreground">Date</th>
                  <th className="pb-2 text-left text-sm font-medium text-muted-foreground">Amount</th>
                  <th className="pb-2 text-left text-sm font-medium text-muted-foreground">Status</th>
                  <th className="pb-2 text-right text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b">
                    <td className="py-4 text-sm">{invoice.number || invoice.id}</td>
                    <td className="py-4 text-sm">
                      {invoice.created ? new Date(invoice.created * 1000).toLocaleDateString() : "N/A"}
                    </td>
                    <td className="py-4 text-sm">
                      {invoice.currency?.toUpperCase()} {(invoice.breakdown.totalCents / 100).toFixed(2)}
                    </td>
                    <td className="py-4">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          invoice.status === "paid"
                            ? "bg-green-100 text-green-800"
                            : invoice.status === "open"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {invoice.status ? invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1) : "Unknown"}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleDownloadInvoice(invoice.invoicePdfUrl)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {invoiceData?.hasMore && (
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
