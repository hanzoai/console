import { api } from "@/src/utils/api";

// ── Zones ──────────────────────────────────────────────────────

export function useDnsZones(orgId: string) {
  return api.dns.listZones.useQuery({ orgId }, { enabled: !!orgId });
}

export function useDnsZone(orgId: string, zoneId: string) {
  return api.dns.getZone.useQuery({ orgId, zoneId }, { enabled: !!orgId && !!zoneId });
}

export function useCreateDnsZone() {
  const utils = api.useUtils();
  return api.dns.createZone.useMutation({
    onSuccess: () => {
      void utils.dns.listZones.invalidate();
    },
  });
}

export function useDeleteDnsZone() {
  const utils = api.useUtils();
  return api.dns.deleteZone.useMutation({
    onSuccess: () => {
      void utils.dns.listZones.invalidate();
    },
  });
}

// ── Records ────────────────────────────────────────────────────

export function useDnsRecords(orgId: string, zoneId: string) {
  return api.dns.listRecords.useQuery({ orgId, zoneId }, { enabled: !!orgId && !!zoneId });
}

export function useCreateDnsRecord() {
  const utils = api.useUtils();
  return api.dns.createRecord.useMutation({
    onSuccess: () => {
      void utils.dns.listRecords.invalidate();
    },
  });
}

export function useUpdateDnsRecord() {
  const utils = api.useUtils();
  return api.dns.updateRecord.useMutation({
    onSuccess: () => {
      void utils.dns.listRecords.invalidate();
    },
  });
}

export function useDeleteDnsRecord() {
  const utils = api.useUtils();
  return api.dns.deleteRecord.useMutation({
    onSuccess: () => {
      void utils.dns.listRecords.invalidate();
    },
  });
}

// ── Audit Logs ─────────────────────────────────────────────────

export function useDnsAuditLogs(orgId: string, zoneId: string) {
  return api.dns.listAuditLogs.useQuery({ orgId, zoneId }, { enabled: !!orgId && !!zoneId });
}
