"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGeneratorProvider = createGeneratorProvider;
exports.createReviewerProvider = createReviewerProvider;
const retry_1 = require("./retry");
const gemini_1 = require("./gemini");
const groq_1 = require("./groq");
const anthropic_1 = require("./anthropic");
function createGeneratorProvider() {
    const providerName = process.env.AI_GENERATOR_PROVIDER || "gemini";
    const provider = createProvider(providerName);
    return (0, retry_1.withRetry)(provider);
}
function createReviewerProvider() {
    const providerName = process.env.AI_REVIEWER_PROVIDER || "groq";
    const provider = createProvider(providerName);
    return (0, retry_1.withRetry)(provider);
}
function createProvider(name) {
    switch (name) {
        case "gemini":
            return (0, gemini_1.createGeminiProvider)();
        case "groq":
            return (0, groq_1.createGroqProvider)();
        case "anthropic":
            return (0, anthropic_1.createAnthropicProvider)();
        default:
            throw new Error(`Unknown AI provider: "${name}". Valid options: gemini, groq, anthropic`);
    }
}
//# sourceMappingURL=factory.js.map