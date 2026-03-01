export function useBillingInformation() {
  return {
    planLabel: "Hanzo Console",
    cancellation: null as { isCancelled: boolean; date?: Date } | null,
  };
}
