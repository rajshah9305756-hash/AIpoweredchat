/**
 * Provider configurations for various LLM inference providers
 * This module handles provider-specific API requirements and request formatting
 */

import axios, { AxiosRequestConfig, AxiosResponse } from "axios";

export type ProviderConfig = {
  id: string;
  name: string;
  baseUrlPattern: RegExp;
  chatEndpoint: string;
  completionEndpoint?: string;
  authHeader: (apiKey: string) => Record<string, string>;
  requestBody: (params: {
    model: string;
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
    temperature: number;
    maxTokens: number;
    stream?: boolean;
  }) => Record<string, unknown>;
  responseContentExtractor: (response: AxiosResponse) => string;
  testPrompt?: string;
  testResponseValidator?: (response: string) => boolean;
  models?: string[];
  requiresApiKey: boolean;
};

// Common response extractors
export const openAIResponseExtractor = (response: AxiosResponse): string => {
  const content = response.data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("Invalid response format: expected string content from AI backend");
  }
  return content;
};

export const anthropicResponseExtractor = (response: AxiosResponse): string => {
  const content = response.data?.content?.[0]?.text;
  if (typeof content !== "string") {
    throw new Error("Invalid Anthropic response format");
  }
  return content;
};

export const cohereResponseExtractor = (response: AxiosResponse): string => {
  const content = response.data?.generations?.[0]?.text;
  if (typeof content !== "string") {
    throw new Error("Invalid Cohere response format");
  }
  return content;
};

export const mistralResponseExtractor = (response: AxiosResponse): string => {
  const content = response.data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("Invalid Mistral response format");
  }
  return content;
};

export const googleResponseExtractor = (response: AxiosResponse): string => {
  const content = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof content !== "string") {
    throw new Error("Invalid Google Vertex AI response format");
  }
  return content;
};

// Provider configurations
const PROVIDERS: ProviderConfig[] = [
  // OpenAI and compatible providers (Mistral, DeepSeek, etc.)
  {
    id: "openai",
    name: "OpenAI",
    baseUrlPattern: /api\.openai\.com/,
    chatEndpoint: "/chat/completions",
    authHeader: (apiKey) => ({ Authorization: `Bearer ${apiKey}` }),
    requestBody: ({ model, messages, temperature, maxTokens }) => ({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
    responseContentExtractor: openAIResponseExtractor,
    testPrompt: "Reply with the exact text CONNECTION_OK.",
    testResponseValidator: (response) => response.includes("CONNECTION_OK"),
    requiresApiKey: true,
  },
  
  // Mistral AI (OpenAI-compatible)
  {
    id: "mistral",
    name: "Mistral AI",
    baseUrlPattern: /api\.mistral\.ai/,
    chatEndpoint: "/v1/chat/completions",
    authHeader: (apiKey) => ({ Authorization: `Bearer ${apiKey}` }),
    requestBody: ({ model, messages, temperature, maxTokens }) => ({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
    responseContentExtractor: mistralResponseExtractor,
    testPrompt: "Reply with the exact text CONNECTION_OK.",
    testResponseValidator: (response) => response.includes("CONNECTION_OK"),
    requiresApiKey: true,
  },
  
  // Anthropic Claude
  {
    id: "anthropic",
    name: "Anthropic Claude",
    baseUrlPattern: /api\.anthropic\.com/,
    chatEndpoint: "/v1/messages",
    authHeader: (apiKey) => ({ "x-api-key": apiKey }),
    requestBody: ({ model, messages, temperature, maxTokens }) => {
      // Convert OpenAI messages format to Anthropic format
      const systemMessage = messages.find(m => m.role === "system")?.content || "";
      const userMessages = messages.filter(m => m.role !== "system");
      
      return {
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemMessage || undefined,
        messages: userMessages.map(m => ({
          role: m.role,
          content: m.content,
        })),
      };
    },
    responseContentExtractor: anthropicResponseExtractor,
    testPrompt: "Reply with the exact text CONNECTION_OK.",
    testResponseValidator: (response) => response.includes("CONNECTION_OK"),
    requiresApiKey: true,
  },
  
  // Cohere
  {
    id: "cohere",
    name: "Cohere",
    baseUrlPattern: /api\.cohere\.(ai|com)/,
    chatEndpoint: "/v1/chat",
    authHeader: (apiKey) => ({ Authorization: `Bearer ${apiKey}` }),
    requestBody: ({ model, messages, temperature, maxTokens }) => {
      const systemMessage = messages.find(m => m.role === "system")?.content || "";
      const userMessages = messages.filter(m => m.role !== "system");
      
      return {
        model,
        max_tokens: maxTokens,
        temperature,
        preamble: systemMessage || undefined,
        messages: userMessages.map(m => ({
          role: m.role === "assistant" ? "CHATBOT" : "USER",
          message: m.content,
        })),
      };
    },
    responseContentExtractor: cohereResponseExtractor,
    testPrompt: "Reply with the exact text CONNECTION_OK.",
    testResponseValidator: (response) => response.includes("CONNECTION_OK"),
    requiresApiKey: true,
  },
  
  // Google Vertex AI / Gemini
  {
    id: "google",
    name: "Google Vertex AI / Gemini",
    baseUrlPattern: /generativelanguage\.googleapis\.com|aiplatform\.googleapis\.com/,
    chatEndpoint: "/v1beta/models/{model}:generateContent",
    authHeader: (apiKey) => ({ Authorization: `Bearer ${apiKey}` }),
    requestBody: ({ model, messages, temperature, maxTokens }) => {
      const systemMessage = messages.find(m => m.role === "system")?.content || "";
      const userMessages = messages.filter(m => m.role !== "system");
      
      // Google expects: contents[].parts[].text
      const contents = userMessages.map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
      
      // Add system instruction as first user message if it exists
      if (systemMessage) {
        contents.unshift({
          role: "user",
          parts: [{ text: systemMessage }],
        });
      }
      
      return {
        contents,
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
      };
    },
    responseContentExtractor: googleResponseExtractor,
    testPrompt: "Reply with the exact text CONNECTION_OK.",
    testResponseValidator: (response) => response.includes("CONNECTION_OK"),
    requiresApiKey: true,
  },
  
  // Local inference servers (Ollama, LM Studio, etc.) - OpenAI compatible
  {
    id: "local",
    name: "Local Inference Server",
    baseUrlPattern: /localhost|127\.0\.0\.1|\.local|ollama|lmstudio|text-generation-webui/,
    chatEndpoint: "/v1/chat/completions",
    authHeader: (apiKey) => ({ Authorization: `Bearer ${apiKey}` }),
    requestBody: ({ model, messages, temperature, maxTokens }) => ({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
    responseContentExtractor: openAIResponseExtractor,
    testPrompt: "Reply with the exact text CONNECTION_OK.",
    testResponseValidator: (response) => response.includes("CONNECTION_OK"),
    requiresApiKey: false, // Local servers may not require API keys
  },
  
  // Groq
  {
    id: "groq",
    name: "Groq",
    baseUrlPattern: /api\.groq\.com/,
    chatEndpoint: "/v1/chat/completions",
    authHeader: (apiKey) => ({ Authorization: `Bearer ${apiKey}` }),
    requestBody: ({ model, messages, temperature, maxTokens }) => ({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
    responseContentExtractor: openAIResponseExtractor,
    testPrompt: "Reply with the exact text CONNECTION_OK.",
    testResponseValidator: (response) => response.includes("CONNECTION_OK"),
    requiresApiKey: true,
  },
  
  // Perplexity
  {
    id: "perplexity",
    name: "Perplexity",
    baseUrlPattern: /api\.perplexity\.ai/,
    chatEndpoint: "/chat/completions",
    authHeader: (apiKey) => ({ Authorization: `Bearer ${apiKey}` }),
    requestBody: ({ model, messages, temperature, maxTokens }) => ({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
    responseContentExtractor: openAIResponseExtractor,
    testPrompt: "Reply with the exact text CONNECTION_OK.",
    testResponseValidator: (response) => response.includes("CONNECTION_OK"),
    requiresApiKey: true,
  },
  
  // Fireworks AI
  {
    id: "fireworks",
    name: "Fireworks AI",
    baseUrlPattern: /api\.fireworks\.ai/,
    chatEndpoint: "/v1/chat/completions",
    authHeader: (apiKey) => ({ Authorization: `Bearer ${apiKey}` }),
    requestBody: ({ model, messages, temperature, maxTokens }) => ({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
    responseContentExtractor: openAIResponseExtractor,
    testPrompt: "Reply with the exact text CONNECTION_OK.",
    testResponseValidator: (response) => response.includes("CONNECTION_OK"),
    requiresApiKey: true,
  },
  
  // Together AI
  {
    id: "together",
    name: "Together AI",
    baseUrlPattern: /api\.together\.xyz/,
    chatEndpoint: "/v1/chat/completions",
    authHeader: (apiKey) => ({ Authorization: `Bearer ${apiKey}` }),
    requestBody: ({ model, messages, temperature, maxTokens }) => ({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
    responseContentExtractor: openAIResponseExtractor,
    testPrompt: "Reply with the exact text CONNECTION_OK.",
    testResponseValidator: (response) => response.includes("CONNECTION_OK"),
    requiresApiKey: true,
  },
];

/**
 * Detect the provider based on the base URL
 */
export function detectProvider(baseUrl: string): ProviderConfig {
  const normalizedUrl = baseUrl.replace(/\/$/, "").toLowerCase();
  
  for (const provider of PROVIDERS) {
    if (provider.baseUrlPattern.test(normalizedUrl)) {
      return provider;
    }
  }
  
  // Default to OpenAI-compatible if no specific provider matched
  return {
    id: "openai-compatible",
    name: "OpenAI Compatible",
    baseUrlPattern: /.*/,
    chatEndpoint: "/chat/completions",
    authHeader: (apiKey) => ({ Authorization: `Bearer ${apiKey}` }),
    requestBody: ({ model, messages, temperature, maxTokens }) => ({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
    responseContentExtractor: openAIResponseExtractor,
    testPrompt: "Reply with the exact text CONNECTION_OK.",
    testResponseValidator: (response) => response.includes("CONNECTION_OK"),
    requiresApiKey: true,
  };
}

/**
 * Get all supported provider configurations
 */
export function getAllProviders(): ProviderConfig[] {
  return [...PROVIDERS];
}

/**
 * Get provider by ID
 */
export function getProviderById(id: string): ProviderConfig | undefined {
  return PROVIDERS.find(p => p.id === id);
}

/**
 * Get the chat endpoint URL for a provider
 */
export function getChatEndpoint(baseUrl: string, model: string, provider?: ProviderConfig): string {
  const detectedProvider = provider || detectProvider(baseUrl);
  
  // For Google Vertex AI, the model is part of the URL
  if (detectedProvider.id === "google") {
    return `${baseUrl.replace(/\/$/, "")}${detectedProvider.chatEndpoint.replace("{model}", model)}`;
  }
  
  return `${baseUrl.replace(/\/$/, "")}${detectedProvider.chatEndpoint}`;
}

/**
 * Build request configuration for a specific provider
 */
export function buildProviderRequest(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  temperature: number,
  maxTokens: number
): { url: string; config: AxiosRequestConfig } {
  const provider = detectProvider(baseUrl);
  const endpoint = getChatEndpoint(baseUrl, model, provider);
  
  const requestBody = provider.requestBody({
    model,
    messages,
    temperature,
    maxTokens,
    stream: false,
  });
  
  return {
    url: endpoint,
    config: {
      headers: {
        "Content-Type": "application/json",
        ...provider.authHeader(apiKey),
      },
      timeout: 30000,
    },
    data: requestBody,
  };
}

/**
 * Extract content from provider-specific response
 */
export function extractProviderResponse(provider: ProviderConfig, response: AxiosResponse): string {
  return provider.responseContentExtractor(response);
}

/**
 * Get the test prompt for a provider
 */
export function getTestPrompt(provider: ProviderConfig): string {
  return provider.testPrompt || "Reply with the exact text CONNECTION_OK.";
}

/**
 * Validate test response for a provider
 */
export function validateTestResponse(provider: ProviderConfig, response: string): boolean {
  if (provider.testResponseValidator) {
    return provider.testResponseValidator(response);
  }
  return response.includes("CONNECTION_OK");
}
