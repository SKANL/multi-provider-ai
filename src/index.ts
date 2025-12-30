import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { streamText } from 'hono/streaming';

import type { ChatMessage } from './types';
import { ModelManager } from './core/model-manager';
import { usageTracker } from './core/usage-tracker';
import { getProvider } from './services';

// ─────────────────────────────────────────────────────────────
// Initialize Model Manager
// ─────────────────────────────────────────────────────────────
// You can customize the model manager with options:
//
// const modelManager = new ModelManager({
//   strategy: 'round-robin',  // 'round-robin' | 'random' | 'least-used'
//   autoFallback: true,       // Fallback to next model if rate limited
//   providers: ['groq'],      // Filter by provider
//   modelIds: ['llama-3.3-70b-versatile'], // Filter by specific models
// });
// ─────────────────────────────────────────────────────────────

const modelManager = new ModelManager({
  strategy: 'round-robin',
  autoFallback: true,
});

// ─────────────────────────────────────────────────────────────
// Hono app
// ─────────────────────────────────────────────────────────────
const app = new Hono();

// Global middlewares
app.use('*', logger());

// CORS configuration - use environment variable in production
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['*'];

app.use(
  '*',
  cors({
    origin: allowedOrigins.length === 1 && allowedOrigins[0] === '*' 
      ? '*' 
      : allowedOrigins,
    allowMethods: ['POST', 'GET', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  })
);

// ─────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────

// Health check
app.get('/', (c) =>
  c.json({
    status: 'ok',
    message: 'AI API running',
    models: modelManager.getAllModels().map((m) => ({
      id: m.id,
      provider: m.provider,
      name: m.name,
    })),
  })
);

// Get available models and their status
app.get('/models', (c) => {
  const status = modelManager.getStatus();
  return c.json({
    models: status.map((s) => ({
      id: s.model.id,
      provider: s.model.provider,
      name: s.model.name,
      available: s.available,
      reason: s.reason,
      rateLimit: usageTracker.getRateLimitInfo(s.model),
      configuredLimits: s.model.limits,
    })),
  });
});

// Get usage statistics with detailed rate limit info
app.get('/usage', (c) => {
  const models = modelManager.getAllModels();
  const usage = models.map((model) => ({
    modelId: model.id,
    provider: model.provider,
    name: model.name,
    rateLimit: usageTracker.getRateLimitInfo(model),
    remaining: usageTracker.getRemainingCapacity(model),
    localStats: usageTracker.getUsageStats(model.id),
  }));
  return c.json({ usage });
});

// Chat endpoint with streaming
app.post('/chat', async (c) => {
  try {
    const body = await c.req.json<{
      messages: ChatMessage[];
      model?: string; // Optional: specify a model
    }>();

    const { messages, model: requestedModelId } = body;

    // Validate input
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return c.json({ error: 'messages is required and must be a non-empty array' }, 400);
    }

    // Validate message structure
    for (const msg of messages) {
      if (!msg.role || typeof msg.role !== 'string') {
        return c.json({ error: 'Each message must have a valid role' }, 400);
      }
    }

    // Get model (either requested or next in rotation)
    let model;
    let skipped: string[] = [];

    if (requestedModelId) {
      model = modelManager.getModel(requestedModelId);
      if (!model) {
        return c.json({ error: `Model "${requestedModelId}" not found` }, 404);
      }
      const check = usageTracker.canRequest(model);
      if (!check.allowed) {
        return c.json({ error: check.reason }, 429);
      }
    } else {
      const result = modelManager.getNextModel(messages);
      model = result.model;
      skipped = result.skipped;
    }

    // Get provider for this model
    const provider = getProvider(model.provider);

    console.log(
      `🤖 Using ${model.provider}/${model.id}` +
        (skipped.length ? ` (skipped: ${skipped.length} models)` : '')
    );

    // Estimate tokens for rate limiting
    const estimatedTokens = messages.reduce((sum, m) => {
      const content = typeof m.content === 'string' ? m.content : '';
      return sum + Math.ceil(content.length / 4);
    }, 0);

    // Record the request
    usageTracker.recordRequest(model, model.provider, estimatedTokens);

    // Get chat stream
    const { stream: aiStream, usage } = await provider.chat(messages, model);

    // Stream response with error handling
    return streamText(
      c,
      async (stream) => {
        stream.onAbort(() => {
          console.log(`⚠️ Stream aborted for ${model.provider}/${model.id}`);
        });

        for await (const chunk of aiStream) {
          await stream.write(chunk);
        }

        // Log usage after stream completes (already recorded in provider)
        const actualUsage = await usage;
        console.log(
          `📊 ${model.id}: ${actualUsage.inputTokens} in / ${actualUsage.outputTokens} out tokens`
        );
      },
      async (err, stream) => {
        console.error(`❌ Stream error for ${model.provider}/${model.id}:`, err);
        await stream.writeln(JSON.stringify({ error: 'Stream error occurred' }));
      }
    );
  } catch (error) {
    console.error('Chat error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message.includes('rate limit')) {
      return c.json({ error: message }, 429);
    }

    return c.json({ error: message }, 500);
  }
});

// ─────────────────────────────────────────────────────────────
// Start server
// ─────────────────────────────────────────────────────────────
const port = Number(process.env.PORT) || 3000;

export default {
  port,
  fetch: app.fetch,
};

console.log(`🚀 Server is running on http://localhost:${port}`);
console.log(`📋 Available endpoints:`);
console.log(`   GET  /        - Health check & model list`);
console.log(`   GET  /models  - Model status & rate limits`);
console.log(`   GET  /usage   - Usage statistics`);
console.log(`   POST /chat    - Chat with AI (streaming)`);
