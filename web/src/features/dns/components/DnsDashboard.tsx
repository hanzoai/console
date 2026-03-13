"use client";

import { useState } from "react";
import { DnsZoneList } from "./DnsZoneList";
import { DnsRecordTable } from "./DnsRecordTable";
import { DnsAuditLog } from "./DnsAuditLog";

export function DnsDashboard({ orgId }: { orgId: string }) {
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  if (selectedZoneId) {
    return (
      <div className="flex flex-col gap-6">
        <DnsRecordTable orgId={orgId} zoneId={selectedZoneId} onBack={() => setSelectedZoneId(null)} />
        <DnsAuditLog orgId={orgId} zoneId={selectedZoneId} />
      </div>
    );
  }

  return <DnsZoneList orgId={orgId} onSelectZone={setSelectedZoneId} />;
}
