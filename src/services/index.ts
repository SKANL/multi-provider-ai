import type { AIProvider, ProviderName } from '../types';
import { groqProvider } from './groq';
import { cerebrasProvider } from './cerebras';

// ─────────────────────────────────────────────────────────────
// Provider Registry
// ─────────────────────────────────────────────────────────────
// Register all available providers here.
// Add new providers by importing them and adding to the map.
// ─────────────────────────────────────────────────────────────

const providerRegistry = new Map<ProviderName, AIProvider>([
  ['groq', groqProvider],
  ['cerebras', cerebrasProvider],
]);

/**
 * Get a provider by name
 */
export function getProvider(name: ProviderName): AIProvider {
  const provider = providerRegistry.get(name);
  if (!provider) {
    throw new Error(`Provider "${name}" not found. Available: ${[...providerRegistry.keys()].join(', ')}`);
  }
  return provider;
}

/**
 * Get all registered providers
 */
export function getAllProviders(): AIProvider[] {
  return [...providerRegistry.values()];
}

/**
 * Check if a provider is registered
 */
export function hasProvider(name: ProviderName): boolean {
  return providerRegistry.has(name);
}

// Re-export providers
export { groqProvider } from './groq';
export { cerebrasProvider } from './cerebras';
