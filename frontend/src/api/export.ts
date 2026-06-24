import { authHeaders } from "./authFetch";

const BASE = "/api/export";

export interface ColumnMapping {
  excelColumn: string;
  label: string;
  sourceField: string;
}

export interface ExportTemplate {
  id: string;
  name: string;
  columnMapping: ColumnMapping[];
  createdAt: string;
}

export async function fetchTemplates(): Promise<ExportTemplate[]> {
  const res = await fetch(`${BASE}/templates`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Gagal mengambil template");
  return res.json();
}

export async function createTemplate(
  name: string,
  columnMapping: ColumnMapping[]
): Promise<ExportTemplate> {
  const res = await fetch(`${BASE}/templates`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ name, columnMapping }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Gagal membuat template");
  }
  return res.json();
}

export async function updateTemplate(
  id: string,
  data: { name?: string; columnMapping?: ColumnMapping[] }
): Promise<ExportTemplate> {
  const res = await fetch(`${BASE}/templates/${id}`, {
    method: "PUT",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Gagal mengupdate template");
  }
  return res.json();
}

export async function deleteTemplate(id: string): Promise<void> {
  const res = await fetch(`${BASE}/templates/${id}`, { method: "DELETE", headers: authHeaders() });
  if (!res.ok) throw new Error("Gagal menghapus template");
}

export async function fetchExportedIds(): Promise<string[]> {
  const res = await fetch(`${BASE}/exported-ids`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Gagal mengambil data export");
  const data = await res.json();
  return data.exportedIds as string[];
}

export async function startExport(
  templateId: string,
  questionIds: string[]
): Promise<{ logId: string; status: string }> {
  const res = await fetch(`${BASE}/`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ templateId, questionIds }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Gagal memulai export");
  }
  return res.json();
}

export async function getExportStatus(logId: string): Promise<{
  status: string;
  downloadUrl?: string;
  error?: string;
}> {
  const res = await fetch(`${BASE}/${logId}/status`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Gagal mengecek status export");
  return res.json();
}
