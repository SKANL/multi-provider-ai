import type { ChatCompletionMessageParam } from 'groq-sdk/resources/chat/completions';

// ─────────────────────────────────────────────────────────────
// Message Types
// ─────────────────────────────────────────────────────────────
export type ChatMessage = ChatCompletionMessageParam;

// ─────────────────────────────────────────────────────────────
// Provider Types
// ─────────────────────────────────────────────────────────────
export type ProviderName = 'groq' | 'cerebras';

// ─────────────────────────────────────────────────────────────
// Rate Limit Configuration
// ─────────────────────────────────────────────────────────────
// Groq limits: RPM, RPD, TPM, TPD
// Cerebras limits: RPM, RPH, RPD, TPM, TPH, TPD
// ─────────────────────────────────────────────────────────────

/** Groq-specific rate limits */
export interface GroqRateLimits {
  /** Requests per minute (RPM) */
  requestsPerMinute: number;
  /** Requests per day (RPD) */
  requestsPerDay: number;
  /** Tokens per minute (TPM) */
  tokensPerMinute: number;
  /** Tokens per day (TPD) */
  tokensPerDay: number;
}

/** Cerebras-specific rate limits */
export interface CerebrasRateLimits {
  /** Requests per minute (RPM) */
  requestsPerMinute: number;
  /** Requests per hour (RPH) */
  requestsPerHour: number;
  /** Requests per day (RPD) */
  requestsPerDay: number;
  /** Tokens per minute (TPM) */
  tokensPerMinute: number;
  /** Tokens per hour (TPH) */
  tokensPerHour: number;
  /** Tokens per day (TPD) */
  tokensPerDay: number;
}

/** Union type for provider-specific rate limits */
export type RateLimits = GroqRateLimits | CerebrasRateLimits;

// ─────────────────────────────────────────────────────────────
// Model Configuration
// ─────────────────────────────────────────────────────────────
export interface ModelConfig {
  /** Model identifier as used by the provider API */
  id: string;
  /** Human-readable name */
  name: string;
  /** Provider that serves this model */
  provider: ProviderName;
  /** Rate limits for this specific model */
  limits: RateLimits;
  /** Whether this model is currently enabled */
  enabled: boolean;
  /** Default parameters for this model */
  defaults?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };
}

// ─────────────────────────────────────────────────────────────
// Provider Configuration
// ─────────────────────────────────────────────────────────────
export interface ProviderConfig {
  name: ProviderName;
  /** API key environment variable name */
  apiKeyEnv: string;
  /** Models available from this provider */
  models: ModelConfig[];
}

// ─────────────────────────────────────────────────────────────
// Usage Tracking
// ─────────────────────────────────────────────────────────────
export interface UsageRecord {
  modelId: string;
  provider: ProviderName;
  timestamp: number;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Groq Rate Limit State (from headers)
 * Headers: x-ratelimit-limit-requests (RPD), x-ratelimit-limit-tokens (TPM)
 *          x-ratelimit-remaining-requests (RPD), x-ratelimit-remaining-tokens (TPM)
 *          x-ratelimit-reset-requests, x-ratelimit-reset-tokens, retry-after
 */
export interface GroqRateLimitState {
  /** Remaining requests per day (RPD) */
  remainingRequestsDay: number;
  /** Remaining tokens per minute (TPM) */
  remainingTokensMinute: number;
  /** Limit requests per day (RPD) */
  limitRequestsDay: number;
  /** Limit tokens per minute (TPM) */
  limitTokensMinute: number;
  /** Timestamp when requests reset */
  resetRequestsAt: number;
  /** Timestamp when tokens reset */
  resetTokensAt: number;
  /** Retry after (seconds) - only set on 429 */
  retryAfter?: number;
  /** Last header update timestamp */
  lastUpdated: number;
}

/**
 * Cerebras Rate Limit State (from headers)
 * Headers: x-ratelimit-limit-requests-day, x-ratelimit-limit-tokens-minute
 *          x-ratelimit-remaining-requests-day, x-ratelimit-remaining-tokens-minute
 *          x-ratelimit-reset-requests-day, x-ratelimit-reset-tokens-minute
 */
export interface CerebrasRateLimitState {
  /** Remaining requests per day */
  remainingRequestsDay: number;
  /** Remaining tokens per minute */
  remainingTokensMinute: number;
  /** Limit requests per day */
  limitRequestsDay: number;
  /** Limit tokens per minute */
  limitTokensMinute: number;
  /** Seconds until daily request limit resets */
  resetRequestsDaySeconds: number;
  /** Seconds until per-minute token limit resets */
  resetTokensMinuteSeconds: number;
  /** Last header update timestamp */
  lastUpdated: number;
}

/** Union type for provider-specific rate limit state */
export type RateLimitState = GroqRateLimitState | CerebrasRateLimitState;

export interface UsageStats {
  provider: ProviderName;
  /** Current rate limit state from headers */
  rateLimitState: RateLimitState;
  /** Requests sent today (local counter for fallback) */
  requestsToday: number;
  /** Tokens used today (local counter for fallback) */
  tokensToday: number;
  /** Timestamp of the current day start */
  dayStart: number;
}

// ─────────────────────────────────────────────────────────────
// Service Interface
// ─────────────────────────────────────────────────────────────
export interface ChatResult {
  stream: AsyncIterable<string>;
  /** Promise that resolves with usage info after stream completes */
  usage: Promise<{ inputTokens: number; outputTokens: number }>;
}

export interface AIProvider {
  name: ProviderName;
  chat: (
    messages: ChatMessage[],
    model: ModelConfig
  ) => Promise<ChatResult>;
}

// ─────────────────────────────────────────────────────────────
// Model Manager Types
// ─────────────────────────────────────────────────────────────
export type RotationStrategy = 'round-robin' | 'random' | 'least-used';

export interface ModelManagerConfig {
  strategy: RotationStrategy;
  /** Fallback to next available model if current is rate limited */
  autoFallback: boolean;
}
