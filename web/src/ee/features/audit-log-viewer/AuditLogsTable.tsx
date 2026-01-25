/**
 * Audit Logs Table - EE Stub
 * Audit log viewing is an enterprise feature handled via Hanzo IAM.
 */

interface AuditLogsTableProps {
  scope: "organization" | "project";
  orgId?: string;
  projectId?: string;
}

export function AuditLogsTable(_props: AuditLogsTableProps) {
  return (
    <div className="rounded-md border p-6 text-center text-muted-foreground">
      <p>Audit logs are available via Hanzo IAM at hanzo.id</p>
    </div>
  );
}
