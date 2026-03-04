import { describe, test, expect } from "vitest";
import { fetchLLMCompletion } from "@hanzo/shared/src/server";
import { encrypt } from "@hanzo/shared/encryption";
import { ChatMessageType, LLMAdapter } from "@hanzo/shared";
import { z } from "zod/v4";

/**
 * LLM Connection Integration Tests
 *
 * Tests verify that the fetchLLMCompletion pipeline works with live API calls
 * through the Hanzo LLM Gateway (llm.hanzo.ai), which is OpenAI-compatible.
 *
 * Uses the cheapest available model (zen3-nano) to minimize costs.
 * All tests route through our gateway — no direct provider keys needed.
 *
 * Required environment variable:
 * - HANZO_LLM_API_KEY — API key for llm.hanzo.ai (stored in KMS)
 *
 * Optional provider-specific keys for direct adapter testing:
 * - HANZO_LLM_CONNECTION_OPENAI_KEY
 * - HANZO_LLM_CONNECTION_ANTHROPIC_KEY
 * - HANZO_LLM_CONNECTION_AZURE_KEY + _BASE_URL + _MODEL
 * - HANZO_LLM_CONNECTION_BEDROCK_ACCESS_KEY_ID + _SECRET_ACCESS_KEY + _REGION
 * - HANZO_LLM_CONNECTION_VERTEXAI_KEY
 * - HANZO_LLM_CONNECTION_GOOGLEAISTUDIO_KEY
 */

// Eval schema matching production usage
const evalOutputSchema = z.object({
  score: z.number(),
  reasoning: z.string(),
});

// Common tool definition for tool calling tests
const weatherTool = {
  name: "get_weather",
  description: "Get the current weather for a location",
  parameters: {
    type: "object",
    properties: {
      location: {
        type: "string",
        description: "The city name, e.g. 'Paris' or 'London'",
      },
    },
    required: ["location"],
  },
};

// Gateway config — cheapest model via Hanzo LLM Gateway
const GATEWAY_URL = process.env.HANZO_LLM_GATEWAY_URL ?? "https://llm.hanzo.ai";
const GATEWAY_MODEL = process.env.HANZO_LLM_GATEWAY_MODEL ?? "zen3-nano";

describe("LLM Connection Tests", () => {
  // =========================================================================
  // Hanzo Gateway Tests (primary — uses KMS-managed API key)
  // =========================================================================
  describe("Hanzo Gateway (OpenAI-compatible)", () => {
    const checkEnvVar = () => {
      if (!process.env.HANZO_LLM_API_KEY) {
        throw new Error(
          "HANZO_LLM_API_KEY not set. " +
            "This test requires a valid Hanzo LLM Gateway API key. " +
            "Set the environment variable to run this test.",
        );
      }
    };

    test("simple completion", async () => {
      checkEnvVar();

      const completion = await fetchLLMCompletion({
        streaming: false,
        messages: [
          {
            role: "user",
            content: "What is 2+2? Answer only with the number.",
            type: ChatMessageType.PublicAPICreated,
          },
        ],
        modelParams: {
          provider: "openai",
          adapter: LLMAdapter.OpenAI,
          model: GATEWAY_MODEL,
          temperature: 0,
          max_tokens: 10,
        },
        llmConnection: {
          secretKey: encrypt(process.env.HANZO_LLM_API_KEY!),
          baseURL: GATEWAY_URL,
        },
      });

      expect(typeof completion).toBe("string");
      expect(completion).toContain("4");
    }, 30_000);

    test("streaming completion", async () => {
      checkEnvVar();

      const stream = await fetchLLMCompletion({
        streaming: true,
        messages: [
          {
            role: "user",
            content: "What is 2+2? Answer only with the number.",
            type: ChatMessageType.PublicAPICreated,
          },
        ],
        modelParams: {
          provider: "openai",
          adapter: LLMAdapter.OpenAI,
          model: GATEWAY_MODEL,
          temperature: 0,
          max_tokens: 10,
        },
        llmConnection: {
          secretKey: encrypt(process.env.HANZO_LLM_API_KEY!),
          baseURL: GATEWAY_URL,
        },
      });

      const decoder = new TextDecoder();
      let fullResponse = "";
      let chunkCount = 0;

      for await (const chunk of stream) {
        fullResponse += decoder.decode(chunk);
        chunkCount++;
      }

      expect(chunkCount).toBeGreaterThan(0);
      expect(fullResponse).toContain("4");
    }, 30_000);

    test("structured output - eval schema", async () => {
      checkEnvVar();

      const completion = await fetchLLMCompletion({
        streaming: false,
        messages: [
          {
            role: "user",
            content:
              "Evaluate the quality of this response: 'The answer is 42.' Provide a score from 0-100 and reasoning.",
            type: ChatMessageType.PublicAPICreated,
          },
        ],
        modelParams: {
          provider: "openai",
          adapter: LLMAdapter.OpenAI,
          model: GATEWAY_MODEL,
          temperature: 0,
          max_tokens: 200,
        },
        structuredOutputSchema: evalOutputSchema,
        llmConnection: {
          secretKey: encrypt(process.env.HANZO_LLM_API_KEY!),
          baseURL: GATEWAY_URL,
        },
      });

      const parsed = evalOutputSchema.safeParse(completion);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(typeof parsed.data.score).toBe("number");
        expect(typeof parsed.data.reasoning).toBe("string");
        expect(parsed.data.reasoning.length).toBeGreaterThan(0);
      }
    }, 60_000);

    test("tool calling", async () => {
      checkEnvVar();

      const completion = await fetchLLMCompletion({
        streaming: false,
        messages: [
          {
            role: "user",
            content: "What's the weather like in Paris?",
            type: ChatMessageType.PublicAPICreated,
          },
        ],
        modelParams: {
          provider: "openai",
          adapter: LLMAdapter.OpenAI,
          model: GATEWAY_MODEL,
          temperature: 0,
          max_tokens: 100,
        },
        tools: [weatherTool],
        llmConnection: {
          secretKey: encrypt(process.env.HANZO_LLM_API_KEY!),
          baseURL: GATEWAY_URL,
        },
      });

      expect(completion).toHaveProperty("tool_calls");
      expect(Array.isArray(completion.tool_calls)).toBe(true);
      expect(completion.tool_calls.length).toBeGreaterThan(0);
      expect(completion.tool_calls[0].name).toBe("get_weather");
      expect(completion.tool_calls[0].args).toHaveProperty("location");
    }, 30_000);
  });

  // =========================================================================
  // Direct provider adapter tests (optional — run when provider keys are set)
  // =========================================================================
  describe("OpenAI (direct)", () => {
    const MODEL = "gpt-4o-mini";

    const checkEnvVar = () => {
      if (!process.env.HANZO_LLM_CONNECTION_OPENAI_KEY) {
        throw new Error(
          "HANZO_LLM_CONNECTION_OPENAI_KEY not set. " +
            "This test requires a valid OpenAI API key to verify the LLM connection. " +
            "Set the environment variable to run this test.",
        );
      }
    };

    test("simple completion", async () => {
      checkEnvVar();

      const completion = await fetchLLMCompletion({
        streaming: false,
        messages: [
          {
            role: "user",
            content: "What is 2+2? Answer only with the number.",
            type: ChatMessageType.PublicAPICreated,
          },
        ],
        modelParams: {
          provider: "openai",
          adapter: LLMAdapter.OpenAI,
          model: MODEL,
          temperature: 0,
          max_tokens: 10,
        },
        llmConnection: {
          secretKey: encrypt(process.env.HANZO_LLM_CONNECTION_OPENAI_KEY!),
        },
      });

      expect(typeof completion).toBe("string");
      expect(completion).toContain("4");
    }, 30_000);

    test("streaming completion", async () => {
      checkEnvVar();

      const stream = await fetchLLMCompletion({
        streaming: true,
        messages: [
          {
            role: "user",
            content: "What is 2+2? Answer only with the number.",
            type: ChatMessageType.PublicAPICreated,
          },
        ],
        modelParams: {
          provider: "openai",
          adapter: LLMAdapter.OpenAI,
          model: MODEL,
          temperature: 0,
          max_tokens: 10,
        },
        llmConnection: {
          secretKey: encrypt(process.env.HANZO_LLM_CONNECTION_OPENAI_KEY!),
        },
      });

      const decoder = new TextDecoder();
      let fullResponse = "";
      let chunkCount = 0;

      for await (const chunk of stream) {
        fullResponse += decoder.decode(chunk);
        chunkCount++;
      }

      expect(chunkCount).toBeGreaterThan(0);
      expect(fullResponse).toContain("4");
    }, 30_000);

    test("structured output - eval schema", async () => {
      checkEnvVar();

      const completion = await fetchLLMCompletion({
        streaming: false,
        messages: [
          {
            role: "user",
            content:
              "Evaluate the quality of this response: 'The answer is 42.' Provide a score from 0-100 and reasoning.",
            type: ChatMessageType.PublicAPICreated,
          },
        ],
        modelParams: {
          provider: "openai",
          adapter: LLMAdapter.OpenAI,
          model: MODEL,
          temperature: 0,
          max_tokens: 200,
        },
        structuredOutputSchema: evalOutputSchema,
        llmConnection: {
          secretKey: encrypt(process.env.HANZO_LLM_CONNECTION_OPENAI_KEY!),
        },
      });

      const parsed = evalOutputSchema.safeParse(completion);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(typeof parsed.data.score).toBe("number");
        expect(typeof parsed.data.reasoning).toBe("string");
        expect(parsed.data.reasoning.length).toBeGreaterThan(0);
      }
    }, 30_000);

    test("tool calling", async () => {
      checkEnvVar();

      const completion = await fetchLLMCompletion({
        streaming: false,
        messages: [
          {
            role: "user",
            content: "What's the weather like in Paris?",
            type: ChatMessageType.PublicAPICreated,
          },
        ],
        modelParams: {
          provider: "openai",
          adapter: LLMAdapter.OpenAI,
          model: MODEL,
          temperature: 0,
          max_tokens: 100,
        },
        tools: [weatherTool],
        llmConnection: {
          secretKey: encrypt(process.env.HANZO_LLM_CONNECTION_OPENAI_KEY!),
        },
      });

      expect(completion).toHaveProperty("tool_calls");
      expect(Array.isArray(completion.tool_calls)).toBe(true);
      expect(completion.tool_calls.length).toBeGreaterThan(0);
      expect(completion.tool_calls[0].name).toBe("get_weather");
      expect(completion.tool_calls[0].args).toHaveProperty("location");
    }, 30_000);
  });

  describe("Anthropic (direct)", () => {
    const MODEL = "claude-sonnet-4-6";

    const checkEnvVar = () => {
      if (!process.env.HANZO_LLM_CONNECTION_ANTHROPIC_KEY) {
        throw new Error(
          "HANZO_LLM_CONNECTION_ANTHROPIC_KEY not set. " +
            "This test requires a valid Anthropic API key to verify the LLM connection. " +
            "Set the environment variable to run this test.",
        );
      }
    };

    test("simple completion", async () => {
      checkEnvVar();

      const completion = await fetchLLMCompletion({
        streaming: false,
        messages: [
          {
            role: "user",
            content: "What is 2+2? Answer only with the number.",
            type: ChatMessageType.PublicAPICreated,
          },
        ],
        modelParams: {
          provider: "anthropic",
          adapter: LLMAdapter.Anthropic,
          model: MODEL,
          temperature: 0,
          max_tokens: 10,
        },
        llmConnection: {
          secretKey: encrypt(process.env.HANZO_LLM_CONNECTION_ANTHROPIC_KEY!),
        },
      });

      expect(typeof completion).toBe("string");
      expect(completion).toContain("4");
    }, 30_000);

    test("streaming completion", async () => {
      checkEnvVar();

      const stream = await fetchLLMCompletion({
        streaming: true,
        messages: [
          {
            role: "user",
            content: "What is 2+2? Answer only with the number.",
            type: ChatMessageType.PublicAPICreated,
          },
        ],
        modelParams: {
          provider: "anthropic",
          adapter: LLMAdapter.Anthropic,
          model: MODEL,
          temperature: 0,
          max_tokens: 10,
        },
        llmConnection: {
          secretKey: encrypt(
            process.env.HANZO_LLM_CONNECTION_ANTHROPIC_KEY!,
          ),
        },
      });

      const decoder = new TextDecoder();
      let fullResponse = "";
      let chunkCount = 0;

      for await (const chunk of stream) {
        fullResponse += decoder.decode(chunk);
        chunkCount++;
      }

      expect(chunkCount).toBeGreaterThan(0);
      expect(fullResponse).toContain("4");
    }, 30_000);

    test("tool calling", async () => {
      checkEnvVar();

      const completion = await fetchLLMCompletion({
        streaming: false,
        messages: [
          {
            role: "user",
            content: "What's the weather like in Paris?",
            type: ChatMessageType.PublicAPICreated,
          },
        ],
        modelParams: {
          provider: "anthropic",
          adapter: LLMAdapter.Anthropic,
          model: MODEL,
          temperature: 0,
          max_tokens: 100,
        },
        tools: [weatherTool],
        llmConnection: {
          secretKey: encrypt(process.env.HANZO_LLM_CONNECTION_ANTHROPIC_KEY!),
        },
      });

      expect(completion).toHaveProperty("tool_calls");
      expect(Array.isArray(completion.tool_calls)).toBe(true);
      expect(completion.tool_calls.length).toBeGreaterThan(0);
      expect(completion.tool_calls[0].name).toBe("get_weather");
      expect(completion.tool_calls[0].args).toHaveProperty("location");
    }, 30_000);
  });
});
