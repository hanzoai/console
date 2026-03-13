"use client";

import { useState } from "react";
import { useCreateDnsRecord, useUpdateDnsRecord } from "../hooks";
import type { DnsRecordType } from "../types";

const RECORD_TYPES: DnsRecordType[] = ["A", "AAAA", "CNAME", "MX", "TXT", "SRV", "NS", "CAA"];

interface RecordLike {
  id: string;
  name: string;
  type: string;
  content: string;
  ttl: number;
  priority: number | null;
  proxied: boolean;
  syncToCloudflare: boolean;
}

export function DnsRecordForm({
  orgId,
  zoneId,
  record,
  open,
  onOpenChange,
}: {
  orgId: string;
  zoneId: string;
  record?: RecordLike;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isEditing = !!record;
  const createRecord = useCreateDnsRecord();
  const updateRecord = useUpdateDnsRecord();

  const [name, setName] = useState(record?.name ?? "");
  const [type, setType] = useState<DnsRecordType>((record?.type as DnsRecordType) ?? "A");
  const [content, setContent] = useState(record?.content ?? "");
  const [ttl, setTtl] = useState(String(record?.ttl ?? 300));
  const [priority, setPriority] = useState(record?.priority != null ? String(record.priority) : "");
  const [proxied, setProxied] = useState(record?.proxied ?? false);
  const [syncToCf, setSyncToCf] = useState(record?.syncToCloudflare ?? false);

  const isPending = createRecord.isPending || updateRecord.isPending;

  const handleSubmit = () => {
    if (isEditing && record) {
      updateRecord.mutate(
        {
          orgId,
          zoneId,
          recordId: record.id,
          name,
          type,
          content,
          ttl: parseInt(ttl, 10),
          priority: priority ? parseInt(priority, 10) : null,
          proxied,
          syncToCloudflare: syncToCf,
        },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      createRecord.mutate(
        {
          orgId,
          zoneId,
          name,
          type,
          content,
          ttl: parseInt(ttl, 10),
          priority: priority ? parseInt(priority, 10) : undefined,
          proxied,
          syncToCloudflare: syncToCf,
        },
        { onSuccess: () => onOpenChange(false) },
      );
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg">
        <h3 className="text-lg font-semibold">{isEditing ? "Edit Record" : "Add Record"}</h3>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Name</label>
            <input
              type="text"
              placeholder="@, www, mail"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as DnsRecordType)}
              className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-sm"
            >
              {RECORD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="text-sm font-medium">Content</label>
            <input
              type="text"
              placeholder="IP address, hostname, or value"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="text-sm font-medium">TTL (seconds)</label>
            <input
              type="number"
              value={ttl}
              onChange={(e) => setTtl(e.target.value)}
              className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-sm"
            />
          </div>
          {(type === "MX" || type === "SRV") && (
            <div>
              <label className="text-sm font-medium">Priority</label>
              <input
                type="number"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-sm"
              />
            </div>
          )}
          <div className="col-span-2 flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={proxied}
                onChange={(e) => setProxied(e.target.checked)}
                className="rounded border"
              />
              CF Proxied
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={syncToCf}
                onChange={(e) => setSyncToCf(e.target.checked)}
                className="rounded border"
              />
              Sync to Cloudflare
            </label>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-md px-3 py-1.5 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name || !content || isPending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? "Saving..." : isEditing ? "Update Record" : "Add Record"}
          </button>
        </div>
      </div>
    </div>
  );
}
