-- RenameTable
ALTER TABLE "posthog_integrations" RENAME TO "insights_integrations";

-- RenameColumn
ALTER TABLE "insights_integrations" RENAME COLUMN "encrypted_posthog_api_key" TO "encrypted_insights_api_key";

-- RenameColumn
ALTER TABLE "insights_integrations" RENAME COLUMN "posthog_host_name" TO "insights_host_name";
