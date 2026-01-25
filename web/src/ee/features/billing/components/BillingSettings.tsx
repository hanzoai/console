/**
 * Billing Settings - Stub for Hanzo console.
 * Billing is handled by Hanzo IAM (hanzo.id).
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
          <p className="text-muted-foreground">
            Billing and usage are managed through Hanzo IAM.
          </p>
          <Button asChild>
            <a
              href="https://hanzo.id/billing"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Manage Billing
            </a>
          </Button>
        </div>
      </Card>
    </div>
  );
};
