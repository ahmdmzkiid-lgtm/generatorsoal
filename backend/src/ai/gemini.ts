import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { GoogleAICacheManager } from "@google/generative-ai/server";
import type { Schema } from "@google/generative-ai";
import * as crypto from "crypto";
import type {
  AIProvider,
  GeneratedQuestion,
  ReviewResult,
} from "./types";

const GEMINI_MODEL = "gemini-2.5-flash";

const questionSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    question: { type: SchemaType.STRING, description: "Teks soal" },
    options: {
      type: SchemaType.ARRAY,
      description: "Opsi jawaban",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          key: { type: SchemaType.STRING, description: "Huruf opsi (A, B, C, D, E)" },
          value: { type: SchemaType.STRING, description: "Teks opsi" },
        },
        required: ["key", "value"],
      },
    },
    answerKey: { type: SchemaType.STRING, description: "Kunci jawaban (huruf)" },
    explanation: { type: SchemaType.STRING, description: "Pembahasan soal" },
    difficulty: {
      type: SchemaType.STRING,
      format: "enum",
      description: "Tingkat kesulitan",
      enum: ["easy", "medium", "hard"],
    },
    tags: {
      type: SchemaType.ARRAY,
      description: "Tag/topik soal",
      items: { type: SchemaType.STRING },
    },
  },
  required: ["question", "options", "answerKey", "explanation", "difficulty", "tags"],
};

const reviewSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    valid: { type: SchemaType.BOOLEAN, description: "Apakah soal valid" },
    issues: {
      type: SchemaType.ARRAY,
      description: "Daftar masalah yang ditemukan (string deskripsi)",
      items: { type: SchemaType.STRING },
    },
    confidence: { type: SchemaType.NUMBER, description: "Tingkat keyakinan review (0-1)" },
  },
  required: ["valid", "issues", "confidence"],
};

export function createGeminiProvider(): AIProvider {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY environment variable is required for GeminiProvider"
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const cacheManager = new GoogleAICacheManager(apiKey);
  const cacheMap = new Map<string, { name: string; expiresAt: number }>();

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
    let model: any;
    let contents: any[];
    let cacheName: string | null = null;

    const hasStaticContext = options?.systemPrompt;

    if (hasStaticContext) {
      const staticContext = `${options.systemPrompt}${options.referenceContext ? `\n\nREFERENCE_CONTEXT:\n${options.referenceContext}` : ""}`;
      
      try {
        // 1. Get token count to check if it's eligible for caching (>= 2048 tokens)
        const tokenModel = genAI.getGenerativeModel({ model: GEMINI_MODEL });
        const { totalTokens } = await tokenModel.countTokens(staticContext);

        if (totalTokens >= 2048) {
          // 2. Hash static content and look up or create cache
          const hash = crypto.createHash("sha256").update(staticContext).digest("hex");
          let cacheEntry = cacheMap.get(hash);

          if (cacheEntry && Date.now() < cacheEntry.expiresAt - 10000) {
            cacheName = cacheEntry.name;
          } else {
            const cache = await cacheManager.create({
              model: `models/${GEMINI_MODEL}`,
              contents: [{ role: "user", parts: [{ text: staticContext }] }],
              ttlSeconds: 1800, // 30 minutes TTL
            });
            if (cache.name) {
              const expiresAt = Date.now() + 1800 * 1000;
              const newEntry = { name: cache.name, expiresAt };
              cacheMap.set(hash, newEntry);
              cacheName = cache.name;
            }
          }
        }
      } catch (err) {
        console.warn("Context caching failed, falling back to standard generation:", err);
      }
    }

    if (cacheName) {
      // Use cached model
      model = genAI.getGenerativeModelFromCachedContent(
        { name: cacheName } as any,
        {
          model: GEMINI_MODEL,
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: { type: SchemaType.ARRAY, items: questionSchema },
          },
        }
      );

      const customInstruction = options?.customPrompt
        ? `\n\nINSTRUKSI TAMBAHAN DARI PENGGUNA:\n${options.customPrompt}\n(Harap prioritaskan instruksi tambahan ini dalam pembuatan soal jika tidak bertentangan dengan reference_context).`
        : "";

      const query = `Buatkan ${count} soal dengan format JSON array.${customInstruction}

INSTRUKSI FORMAT OUTPUT:
Buat soal dalam format JSON array. Setiap item harus memiliki field:
- question (string): teks soal
- options (array of {key: string, value: string}): opsi jawaban (A/B/C/D/E), selalu 5 opsi
- answerKey (string): huruf kunci jawaban
- explanation (string): pembahasan singkat
- difficulty (string): "easy", "medium", atau "hard"
- tags (array of string): tag/topik soal

Output HANYA berupa JSON array valid, tanpa teks lain.`;

      contents = [query];
    } else {
      // Fallback: non-cached model
      model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: { type: SchemaType.ARRAY, items: questionSchema },
        },
      });

      contents = [`Buatkan ${count} soal dengan format JSON array.\n${prompt}`];
    }

    if (images && images.length > 0) {
      for (const img of images) {
        contents.push({
          inlineData: {
            data: img.data,
            mimeType: img.mimeType,
          },
        });
      }
    }

    const result = await model.generateContent(contents);
    const text = result.response.text();

    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      throw new SyntaxError("Response is not a JSON array");
    }
    return parsed as GeneratedQuestion[];
  }

  async function reviewQuestion(
    question: GeneratedQuestion,
    criteria: string
  ): Promise<ReviewResult> {
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: reviewSchema,
      },
    });

    const result = await model.generateContent(
      `Review soal berikut:\n${JSON.stringify(question, null, 2)}\n\nKriteria review:\n${criteria}`
    );
    const text = result.response.text();

    const parsed = JSON.parse(text);
    if (typeof parsed.valid !== "boolean") {
      throw new SyntaxError("Response missing 'valid' boolean field");
    }
    return parsed as ReviewResult;
  }

  return { generateQuestions, reviewQuestion };
}
