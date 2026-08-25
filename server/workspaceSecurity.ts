export type SafeBackendPreferences = {
  model: string;
  baseUrl: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
};

export const DEFAULT_BACKEND_PREFERENCES: SafeBackendPreferences = {
  model: "gpt-4o-mini",
  baseUrl: "https://api.openai.com/v1",
  systemPrompt: "You are a precise senior software engineer. Explain decisions clearly and provide complete, runnable code when asked.",
  temperature: 0.7,
  maxTokens: 4096,
};

export function canAccessUserRecord(record: { userId: number } | undefined, userId: number) {
  return Boolean(record && record.userId === userId);
}

export function normalizeBaseUrl(value: string) {
  const candidate = value.trim().replace(/\/$/, "");
  let url: URL;

  try {
    url = new URL(candidate);
  } catch {
    throw new Error("Enter a complete HTTPS URL, such as https://api.example.com/v1.");
  }

  if (url.protocol !== "https:") {
    throw new Error("Only HTTPS AI backend URLs are permitted.");
  }

  const hostname = url.hostname.toLowerCase();
  const isPrivateIpv4 = /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(hostname)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
  const isPrivateHost = hostname === "localhost" || hostname === "localhost.localdomain" || hostname === "::1";

  if (isPrivateIpv4 || isPrivateHost || hostname.endsWith(".local")) {
    throw new Error("Private network AI backend URLs are not permitted.");
  }

  return url.toString().replace(/\/$/, "");
}

export function sanitizeBackendPreferences(input: SafeBackendPreferences): SafeBackendPreferences {
  return {
    model: input.model.trim(),
    baseUrl: normalizeBaseUrl(input.baseUrl),
    systemPrompt: input.systemPrompt.trim(),
    temperature: Math.min(2, Math.max(0, Number(input.temperature))),
    maxTokens: Math.min(32000, Math.max(256, Math.round(Number(input.maxTokens)))),
  };
}
