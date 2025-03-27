import {
  type PromptVariable,
  type ChatMessage,
  type UIModelParams,
} from "@hanzo/shared";

export type PlaygroundCache = {
  messages: ChatMessage[];
  modelParams?: Partial<UIModelParams> &
    Pick<UIModelParams, "provider" | "model">;
  output?: string | null;
  promptVariables?: PromptVariable[];
} | null;
