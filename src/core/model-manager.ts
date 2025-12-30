import type { ModelConfig, RotationStrategy, ChatMessage } from '../types';
import { getEnabledModels } from '../config/models';
import { usageTracker } from './usage-tracker';

// ─────────────────────────────────────────────────────────────
// Model Manager
// ─────────────────────────────────────────────────────────────
// Manages model selection and rotation with rate limit awareness.
// Supports multiple strategies and automatic fallback.
// ─────────────────────────────────────────────────────────────

export interface ModelManagerOptions {
  /** Rotation strategy */
  strategy?: RotationStrategy;
  /** Auto-fallback to next available model if rate limited */
  autoFallback?: boolean;
  /** Filter models by provider */
  providers?: string[];
  /** Filter models by specific IDs */
  modelIds?: string[];
}

export class ModelManager {
  private models: ModelConfig[];
  private currentIndex: number = 0;
  private strategy: RotationStrategy;
  private autoFallback: boolean;
  private usageCount: Map<string, number> = new Map();

  constructor(options: ModelManagerOptions = {}) {
    this.strategy = options.strategy ?? 'round-robin';
    this.autoFallback = options.autoFallback ?? true;

    // Get and filter models
    let models = getEnabledModels();

    if (options.providers?.length) {
      models = models.filter((m) => options.providers!.includes(m.provider));
    }

    if (options.modelIds?.length) {
      models = models.filter((m) => options.modelIds!.includes(m.id));
    }

    this.models = models;

    if (this.models.length === 0) {
      throw new Error('No enabled models available with the specified filters');
    }

    console.log(
      `📦 ModelManager initialized with ${this.models.length} models:`,
      this.models.map((m) => `${m.provider}/${m.id}`).join(', ')
    );
  }

  /**
   * Estimate input tokens from messages (rough approximation)
   */
  private estimateTokens(messages: ChatMessage[]): number {
    // Rough estimate: ~4 characters per token
    const totalChars = messages.reduce((sum, m) => {
      const content = typeof m.content === 'string' ? m.content : '';
      return sum + content.length;
    }, 0);
    return Math.ceil(totalChars / 4);
  }

  /**
   * Select next model based on strategy
   */
  private selectByStrategy(): ModelConfig {
    switch (this.strategy) {
      case 'round-robin':
        const model = this.models[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.models.length;
        return model!;

      case 'random':
        return this.models[Math.floor(Math.random() * this.models.length)]!;

      case 'least-used':
        // Sort by usage count and pick least used
        const sorted = [...this.models].sort((a, b) => {
          const aCount = this.usageCount.get(a.id) ?? 0;
          const bCount = this.usageCount.get(b.id) ?? 0;
          return aCount - bCount;
        });
        return sorted[0]!;

      default:
        return this.models[0]!;
    }
  }

  /**
   * Get next available model that respects rate limits
   */
  getNextModel(messages: ChatMessage[] = []): {
    model: ModelConfig;
    skipped: string[];
  } {
    const estimatedTokens = this.estimateTokens(messages);
    const skipped: string[] = [];
    const startIndex = this.currentIndex;
    let attempts = 0;

    while (attempts < this.models.length) {
      const model = this.selectByStrategy();
      const check = usageTracker.canRequest(model, estimatedTokens);

      if (check.allowed) {
        // Track usage for least-used strategy
        this.usageCount.set(model.id, (this.usageCount.get(model.id) ?? 0) + 1);
        return { model, skipped };
      }

      if (this.autoFallback) {
        skipped.push(`${model.provider}/${model.id}: ${check.reason}`);
        attempts++;
      } else {
        throw new Error(`Model ${model.id} rate limited: ${check.reason}`);
      }
    }

    // All models exhausted
    throw new Error(
      `All models rate limited:\n${skipped.join('\n')}`
    );
  }

  /**
   * Get a specific model by ID
   */
  getModel(modelId: string): ModelConfig | undefined {
    return this.models.find((m) => m.id === modelId);
  }

  /**
   * Get all available models
   */
  getAllModels(): ModelConfig[] {
    return [...this.models];
  }

  /**
   * Get models that can currently accept requests
   */
  getAvailableModels(estimatedTokens: number = 0): ModelConfig[] {
    return this.models.filter((m) => 
      usageTracker.canRequest(m, estimatedTokens).allowed
    );
  }

  /**
   * Get status of all models including rate limit info
   */
  getStatus(): Array<{
    model: ModelConfig;
    available: boolean;
    reason?: string;
    remaining: {
      requests: number;
      tokens: number;
      requestsResetAt?: number;
      tokensResetAt?: number;
    };
  }> {
    return this.models.map((model) => {
      const check = usageTracker.canRequest(model);
      const remaining = usageTracker.getRemainingCapacity(model);
      return {
        model,
        available: check.allowed,
        reason: check.reason,
        remaining,
      };
    });
  }

  /**
   * Set rotation strategy
   */
  setStrategy(strategy: RotationStrategy): void {
    this.strategy = strategy;
    console.log(`🔄 Rotation strategy changed to: ${strategy}`);
  }

  /**
   * Reset usage counters (for least-used strategy)
   */
  resetUsageCount(): void {
    this.usageCount.clear();
  }
}
