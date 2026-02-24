import { Wallet } from "lucide-react";

import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent } from "@/src/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/components/ui/table";
import { Skeleton } from "@/src/components/ui/skeleton";

import { useMpcWallets } from "../hooks";
import type { MpcWallet, MpcWalletStatus } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const statusConfig: Record<MpcWalletStatus, { label: string; variant: "success" | "warning" | "secondary" }> = {
  active: { label: "Active", variant: "success" },
  pending: { label: "Pending", variant: "warning" },
  archived: { label: "Archived", variant: "secondary" },
};

// ---------------------------------------------------------------------------
// MpcWalletsTable
// ---------------------------------------------------------------------------

export function MpcWalletsTable({ projectId }: { projectId: string }) {
  const walletsQuery = useMpcWallets(projectId);
  const wallets = walletsQuery.data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {wallets.length} wallet{wallets.length !== 1 ? "s" : ""}
          </span>
        </div>
        <Button size="sm">Create Wallet</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Wallet ID</TableHead>
                <TableHead>Curve</TableHead>
                <TableHead>Threshold</TableHead>
                <TableHead>Public Key</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Signed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {walletsQuery.isPending ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : walletsQuery.isError ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-destructive">
                    Failed to load wallets: {walletsQuery.error.message}
                  </TableCell>
                </TableRow>
              ) : wallets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No wallets yet. Create your first MPC wallet to get started.
                  </TableCell>
                </TableRow>
              ) : (
                wallets.map((w: MpcWallet) => {
                  const cfg = statusConfig[w.status];
                  return (
                    <TableRow key={w.id}>
                      <TableCell className="font-mono text-xs">{w.id}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{w.curve}</Badge>
                      </TableCell>
                      <TableCell>
                        {w.threshold}/{w.parties}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate font-mono text-xs">{w.publicKey}</TableCell>
                      <TableCell>
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(w.createdAt)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {w.lastSignedAt ? formatDate(w.lastSignedAt) : "--"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
