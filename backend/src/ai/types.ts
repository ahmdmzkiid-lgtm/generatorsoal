export interface QuestionOption {
  key: string;
  value: string;
}

export interface GeneratedQuestion {
  question: string;
  options: QuestionOption[];
  answerKey: string;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
}

export interface ReviewResult {
  valid: boolean;
  issues: string[];
  confidence: number;
}

export interface AIProvider {
  generateQuestions(
    prompt: string,
    schema: object,
    count: number,
    images?: { data: string; mimeType: string }[],
    options?: {
      systemPrompt?: string;
      referenceContext?: string | null;
      customPrompt?: string;
    }
  ): Promise<GeneratedQuestion[]>;

  reviewQuestion(
    question: GeneratedQuestion,
    criteria: string
  ): Promise<ReviewResult>;
}
