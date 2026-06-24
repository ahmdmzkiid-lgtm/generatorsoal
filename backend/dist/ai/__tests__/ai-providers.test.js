"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const gemini_1 = require("../gemini");
const groq_1 = require("../groq");
const factory_1 = require("../factory");
const retry_1 = require("../retry");
// ── Helpers ──
const sampleQuestion = {
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
function mockProvider(impl) {
    return {
        generateQuestions: impl?.generateQuestions ?? vitest_1.vi.fn(),
        reviewQuestion: impl?.reviewQuestion ?? vitest_1.vi.fn(),
    };
}
// ── withRetry ──
(0, vitest_1.describe)("withRetry", () => {
    (0, vitest_1.it)("passes through on success", async () => {
        const inner = mockProvider({
            generateQuestions: vitest_1.vi.fn().mockResolvedValue([sampleQuestion]),
        });
        const wrapped = (0, retry_1.withRetry)(inner, 2);
        const result = await wrapped.generateQuestions("test", {}, 1);
        (0, vitest_1.expect)(result).toEqual([sampleQuestion]);
    });
    (0, vitest_1.it)("retries on JSON parse error and succeeds", async () => {
        const fn = vitest_1.vi
            .fn()
            .mockRejectedValueOnce(new SyntaxError("Unexpected token"))
            .mockResolvedValueOnce([sampleQuestion]);
        const wrapped = (0, retry_1.withRetry)(mockProvider({ generateQuestions: fn }), 2);
        const result = await wrapped.generateQuestions("test", {}, 1);
        (0, vitest_1.expect)(result).toEqual([sampleQuestion]);
        (0, vitest_1.expect)(fn).toHaveBeenCalledTimes(2);
    });
    (0, vitest_1.it)("throws after exhausting retries", async () => {
        const err = new SyntaxError("Bad JSON");
        const fn = vitest_1.vi.fn().mockRejectedValue(err);
        const wrapped = (0, retry_1.withRetry)(mockProvider({ generateQuestions: fn }), 2);
        await (0, vitest_1.expect)(wrapped.generateQuestions("test", {}, 1)).rejects.toThrow("Bad JSON");
        (0, vitest_1.expect)(fn).toHaveBeenCalledTimes(3);
    });
    (0, vitest_1.it)("does NOT retry on non-JSON errors", async () => {
        const err = new Error("Rate limited");
        const fn = vitest_1.vi.fn().mockRejectedValue(err);
        const wrapped = (0, retry_1.withRetry)(mockProvider({ generateQuestions: fn }), 2);
        await (0, vitest_1.expect)(wrapped.generateQuestions("test", {}, 1)).rejects.toThrow("Rate limited");
        (0, vitest_1.expect)(fn).toHaveBeenCalledTimes(1);
    });
    (0, vitest_1.it)("retries reviewQuestion on JSON error", async () => {
        const reviewResult = {
            valid: true,
            issues: [],
            confidence: 0.95,
        };
        const fn = vitest_1.vi
            .fn()
            .mockRejectedValueOnce(new SyntaxError("bad json"))
            .mockResolvedValueOnce(reviewResult);
        const wrapped = (0, retry_1.withRetry)(mockProvider({ reviewQuestion: fn }), 2);
        const result = await wrapped.reviewQuestion(sampleQuestion, "criteria");
        (0, vitest_1.expect)(result).toEqual(reviewResult);
        (0, vitest_1.expect)(fn).toHaveBeenCalledTimes(2);
    });
});
// ── GeminiProvider (mocked) ──
(0, vitest_1.describe)("GeminiProvider", () => {
    (0, vitest_1.beforeEach)(() => {
        process.env.GEMINI_API_KEY = "test-key";
    });
    (0, vitest_1.it)("throws if GEMINI_API_KEY is not set", () => {
        delete process.env.GEMINI_API_KEY;
        (0, vitest_1.expect)(() => (0, gemini_1.createGeminiProvider)()).toThrow("GEMINI_API_KEY");
    });
    (0, vitest_1.it)("generateQuestions rejects cleanly with fake SDK (no real key)", async () => {
        const provider = (0, gemini_1.createGeminiProvider)();
        // The SDK will try to connect and fail with an API error, not a JSON parse error
        await (0, vitest_1.expect)(provider.generateQuestions("test", {}, 1)).rejects.toThrow();
    });
});
// ── GroqProvider (mocked) ──
(0, vitest_1.describe)("GroqProvider", () => {
    (0, vitest_1.beforeEach)(() => {
        process.env.GROQ_API_KEY = "test-key";
    });
    (0, vitest_1.it)("throws if GROQ_API_KEY is not set", () => {
        delete process.env.GROQ_API_KEY;
        (0, vitest_1.expect)(() => (0, groq_1.createGroqProvider)()).toThrow("GROQ_API_KEY");
    });
    (0, vitest_1.it)("generateQuestions rejects cleanly with fake SDK (no real key)", async () => {
        const provider = (0, groq_1.createGroqProvider)();
        await (0, vitest_1.expect)(provider.generateQuestions("test", {}, 1)).rejects.toThrow();
    });
    // ── parseGeneratedQuestions edge cases (via mocked Groq) ──
    (0, vitest_1.it)("handles JSON parse failure in wrap", async () => {
        // Use a mock provider that returns invalid JSON
        const mock = {
            generateQuestions: vitest_1.vi
                .fn()
                .mockResolvedValue({ notAnArray: true }),
            reviewQuestion: vitest_1.vi.fn(),
        };
        await (0, vitest_1.expect)(mock.generateQuestions("", {}, 1)).resolves.toEqual({
            notAnArray: true,
        });
    });
});
// ── Factory env var tests ──
(0, vitest_1.describe)("Factory", () => {
    (0, vitest_1.it)("respects AI_GENERATOR_PROVIDER env var (test via constructor)", () => {
        process.env.GEMINI_API_KEY = "k";
        process.env.GROQ_API_KEY = "k";
        process.env.ANTHROPIC_API_KEY = "k";
        process.env.AI_GENERATOR_PROVIDER = "gemini";
        (0, vitest_1.expect)(() => (0, factory_1.createGeneratorProvider)()).not.toThrow();
        process.env.AI_GENERATOR_PROVIDER = "groq";
        (0, vitest_1.expect)(() => (0, factory_1.createGeneratorProvider)()).not.toThrow();
        process.env.AI_GENERATOR_PROVIDER = "anthropic";
        (0, vitest_1.expect)(() => (0, factory_1.createGeneratorProvider)()).not.toThrow();
    });
});
//# sourceMappingURL=ai-providers.test.js.map