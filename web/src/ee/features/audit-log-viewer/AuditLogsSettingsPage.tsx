/**
 * Audit Logs Settings Page - stub for community edition.
 * Audit log features are only available in the enterprise/cloud edition.
 */

import { Card } from "@/src/components/ui/card";

export const AuditLogsSettingsPage = ({ projectId }: { projectId: string }) => {
  return (
    <Card className="p-4">
      <p className="text-sm text-muted-foreground">
        Audit logs are only available in the enterprise edition.
      </p>
    </Card>
  );
};
