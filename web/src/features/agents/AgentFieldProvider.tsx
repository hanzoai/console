/**
 * AgentField configuration provider for Console integration.
 *
 * Wraps agent pages to:
 * 1. Configure the @hanzo/agent-ui API client (or the local services)
 * 2. Provide auth context (API key from Console session)
 * 3. Provide mode context (developer/user)
 */
import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";

// The AgentField services use a module-level config.
// We configure it on mount via the local services/api.ts setApiKey + setBaseUrl
import { setApiKey, setBaseUrl } from "./services/api";

interface AgentFieldConfig {
  baseUrl: string;
  apiKey?: string;
}

const AgentFieldContext = createContext<AgentFieldConfig>({
  baseUrl: "http://localhost:8080/api/ui/v1",
});

export function useAgentFieldConfig() {
  return useContext(AgentFieldContext);
}

export function AgentFieldProvider({
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
      ? (process.env.NEXT_PUBLIC_AGENTFIELD_URL ?? "http://localhost:8080/api/ui/v1")
      : "http://localhost:8080/api/ui/v1");

  useEffect(() => {
    if (configuredRef.current) return;
    configuredRef.current = true;

    // Configure the AgentField API client
    if (typeof setBaseUrl === "function") {
      setBaseUrl(resolvedBaseUrl);
    }
    if (apiKey && typeof setApiKey === "function") {
      setApiKey(apiKey);
    }
  }, [resolvedBaseUrl, apiKey]);

  return (
    <AgentFieldContext.Provider value={{ baseUrl: resolvedBaseUrl, apiKey }}>
      {children}
    </AgentFieldContext.Provider>
  );
}
