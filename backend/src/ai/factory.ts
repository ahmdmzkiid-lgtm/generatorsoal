import type { AIProvider } from "./types";
import { withRetry } from "./retry";
import { createGeminiProvider } from "./gemini";
import { createGroqProvider } from "./groq";
import { createAnthropicProvider } from "./anthropic";

export function createGeneratorProvider(): AIProvider {
  const providerName =
    process.env.AI_GENERATOR_PROVIDER || "gemini";

  const provider = createProvider(providerName);
  return withRetry(provider);
}

export function createReviewerProvider(): AIProvider {
  const providerName =
    process.env.AI_REVIEWER_PROVIDER || "groq";

  const provider = createProvider(providerName);
  return withRetry(provider);
}

function createProvider(name: string): AIProvider {
  switch (name) {
    case "gemini":
      return createGeminiProvider();
    case "groq":
      return createGroqProvider();
    case "anthropic":
      return createAnthropicProvider();
    default:
      throw new Error(
        `Unknown AI provider: "${name}". Valid options: gemini, groq, anthropic`
      );
  }
}
