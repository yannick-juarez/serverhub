import Cookies from "js-cookie";
import { apiUrl } from "../config/api";

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = Cookies.get("token");

  const response = await fetch(apiUrl(path), {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  let payload: unknown;
  const text = await response.text();

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { success: false, error: text };
    }
  } else {
    payload = { success: true };
  }

  const dataEnvelope = payload as { success?: boolean; data?: T; error?: string; message?: string };

  const isUnauthorized = response.status === 401;
  const authErrorText = `${dataEnvelope.error ?? ""} ${dataEnvelope.message ?? ""}`.toLowerCase();
  const isAuthError = authErrorText.includes("invalid or expired token") || authErrorText.includes("authorization");

  if (isUnauthorized || isAuthError) {
    Cookies.remove("token");
    Cookies.remove("user");

    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.assign("/login");
    }
  }

  if (!response.ok || dataEnvelope.success === false) {
    throw new Error(dataEnvelope.error || dataEnvelope.message || `HTTP ${response.status}`);
  }

  // Support both response shapes:
  // 1) { success: true, data: ... }
  // 2) direct JSON payload without envelope
  if (Object.prototype.hasOwnProperty.call(dataEnvelope, "data")) {
    return (dataEnvelope.data as T) ?? ({} as T);
  }

  if (Object.prototype.hasOwnProperty.call(dataEnvelope, "success")) {
    return {} as T;
  }

  return payload as T;
}
