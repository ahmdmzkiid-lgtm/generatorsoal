import type { AIProvider, GeneratedQuestion, ReviewResult } from "./types";

/**
 * AnthropicProvider — skeleton untuk implementasi Claude API.
 * Aktifkan dengan env AI_GENERATOR_PROVIDER=anthropic atau AI_REVIEWER_PROVIDER=anthropic
 * dan set ANTHROPIC_API_KEY.
 *
 * TODO: Implementasi penuh menggunakan @anthropic-ai/sdk
 */
export function createAnthropicProvider(): AIProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY environment variable is required for AnthropicProvider"
    );
  }

  return {
    async generateQuestions(_prompt, _schema, _count, _images) {
      throw new Error(
        "AnthropicProvider.generateQuestions is not yet implemented. " +
          "Install @anthropic-ai/sdk and implement using messages API with tools/structured output."
      );
    },

    async reviewQuestion(_question, _criteria) {
      throw new Error(
        "AnthropicProvider.reviewQuestion is not yet implemented."
      );
    },
  };
}
