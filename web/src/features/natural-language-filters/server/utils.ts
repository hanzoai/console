import { LLMAdapter } from "@hanzo/shared/src/server";
import { Hanzo } from "@hanzo/console";
import { env } from "@/src/env.mjs";
import { type FilterCondition, singleFilter } from "@hanzo/shared";
import { z } from "zod/v4";

let hanzoClient: Hanzo | null = null;

export function getDefaultModelParams() {
  return {
    provider: "bedrock",
    adapter: LLMAdapter.Bedrock,
    model: env.HANZO_AWS_BEDROCK_MODEL ?? "",
    temperature: 0.1,
    maxTokens: 1000,
    topP: 0.9,
  };
}

const FilterArraySchema = z.array(singleFilter);

export function parseFiltersFromCompletion(
  completion: string,
): FilterCondition[] {
  const arrayMatch = completion.match(/\[[\s\S]*?\]/)?.[0];
  const objectMatch = completion.match(/\{[\s\S]*?\}/)?.[0];

  const candidates = [
    completion, // full response
    arrayMatch, // extract JSON array
    objectMatch ? `[${objectMatch}]` : undefined, // wrap single object in array
  ].filter((c): c is string => Boolean(c));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);

      // sometimes, ai returns {filters: [...]}, extract the filters array
      const filtersArray = parsed.filters || parsed;
      const validated = FilterArraySchema.parse(filtersArray);
      return validated;
    } catch {
      // try next candidate
    }
  }
  return [];
}

export function getHanzoClient(
  publicKey: string,
  secretKey: string,
  baseUrl?: string,
): Hanzo {
  if (!hanzoClient) {
    hanzoClient = new Hanzo({
      publicKey,
      secretKey,
      baseUrl,
    });
  }
  return hanzoClient;
}
