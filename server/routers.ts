import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { extractCodeArtifacts, hasTemporaryApiKey, requestCustomCompletion, storeTemporaryApiKey, testCustomBackend } from "./aiBackend";
import { sanitizeBackendPreferences } from "./workspaceSecurity";

const backendInput = z.object({
  model: z.string().trim().min(1).max(120),
  baseUrl: z.string().trim().min(8).max(512),
  systemPrompt: z.string().trim().min(1).max(12000),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().int().min(256).max(32000),
});

const messageInput = z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(20000) });
const workspaceIdInput = z.string().uuid();

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  workspace: router({
    chat: publicProcedure.input(z.object({
      messages: z.array(messageInput).min(1).max(30),
      preferences: backendInput,
      workspaceId: workspaceIdInput,
    })).mutation(async ({ input }) => {
      const preferences = sanitizeBackendPreferences(input.preferences);
      const content = await requestCustomCompletion(preferences, input.workspaceId, input.messages);
      return { content, artifacts: extractCodeArtifacts(content) };
    }),
    settings: router({
      sessionApiKey: publicProcedure.input(z.object({ workspaceId: workspaceIdInput, apiKey: z.string().trim().min(1).max(512) })).mutation(({ input }) => {
        storeTemporaryApiKey(input.workspaceId, input.apiKey);
        return { configured: hasTemporaryApiKey(input.workspaceId) };
      }),
      test: publicProcedure.input(backendInput.extend({ workspaceId: workspaceIdInput })).mutation(async ({ input }) => {
        const preferences = sanitizeBackendPreferences(input);
        return testCustomBackend(preferences, input.workspaceId);
      }),
    }),
  }),
});

export type AppRouter = typeof appRouter;
