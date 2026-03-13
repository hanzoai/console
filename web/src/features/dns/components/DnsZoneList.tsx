"use client";

import { useState } from "react";
import { Globe, Plus, Trash2 } from "lucide-react";
import { useDnsZones, useDeleteDnsZone } from "../hooks";
import { CreateDnsZoneDialog } from "./CreateDnsZoneDialog";

export function DnsZoneList({ orgId, onSelectZone }: { orgId: string; onSelectZone: (zoneId: string) => void }) {
  const zonesQuery = useDnsZones(orgId);
  const deleteZone = useDeleteDnsZone();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">DNS Zones</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add Zone
        </button>
      </div>

      {zonesQuery.isLoading && <p className="text-sm text-muted-foreground">Loading zones...</p>}

      {zonesQuery.isError && <p className="text-sm text-destructive">Failed to load zones. Please try again.</p>}

      {zonesQuery.data && zonesQuery.data.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <Globe className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">No DNS zones</p>
          <p className="text-sm text-muted-foreground">Create your first zone to get started.</p>
        </div>
      )}

      {zonesQuery.data && zonesQuery.data.length > 0 && (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium">Domain</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Records</th>
                <th className="px-4 py-2 text-left font-medium">Cloudflare</th>
                <th className="px-4 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {zonesQuery.data.map((zone) => (
                <tr
                  key={zone.id}
                  className="border-b cursor-pointer hover:bg-muted/30"
                  onClick={() => onSelectZone(zone.id)}
                >
                  <td className="px-4 py-2 font-medium">{zone.name}</td>
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                      {zone.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{zone._count?.records ?? 0}</td>
                  <td className="px-4 py-2 text-muted-foreground">{zone.cloudflareZoneId ? "Linked" : "-"}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete zone "${zone.name}" and all its records?`)) {
                          deleteZone.mutate({ orgId, zoneId: zone.id });
                        }
                      }}
                      className="inline-flex items-center rounded p-1 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateDnsZoneDialog orgId={orgId} open={showCreate} onOpenChange={setShowCreate} />}
    </div>
  );
}
