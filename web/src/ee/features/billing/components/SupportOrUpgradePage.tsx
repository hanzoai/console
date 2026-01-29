/**
 * Support or Upgrade Page - Stub for Hanzo console.
 * Premium features are available through Hanzo IAM.
 */

import { Card } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { ExternalLink } from "lucide-react";

export const SupportOrUpgradePage = ({
  title = "Premium Feature",
  description = "This feature requires a premium subscription.",
}: {
  title?: string;
  description?: string;
}) => {
  return (
    <Card className="p-6 text-center">
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="mb-4 text-muted-foreground">{description}</p>
      <Button asChild>
        <a
          href="https://hanzo.id/upgrade"
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Upgrade Plan
        </a>
      </Button>
    </Card>
  );
};
