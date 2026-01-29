/**
 * Hanzo Console SDK
 *
 * Provides prompt management and observability features for Hanzo Console.
 */

export interface HanzoClientOptions {
  publicKey: string;
  secretKey: string;
  baseUrl?: string;
}

export interface PromptOptions {
  type?: "chat" | "text";
}

export interface PromptMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface PromptResponse {
  name: string;
  version: number;
  prompt: string | PromptMessage[];
  compile: (variables: Record<string, string>) => PromptMessage[];
}

/**
 * Hanzo Console client for prompt management and observability.
 */
export class Hanzo {
  private publicKey: string;
  private secretKey: string;
  private baseUrl: string;

  constructor(options: HanzoClientOptions) {
    this.publicKey = options.publicKey;
    this.secretKey = options.secretKey;
    this.baseUrl = options.baseUrl ?? "https://cloud.hanzo.ai";
  }

  /**
   * Fetches a prompt from the Hanzo prompt management service.
   */
  async getPrompt(name: string, version?: number, options?: PromptOptions): Promise<PromptResponse> {
    const url = new URL(`/api/public/v2/prompts/${encodeURIComponent(name)}`, this.baseUrl);
    if (version !== undefined) {
      url.searchParams.set("version", String(version));
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${this.publicKey}:${this.secretKey}`).toString("base64")}`,
      },
    });

    if (!response.ok) {
      const error = await response.text().catch(() => "Unknown error");
      throw new Error(`Failed to fetch prompt "${name}": ${response.status} ${error}`);
    }

    const data = await response.json();

    // Create a compile function that substitutes variables in the prompt
    const compile = (variables: Record<string, string>): PromptMessage[] => {
      const promptContent = data.prompt ?? data.content ?? "";

      // Handle chat prompts (array of messages)
      if (Array.isArray(promptContent)) {
        return promptContent.map((msg: PromptMessage) => ({
          ...msg,
          content: substituteVariables(msg.content, variables),
        }));
      }

      // Handle text prompts (single string) - wrap in user message
      const substituted = substituteVariables(
        typeof promptContent === "string" ? promptContent : JSON.stringify(promptContent),
        variables,
      );

      return [{ role: "user", content: substituted }];
    };

    return {
      name: data.name ?? name,
      version: data.version ?? 1,
      prompt: data.prompt ?? data.content,
      compile,
    };
  }

  /**
   * Creates a trace for observability.
   */
  trace(options: { name?: string; userId?: string; sessionId?: string; metadata?: Record<string, unknown> }) {
    // Placeholder for trace creation - can be expanded later
    return {
      id: generateTraceId(),
      ...options,
      span: (spanOptions: { name: string; input?: unknown }) => ({
        id: generateTraceId(),
        ...spanOptions,
        end: (output?: { output?: unknown }) => output,
      }),
    };
  }
}

/**
 * Substitutes {{variable}} placeholders in a string with values from the variables object.
 */
function substituteVariables(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] ?? match;
  });
}

/**
 * Generates a random trace ID.
 */
function generateTraceId(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Fallback for environments without crypto.getRandomValues
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default Hanzo;
