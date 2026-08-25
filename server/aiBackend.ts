import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { normalizeBaseUrl, type SafeBackendPreferences } from "./workspaceSecurity";
import { detectProvider, getChatEndpoint, extractProviderResponse, getTestPrompt, validateTestResponse, ProviderConfig } from "./providers";
import { getProviderSuggestions as sharedGetProviderSuggestions, type ProviderSuggestion } from "@shared/providers";

type ProviderMessage = { role: "system" | "user" | "assistant"; content: string };

export type CodeArtifact = {
  path: string;
  language: string;
  content: string;
};

const temporaryKeys = new Map<string, { value: string; updatedAt: number }>();
const KEY_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

// Cache provider detection to avoid repeated regex matching
export const providerCache = new Map<string, ProviderConfig>();

export function storeTemporaryApiKey(workspaceId: string, apiKey: string) {
  const value = apiKey.trim();
  if (!value) throw new Error("Enter an API key before continuing.");
  temporaryKeys.set(workspaceId, { value, updatedAt: Date.now() });
}

export function hasTemporaryApiKey(workspaceId: string) {
  const entry = temporaryKeys.get(workspaceId);
  if (!entry) return false;
  if (Date.now() - entry.updatedAt > KEY_TTL_MS) {
    temporaryKeys.delete(workspaceId);
    return false;
  }
  return true;
}

function getTemporaryApiKey(workspaceId: string) {
  if (!hasTemporaryApiKey(workspaceId)) {
    throw new Error("Add an API key in Settings before sending a request. Keys are kept only in a temporary server session.");
  }
  return temporaryKeys.get(workspaceId)!.value;
}

/**
 * Get cached provider for a base URL or detect and cache it
 */
function getCachedProvider(baseUrl: string): ProviderConfig {
  if (providerCache.has(baseUrl)) {
    return providerCache.get(baseUrl)!;
  }
  const provider = detectProvider(baseUrl);
  providerCache.set(baseUrl, provider);
  return provider;
}

export async function requestCustomCompletion(
  preferences: SafeBackendPreferences,
  workspaceId: string,
  messages: ProviderMessage[]
) {
  const secret = getTemporaryApiKey(workspaceId);
  const provider = getCachedProvider(preferences.baseUrl);
  const endpoint = getChatEndpoint(preferences.baseUrl, preferences.model, provider);

  try {
    // Build request based on provider
    const requestBody = provider.requestBody({
      model: preferences.model,
      messages,
      temperature: preferences.temperature,
      maxTokens: preferences.maxTokens,
      stream: false,
    });

    const response = await axios.post(
      endpoint,
      requestBody,
      {
        headers: { 
          "Content-Type": "application/json",
          ...provider.authHeader(secret),
        },
        timeout: 30000,
      }
    );

    // Use provider-specific content extractor
    const content = extractProviderResponse(provider, response);
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("The AI backend returned no assistant message.");
    }
    return content;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 401 || status === 403) {
        throw new Error("The AI backend rejected the configured API key.");
      }
      if (status) {
        throw new Error(`The AI backend returned HTTP ${status}. Review the base URL, model, and provider settings.`);
      }
      if (error.code === "ECONNABORTED") {
        throw new Error("The AI backend did not respond in time. Please try again.");
      }
      throw new Error("Unable to reach the AI backend. Confirm that the base URL is publicly accessible.");
    }
    throw error;
  }
}

export async function testCustomBackend(preferences: SafeBackendPreferences, workspaceId: string) {
  const provider = getCachedProvider(preferences.baseUrl);
  const testPrompt = getTestPrompt(provider);
  
  try {
    const content = await requestCustomCompletion(preferences, workspaceId, [
      { role: "user", content: testPrompt }
    ]);
    
    // Validate the response
    if (!validateTestResponse(provider, content)) {
      throw new Error("The AI backend did not return the expected test response. Check your model and provider settings.");
    }
    
    return { preview: content.slice(0, 180) };
  } catch (error) {
    // Re-throw with more context
    if (error instanceof Error) {
      throw new Error(`Connection test failed: ${error.message}`);
    }
    throw error;
  }
}

const extensionByLanguage: Record<string, string> = { 
  html: "html", css: "css", javascript: "js", js: "js", 
  typescript: "ts", ts: "ts", tsx: "tsx", jsx: "jsx", 
  json: "json", markdown: "md", md: "md", python: "py", py: "py" 
};

export function extractCodeArtifacts(content: string): CodeArtifact[] {
  const artifacts: CodeArtifact[] = [];
  const fence = /```([a-zA-Z0-9+#.-]+)?(?:\s+([^\n`]+))?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = fence.exec(content))) {
    const language = (match[1] || "text").toLowerCase();
    const requestedPath = match[2]?.trim().split(/\s+/)[0];
    const path = requestedPath && /^[a-zA-Z0-9_./-]{1,120}$/.test(requestedPath) && !requestedPath.includes("..") 
      ? requestedPath 
      : `snippet-${artifacts.length + 1}.${extensionByLanguage[language] || "txt"}`;
    artifacts.push({ path, language, content: match[3].trim() });
  }
  return artifacts;
}

/**
 * Get supported providers for the settings UI
 */
export function getProviderSuggestions(): ProviderSuggestion[] {
  return sharedGetProviderSuggestions();
}
