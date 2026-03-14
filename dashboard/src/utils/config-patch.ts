/**
 * Build & parse OpenClaw config for the dashboard.
 *
 * Uses config.apply (full replacement + restart) instead of config.patch
 * (deep merge) so that stale providers are cleaned up, all model metadata
 * (contextWindow, maxTokens, reasoning) comes from presets, and the
 * gateway's restoreRedactedValues() handles API key round-trips.
 *
 * Uses OpenClaw's native provider keys (e.g. 'zai', 'openai', 'anthropic')
 * so that ProviderCapabilities and imageModel fallback logic work correctly.
 */

import { getPreset } from './provider-presets';

/** Sentinel value OpenClaw uses to redact secrets in resolved config */
export const REDACTED_SENTINEL = '__OPENCLAW_REDACTED__';

export interface ConfigPatchInput {
  /** OpenClaw native provider key (e.g. 'zai', 'openai', 'anthropic') */
  provider: string;
  baseUrl: string;
  /** API protocol: 'openai-completions' | 'anthropic-messages' | etc. */
  api?: string;
  /** Omit or empty → preserve existing key via sentinel round-trip */
  apiKey?: string;
  textModel: string;
  visionEnabled?: boolean;
  /** Native provider key for vision (may equal text provider) */
  visionProvider?: string;
  visionModel?: string;
  /** When vision uses a different provider, its baseUrl */
  visionBaseUrl?: string;
  visionApiKey?: string;
  /** API protocol for the vision provider */
  visionApi?: string;
  /** undefined = don't touch env, "" = clear proxy, "http://..." = set proxy */
  proxyUrl?: string;
}

export interface ExtractedConfig {
  /** Detected native provider key */
  provider: string;
  baseUrl: string;
  api: string;
  apiKey: string;
  /** True when the gateway has an API key configured (even if redacted) */
  apiKeyConfigured: boolean;
  textModel: string;
  visionEnabled: boolean;
  visionProvider: string;
  visionModel: string;
  visionBaseUrl: string;
  visionApiKey: string;
  /** True when the gateway has a vision API key configured (even if redacted) */
  visionApiKeyConfigured: boolean;
  visionApi: string;
  proxyUrl: string;
}

function cleanUrl(url: string): string {
  return url.replace(/\/+$/, '').replace(/\/chat\/completions$/, '');
}

/**
 * Resolve full model definition from provider presets.
 * Returns all metadata fields (input, contextWindow, maxTokens, reasoning).
 */
function resolveModelDef(provider: string, modelId: string): Record<string, unknown> {
  const preset = getPreset(provider);
  const known = preset.models.find((m) => m.id === modelId);
  return {
    id: modelId,
    name: modelId,
    reasoning: known?.reasoning ?? false,
    input: known?.input ?? ['text', 'image'],
    contextWindow: known?.contextWindow ?? 128_000,
    maxTokens: known?.maxTokens ?? 16_384,
  };
}

/**
 * Resolve the existing API key from project config for a given provider.
 * Returns the key (may be REDACTED_SENTINEL) or undefined if not found.
 */
function resolveExistingApiKey(
  projectConfig: Record<string, unknown> | null,
  providerKey: string,
): string | undefined {
  if (!projectConfig) return undefined;
  const providers = (projectConfig.models as Record<string, unknown> | undefined)
    ?.providers as Record<string, Record<string, unknown>> | undefined;
  const key = providers?.[providerKey]?.apiKey;
  return typeof key === 'string' ? key : undefined;
}

/**
 * Build the complete project-level config by merging user edits into
 * the current project config.
 *
 * This produces a full config ready for config.apply (not a partial patch).
 * Only providers referenced by the user appear in the output — stale
 * providers (e.g. old 'rc') are naturally excluded.
 *
 * API keys: when the user doesn't supply a new key, the existing key
 * (which may be __OPENCLAW_REDACTED__) is preserved. The gateway's
 * restoreRedactedValues() restores sentinels to real values on write.
 */
export function buildSaveConfig(
  currentConfig: Record<string, unknown> | null,
  input: ConfigPatchInput,
): Record<string, unknown> {
  const base = currentConfig ? structuredClone(currentConfig) : {};

  const providerKey = input.provider;
  const baseUrl = cleanUrl(input.baseUrl);
  const apiType = input.api || 'openai-completions';

  const hasVision = !!input.visionEnabled && !!input.visionModel;
  const visionProviderKey = input.visionProvider || providerKey;
  const useSeparateProvider = hasVision && visionProviderKey !== providerKey;

  // --- Text provider entry ---
  const textModels = [resolveModelDef(providerKey, input.textModel)];

  // Same provider, different vision model → add to same provider entry
  if (hasVision && !useSeparateProvider && input.visionModel !== input.textModel) {
    textModels.push(resolveModelDef(providerKey, input.visionModel!));
  }

  const textProvider: Record<string, unknown> = {
    baseUrl,
    api: apiType,
    models: textModels,
  };

  // API key: use new value if provided, otherwise preserve existing (may be sentinel)
  if (input.apiKey) {
    textProvider.apiKey = input.apiKey;
  } else {
    const existing = resolveExistingApiKey(currentConfig, providerKey);
    if (existing) textProvider.apiKey = existing;
  }

  const providers: Record<string, unknown> = {
    [providerKey]: textProvider,
  };

  // --- Vision provider entry (only when using a different provider) ---
  if (useSeparateProvider) {
    const visionEntry: Record<string, unknown> = {
      baseUrl: cleanUrl(input.visionBaseUrl || input.baseUrl),
      api: input.visionApi || apiType,
      models: [resolveModelDef(visionProviderKey, input.visionModel!)],
    };

    if (input.visionApiKey) {
      visionEntry.apiKey = input.visionApiKey;
    } else if (input.apiKey) {
      visionEntry.apiKey = input.apiKey;
    } else {
      const existing = resolveExistingApiKey(currentConfig, visionProviderKey);
      if (existing) visionEntry.apiKey = existing;
    }

    providers[visionProviderKey] = visionEntry;
  }

  // --- Agent model refs ---
  const visionRef = hasVision
    ? `${visionProviderKey}/${input.visionModel}`
    : `${providerKey}/${input.textModel}`;

  // Preserve existing agent defaults (heartbeat, models aliases, etc.)
  const existingAgents = base.agents as Record<string, unknown> | undefined;
  const existingDefaults = existingAgents?.defaults as Record<string, unknown> | undefined;
  const defaults: Record<string, unknown> = {
    ...existingDefaults,
    model: { primary: `${providerKey}/${input.textModel}` },
    imageModel: { primary: visionRef },
  };

  // --- Build full config ---
  const result: Record<string, unknown> = { ...base };
  result.agents = { ...existingAgents, defaults };
  result.models = { providers };

  if (input.proxyUrl !== undefined) {
    result.env = {
      ...(base.env as Record<string, string> | undefined),
      HTTP_PROXY: input.proxyUrl,
      HTTPS_PROXY: input.proxyUrl,
    };
  } else if (base.env !== undefined) {
    result.env = base.env;
  }

  return result;
}

/**
 * Extract user-facing fields from an OpenClaw gateway config snapshot.
 */
export function extractConfigFields(
  config: Record<string, unknown> | null,
): ExtractedConfig {
  const empty: ExtractedConfig = {
    provider: 'custom',
    baseUrl: '',
    api: 'openai-completions',
    apiKey: '',
    apiKeyConfigured: false,
    textModel: '',
    visionEnabled: false,
    visionProvider: 'custom',
    visionModel: '',
    visionBaseUrl: '',
    visionApiKey: '',
    visionApiKeyConfigured: false,
    visionApi: 'openai-completions',
    proxyUrl: '',
  };
  if (!config) return empty;

  // --- Model refs ---
  const agents = config.agents as Record<string, unknown> | undefined;
  const defaults = agents?.defaults as Record<string, unknown> | undefined;
  const modelDef = defaults?.model as { primary?: string } | undefined;
  const imageModelDef = defaults?.imageModel as { primary?: string } | undefined;

  const primary = modelDef?.primary ?? '';
  const imagePrimary = imageModelDef?.primary ?? '';

  const providerOf = (ref: string) =>
    ref.includes('/') ? ref.split('/')[0] : '';
  const modelOf = (ref: string) =>
    ref.includes('/') ? ref.split('/').slice(1).join('/') : ref;

  const textProviderKey = providerOf(primary) || 'custom';
  const textModelId = modelOf(primary);

  const visionProviderKey = providerOf(imagePrimary) || textProviderKey;
  const visionModelId = modelOf(imagePrimary);

  // Vision is enabled when imageModel exists and differs from text model
  const visionEnabled = !!visionModelId &&
    (visionProviderKey !== textProviderKey || visionModelId !== textModelId);

  // --- Providers ---
  const providers = (config.models as Record<string, unknown> | undefined)
    ?.providers as Record<string, Record<string, unknown>> | undefined;

  const textProviderDef = providers?.[textProviderKey];
  const visionProviderDef = visionProviderKey !== textProviderKey
    ? providers?.[visionProviderKey]
    : undefined;

  // --- Proxy ---
  const env = config.env as Record<string, string> | undefined;
  const proxyUrl = env?.HTTP_PROXY || env?.HTTPS_PROXY || '';

  const deRedact = (v: unknown): string => {
    const s = (v as string) ?? '';
    return s === REDACTED_SENTINEL ? '' : s;
  };

  const apiKeyRaw = textProviderDef?.apiKey;
  const visionApiKeyRaw = visionProviderDef?.apiKey;

  return {
    provider: textProviderKey,
    baseUrl: (textProviderDef?.baseUrl as string) ?? '',
    api: (textProviderDef?.api as string) ?? 'openai-completions',
    apiKey: deRedact(apiKeyRaw),
    apiKeyConfigured: typeof apiKeyRaw === 'string' && apiKeyRaw.length > 0,
    textModel: textModelId,
    visionEnabled,
    visionProvider: visionProviderKey,
    visionModel: visionEnabled ? visionModelId : '',
    visionBaseUrl: visionEnabled
      ? (visionProviderDef?.baseUrl as string) ?? (textProviderDef?.baseUrl as string) ?? ''
      : '',
    visionApiKey: visionProviderDef ? deRedact(visionApiKeyRaw) : '',
    visionApiKeyConfigured: typeof visionApiKeyRaw === 'string' && visionApiKeyRaw.length > 0,
    visionApi: (visionProviderDef?.api as string) ?? (textProviderDef?.api as string) ?? 'openai-completions',
    proxyUrl,
  };
}

/**
 * Check if a gateway config has a valid model + matching provider.
 * Strict validation: requires both model ref AND a matching provider entry.
 */
export function isConfigValid(config: Record<string, unknown> | null): boolean {
  if (!config) return false;

  const agents = config.agents as Record<string, unknown> | undefined;
  const defaults = agents?.defaults as Record<string, unknown> | undefined;
  const modelDef = defaults?.model as { primary?: string } | undefined;
  const primary = modelDef?.primary ?? '';
  if (!primary) return false;

  const providerKey = primary.includes('/') ? primary.split('/')[0] : '';
  if (!providerKey) return false;

  const providers = (config.models as Record<string, unknown> | undefined)
    ?.providers as Record<string, Record<string, unknown>> | undefined;
  return !!providers?.[providerKey];
}

/**
 * Relaxed config check: only verifies that a model reference exists.
 * Used as a fallback when the gateway is running (hello-ok received)
 * but strict validation fails due to resolved config structure differences.
 */
export function hasModelConfigured(config: Record<string, unknown> | null): boolean {
  if (!config) return false;
  const agents = config.agents as Record<string, unknown> | undefined;
  const defaults = agents?.defaults as Record<string, unknown> | undefined;
  const modelDef = defaults?.model as { primary?: string } | undefined;
  const primary = modelDef?.primary ?? '';
  return primary.length > 0 && primary.includes('/');
}
