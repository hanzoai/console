/**
 * v4 is now always enabled — this hook is kept for backward compatibility
 * so the 27+ files that import it don't need to change.
 */
export function useV4Beta() {
  return {
    isBetaEnabled: true,
    setBetaEnabled: (_enabled: boolean) => {},
    isLoading: false,
  };
}
