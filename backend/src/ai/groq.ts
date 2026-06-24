import Groq from "groq-sdk";
import type {
  AIProvider,
  GeneratedQuestion,
  ReviewResult,
  QuestionOption,
} from "./types";

const GROQ_MODEL = "llama-3.3-70b-versatile";

function parseGeneratedQuestions(raw: string): GeneratedQuestion[] {
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new SyntaxError("Response is not a JSON array");
  }
  return data.map((item: Record<string, unknown>, i: number) => {
    if (typeof item.question !== "string") {
      throw new SyntaxError(`Item[${i}]: 'question' must be a string`);
    }
    if (!Array.isArray(item.options)) {
      throw new SyntaxError(`Item[${i}]: 'options' must be an array`);
    }
    if (typeof item.answerKey !== "string") {
      throw new SyntaxError(`Item[${i}]: 'answerKey' must be a string`);
    }
    if (typeof item.explanation !== "string") {
      throw new SyntaxError(`Item[${i}]: 'explanation' must be a string`);
    }
    if (!["easy", "medium", "hard"].includes(item.difficulty as string)) {
      throw new SyntaxError(
        `Item[${i}]: 'difficulty' must be one of easy, medium, hard`
      );
    }
    if (!Array.isArray(item.tags)) {
      throw new SyntaxError(`Item[${i}]: 'tags' must be an array`);
    }

    return {
      question: item.question,
      options: item.options as QuestionOption[],
      answerKey: item.answerKey,
      explanation: item.explanation,
      difficulty: item.difficulty as "easy" | "medium" | "hard",
      tags: item.tags as string[],
    };
  });
}

function parseReviewResult(raw: string): ReviewResult {
  const data = JSON.parse(raw);
  if (typeof data.valid !== "boolean") {
    throw new SyntaxError("Response missing 'valid' boolean field");
  }
  if (!Array.isArray(data.issues)) {
    throw new SyntaxError("Response missing 'issues' array");
  }
  const issues: string[] = Array.isArray(data.issues)
    ? data.issues.map((i: unknown) => (typeof i === "string" ? i : String(i)))
    : [];
  return {
    valid: data.valid,
    issues,
    confidence: data.confidence ?? 0,
  };
}

export function createGroqProvider(): AIProvider {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY environment variable is required for GroqProvider"
    );
  }

  const groq = new Groq({ apiKey });

  const jsonSystemInstruction = `Kamu adalah asisten yang hanya merespons dalam format JSON valid.
Jangan pernah menyertakan teks penjelasan, markdown, atau apapun di luar JSON.
Output harus bisa di-parse langsung oleh JSON.parse().`;

  async function generateQuestions(
    prompt: string,
    _schema: object,
    count: number,
    images?: { data: string; mimeType: string }[],
    _options?: {
      systemPrompt?: string;
      referenceContext?: string | null;
      customPrompt?: string;
    }
  ): Promise<GeneratedQuestion[]> {
    const userContent = `Buatkan ${count} soal dalam format JSON array. Setiap item memiliki field: question (string), options (array of {key, value} — selalu 5 opsi A/B/C/D/E), answerKey (string), explanation (string), difficulty ("easy"|"medium"|"hard"), tags (string[]).\n\n${prompt}`;

    const messages: any[] = [
      { role: "system", content: jsonSystemInstruction }
    ];

    if (images && images.length > 0) {
      const contentParts: any[] = [{ type: "text", text: userContent }];
      for (const img of images) {
        contentParts.push({
          type: "image_url",
          image_url: {
            url: `data:${img.mimeType};base64,${img.data}`
          }
        });
      }
      messages.push({ role: "user", content: contentParts });
    } else {
      messages.push({ role: "user", content: userContent });
    }

    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages,
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) {
      throw new Error("Empty response from Groq API");
    }

    return parseGeneratedQuestions(text);
  }

  async function reviewQuestion(
    question: GeneratedQuestion,
    criteria: string
  ): Promise<ReviewResult> {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: jsonSystemInstruction },
        {
          role: "user",
          content: `Review soal berikut dan berikan hasil dalam format JSON dengan field: valid (boolean), issues (array of string), confidence (number 0-1).\n\nSoal:\n${JSON.stringify(question, null, 2)}\n\nKriteria review:\n${criteria}`,
        },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) {
      throw new Error("Empty response from Groq API");
    }

    return parseReviewResult(text);
  }

  return { generateQuestions, reviewQuestion };
}
