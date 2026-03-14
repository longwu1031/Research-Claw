/**
 * Provider presets aligned with OpenClaw's native provider system.
 *
 * Each preset uses the EXACT provider key that OpenClaw recognizes internally,
 * so that ProviderCapabilities (tool schema mode, thinking signatures, etc.)
 * and the automatic imageModel fallback logic work correctly.
 *
 * Sources:
 *   - openclaw/src/agents/provider-capabilities.ts (provider keys)
 *   - openclaw/src/agents/models-config.providers.static.ts (models & baseUrls)
 *   - openclaw/src/commands/auth-choice-options.ts (onboard choices)
 *   - openclaw/src/commands/onboard-auth.models.ts (model catalogs)
 */

export interface ProviderModel {
  id: string;
  name: string;
  reasoning?: boolean;
  input?: string[];
  contextWindow?: number;
  maxTokens?: number;
}

export interface ProviderPreset {
  id: string;
  /** Display label (used in selector) */
  label: string;
  /** API base URL */
  baseUrl: string;
  /** API protocol for pi-ai */
  api: 'openai-completions' | 'anthropic-messages' | 'google-generative-ai' | 'bedrock-converse-stream' | 'ollama' | 'github-copilot';
  /** Suggested models for this provider */
  models: ProviderModel[];
  /** URL pattern to match when detecting provider from existing config */
  urlPattern?: RegExp;
}

/**
 * All OpenClaw-native providers.
 * Provider `id` MUST match the key OpenClaw uses in `models.providers.*`
 * so that `resolveProviderCapabilities(provider)` returns the correct config.
 */
export const PROVIDER_PRESETS: ProviderPreset[] = [
  // ── Tier 1: Major cloud providers ──
  {
    id: 'anthropic',
    label: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    api: 'anthropic-messages',
    models: [
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', input: ['text', 'image'], contextWindow: 200_000, maxTokens: 16_384 },
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', input: ['text', 'image'], contextWindow: 200_000, maxTokens: 16_384 },
      { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', input: ['text', 'image'], contextWindow: 200_000, maxTokens: 16_384 },
      { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', input: ['text', 'image'], contextWindow: 200_000, maxTokens: 16_384 },
    ],
    urlPattern: /anthropic\.com/i,
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    api: 'openai-completions',
    models: [
      { id: 'gpt-5.4', name: 'GPT-5.4', reasoning: true, input: ['text', 'image'], contextWindow: 128_000, maxTokens: 16_384 },
      { id: 'gpt-5.4-pro', name: 'GPT-5.4 Pro', reasoning: true, input: ['text', 'image'], contextWindow: 128_000, maxTokens: 16_384 },
      { id: 'gpt-5.2', name: 'GPT-5.2', reasoning: true, input: ['text', 'image'], contextWindow: 128_000, maxTokens: 16_384 },
      { id: 'gpt-4.1', name: 'GPT-4.1', input: ['text', 'image'], contextWindow: 128_000, maxTokens: 16_384 },
      { id: 'gpt-4o', name: 'GPT-4o', input: ['text', 'image'], contextWindow: 128_000, maxTokens: 16_384 },
      { id: 'gpt-5-mini', name: 'GPT-5 Mini', input: ['text', 'image'], contextWindow: 128_000, maxTokens: 16_384 },
    ],
    urlPattern: /openai\.com/i,
  },
  {
    id: 'google',
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    api: 'google-generative-ai',
    models: [
      { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', reasoning: true, input: ['text', 'image'], contextWindow: 1_000_000, maxTokens: 65_536 },
      { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro', reasoning: true, input: ['text', 'image'], contextWindow: 1_000_000, maxTokens: 65_536 },
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', reasoning: true, input: ['text', 'image'], contextWindow: 1_000_000, maxTokens: 65_536 },
    ],
    urlPattern: /generativelanguage\.googleapis\.com/i,
  },

  // ── Tier 2: Chinese providers ──
  {
    id: 'zai',
    label: 'Z.AI / 智谱',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    api: 'openai-completions',
    models: [
      { id: 'glm-5', name: 'GLM-5', reasoning: true, input: ['text'], contextWindow: 204_800, maxTokens: 131_072 },
      { id: 'glm-4.7', name: 'GLM-4.7', reasoning: true, input: ['text'], contextWindow: 204_800, maxTokens: 131_072 },
      { id: 'glm-4.7-flash', name: 'GLM-4.7 Flash', reasoning: true, input: ['text'], contextWindow: 204_800, maxTokens: 131_072 },
      { id: 'glm-4.6v', name: 'GLM-4.6V (Vision)', input: ['text', 'image'], contextWindow: 8_192, maxTokens: 4_096 },
    ],
    urlPattern: /bigmodel\.cn|api\.z\.ai/i,
  },
  {
    id: 'moonshot',
    label: 'Moonshot / Kimi',
    baseUrl: 'https://api.moonshot.ai/v1',
    api: 'openai-completions',
    models: [
      { id: 'kimi-k2.5', name: 'Kimi K2.5', input: ['text', 'image'], contextWindow: 256_000, maxTokens: 8_192 },
    ],
    urlPattern: /moonshot\.(ai|cn)/i,
  },
  {
    id: 'kimi-coding',
    label: 'Kimi Coding',
    baseUrl: 'https://api.kimi.com/coding/',
    api: 'anthropic-messages',
    models: [
      { id: 'k2p5', name: 'Kimi for Coding', reasoning: true, input: ['text', 'image'], contextWindow: 262_144, maxTokens: 32_768 },
    ],
    urlPattern: /api\.kimi\.com/i,
  },
  {
    id: 'minimax',
    label: 'MiniMax',
    baseUrl: 'https://api.minimax.io/anthropic',
    api: 'anthropic-messages',
    models: [
      { id: 'MiniMax-VL-01', name: 'MiniMax VL-01 (Vision)', input: ['text', 'image'], contextWindow: 200_000, maxTokens: 8_192 },
      { id: 'MiniMax-M2.5', name: 'MiniMax M2.5', reasoning: true, input: ['text'], contextWindow: 200_000, maxTokens: 8_192 },
      { id: 'MiniMax-M2.5-highspeed', name: 'MiniMax M2.5 Highspeed', reasoning: true, input: ['text'], contextWindow: 200_000, maxTokens: 8_192 },
    ],
    urlPattern: /minimax\.io/i,
  },
  {
    id: 'volcengine',
    label: 'Volcengine / 豆包',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    api: 'openai-completions',
    models: [
      { id: 'doubao-seed-1-8-251228', name: 'Doubao Seed 1.8', input: ['text', 'image'], contextWindow: 256_000, maxTokens: 4_096 },
      { id: 'kimi-k2-5-260127', name: 'Kimi K2.5', input: ['text', 'image'], contextWindow: 256_000, maxTokens: 4_096 },
      { id: 'glm-4-7-251222', name: 'GLM 4.7', input: ['text', 'image'], contextWindow: 200_000, maxTokens: 4_096 },
    ],
    urlPattern: /volces\.com/i,
  },
  {
    id: 'byteplus',
    label: 'BytePlus',
    baseUrl: 'https://ark.ap-southeast.bytepluses.com/api/v3',
    api: 'openai-completions',
    models: [
      { id: 'seed-1-8-251228', name: 'Seed 1.8', input: ['text', 'image'], contextWindow: 256_000, maxTokens: 4_096 },
      { id: 'kimi-k2-5-260127', name: 'Kimi K2.5', input: ['text', 'image'], contextWindow: 256_000, maxTokens: 4_096 },
      { id: 'glm-4-7-251222', name: 'GLM 4.7', input: ['text', 'image'], contextWindow: 200_000, maxTokens: 4_096 },
    ],
    urlPattern: /bytepluses\.com/i,
  },
  {
    id: 'qianfan',
    label: 'Qianfan / 百度千帆',
    baseUrl: 'https://qianfan.baidubce.com/v2',
    api: 'openai-completions',
    models: [
      { id: 'deepseek-v3.2', name: 'DeepSeek V3.2', reasoning: true, input: ['text'], contextWindow: 98_304, maxTokens: 32_768 },
      { id: 'ernie-5.0-thinking-preview', name: 'ERNIE 5.0 Thinking', reasoning: true, input: ['text', 'image'], contextWindow: 119_000, maxTokens: 64_000 },
    ],
    urlPattern: /baidubce\.com/i,
  },
  {
    id: 'modelstudio',
    label: 'Alibaba Model Studio',
    baseUrl: 'https://coding-intl.dashscope.aliyuncs.com/v1',
    api: 'openai-completions',
    models: [
      { id: 'qwen3.5-plus', name: 'Qwen 3.5 Plus', input: ['text', 'image'], contextWindow: 1_000_000, maxTokens: 65_536 },
      { id: 'qwen3-coder-plus', name: 'Qwen 3 Coder Plus', input: ['text'], contextWindow: 1_000_000, maxTokens: 65_536 },
      { id: 'qwen3-coder-next', name: 'Qwen 3 Coder Next', input: ['text'], contextWindow: 262_144, maxTokens: 65_536 },
      { id: 'kimi-k2.5', name: 'Kimi K2.5', input: ['text', 'image'], contextWindow: 262_144, maxTokens: 32_768 },
      { id: 'glm-5', name: 'GLM-5', input: ['text'], contextWindow: 202_752, maxTokens: 16_384 },
    ],
    urlPattern: /dashscope\.aliyuncs\.com/i,
  },
  {
    id: 'xiaomi',
    label: 'Xiaomi / MiMo',
    baseUrl: 'https://api.xiaomimimo.com/anthropic',
    api: 'anthropic-messages',
    models: [
      { id: 'mimo-v2-flash', name: 'MiMo V2 Flash', input: ['text'], contextWindow: 262_144, maxTokens: 8_192 },
    ],
    urlPattern: /xiaomimimo\.com/i,
  },

  // ── Tier 3: International providers ──
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    api: 'openai-completions',
    models: [],
    urlPattern: /openrouter\.ai/i,
  },
  {
    id: 'mistral',
    label: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    api: 'openai-completions',
    models: [
      { id: 'mistral-large-latest', name: 'Mistral Large', input: ['text', 'image'], contextWindow: 262_144, maxTokens: 262_144 },
    ],
    urlPattern: /mistral\.ai/i,
  },
  {
    id: 'xai',
    label: 'xAI (Grok)',
    baseUrl: 'https://api.x.ai/v1',
    api: 'openai-completions',
    models: [
      { id: 'grok-4', name: 'Grok 4', input: ['text'], contextWindow: 131_072, maxTokens: 8_192 },
    ],
    urlPattern: /api\.x\.ai/i,
  },
  {
    id: 'together',
    label: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    api: 'openai-completions',
    models: [
      { id: 'moonshotai/Kimi-K2.5', name: 'Kimi K2.5', reasoning: true, input: ['text', 'image'], contextWindow: 262_144, maxTokens: 32_768 },
      { id: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek R1', reasoning: true, input: ['text'], contextWindow: 131_072, maxTokens: 8_192 },
      { id: 'deepseek-ai/DeepSeek-V3.1', name: 'DeepSeek V3.1', input: ['text'], contextWindow: 131_072, maxTokens: 8_192 },
      { id: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8', name: 'Llama 4 Maverick', input: ['text', 'image'], contextWindow: 20_000_000, maxTokens: 32_768 },
    ],
    urlPattern: /together\.xyz/i,
  },
  {
    id: 'venice',
    label: 'Venice AI',
    baseUrl: 'https://api.venice.ai/api/v1',
    api: 'openai-completions',
    models: [
      { id: 'kimi-k2-5', name: 'Kimi K2.5', reasoning: true, input: ['text', 'image'], contextWindow: 128_000, maxTokens: 4_096 },
      { id: 'qwen3-5-35b-a3b', name: 'Qwen3.5 35B', reasoning: true, input: ['text', 'image'], contextWindow: 128_000, maxTokens: 16_384 },
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6 (via Venice)', reasoning: true, input: ['text', 'image'], contextWindow: 128_000, maxTokens: 16_384 },
      { id: 'openai-gpt-54', name: 'GPT-5.4 (via Venice)', reasoning: true, input: ['text', 'image'], contextWindow: 128_000, maxTokens: 16_384 },
    ],
    urlPattern: /venice\.ai/i,
  },
  {
    id: 'nvidia',
    label: 'NVIDIA',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    api: 'openai-completions',
    models: [
      { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'Llama 3.1 Nemotron 70B', input: ['text'], contextWindow: 131_072, maxTokens: 4_096 },
      { id: 'meta/llama-3.3-70b-instruct', name: 'Meta Llama 3.3 70B', input: ['text'], contextWindow: 131_072, maxTokens: 4_096 },
    ],
    urlPattern: /nvidia\.com/i,
  },
  {
    id: 'huggingface',
    label: 'Hugging Face',
    baseUrl: 'https://router.huggingface.co/v1',
    api: 'openai-completions',
    models: [
      { id: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek R1', reasoning: true, input: ['text'], contextWindow: 131_072, maxTokens: 8_192 },
      { id: 'deepseek-ai/DeepSeek-V3.1', name: 'DeepSeek V3.1', input: ['text'], contextWindow: 131_072, maxTokens: 8_192 },
    ],
    urlPattern: /huggingface\.co/i,
  },
  {
    id: 'synthetic',
    label: 'Synthetic',
    baseUrl: 'https://api.synthetic.new/anthropic',
    api: 'anthropic-messages',
    models: [
      { id: 'hf:MiniMaxAI/MiniMax-M2.5', name: 'MiniMax M2.5', input: ['text'], contextWindow: 192_000, maxTokens: 65_536 },
      { id: 'hf:moonshotai/Kimi-K2.5', name: 'Kimi K2.5', reasoning: true, input: ['text', 'image'], contextWindow: 256_000, maxTokens: 8_192 },
      { id: 'hf:zai-org/GLM-5', name: 'GLM-5', reasoning: true, input: ['text', 'image'], contextWindow: 256_000, maxTokens: 128_000 },
    ],
    urlPattern: /synthetic\.new/i,
  },
  {
    id: 'kilocode',
    label: 'Kilo Gateway',
    baseUrl: 'https://api.kilo.ai/api/gateway/',
    api: 'openai-completions',
    models: [
      { id: 'kilo/auto', name: 'Kilo Auto', reasoning: true, input: ['text', 'image'], contextWindow: 1_000_000, maxTokens: 128_000 },
    ],
    urlPattern: /kilo\.ai/i,
  },

  // ── Tier 4: Self-hosted / local ──
  {
    id: 'ollama',
    label: 'Ollama (Local)',
    baseUrl: 'http://127.0.0.1:11434',
    api: 'ollama',
    models: [],
    urlPattern: /localhost:11434|127\.0\.0\.1:11434/i,
  },
  {
    id: 'vllm',
    label: 'vLLM (Local)',
    baseUrl: 'http://127.0.0.1:8000/v1',
    api: 'openai-completions',
    models: [],
    urlPattern: /vllm|127\.0\.0\.1:8000/i,
  },

  // ── Custom (always last) ──
  {
    id: 'custom',
    label: 'Custom / Other',
    baseUrl: '',
    api: 'openai-completions',
    models: [],
  },
];

/**
 * Detect which preset matches a given baseUrl.
 * Returns 'custom' if no match found.
 */
export function detectPresetFromUrl(baseUrl: string): string {
  if (!baseUrl) return 'custom';
  for (const preset of PROVIDER_PRESETS) {
    if (preset.urlPattern && preset.urlPattern.test(baseUrl)) {
      return preset.id;
    }
  }
  return 'custom';
}

/**
 * Detect which preset matches a provider key from config.
 * First tries exact id match, then falls back to URL detection.
 */
export function detectPresetFromProvider(providerKey: string, baseUrl?: string): string {
  if (!providerKey) return 'custom';
  const exact = PROVIDER_PRESETS.find((p) => p.id === providerKey);
  if (exact) return exact.id;
  if (baseUrl) return detectPresetFromUrl(baseUrl);
  return 'custom';
}

/**
 * Get a preset by ID. Falls back to 'custom'.
 */
export function getPreset(id: string): ProviderPreset {
  return PROVIDER_PRESETS.find((p) => p.id === id) ?? PROVIDER_PRESETS[PROVIDER_PRESETS.length - 1];
}
