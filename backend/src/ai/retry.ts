import type { AIProvider, GeneratedQuestion, ReviewResult } from "./types";

function isJsonParseError(err: unknown): boolean {
  if (err instanceof SyntaxError) return true;
  if (
    err &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as { message: string }).message === "string"
  ) {
    const msg = (err as { message: string }).message.toLowerCase();
    return msg.includes("json") || msg.includes("parse");
  }
  return false;
}

export function withRetry(provider: AIProvider, maxRetries = 2): AIProvider {
  return {
    async generateQuestions(prompt, schema, count, images, options) {
      let lastError: unknown;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const instruction =
            attempt > 0
              ? "\n\n⚠️ PERINGATAN: Response sebelumnya tidak valid JSON. Pastikan output hanya JSON array sesuai schema yang diberikan, tanpa teks tambahan."
              : "";
          const finalOptions = options
            ? {
                ...options,
                customPrompt: (options.customPrompt || "") + instruction,
              }
            : undefined;
          return await provider.generateQuestions(
            prompt + instruction,
            schema,
            count,
            images,
            finalOptions
          );
        } catch (err) {
          lastError = err;
          if (attempt < maxRetries && isJsonParseError(err)) {
            continue;
          }
          throw err;
        }
      }
      throw lastError;
    },

    async reviewQuestion(question, criteria) {
      let lastError: unknown;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const instruction =
            attempt > 0
              ? "\n\n⚠️ PERINGATAN: Response sebelumnya tidak valid JSON. Pastikan output hanya JSON object sesuai schema, tanpa teks tambahan."
              : "";
          return await provider.reviewQuestion(question, criteria + instruction);
        } catch (err) {
          lastError = err;
          if (attempt < maxRetries && isJsonParseError(err)) {
            continue;
          }
          throw err;
        }
      }
      throw lastError;
    },
  };
}
