import type { ProviderConfig, GroqRateLimits, CerebrasRateLimits } from '../types';

// ─────────────────────────────────────────────────────────────
// Provider and Model Configuration
// ─────────────────────────────────────────────────────────────
// 
// Rate limits from official documentation (Free Tier):
// - Groq: https://console.groq.com/docs/rate-limits
// - Cerebras: https://inference-docs.cerebras.ai/support/rate-limits#free
//
// Groq limits: RPM, RPD, TPM, TPD
// Cerebras limits: RPM, RPH, RPD, TPM, TPH, TPD
// ─────────────────────────────────────────────────────────────

export const providers: ProviderConfig[] = [
  {
    name: 'groq',
    apiKeyEnv: 'GROQ_API_KEY',
    models: [
      // ─────────────────────────────────────────────────────────
      // Llama Models
      // ─────────────────────────────────────────────────────────
      {
        id: 'llama-3.3-70b-versatile',
        name: 'Llama 3.3 70B Versatile',
        provider: 'groq',
        enabled: true,
        limits: {
          requestsPerMinute: 30,
          requestsPerDay: 1_000,
          tokensPerMinute: 12_000,
          tokensPerDay: 100_000,
        } as GroqRateLimits,
        defaults: {
          temperature: 0.7,
          maxTokens: 4096,
          topP: 1,
        },
      },
      {
        id: 'llama-3.1-8b-instant',
        name: 'Llama 3.1 8B Instant',
        provider: 'groq',
        enabled: true,
        limits: {
          requestsPerMinute: 30,
          requestsPerDay: 14_400,
          tokensPerMinute: 6_000,
          tokensPerDay: 500_000,
        } as GroqRateLimits,
        defaults: {
          temperature: 0.6,
          maxTokens: 8192,
          topP: 1,
        },
      },
      {
        id: 'meta-llama/llama-4-maverick-17b-128e-instruct',
        name: 'Llama 4 Maverick 17B',
        provider: 'groq',
        enabled: true,
        limits: {
          requestsPerMinute: 30,
          requestsPerDay: 1_000,
          tokensPerMinute: 6_000,
          tokensPerDay: 500_000,
        } as GroqRateLimits,
        defaults: {
          temperature: 0.7,
          maxTokens: 4096,
        },
      },
      {
        id: 'meta-llama/llama-4-scout-17b-16e-instruct',
        name: 'Llama 4 Scout 17B',
        provider: 'groq',
        enabled: true,
        limits: {
          requestsPerMinute: 30,
          requestsPerDay: 1_000,
          tokensPerMinute: 30_000,
          tokensPerDay: 500_000,
        } as GroqRateLimits,
        defaults: {
          temperature: 0.7,
          maxTokens: 4096,
        },
      },
      // ─────────────────────────────────────────────────────────
      // Moonshot Kimi Models
      // ─────────────────────────────────────────────────────────
      {
        id: 'moonshotai/kimi-k2-instruct',
        name: 'Moonshot Kimi K2',
        provider: 'groq',
        enabled: true,
        limits: {
          requestsPerMinute: 60,
          requestsPerDay: 1_000,
          tokensPerMinute: 10_000,
          tokensPerDay: 300_000,
        } as GroqRateLimits,
        defaults: {
          temperature: 0.6,
          maxTokens: 4096,
          topP: 1,
        },
      },
      // ─────────────────────────────────────────────────────────
      // OpenAI GPT-OSS Models
      // ─────────────────────────────────────────────────────────
      {
        id: 'openai/gpt-oss-120b',
        name: 'GPT OSS 120B',
        provider: 'groq',
        enabled: true,
        limits: {
          requestsPerMinute: 30,
          requestsPerDay: 1_000,
          tokensPerMinute: 8_000,
          tokensPerDay: 200_000,
        } as GroqRateLimits,
        defaults: {
          temperature: 0.7,
          maxTokens: 4096,
        },
      },
      {
        id: 'openai/gpt-oss-20b',
        name: 'GPT OSS 20B',
        provider: 'groq',
        enabled: true,
        limits: {
          requestsPerMinute: 30,
          requestsPerDay: 1_000,
          tokensPerMinute: 8_000,
          tokensPerDay: 200_000,
        } as GroqRateLimits,
        defaults: {
          temperature: 0.7,
          maxTokens: 4096,
        },
      },
      // ─────────────────────────────────────────────────────────
      // Qwen Models
      // ─────────────────────────────────────────────────────────
      {
        id: 'qwen/qwen3-32b',
        name: 'Qwen 3 32B',
        provider: 'groq',
        enabled: true,
        limits: {
          requestsPerMinute: 60,
          requestsPerDay: 1_000,
          tokensPerMinute: 6_000,
          tokensPerDay: 500_000,
        } as GroqRateLimits,
        defaults: {
          temperature: 0.7,
          maxTokens: 4096,
        },
      },
      // ─────────────────────────────────────────────────────────
      // Guard Models (for content moderation)
      // ─────────────────────────────────────────────────────────
      {
        id: 'meta-llama/llama-guard-4-12b',
        name: 'Llama Guard 4 12B',
        provider: 'groq',
        enabled: false, // Disabled - for moderation only
        limits: {
          requestsPerMinute: 30,
          requestsPerDay: 14_400,
          tokensPerMinute: 15_000,
          tokensPerDay: 500_000,
        } as GroqRateLimits,
      },
    ],
  },
  {
    name: 'cerebras',
    apiKeyEnv: 'CEREBRAS_API_KEY',
    models: [
      // ─────────────────────────────────────────────────────────
      // Standard Models (same limits for most)
      // TPM: 60K, TPH: 1M, TPD: 1M, RPM: 30, RPH: 900, RPD: 14.4K
      // ─────────────────────────────────────────────────────────
      {
        id: 'llama3.1-8b',
        name: 'Llama 3.1 8B',
        provider: 'cerebras',
        enabled: true,
        limits: {
          requestsPerMinute: 30,
          requestsPerHour: 900,
          requestsPerDay: 14_400,
          tokensPerMinute: 60_000,
          tokensPerHour: 1_000_000,
          tokensPerDay: 1_000_000,
        } as CerebrasRateLimits,
        defaults: {
          temperature: 0.7,
          maxTokens: 8192,
          topP: 0.95,
        },
      },
      {
        id: 'llama-3.3-70b',
        name: 'Llama 3.3 70B',
        provider: 'cerebras',
        enabled: true,
        limits: {
          requestsPerMinute: 30,
          requestsPerHour: 900,
          requestsPerDay: 14_400,
          tokensPerMinute: 60_000,
          tokensPerHour: 1_000_000,
          tokensPerDay: 1_000_000,
        } as CerebrasRateLimits,
        defaults: {
          temperature: 0.7,
          maxTokens: 8192,
          topP: 0.95,
        },
      },
      {
        id: 'qwen-3-32b',
        name: 'Qwen 3 32B',
        provider: 'cerebras',
        enabled: true,
        limits: {
          requestsPerMinute: 30,
          requestsPerHour: 900,
          requestsPerDay: 14_400,
          tokensPerMinute: 60_000,
          tokensPerHour: 1_000_000,
          tokensPerDay: 1_000_000,
        } as CerebrasRateLimits,
        defaults: {
          temperature: 0.7,
          maxTokens: 8192,
        },
      },
      {
        id: 'qwen-3-235b-a22b-instruct-2507',
        name: 'Qwen 3 235B Instruct',
        provider: 'cerebras',
        enabled: true,
        limits: {
          requestsPerMinute: 30,
          requestsPerHour: 900,
          requestsPerDay: 14_400,
          tokensPerMinute: 60_000,
          tokensPerHour: 1_000_000,
          tokensPerDay: 1_000_000,
        } as CerebrasRateLimits,
        defaults: {
          temperature: 0.7,
          maxTokens: 8192,
        },
      },
      {
        id: 'gpt-oss-120b',
        name: 'GPT OSS 120B',
        provider: 'cerebras',
        enabled: true,
        limits: {
          requestsPerMinute: 30,
          requestsPerHour: 900,
          requestsPerDay: 14_400,
          tokensPerMinute: 60_000,
          tokensPerHour: 1_000_000,
          tokensPerDay: 1_000_000,
        } as CerebrasRateLimits,
        defaults: {
          temperature: 0.7,
          maxTokens: 8192,
        },
      },
      // ─────────────────────────────────────────────────────────
      // ZAI GLM 4.6 - Different limits!
      // TPM: 150K, TPH: 1M, TPD: 1M, RPM: 10, RPH: 100, RPD: 100
      // ─────────────────────────────────────────────────────────
      {
        id: 'zai-glm-4.6',
        name: 'ZAI GLM 4.6',
        provider: 'cerebras',
        enabled: true,
        limits: {
          requestsPerMinute: 10,
          requestsPerHour: 100,
          requestsPerDay: 100, // Very limited!
          tokensPerMinute: 150_000,
          tokensPerHour: 1_000_000,
          tokensPerDay: 1_000_000,
        } as CerebrasRateLimits,
        defaults: {
          temperature: 0.6,
          maxTokens: 40960,
          topP: 0.95,
        },
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

/** Get all enabled models across all providers */
export function getEnabledModels() {
  return providers.flatMap((p) =>
    p.models.filter((m) => m.enabled)
  );
}

/** Get models for a specific provider */
export function getProviderModels(providerName: string) {
  const provider = providers.find((p) => p.name === providerName);
  return provider?.models.filter((m) => m.enabled) ?? [];
}

/** Get a specific model by ID */
export function getModelById(modelId: string) {
  for (const provider of providers) {
    const model = provider.models.find((m) => m.id === modelId);
    if (model) return model;
  }
  return undefined;
}

/** Get provider config by name */
export function getProviderConfig(name: string) {
  return providers.find((p) => p.name === name);
}
