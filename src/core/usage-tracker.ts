import type { 
  ModelConfig, 
  UsageStats, 
  UsageRecord, 
  ProviderName, 
  GroqRateLimitState, 
  CerebrasRateLimitState,
  GroqRateLimits,
  CerebrasRateLimits,
} from '../types';

// ─────────────────────────────────────────────────────────────
// Usage Tracker (Header-Based)
// ─────────────────────────────────────────────────────────────
// Tracks usage primarily using Rate Limit Headers from APIs.
// 
// Groq Headers:
//   x-ratelimit-limit-requests (RPD), x-ratelimit-limit-tokens (TPM)
//   x-ratelimit-remaining-requests (RPD), x-ratelimit-remaining-tokens (TPM)
//   x-ratelimit-reset-requests, x-ratelimit-reset-tokens
//   retry-after (only on 429)
//
// Cerebras Headers:
//   x-ratelimit-limit-requests-day, x-ratelimit-limit-tokens-minute
//   x-ratelimit-remaining-requests-day, x-ratelimit-remaining-tokens-minute
//   x-ratelimit-reset-requests-day (seconds), x-ratelimit-reset-tokens-minute (seconds)
// ─────────────────────────────────────────────────────────────

export class UsageTracker {
  // Map of modelId -> usage stats
  private stats: Map<string, UsageStats> = new Map();
  // History of usage records for analytics
  private history: UsageRecord[] = [];
  // Max history entries to keep
  private readonly maxHistorySize = 10000;

  /**
   * Initialize default rate limit state for Groq
   */
  private createGroqState(limits: GroqRateLimits): GroqRateLimitState {
    return {
      remainingRequestsDay: limits.requestsPerDay,
      remainingTokensMinute: limits.tokensPerMinute,
      limitRequestsDay: limits.requestsPerDay,
      limitTokensMinute: limits.tokensPerMinute,
      resetRequestsAt: 0,
      resetTokensAt: 0,
      lastUpdated: 0,
    };
  }

  /**
   * Initialize default rate limit state for Cerebras
   */
  private createCerebrasState(limits: CerebrasRateLimits): CerebrasRateLimitState {
    return {
      remainingRequestsDay: limits.requestsPerDay,
      remainingTokensMinute: limits.tokensPerMinute,
      limitRequestsDay: limits.requestsPerDay,
      limitTokensMinute: limits.tokensPerMinute,
      resetRequestsDaySeconds: 0,
      resetTokensMinuteSeconds: 0,
      lastUpdated: 0,
    };
  }

  /**
   * Get or create usage stats for a model
   */
  private getStats(model: ModelConfig): UsageStats {
    const dayStart = new Date().setHours(0, 0, 0, 0);
    let stats = this.stats.get(model.id);

    if (!stats) {
      // Initialize with config limits as "current" state until first header update
      const rateLimitState = model.provider === 'groq'
        ? this.createGroqState(model.limits as GroqRateLimits)
        : this.createCerebrasState(model.limits as CerebrasRateLimits);

      stats = {
        provider: model.provider,
        rateLimitState,
        requestsToday: 0,
        tokensToday: 0,
        dayStart,
      };
      this.stats.set(model.id, stats);
    }

    // Reset daily counters if new day
    if (stats.dayStart !== dayStart) {
      stats.requestsToday = 0;
      stats.tokensToday = 0;
      stats.dayStart = dayStart;
    }

    return stats;
  }

  /**
   * Update state from Groq API Headers
   */
  private updateFromGroqHeaders(state: GroqRateLimitState, headers: Headers): void {
    const now = Date.now();

    // Groq Headers (all refer to RPD for requests, TPM for tokens)
    const remReq = headers.get('x-ratelimit-remaining-requests');
    const remTok = headers.get('x-ratelimit-remaining-tokens');
    const limitReq = headers.get('x-ratelimit-limit-requests');
    const limitTok = headers.get('x-ratelimit-limit-tokens');
    const resetReqStr = headers.get('x-ratelimit-reset-requests');
    const resetTokStr = headers.get('x-ratelimit-reset-tokens');
    const retryAfter = headers.get('retry-after');

    if (remReq) state.remainingRequestsDay = parseInt(remReq, 10);
    if (remTok) state.remainingTokensMinute = parseInt(remTok, 10);
    if (limitReq) state.limitRequestsDay = parseInt(limitReq, 10);
    if (limitTok) state.limitTokensMinute = parseInt(limitTok, 10);

    if (resetReqStr) state.resetRequestsAt = now + this.parseGroqDuration(resetReqStr);
    if (resetTokStr) state.resetTokensAt = now + this.parseGroqDuration(resetTokStr);
    if (retryAfter) state.retryAfter = parseInt(retryAfter, 10);

    state.lastUpdated = now;
  }

  /**
   * Update state from Cerebras API Headers
   */
  private updateFromCerebrasHeaders(state: CerebrasRateLimitState, headers: Headers): void {
    const now = Date.now();

    // Cerebras Headers
    const remReq = headers.get('x-ratelimit-remaining-requests-day');
    const remTok = headers.get('x-ratelimit-remaining-tokens-minute');
    const limitReq = headers.get('x-ratelimit-limit-requests-day');
    const limitTok = headers.get('x-ratelimit-limit-tokens-minute');
    const resetReq = headers.get('x-ratelimit-reset-requests-day');
    const resetTok = headers.get('x-ratelimit-reset-tokens-minute');

    if (remReq) state.remainingRequestsDay = parseInt(remReq, 10);
    if (remTok) state.remainingTokensMinute = parseInt(remTok, 10);
    if (limitReq) state.limitRequestsDay = parseInt(limitReq, 10);
    if (limitTok) state.limitTokensMinute = parseInt(limitTok, 10);
    
    // Cerebras sends reset times in seconds
    if (resetReq) state.resetRequestsDaySeconds = parseFloat(resetReq);
    if (resetTok) state.resetTokensMinuteSeconds = parseFloat(resetTok);

    state.lastUpdated = now;
  }

  /**
   * Update state from API Headers (public method)
   */
  updateFromHeaders(modelId: string, provider: ProviderName, headers: Headers): void {
    const stats = this.stats.get(modelId);
    if (!stats) return;

    if (provider === 'groq') {
      this.updateFromGroqHeaders(stats.rateLimitState as GroqRateLimitState, headers);
    } else if (provider === 'cerebras') {
      this.updateFromCerebrasHeaders(stats.rateLimitState as CerebrasRateLimitState, headers);
    }
  }

  /**
   * Helper to parse Groq duration format e.g. "12m3.5s", "4s", "1h"
   */
  private parseGroqDuration(duration: string): number {
    let ms = 0;
    const regex = /(\d+(?:\.\d+)?)([hms])/g;
    let match;
    while ((match = regex.exec(duration)) !== null) {
      const value = parseFloat(match[1]!);
      const unit = match[2];
      if (unit === 'h') ms += value * 3600 * 1000;
      else if (unit === 'm') ms += value * 60 * 1000;
      else if (unit === 's') ms += value * 1000;
    }
    return ms;
  }

  /**
   * Check if a model can accept a request
   */
  canRequest(model: ModelConfig, estimatedInputTokens: number = 0): {
    allowed: boolean;
    reason?: string;
    stats: UsageStats;
  } {
    const stats = this.getStats(model);
    const now = Date.now();

    if (model.provider === 'groq') {
      return this.canRequestGroq(stats, estimatedInputTokens, now);
    } else {
      return this.canRequestCerebras(stats, estimatedInputTokens, now);
    }
  }

  private canRequestGroq(
    stats: UsageStats, 
    estimatedTokens: number, 
    now: number
  ): { allowed: boolean; reason?: string; stats: UsageStats } {
    const state = stats.rateLimitState as GroqRateLimitState;

    // Check retry-after (only set on 429)
    if (state.retryAfter && state.lastUpdated + (state.retryAfter * 1000) > now) {
      const waitSec = Math.ceil(state.retryAfter - ((now - state.lastUpdated) / 1000));
      return { allowed: false, reason: `Rate limited: Retry after ${waitSec}s`, stats };
    }

    // Check requests per day
    if (state.remainingRequestsDay <= 0 && state.resetRequestsAt > now) {
      const waitSec = Math.ceil((state.resetRequestsAt - now) / 1000);
      return { allowed: false, reason: `Daily requests exhausted: Reset in ${this.formatDuration(waitSec)}`, stats };
    }

    // Check tokens per minute
    if (state.remainingTokensMinute < estimatedTokens && state.resetTokensAt > now) {
      const waitSec = Math.ceil((state.resetTokensAt - now) / 1000);
      return { allowed: false, reason: `Token limit (TPM): Reset in ${waitSec}s`, stats };
    }

    return { allowed: true, stats };
  }

  private canRequestCerebras(
    stats: UsageStats, 
    estimatedTokens: number, 
    _now: number
  ): { allowed: boolean; reason?: string; stats: UsageStats } {
    const state = stats.rateLimitState as CerebrasRateLimitState;

    // Check requests per day
    if (state.remainingRequestsDay <= 0 && state.resetRequestsDaySeconds > 0) {
      return { 
        allowed: false, 
        reason: `Daily requests exhausted: Reset in ${this.formatDuration(Math.ceil(state.resetRequestsDaySeconds))}`, 
        stats 
      };
    }

    // Check tokens per minute
    if (state.remainingTokensMinute < estimatedTokens && state.resetTokensMinuteSeconds > 0) {
      return { 
        allowed: false, 
        reason: `Token limit (TPM): Reset in ${Math.ceil(state.resetTokensMinuteSeconds)}s`, 
        stats 
      };
    }

    return { allowed: true, stats };
  }

  /**
   * Format duration in human readable format
   */
  private formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  }

  /**
   * Record a request (optimistic update before headers arrive)
   */
  recordRequest(model: ModelConfig, _provider: ProviderName, inputTokens: number): void {
    const stats = this.getStats(model);
    stats.requestsToday++;
    stats.tokensToday += inputTokens;
    
    // Optimistically decrement state to prevent rapid-fire breaches
    if (model.provider === 'groq') {
      const state = stats.rateLimitState as GroqRateLimitState;
      if (state.remainingRequestsDay > 0) state.remainingRequestsDay--;
      if (state.remainingTokensMinute > 0) state.remainingTokensMinute -= inputTokens;
    } else {
      const state = stats.rateLimitState as CerebrasRateLimitState;
      if (state.remainingRequestsDay > 0) state.remainingRequestsDay--;
      if (state.remainingTokensMinute > 0) state.remainingTokensMinute -= inputTokens;
    }
  }

  /**
   * Record completed usage
   */
  recordUsage(
    modelId: string,
    provider: ProviderName,
    inputTokens: number,
    outputTokens: number
  ): void {
    const record: UsageRecord = {
      modelId,
      provider,
      timestamp: Date.now(),
      inputTokens,
      outputTokens,
    };
    this.history.push(record);
    
    // Trim history
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize / 2);
    }
  }

  /**
   * Get usage history
   */
  getHistory(options?: {
    modelId?: string;
    provider?: ProviderName;
    since?: number;
    limit?: number;
  }): UsageRecord[] {
    let filtered = this.history;

    if (options?.modelId) {
      filtered = filtered.filter((r) => r.modelId === options.modelId);
    }

    if (options?.provider) {
      filtered = filtered.filter((r) => r.provider === options.provider);
    }

    if (options?.since !== undefined) {
      filtered = filtered.filter((r) => r.timestamp >= options.since!);
    }

    if (options?.limit) {
      return filtered.slice(-options.limit);
    }

    return filtered;
  }

  /**
   * Get usage stats for a specific model (public accessor)
   */
  getUsageStats(modelId: string): UsageStats | null {
    return this.stats.get(modelId) ?? null;
  }

  /**
   * Get remaining capacity for a model
   */
  getRemainingCapacity(model: ModelConfig): {
    requests: number;
    tokens: number;
    requestsResetAt?: number;
    tokensResetAt?: number;
  } {
    const stats = this.getStats(model);
    
    if (model.provider === 'groq') {
      const state = stats.rateLimitState as GroqRateLimitState;
      return {
        requests: state.remainingRequestsDay,
        tokens: state.remainingTokensMinute,
        requestsResetAt: state.resetRequestsAt,
        tokensResetAt: state.resetTokensAt,
      };
    } else {
      const state = stats.rateLimitState as CerebrasRateLimitState;
      const now = Date.now();
      return {
        requests: state.remainingRequestsDay,
        tokens: state.remainingTokensMinute,
        requestsResetAt: now + (state.resetRequestsDaySeconds * 1000),
        tokensResetAt: now + (state.resetTokensMinuteSeconds * 1000),
      };
    }
  }

  /**
   * Get detailed rate limit info for display
   */
  getRateLimitInfo(model: ModelConfig): {
    provider: ProviderName;
    remainingRequests: number;
    remainingTokens: number;
    limitRequests: number;
    limitTokens: number;
    resetInfo: string;
    lastUpdated: number;
  } {
    const stats = this.getStats(model);
    
    if (model.provider === 'groq') {
      const state = stats.rateLimitState as GroqRateLimitState;
      const now = Date.now();
      const reqResetIn = state.resetRequestsAt > now 
        ? this.formatDuration(Math.ceil((state.resetRequestsAt - now) / 1000))
        : 'now';
      const tokResetIn = state.resetTokensAt > now
        ? `${Math.ceil((state.resetTokensAt - now) / 1000)}s`
        : 'now';
      
      return {
        provider: 'groq',
        remainingRequests: state.remainingRequestsDay,
        remainingTokens: state.remainingTokensMinute,
        limitRequests: state.limitRequestsDay,
        limitTokens: state.limitTokensMinute,
        resetInfo: `Requests reset: ${reqResetIn}, Tokens reset: ${tokResetIn}`,
        lastUpdated: state.lastUpdated,
      };
    } else {
      const state = stats.rateLimitState as CerebrasRateLimitState;
      return {
        provider: 'cerebras',
        remainingRequests: state.remainingRequestsDay,
        remainingTokens: state.remainingTokensMinute,
        limitRequests: state.limitRequestsDay,
        limitTokens: state.limitTokensMinute,
        resetInfo: `Requests reset: ${this.formatDuration(Math.ceil(state.resetRequestsDaySeconds))}, Tokens reset: ${Math.ceil(state.resetTokensMinuteSeconds)}s`,
        lastUpdated: state.lastUpdated,
      };
    }
  }
}

// Singleton instance
export const usageTracker = new UsageTracker();
