import { env } from "@/src/env.mjs";
import * as InsightsSDK from "@hanzo/insights-node";

type InsightsNode = InstanceType<typeof InsightsSDK.Insights>;
const InsightsNode = InsightsSDK.Insights;

const FALLBACK_INSIGHTS_KEY = "phc_zkMwFajk8ehObUlMth0D7DtPItFnxETi3lmSvyQDrwB";
const FALLBACK_INSIGHTS_HOST = "https://insights.hanzo.ai";

export class ServerInsights {
  private client: InsightsNode | null;

  constructor() {
    const telemetryEnabled = env.TELEMETRY_ENABLED !== "false";

    const apiKey = env.NEXT_PUBLIC_INSIGHTS_KEY ?? (telemetryEnabled ? FALLBACK_INSIGHTS_KEY : null);
    const host = env.NEXT_PUBLIC_INSIGHTS_HOST ?? (telemetryEnabled ? FALLBACK_INSIGHTS_HOST : null);

    if (apiKey && host) {
      this.client = new InsightsNode(apiKey, { host });
      if (process.env.NODE_ENV === "development") this.client.debug();
    } else {
      this.client = null;
    }
  }

  capture(...args: Parameters<InsightsNode["capture"]>) {
    this.client?.capture(...args);
  }

  async shutdown() {
    await this.client?.shutdown();
  }

  async flush() {
    await this.client?.flush();
  }
}
