"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGeminiProvider = createGeminiProvider;
const generative_ai_1 = require("@google/generative-ai");
const GEMINI_MODEL = "gemini-2.0-flash-thinking-exp";
function extractJson(raw) {
    const jsonMatch = raw.match(/\[[\s\S]*\]/) || raw.match(/\{[\s\S]*\}/);
    if (jsonMatch)
        return jsonMatch[0];
    throw new SyntaxError("No JSON found in response");
}
function createGeminiProvider() {
    const apiKey = process.env.VERTEX_AI_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("VERTEX_AI_KEY or GEMINI_API_KEY environment variable is required");
    }
    const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    const jsonInstruction = `Kamu adalah asisten yang hanya merespons dalam format JSON valid.
Jangan pernah menyertakan teks penjelasan, markdown, atau apapun di luar JSON.
Output harus bisa di-parse langsung oleh JSON.parse().`;
    async function generateQuestions(prompt, _schema, count, images, options) {
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
        const sysPrompt = options?.systemPrompt
            ? `${options.systemPrompt}${options.referenceContext ? `\n\nREFERENCE_CONTEXT:\n${options.referenceContext}` : ""}`
            : "";
        const customInstruction = options?.customPrompt
            ? `\n\nINSTRUKSI TAMBAHAN DARI PENGGUNA:\n${options.customPrompt}`
            : "";
        const userContent = `${jsonInstruction}

${sysPrompt}

Buatkan ${count} soal dalam format JSON array.
Setiap item harus memiliki field:
- question (string): teks soal
- options (array of {key: string, value: string}): opsi jawaban (A/B/C/D/E), selalu 5 opsi
- answerKey (string): huruf kunci jawaban
- explanation (string): pembahasan singkat
- difficulty (string): "easy", "medium", atau "hard"
- tags (array of string): tag/topik soal

Output HANYA berupa JSON array valid, tanpa teks lain.
Bungkus dalam object: { "questions": [ ... ] }${customInstruction}

${prompt}`;
        const contents = [{ role: "user", parts: [{ text: userContent }] }];
        if (images && images.length > 0) {
            for (const img of images) {
                contents[0].parts.push({
                    inlineData: { data: img.data, mimeType: img.mimeType },
                });
            }
        }
        const result = await model.generateContent(contents);
        const text = result.response.text();
        const jsonStr = extractJson(text);
        let data = JSON.parse(jsonStr);
        if (!Array.isArray(data)) {
            const arrayKey = Object.keys(data).find((k) => Array.isArray(data[k]));
            if (arrayKey)
                data = data[arrayKey];
            else
                throw new SyntaxError("Response is not a JSON array");
        }
        return data.map((item) => ({
            question: item.question,
            options: item.options,
            answerKey: item.answerKey,
            explanation: item.explanation,
            difficulty: item.difficulty,
            tags: item.tags,
        }));
    }
    async function reviewQuestion(question, criteria) {
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
        const result = await model.generateContent({
            contents: [{
                    role: "user",
                    parts: [{ text: `${jsonInstruction}

Review soal berikut dan berikan hasil dalam format JSON dengan field:
- valid (boolean): apakah soal valid
- issues (array of string): daftar masalah
- confidence (number 0-1): tingkat keyakinan

Soal:
${JSON.stringify(question, null, 2)}

Kriteria review:
${criteria}` }],
                }],
        });
        const text = result.response.text();
        const jsonStr = extractJson(text);
        const parsed = JSON.parse(jsonStr);
        return {
            valid: typeof parsed.valid === "boolean" ? parsed.valid : true,
            issues: Array.isArray(parsed.issues) ? parsed.issues.map(String) : [],
            confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
        };
    }
    return { generateQuestions, reviewQuestion };
}
//# sourceMappingURL=gemini.js.map