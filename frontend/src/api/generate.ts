import { authHeaders, apiUrl } from "./authFetch";

export interface GeneratedQuestion {
  id: string;
  skillId: string;
  jobId: string | null;
  content: Record<string, unknown>;
  questionText: string;
  difficulty: string;
  tags: string[];
  status: string;
  generatedByModel: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GenerationJob {
  id: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  requestedCount: number;
  completedCount: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  questions?: GeneratedQuestion[];
}

export async function startGeneration(
  skillId: string,
  count: number,
  prompt?: string,
  images?: { data: string; mimeType: string }[]
): Promise<{ jobId: string }> {
  const res = await fetch(apiUrl("/api/generate"), {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ skillId, count, prompt, images }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Gagal memulai generate");
  }
  return res.json();
}

export async function getJobStatus(jobId: string): Promise<GenerationJob> {
  const res = await fetch(apiUrl(`/api/generate/${jobId}/status`), { headers: authHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Gagal mengambil status job");
  }
  return res.json();
}
