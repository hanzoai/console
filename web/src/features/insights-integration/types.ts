import { AnalyticsIntegrationExportSource } from "@hanzo/console-core";
import { z } from "zod/v4";

export const insightsIntegrationFormSchema = z.object({
  insightsHostname: z.string().url(),
  insightsProjectApiKey: z.string().refine((v) => v.startsWith("phc_"), {
    message:
      "Hanzo Insights 'Project API Key' must start with 'phc_'. You can find it in the Hanzo Insights project settings.",
  }),
  enabled: z.boolean(),
  exportSource: z.enum(AnalyticsIntegrationExportSource).default(AnalyticsIntegrationExportSource.TRACES_OBSERVATIONS),
});
