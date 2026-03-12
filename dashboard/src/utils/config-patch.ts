/**
 * Build & parse OpenClaw config patches for the dashboard.
 *
 * Provider names:
 *   "rc"        — text model (and vision if same endpoint)
 *   "rc-vision" — vision model when using a different endpoint
 */

export const RC_PROVIDER = 'rc';
export const RC_VISION_PROVIDER = 'rc-vision';

export interface ConfigPatchInput {
  baseUrl: string;
  apiKey: string;
  textModel: string;
  visionModel?: string;
  /** When set (and differs from baseUrl), creates a second provider for vision */
  visionBaseUrl?: string;
  visionApiKey?: string;
  /** undefined = don't touch env, "" = clear proxy, "http://..." = set proxy */
  proxyUrl?: string;
}

export interface ExtractedConfig {
  baseUrl: string;
  apiKey: string;
  textModel: string;
  visionModel: string;
  visionBaseUrl: string;
  visionApiKey: string;
  proxyUrl: string;
  useDifferentVisionEndpoint: boolean;
}

function makeModelDef(id: string, input: string[]) {
  return { id, name: id, input, contextWindow: 128000, maxTokens: 65536 };
}

/**
 * Build a config.patch payload from user-provided fields.
 */
export function buildConfigPatch(input: ConfigPatchInput): Record<string, unknown> {
  const baseUrl = input.baseUrl.replace(/\/+$/, '').replace(/\/chat\/completions$/, '');
  const hasVision = !!input.visionModel && input.visionModel !== input.textModel;
  const useSeparateEndpoint =
    hasVision && !!input.visionBaseUrl && input.visionBaseUrl !== input.baseUrl;

  // --- Providers ---
  // Always mark the primary model as supporting images — modern LLMs are multimodal.
  // OpenClaw checks model.input.includes("image") to decide whether to inject images
  // into the prompt. Without this, images are silently dropped.
  const rcModels = [makeModelDef(input.textModel, ['text', 'image'])];
  if (hasVision && !useSeparateEndpoint) {
    rcModels.push(makeModelDef(input.visionModel!, ['text', 'image']));
  }

  const providers: Record<string, unknown> = {
    [RC_PROVIDER]: {
      baseUrl,
      apiKey: input.apiKey,
      api: 'openai-completions',
      models: rcModels,
    },
  };

  if (useSeparateEndpoint) {
    providers[RC_VISION_PROVIDER] = {
      baseUrl: input.visionBaseUrl!.replace(/\/+$/, '').replace(/\/chat\/completions$/, ''),
      apiKey: input.visionApiKey || input.apiKey,
      api: 'openai-completions',
      models: [makeModelDef(input.visionModel!, ['text', 'image'])],
    };
  }

  // --- Agent model refs ---
  // Always set imageModel — config.patch is a deep merge, so omitting a field
  // leaves stale values. When no separate vision model, imageModel = text model
  // (which is always marked as multimodal).
  const visionProvider = useSeparateEndpoint ? RC_VISION_PROVIDER : RC_PROVIDER;
  const visionRef = hasVision
    ? `${visionProvider}/${input.visionModel}`
    : `${RC_PROVIDER}/${input.textModel}`;

  const defaults: Record<string, unknown> = {
    model: { primary: `${RC_PROVIDER}/${input.textModel}` },
    imageModel: { primary: visionRef },
  };

  // --- Patch ---
  const patch: Record<string, unknown> = {
    agents: { defaults },
    models: { providers },
  };

  if (input.proxyUrl !== undefined) {
    patch.env = {
      HTTP_PROXY: input.proxyUrl,
      HTTPS_PROXY: input.proxyUrl,
    };
  }

  return patch;
}

/**
 * Extract user-facing fields from an OpenClaw gateway config snapshot.
 */
export function extractConfigFields(
  config: Record<string, unknown> | null,
): ExtractedConfig {
  const empty: ExtractedConfig = {
    baseUrl: '',
    apiKey: '',
    textModel: '',
    visionModel: '',
    visionBaseUrl: '',
    visionApiKey: '',
    proxyUrl: '',
    useDifferentVisionEndpoint: false,
  };
  if (!config) return empty;

  // --- Model refs ---
  const agents = config.agents as Record<string, unknown> | undefined;
  const defaults = agents?.defaults as Record<string, unknown> | undefined;
  const modelDef = defaults?.model as { primary?: string } | undefined;
  const imageModelDef = defaults?.imageModel as { primary?: string } | undefined;

  const primary = modelDef?.primary ?? '';
  const imagePrimary = imageModelDef?.primary ?? '';

  const strip = (ref: string) =>
    ref.includes('/') ? ref.split('/').slice(1).join('/') : ref;
  const providerOf = (ref: string) =>
    ref.includes('/') ? ref.split('/')[0] : '';

  const textModel = strip(primary);
  const visionModel = imagePrimary ? strip(imagePrimary) : '';
  const visionProviderKey = providerOf(imagePrimary);
  const useDifferentVisionEndpoint = visionProviderKey === RC_VISION_PROVIDER;

  // --- Providers ---
  const providers = (config.models as Record<string, unknown> | undefined)
    ?.providers as Record<string, Record<string, unknown>> | undefined;

  const textProvider =
    providers?.[RC_PROVIDER] ??
    (providerOf(primary) ? providers?.[providerOf(primary)] : undefined);

  const visionProvider = useDifferentVisionEndpoint
    ? providers?.[RC_VISION_PROVIDER]
    : undefined;

  // --- Proxy ---
  const env = config.env as Record<string, string> | undefined;
  const proxyUrl = env?.HTTP_PROXY || env?.HTTPS_PROXY || '';

  return {
    baseUrl: (textProvider?.baseUrl as string) ?? '',
    apiKey: (textProvider?.apiKey as string) ?? '',
    textModel,
    visionModel: visionModel !== textModel ? visionModel : '',
    visionBaseUrl: (visionProvider?.baseUrl as string) ?? '',
    visionApiKey: (visionProvider?.apiKey as string) ?? '',
    proxyUrl,
    useDifferentVisionEndpoint,
  };
}

/**
 * Check if a gateway config has a valid model + matching provider.
 */
export function isConfigValid(config: Record<string, unknown> | null): boolean {
  if (!config) return false;

  const agents = config.agents as Record<string, unknown> | undefined;
  const defaults = agents?.defaults as Record<string, unknown> | undefined;
  const modelDef = defaults?.model as { primary?: string } | undefined;
  const primary = modelDef?.primary ?? '';
  if (!primary) return false;

  // Check that a matching provider exists
  const providerKey = primary.includes('/') ? primary.split('/')[0] : '';
  if (!providerKey) return false;

  const providers = (config.models as Record<string, unknown> | undefined)
    ?.providers as Record<string, Record<string, unknown>> | undefined;
  return !!providers?.[providerKey];
}
