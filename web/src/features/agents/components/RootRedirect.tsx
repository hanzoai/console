import { useEffect, useState } from "react";
import { Navigate } from "../adapters";
import { getNodesSummary } from "../services/api";

/**
 * Smart root redirect:
 * - If no data at all → /welcome (first-run onboarding)
 * - If has nodes/bots → /playground (returning user)
 * - If has space but no bots → /playground (shows guided empty state)
 */
export function RootRedirect() {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function determineRedirect() {
      try {
        // Check if there are any nodes (proxy for "has bots")
        const response = await getNodesSummary();
        const nodes = response?.nodes ?? [];

        if (!cancelled) {
          if (nodes.length > 0) {
            // Returning user with bots → playground
            setTarget("/playground");
          } else {
            // Has space but no bots → playground (will show guided empty state)
            setTarget("/playground");
          }
        }
      } catch {
        if (!cancelled) {
          // API error (likely no spaces/auth issue) → welcome
          setTarget("/welcome");
        }
      }
    }

    determineRedirect();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!target) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return <Navigate to={target} replace />;
}
