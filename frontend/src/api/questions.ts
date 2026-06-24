import { authHeaders, apiUrl } from "./authFetch";

const BASE = apiUrl("/api/questions");

export interface SkillInfo {
  id: string;
  name: string;
  subject: string;
  gradeLevel: string;
}

export interface AiReviewLog {
  id: string;
  valid: boolean;
  issues: string[];
  confidence: number;
  modelUsed: string | null;
  createdAt: string;
}

export interface DuplicateScanLog {
  id: string;
  similarQuestionId: string;
  similarityScore: number;
  createdAt: string;
}

export interface Question {
  id: string;
  skillId: string;
  content: Record<string, unknown>;
  questionText: string;
  difficulty: string;
  tags: string[];
  status: string;
  generatedByModel: string | null;
  createdAt: string;
  updatedAt: string;
  skill?: SkillInfo;
  aiReviewLogs?: AiReviewLog[];
  duplicateScanLogs?: DuplicateScanLog[];
}

export interface ListQuestionsResponse {
  questions: Question[];
  total: number;
}

export interface DuplicateMatch {
  id: string;
  questionText: string;
  content: unknown;
  status: string;
  difficulty: string;
  similarityScore: number;
  scannedAt: string;
}

export interface DuplicatesResponse {
  question: { id: string; questionText: string; status: string };
  duplicates: DuplicateMatch[];
}

export async function fetchPublishedQuestions(params?: {
  subject?: string;
  difficulty?: string;
  topic?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<ListQuestionsResponse> {
  const qs = new URLSearchParams();
  if (params?.subject) qs.set("subject", params.subject);
  if (params?.difficulty) qs.set("difficulty", params.difficulty);
  if (params?.topic) qs.set("topic", params.topic);
  if (params?.startDate) qs.set("startDate", params.startDate);
  if (params?.endDate) qs.set("endDate", params.endDate);
  if (params?.search) qs.set("search", params.search);
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));

  const res = await fetch(`${BASE}/published?${qs.toString()}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Gagal mengambil data soal");
  return res.json();
}

export async function fetchQuestions(params?: {
  skillId?: string;
  status?: string;
  subject?: string;
  difficulty?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}): Promise<ListQuestionsResponse> {
  const qs = new URLSearchParams();
  if (params?.skillId) qs.set("skillId", params.skillId);
  if (params?.status) qs.set("status", params.status);
  if (params?.subject) qs.set("subject", params.subject);
  if (params?.difficulty) qs.set("difficulty", params.difficulty);
  if (params?.startDate) qs.set("startDate", params.startDate);
  if (params?.endDate) qs.set("endDate", params.endDate);
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));

  const res = await fetch(`${BASE}?${qs.toString()}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Gagal mengambil data soal");
  return res.json();
}

export async function fetchQuestionAiReview(questionId: string): Promise<{
  id: string;
  status: string;
  content: Record<string, unknown>;
  questionText: string;
  difficulty: string;
  createdAt: string;
  aiReviewLogs: AiReviewLog[];
}> {
  const res = await fetch(`${BASE}/${questionId}/ai-review`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Gagal mengambil review");
  return res.json();
}

export async function fetchQuestionDuplicates(questionId: string): Promise<DuplicatesResponse> {
  const res = await fetch(`${BASE}/${questionId}/duplicates`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Gagal mengambil data duplikat");
  return res.json();
}

export async function reviewQuestion(
  questionId: string,
  decision: "APPROVE" | "REJECT" | "EDIT_APPROVE",
  reason?: string,
  editedContent?: {
    questionText?: string;
    content?: Record<string, unknown>;
    difficulty?: string;
    tags?: string[];
  }
): Promise<void> {
  const res = await fetch(`${BASE}/${questionId}/review`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ decision, reason, editedContent }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Gagal menyimpan review");
  }
}

export async function reviewQuestionsBatch(
  ids: string[],
  decision: "APPROVE" | "REJECT",
  reason?: string
): Promise<{ success: boolean; count: number }> {
  const res = await fetch(`${BASE}/batch-review`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ ids, decision, reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Gagal menyimpan review batch");
  }
  return res.json();
}

export async function deleteQuestion(questionId: string): Promise<void> {
  const res = await fetch(`${BASE}/${questionId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Gagal menghapus soal");
  }
}

export async function deleteQuestionsBatch(
  ids: string[]
): Promise<{ success: boolean; count: number }> {
  const res = await fetch(`${BASE}/batch-delete`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Gagal menghapus soal");
  }
  return res.json();
}

export async function fetchUnpublishedQuestions(params?: {
  subject?: string;
  difficulty?: string;
  topic?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<ListQuestionsResponse> {
  const qs = new URLSearchParams();
  if (params?.subject) qs.set("subject", params.subject);
  if (params?.difficulty) qs.set("difficulty", params.difficulty);
  if (params?.topic) qs.set("topic", params.topic);
  if (params?.startDate) qs.set("startDate", params.startDate);
  if (params?.endDate) qs.set("endDate", params.endDate);
  if (params?.search) qs.set("search", params.search);
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));

  const res = await fetch(`${BASE}/unpublished?${qs.toString()}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Gagal mengambil data soal");
  return res.json();
}

export async function publishQuestionsBatch(
  ids: string[]
): Promise<{ success: boolean; count: number }> {
  const res = await fetch(`${BASE}/batch-publish`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Gagal mempublish soal");
  }
  return res.json();
}
