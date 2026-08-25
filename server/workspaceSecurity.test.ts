import { describe, expect, it } from "vitest";
import { canAccessUserRecord, normalizeBaseUrl, sanitizeBackendPreferences } from "./workspaceSecurity";

describe("workspace security boundaries", () => {
  it("keeps user-scoped records inaccessible to another user", () => {
    expect(canAccessUserRecord({ userId: 14 }, 14)).toBe(true);
    expect(canAccessUserRecord({ userId: 14 }, 88)).toBe(false);
    expect(canAccessUserRecord(undefined, 14)).toBe(false);
  });

  it("rejects private and non-HTTPS backend targets", () => {
    expect(() => normalizeBaseUrl("http://api.example.com/v1")).toThrow("Only HTTPS");
    expect(() => normalizeBaseUrl("https://127.0.0.1/v1")).toThrow("Private network");
    expect(() => normalizeBaseUrl("https://192.168.1.8/v1")).toThrow("Private network");
  });

  it("normalizes only non-secret backend preferences", () => {
    expect(sanitizeBackendPreferences({
      model: "  demo-model ",
      baseUrl: "https://api.example.com/v1/",
      systemPrompt: "  Be concise. ",
      temperature: 4,
      maxTokens: 99999,
    })).toEqual({
      model: "demo-model",
      baseUrl: "https://api.example.com/v1",
      systemPrompt: "Be concise.",
      temperature: 2,
      maxTokens: 32000,
    });
  });
});
