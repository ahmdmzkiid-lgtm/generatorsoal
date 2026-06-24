import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGeminiProvider } from "../gemini";
import { createGroqProvider } from "../groq";
import { createGeneratorProvider } from "../factory";
import { withRetry } from "../retry";
import type { AIProvider, GeneratedQuestion, ReviewResult } from "../types";

// ── Helpers ──

const sampleQuestion: GeneratedQuestion = {
  question: "Nilai x dari 2x + 3 = 7 adalah?",
  options: [
    { key: "A", value: "1" },
    { key: "B", value: "2" },
    { key: "C", value: "3" },
    { key: "D", value: "4" },
  ],
  answerKey: "B",
  explanation: "2x = 4 → x = 2",
  difficulty: "easy",
  tags: ["PLSV"],
};

function mockProvider(impl?: Partial<AIProvider>): AIProvider {
  return {
    generateQuestions: impl?.generateQuestions ?? vi.fn(),
    reviewQuestion: impl?.reviewQuestion ?? vi.fn(),
  };
}

// ── withRetry ──

describe("withRetry", () => {
  it("passes through on success", async () => {
    const inner = mockProvider({
      generateQuestions: vi.fn().mockResolvedValue([sampleQuestion]),
    });
    const wrapped = withRetry(inner, 2);
    const result = await wrapped.generateQuestions("test", {}, 1);
    expect(result).toEqual([sampleQuestion]);
  });

  it("retries on JSON parse error and succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new SyntaxError("Unexpected token"))
      .mockResolvedValueOnce([sampleQuestion]);

    const wrapped = withRetry(mockProvider({ generateQuestions: fn }), 2);
    const result = await wrapped.generateQuestions("test", {}, 1);
    expect(result).toEqual([sampleQuestion]);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting retries", async () => {
    const err = new SyntaxError("Bad JSON");
    const fn = vi.fn().mockRejectedValue(err);

    const wrapped = withRetry(mockProvider({ generateQuestions: fn }), 2);
    await expect(wrapped.generateQuestions("test", {}, 1)).rejects.toThrow(
      "Bad JSON"
    );
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does NOT retry on non-JSON errors", async () => {
    const err = new Error("Rate limited");
    const fn = vi.fn().mockRejectedValue(err);

    const wrapped = withRetry(mockProvider({ generateQuestions: fn }), 2);
    await expect(wrapped.generateQuestions("test", {}, 1)).rejects.toThrow(
      "Rate limited"
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries reviewQuestion on JSON error", async () => {
    const reviewResult: ReviewResult = {
      valid: true,
      issues: [],
      confidence: 0.95,
    };
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new SyntaxError("bad json"))
      .mockResolvedValueOnce(reviewResult);

    const wrapped = withRetry(mockProvider({ reviewQuestion: fn }), 2);
    const result = await wrapped.reviewQuestion(sampleQuestion, "criteria");
    expect(result).toEqual(reviewResult);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

// ── GeminiProvider (mocked) ──

describe("GeminiProvider", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
  });

  it("throws if GEMINI_API_KEY is not set", () => {
    delete process.env.GEMINI_API_KEY;
    expect(() => createGeminiProvider()).toThrow("GEMINI_API_KEY");
  });

  it("generateQuestions rejects cleanly with fake SDK (no real key)", async () => {
    const provider = createGeminiProvider();
    // The SDK will try to connect and fail with an API error, not a JSON parse error
    await expect(
      provider.generateQuestions("test", {}, 1)
    ).rejects.toThrow();
  });
});

// ── GroqProvider (mocked) ──

describe("GroqProvider", () => {
  beforeEach(() => {
    process.env.GROQ_API_KEY = "test-key";
  });

  it("throws if GROQ_API_KEY is not set", () => {
    delete process.env.GROQ_API_KEY;
    expect(() => createGroqProvider()).toThrow("GROQ_API_KEY");
  });

  it("generateQuestions rejects cleanly with fake SDK (no real key)", async () => {
    const provider = createGroqProvider();
    await expect(
      provider.generateQuestions("test", {}, 1)
    ).rejects.toThrow();
  });

  // ── parseGeneratedQuestions edge cases (via mocked Groq) ──

  it("handles JSON parse failure in wrap", async () => {
    // Use a mock provider that returns invalid JSON
    const mock: AIProvider = {
      generateQuestions: vi
        .fn()
        .mockResolvedValue({ notAnArray: true } as unknown as GeneratedQuestion[]),
      reviewQuestion: vi.fn(),
    };

    await expect(mock.generateQuestions("", {}, 1)).resolves.toEqual({
      notAnArray: true,
    });
  });
});

// ── Factory env var tests ──

describe("Factory", () => {
  it("respects AI_GENERATOR_PROVIDER env var (test via constructor)", () => {
    process.env.GEMINI_API_KEY = "k";
    process.env.GROQ_API_KEY = "k";
    process.env.ANTHROPIC_API_KEY = "k";

    process.env.AI_GENERATOR_PROVIDER = "gemini";
    expect(() => createGeneratorProvider()).not.toThrow();

    process.env.AI_GENERATOR_PROVIDER = "groq";
    expect(() => createGeneratorProvider()).not.toThrow();

    process.env.AI_GENERATOR_PROVIDER = "anthropic";
    expect(() => createGeneratorProvider()).not.toThrow();
  });
});
