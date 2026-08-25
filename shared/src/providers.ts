/**
 * Provider configurations for various LLM inference providers
 * Shared between client and server
 */

/**
 * Provider suggestion type for the UI
 */
export type ProviderSuggestion = {
  id: string;
  name: string;
  baseUrl: string;
  models: string[];
};

/**
 * Get provider suggestions for the settings UI
 * This is a static list that can be used by both client and server
 */
export function getProviderSuggestions(): ProviderSuggestion[] {
  return [
    { id: "openai", name: "OpenAI", baseUrl: "https://api.openai.com/v1", models: ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"] },
    { id: "mistral", name: "Mistral AI", baseUrl: "https://api.mistral.ai/v1", models: ["mistral-tiny", "mistral-small", "mistral-medium", "mistral-large"] },
    { id: "anthropic", name: "Anthropic", baseUrl: "https://api.anthropic.com/v1", models: ["claude-3-5-sonnet", "claude-3-haiku", "claude-3-opus"] },
    { id: "groq", name: "Groq", baseUrl: "https://api.groq.com/v1", models: ["llama-3.1-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b"] },
    { id: "cohere", name: "Cohere", baseUrl: "https://api.cohere.ai/v1", models: ["command-r-plus", "command-r"] },
    { id: "google", name: "Google", baseUrl: "https://generativelanguage.googleapis.com/v1beta", models: ["gemini-1.5-flash", "gemini-1.5-pro"] },
    { id: "perplexity", name: "Perplexity", baseUrl: "https://api.perplexity.ai", models: ["llama-3.1-sonar-large", "llama-3.1-sonar-small", "mixtral-8x7b"] },
    { id: "fireworks", name: "Fireworks AI", baseUrl: "https://api.fireworks.ai/v1", models: ["llama-v3p1-70b", "llama-v3p1-8b", "mixtral-8x7b"] },
    { id: "together", name: "Together AI", baseUrl: "https://api.together.xyz/v1", models: ["llama-3.1-70b", "llama-3.1-8b", "mixtral-8x7b"] },
    { id: "local", name: "Local Inference Server", baseUrl: "http://localhost:11434/v1", models: ["llama3.1", "mistral", "phi3"] },
  ];
}

/**
 * Detect provider ID from base URL
 */
export function detectProviderId(baseUrl: string): string | null {
  const normalizedUrl = baseUrl.replace(/\/$/, "").toLowerCase();
  
  const providers = getProviderSuggestions();
  
  for (const provider of providers) {
    const providerUrl = provider.baseUrl.replace(/\/$/, "").toLowerCase();
    if (normalizedUrl.includes(providerUrl.replace(/^https?:\/\//, ""))) {
      return provider.id;
    }
  }
  
  return null;
}
