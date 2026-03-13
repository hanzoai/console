"use client";

import { useDnsAuditLogs } from "../hooks";

export function DnsAuditLog({ orgId, zoneId }: { orgId: string; zoneId: string }) {
  const logsQuery = useDnsAuditLogs(orgId, zoneId);

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">Audit Log</h3>

      {logsQuery.isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}

      {logsQuery.data?.logs.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}

      {logsQuery.data?.logs && logsQuery.data.logs.length > 0 && (
        <div className="space-y-1">
          {logsQuery.data.logs.map((log) => (
            <div key={log.id} className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted/30">
              <span className="font-mono text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</span>
              <span className="rounded bg-muted px-1 py-0.5 font-medium">{log.action}</span>
              <span className="text-muted-foreground">by {log.userId}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
