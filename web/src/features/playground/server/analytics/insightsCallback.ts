import type { ValidatedChatCompletionBody } from "@/src/features/playground/server/validateChatCompletionBody";
import { ServerInsights } from "@/src/features/insights-analytics/ServerInsights";
import type { LLMResult } from "@langchain/core/outputs";
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";

import type { ChatMessage, ModelParams } from "@hanzo/shared";

export class InsightsCallbackHandler extends BaseCallbackHandler {
  public name = "InsightsCallbackHandler";
  private messages: ChatMessage[];
  private modelParams: ModelParams;
  private insights: ServerInsights;

  constructor(
    public eventPrefix: string,
    public body: ValidatedChatCompletionBody,
    private userId: string,
  ) {
    super();
    this.insights = new ServerInsights();
    this.messages = body.messages;
    this.modelParams = body.modelParams;
  }

  async handleLLMEnd(output: LLMResult) {
    const generation = output.generations[0][0];

    if (generation) {
      const outputString = output.generations[0][0].text;
      const properties = this.getEventProperties(outputString);

      this.captureEvent(properties);
      await this.insights.flush();
    }
  }

  private getInputLength() {
    return this.messages.reduce((acc, message) => acc + message.content.length, 0);
  }

  private getEventProperties(output: string): ChatCompletionEventProperties {
    return {
      outputLength: output.length,
      inputLength: this.getInputLength(),
      modelProvider: this.modelParams.provider,
      modelName: this.modelParams.model,
    };
  }

  private captureEvent(properties: ChatCompletionEventProperties) {
    this.insights.capture({
      event: this.eventPrefix + "_chat_completion",
      distinctId: this.userId,
      properties,
    });
  }

  public async flushAsync() {
    await this.insights.flush();
  }
}

type ChatCompletionEventProperties = {
  outputLength: number;
  inputLength: number;
  modelProvider: string;
  modelName: string;
};
