"use client";

import { useState } from "react";
import { useCreateDnsZone } from "../hooks";

export function CreateDnsZoneDialog({
  orgId,
  open,
  onOpenChange,
}: {
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [domain, setDomain] = useState("");
  const [cfZoneId, setCfZoneId] = useState("");
  const createZone = useCreateDnsZone();

  const handleSubmit = () => {
    createZone.mutate(
      {
        orgId,
        name: domain,
        cloudflareZoneId: cfZoneId || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setDomain("");
          setCfZoneId("");
        },
      },
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
        <h3 className="text-lg font-semibold">Create DNS Zone</h3>
        <p className="mt-1 text-sm text-muted-foreground">Add a new domain to manage DNS records.</p>

        <div className="mt-4 flex flex-col gap-3">
          <div>
            <label className="text-sm font-medium">Domain Name</label>
            <input
              type="text"
              placeholder="example.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">
              Cloudflare Zone ID <span className="text-muted-foreground">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="abc123..."
              value={cfZoneId}
              onChange={(e) => setCfZoneId(e.target.value)}
              className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-sm"
            />
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
            disabled={!domain || createZone.isPending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {createZone.isPending ? "Creating..." : "Create Zone"}
          </button>
        </div>
      </div>
    </div>
  );
}
