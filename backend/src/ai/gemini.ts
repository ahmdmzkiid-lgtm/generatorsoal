import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  AIProvider,
  GeneratedQuestion,
  ReviewResult,
} from "./types";

const GEMINI_MODEL = "gemini-2.5-flash";

function extractJson(raw: string): string {
  const jsonMatch = raw.match(/\[[\s\S]*\]/) || raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];
  throw new SyntaxError("No JSON found in response");
}

export function createGeminiProvider(): AIProvider {
  const apiKey = process.env.VERTEX_AI_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "VERTEX_AI_KEY or GEMINI_API_KEY environment variable is required"
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  const jsonInstruction = `Kamu adalah asisten yang hanya merespons dalam format JSON valid.
Jangan pernah menyertakan teks penjelasan, markdown, atau apapun di luar JSON.
Output harus bisa di-parse langsung oleh JSON.parse().`;

  async function generateQuestions(
    prompt: string,
    _schema: object,
    count: number,
    images?: { data: string; mimeType: string }[],
    options?: {
      systemPrompt?: string;
      referenceContext?: string | null;
      customPrompt?: string;
    }
  ): Promise<GeneratedQuestion[]> {
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

    const parts: any[] = [{ text: userContent }];

    if (images && images.length > 0) {
      for (const img of images) {
        parts.push({ inlineData: { data: img.data, mimeType: img.mimeType } });
      }
    }

    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
    });
    const text = result.response.text();

    const jsonStr = extractJson(text);
    let data = JSON.parse(jsonStr);

    if (!Array.isArray(data)) {
      const arrayKey = Object.keys(data).find((k) => Array.isArray(data[k]));
      if (arrayKey) data = data[arrayKey];
      else throw new SyntaxError("Response is not a JSON array");
    }

    return data.map((item: Record<string, unknown>) => ({
      question: item.question as string,
      options: item.options as { key: string; value: string }[],
      answerKey: item.answerKey as string,
      explanation: item.explanation as string,
      difficulty: item.difficulty as "easy" | "medium" | "hard",
      tags: item.tags as string[],
    }));
  }

  async function reviewQuestion(
    question: GeneratedQuestion,
    criteria: string
  ): Promise<ReviewResult> {
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
