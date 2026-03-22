import Header from "@/src/components/layouts/header";
import { Alert, AlertDescription, AlertTitle } from "@hanzo/ui";
import { AuditLogsTable } from "@/src/features/audit-log-viewer/AuditLogsTable";
import { useHasProjectAccess } from "@/src/features/rbac/utils/checkProjectAccess";

export function AuditLogsSettingsPage(props: { projectId: string }) {
  const hasAccess = useHasProjectAccess({
    projectId: props.projectId,
    scope: "auditLogs:read",
  });

  const body = !hasAccess ? (
    <Alert>
      <AlertTitle>Access Denied</AlertTitle>
      <AlertDescription>Contact your project administrator to request access.</AlertDescription>
    </Alert>
  ) : (
    <AuditLogsTable scope="project" projectId={props.projectId} />
  );

  return (
    <>
      <Header title="Audit Logs" />
      <p className="mb-2 text-sm text-muted-foreground">
        Track who changed what in your project and when. Monitor settings, configurations, and data changes over time.
      </p>
      {body}
    </>
  );
}
