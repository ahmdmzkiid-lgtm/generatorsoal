import { API_BASE } from "./config";

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
