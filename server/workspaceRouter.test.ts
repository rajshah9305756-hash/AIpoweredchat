import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const aiMocks = vi.hoisted(() => ({
  extractCodeArtifacts: vi.fn(() => []),
  hasTemporaryApiKey: vi.fn(() => true),
  requestCustomCompletion: vi.fn(),
  storeTemporaryApiKey: vi.fn(),
  testCustomBackend: vi.fn(),
}));

vi.mock("./aiBackend", () => aiMocks);

import { appRouter } from "./routers";

const preferences = { model: "provider-model", baseUrl: "https://api.example.com/v1", systemPrompt: "Be helpful.", temperature: 0.4, maxTokens: 2048 };
const workspaceId = "7a931984-7dca-4b12-987a-90bfb7a86ccd";
const anonymousContext: TrpcContext = { user: null, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"] };

describe("public workspace router", () => {
  beforeEach(() => { vi.clearAllMocks(); aiMocks.hasTemporaryApiKey.mockReturnValue(true); });

  it("allows a visitor to use the workspace without a user session", async () => {
    aiMocks.requestCustomCompletion.mockResolvedValue("Hello from the configured model.");
    const result = await appRouter.createCaller(anonymousContext).workspace.chat({ messages: [{ role: "user", content: "Say hello" }], preferences, workspaceId });
    expect(aiMocks.requestCustomCompletion).toHaveBeenCalledWith(preferences, workspaceId, [{ role: "user", content: "Say hello" }]);
    expect(result).toEqual({ content: "Hello from the configured model.", artifacts: [] });
    expect(JSON.stringify(result)).not.toContain("apiKey");
  });

  it("does not accept private or non-HTTPS backend endpoints", async () => {
    const caller = appRouter.createCaller(anonymousContext);
    await expect(caller.workspace.settings.test({ ...preferences, baseUrl: "http://127.0.0.1/v1", workspaceId })).rejects.toThrow("Only HTTPS");
    expect(aiMocks.testCustomBackend).not.toHaveBeenCalled();
  });

  it("accepts a key only through the transient server-session endpoint", async () => {
    const result = await appRouter.createCaller(anonymousContext).workspace.settings.sessionApiKey({ workspaceId, apiKey: "top-secret-value" });
    expect(aiMocks.storeTemporaryApiKey).toHaveBeenCalledWith(workspaceId, "top-secret-value");
    expect(result).toEqual({ configured: true });
    expect(JSON.stringify(result)).not.toContain("top-secret-value");
  });
});
