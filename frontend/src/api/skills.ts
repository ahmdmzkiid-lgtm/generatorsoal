import { authHeaders, apiUrl } from "./authFetch";

const BASE = apiUrl("/api/skills");

export interface Skill {
  id: string;
  name: string;
  version: string;
  subject: string;
  gradeLevel: string;
  topic: string;
  systemPrompt: string;
  questionFormat: Record<string, unknown>;
  referenceContext: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  _count?: { versions: number; questions: number };
}

export interface CreateSkillInput {
  name: string;
  subject: string;
  gradeLevel: string;
  topic: string;
  systemPrompt?: string;
  questionFormat?: Record<string, unknown>;
  referenceContext?: string;
  isActive?: boolean;
}

export type UpdateSkillInput = Partial<CreateSkillInput>;

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body.error || body.message || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export async function fetchSkills(): Promise<Skill[]> {
  const res = await fetch(BASE, { headers: authHeaders() });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function fetchSkill(id: string): Promise<Skill> {
  const res = await fetch(`${BASE}/${id}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function createSkill(data: CreateSkillInput): Promise<Skill> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Gagal membuat skill");
  }
  return res.json();
}

export async function updateSkill(id: string, data: UpdateSkillInput): Promise<Skill> {
  const res = await fetch(`${BASE}/${id}`, {
    method: "PUT",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Gagal mengupdate skill");
  }
  return res.json();
}

export async function deleteSkill(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: "DELETE", headers: authHeaders() });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function toggleSkill(id: string): Promise<Skill> {
  const res = await fetch(`${BASE}/${id}/toggle`, { method: "PATCH", headers: authHeaders() });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}
