/**
 * Hanzo Agents configuration provider for Console integration.
 *
 * Wraps agent pages to:
 * 1. Configure the Hanzo Agents API client
 * 2. Provide auth context (API key from Console session)
 * 3. Provide mode context (developer/user)
 */
import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";

import { setApiKey, setBaseUrl } from "./services/api";

interface AgentsConfig {
  baseUrl: string;
  apiKey?: string;
}

const AgentsContext = createContext<AgentsConfig>({
  baseUrl: "/api/agents/ui/v1",
});

export function useAgentsConfig() {
  return useContext(AgentsContext);
}

export function AgentsProvider({
  baseUrl,
  apiKey,
  children,
}: {
  baseUrl?: string;
  apiKey?: string;
  children: ReactNode;
}) {
  const configuredRef = useRef(false);

  const resolvedBaseUrl =
    baseUrl ??
    (typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_AGENTS_URL ?? "/api/agents/ui/v1")
      : "/api/agents/ui/v1");

  useEffect(() => {
    if (configuredRef.current) return;
    configuredRef.current = true;

    if (typeof setBaseUrl === "function") {
      setBaseUrl(resolvedBaseUrl);
    }
    if (apiKey && typeof setApiKey === "function") {
      setApiKey(apiKey);
    }
  }, [resolvedBaseUrl, apiKey]);

  return (
    <AgentsContext.Provider value={{ baseUrl: resolvedBaseUrl, apiKey }}>
      {children}
    </AgentsContext.Provider>
  );
}
