import Cerebras from '@cerebras/cerebras_cloud_sdk';
import type { ChatCompletion } from '@cerebras/cerebras_cloud_sdk/resources/chat/completions';
import type { AIProvider, ChatMessage, ModelConfig, ChatResult } from '../types';
import { usageTracker } from '../core/usage-tracker';

// ─────────────────────────────────────────────────────────────
// Cerebras Provider Adapter
// ─────────────────────────────────────────────────────────────

const cerebras = new Cerebras();

export const cerebrasProvider: AIProvider = {
  name: 'cerebras',

  async chat(messages: ChatMessage[], model: ModelConfig): Promise<ChatResult> {
    const defaults = model.defaults ?? {};

    // Map messages to Cerebras format
    const cerebrasMessages = messages.map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: typeof m.content === 'string' ? m.content : '',
    }));

    const { response, data: stream } = await cerebras.chat.completions.create({
      messages: cerebrasMessages,
      model: model.id,
      temperature: defaults.temperature ?? 0.7,
      max_completion_tokens: defaults.maxTokens ?? 8192,
      top_p: defaults.topP ?? 0.95,
      stream: true,
    }).withResponse();

    // Update rate limits from headers
    usageTracker.updateFromHeaders(model.id, 'cerebras', response.headers);

    let inputTokens = 0;
    let outputTokens = 0;
    let usageResolved = false;
    let resolveUsage!: (value: { inputTokens: number; outputTokens: number }) => void;

    const usagePromise = new Promise<{ inputTokens: number; outputTokens: number }>(
      (resolve) => {
        resolveUsage = resolve;
      }
    );

    const asyncStream = (async function* () {
      for await (const chunk of stream) {
        // Type assertion: Cerebras SDK doesn't properly type streaming chunks
        // At runtime, chunks have usage and choices properties
        const typedChunk = chunk as {
          usage?: {
            prompt_tokens?: number;
            completion_tokens?: number;
          };
          choices?: Array<{
            delta?: {
              content?: string;
            };
          }>;
        };

        // Extract usage from chunks if available
        if (typedChunk.usage) {
          inputTokens = typedChunk.usage.prompt_tokens ?? 0;
          outputTokens = typedChunk.usage.completion_tokens ?? 0;
        }

        const content = typedChunk.choices?.[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }

      // Record request and usage
      usageTracker.recordUsage(model.id, 'cerebras', inputTokens, outputTokens);

      // Resolve usage promise after stream completes
      if (!usageResolved) {
        usageResolved = true;
        resolveUsage({ inputTokens, outputTokens });
      }
    })();

    return {
      stream: asyncStream,
      usage: usagePromise,
    };
  },
};
