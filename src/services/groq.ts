import { Groq } from 'groq-sdk';
import type { ChatCompletionChunk } from 'groq-sdk/resources/chat/completions';
import type { AIProvider, ChatMessage, ModelConfig, ChatResult } from '../types';
import { usageTracker } from '../core/usage-tracker';

// ─────────────────────────────────────────────────────────────
// Groq Provider Adapter
// ─────────────────────────────────────────────────────────────

const groq = new Groq();

export const groqProvider: AIProvider = {
  name: 'groq',

  async chat(messages: ChatMessage[], model: ModelConfig): Promise<ChatResult> {
    const defaults = model.defaults ?? {};

    const { response, data: stream } = await groq.chat.completions.create({
      messages,
      model: model.id,
      temperature: defaults.temperature ?? 0.7,
      max_completion_tokens: defaults.maxTokens ?? 4096,
      top_p: defaults.topP ?? 1,
      stream: true,
    }).withResponse();

    // Update rate limits from headers
    usageTracker.updateFromHeaders(model.id, 'groq', response.headers);

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
        // Extract usage from x_groq extension if available
        const chunkAny = chunk as any;
        if (chunkAny.x_groq?.usage) {
          inputTokens = chunkAny.x_groq.usage.prompt_tokens ?? 0;
          outputTokens = chunkAny.x_groq.usage.completion_tokens ?? 0;
        }

        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }

      // Record request and usage
      usageTracker.recordUsage(model.id, 'groq', inputTokens, outputTokens);

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
