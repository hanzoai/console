import { z } from "zod";
import { removeEmptyEnvVariables } from "@hanzo/shared";

const EnvSchema = z.object({
  NEXT_PUBLIC_HANZO_CLOUD_REGION: z.string().optional(),
  HANZO_EE_LICENSE_KEY: z.string().optional(),
});

export const env = EnvSchema.parse(removeEmptyEnvVariables(process.env));
