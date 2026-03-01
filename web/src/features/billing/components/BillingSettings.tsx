import Header from "@/src/components/layouts/header";
import { Button } from "@/src/components/ui/button";
import { ExternalLink } from "lucide-react";

/**
 * Billing is managed at billing.hanzo.ai
 */
export const BillingSettings = () => {
  return (
    <div>
      <Header title="Billing" />
      <p className="mb-4 text-sm text-muted-foreground">
        Manage your subscription, invoices, and payment methods at the Hanzo Billing portal.
      </p>
      <Button asChild>
        <a href="https://billing.hanzo.ai" target="_blank" rel="noopener noreferrer">
          <ExternalLink className="mr-2 h-4 w-4" />
          Open Billing Portal
        </a>
      </Button>
    </div>
  );
};
