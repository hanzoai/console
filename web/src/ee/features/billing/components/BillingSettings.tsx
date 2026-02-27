/**
 * Billing Settings - Stub for Hanzo console.
 * Billing is handled by billing.hanzo.ai.
 */

import Header from "@/src/components/layouts/header";
import { Card } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { ExternalLink } from "lucide-react";

export const BillingSettings = () => {
  return (
    <div>
      <Header title="Usage & Billing" />
      <Card className="p-6">
        <div className="space-y-4">
          <p className="text-muted-foreground">Billing and usage are managed through Hanzo Billing.</p>
          <Button asChild>
            <a href="https://billing.hanzo.ai" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Manage Billing
            </a>
          </Button>
        </div>
      </Card>
    </div>
  );
};
