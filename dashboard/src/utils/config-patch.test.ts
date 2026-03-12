import { describe, it, expect } from 'vitest';
import {
  buildConfigPatch,
  extractConfigFields,
  isConfigValid,
  RC_PROVIDER,
  RC_VISION_PROVIDER,
} from './config-patch';

describe('buildConfigPatch', () => {
  it('builds single-provider patch (text model marked as multimodal)', () => {
    const patch = buildConfigPatch({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      textModel: 'gpt-4o',
    });

    const providers = (patch.models as Record<string, unknown>).providers as Record<string, Record<string, unknown>>;
    expect(providers[RC_PROVIDER]).toBeDefined();
    expect(providers[RC_VISION_PROVIDER]).toBeUndefined();
    expect(providers[RC_PROVIDER].baseUrl).toBe('https://api.openai.com/v1');
    expect(providers[RC_PROVIDER].apiKey).toBe('sk-test');

    // Primary model always includes image support so OpenClaw injects images into prompt
    const models = providers[RC_PROVIDER].models as Array<{ id: string; input: string[] }>;
    expect(models[0].input).toEqual(['text', 'image']);

    const defaults = (patch.agents as Record<string, unknown>).defaults as Record<string, unknown>;
    expect((defaults.model as Record<string, string>).primary).toBe('rc/gpt-4o');
    // When no separate vision model, imageModel falls back to text model
    expect((defaults.imageModel as Record<string, string>).primary).toBe('rc/gpt-4o');
  });

  it('builds single-provider patch with vision (same endpoint)', () => {
    const patch = buildConfigPatch({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      textModel: 'gpt-4o',
      visionModel: 'gpt-4o-vision',
    });

    const providers = (patch.models as Record<string, unknown>).providers as Record<string, Record<string, unknown>>;
    expect(providers[RC_PROVIDER]).toBeDefined();
    expect(providers[RC_VISION_PROVIDER]).toBeUndefined();

    const models = providers[RC_PROVIDER].models as Array<{ id: string; input: string[] }>;
    expect(models).toHaveLength(2);
    expect(models[0].input).toEqual(['text', 'image']);
    expect(models[1].input).toEqual(['text', 'image']);

    const defaults = (patch.agents as Record<string, unknown>).defaults as Record<string, unknown>;
    expect((defaults.imageModel as Record<string, string>).primary).toBe('rc/gpt-4o-vision');
  });

  it('builds dual-provider patch (different vision endpoint)', () => {
    const patch = buildConfigPatch({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-text',
      textModel: 'gpt-4o',
      visionModel: 'glm-4v',
      visionBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      visionApiKey: 'sk-vision',
    });

    const providers = (patch.models as Record<string, unknown>).providers as Record<string, Record<string, unknown>>;
    expect(providers[RC_PROVIDER]).toBeDefined();
    expect(providers[RC_VISION_PROVIDER]).toBeDefined();
    expect(providers[RC_VISION_PROVIDER].baseUrl).toBe('https://open.bigmodel.cn/api/paas/v4');
    expect(providers[RC_VISION_PROVIDER].apiKey).toBe('sk-vision');

    const defaults = (patch.agents as Record<string, unknown>).defaults as Record<string, unknown>;
    expect((defaults.model as Record<string, string>).primary).toBe('rc/gpt-4o');
    expect((defaults.imageModel as Record<string, string>).primary).toBe('rc-vision/glm-4v');
  });

  it('includes proxy env when proxyUrl is set', () => {
    const patch = buildConfigPatch({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      textModel: 'gpt-4o',
      proxyUrl: 'http://127.0.0.1:7890',
    });

    const env = patch.env as Record<string, string>;
    expect(env.HTTP_PROXY).toBe('http://127.0.0.1:7890');
    expect(env.HTTPS_PROXY).toBe('http://127.0.0.1:7890');
  });

  it('clears proxy when proxyUrl is empty string', () => {
    const patch = buildConfigPatch({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      textModel: 'gpt-4o',
      proxyUrl: '',
    });

    const env = patch.env as Record<string, string>;
    expect(env.HTTP_PROXY).toBe('');
    expect(env.HTTPS_PROXY).toBe('');
  });

  it('omits env when proxyUrl is undefined', () => {
    const patch = buildConfigPatch({
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      textModel: 'gpt-4o',
    });

    expect(patch.env).toBeUndefined();
  });

  it('strips trailing slashes from baseUrl', () => {
    const patch = buildConfigPatch({
      baseUrl: 'https://api.openai.com/v1///',
      apiKey: 'sk-test',
      textModel: 'gpt-4o',
    });

    const providers = (patch.models as Record<string, unknown>).providers as Record<string, Record<string, unknown>>;
    expect(providers[RC_PROVIDER].baseUrl).toBe('https://api.openai.com/v1');
  });

  it('strips /chat/completions from baseUrl', () => {
    const patch = buildConfigPatch({
      baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
      apiKey: 'sk-test',
      textModel: 'google/gemini-3.1-pro-preview',
    });

    const providers = (patch.models as Record<string, unknown>).providers as Record<string, Record<string, unknown>>;
    expect(providers[RC_PROVIDER].baseUrl).toBe('https://openrouter.ai/api/v1');
  });
});

describe('extractConfigFields', () => {
  it('returns empty fields for null config', () => {
    const fields = extractConfigFields(null);
    expect(fields.baseUrl).toBe('');
    expect(fields.apiKey).toBe('');
    expect(fields.textModel).toBe('');
    expect(fields.useDifferentVisionEndpoint).toBe(false);
  });

  it('extracts single-provider config', () => {
    const config = {
      agents: { defaults: { model: { primary: 'rc/gpt-4o' } } },
      models: {
        providers: {
          rc: { baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-test' },
        },
      },
    };

    const fields = extractConfigFields(config);
    expect(fields.baseUrl).toBe('https://api.openai.com/v1');
    expect(fields.apiKey).toBe('sk-test');
    expect(fields.textModel).toBe('gpt-4o');
    expect(fields.useDifferentVisionEndpoint).toBe(false);
  });

  it('extracts dual-provider config', () => {
    const config = {
      agents: {
        defaults: {
          model: { primary: 'rc/gpt-4o' },
          imageModel: { primary: 'rc-vision/glm-4v' },
        },
      },
      models: {
        providers: {
          rc: { baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-text' },
          'rc-vision': { baseUrl: 'https://open.bigmodel.cn', apiKey: 'sk-vision' },
        },
      },
    };

    const fields = extractConfigFields(config);
    expect(fields.textModel).toBe('gpt-4o');
    expect(fields.visionModel).toBe('glm-4v');
    expect(fields.useDifferentVisionEndpoint).toBe(true);
    expect(fields.visionBaseUrl).toBe('https://open.bigmodel.cn');
    expect(fields.visionApiKey).toBe('sk-vision');
  });

  it('extracts proxy from env', () => {
    const config = {
      agents: { defaults: { model: { primary: 'rc/gpt-4o' } } },
      models: { providers: { rc: { baseUrl: 'https://api.openai.com' } } },
      env: { HTTP_PROXY: 'http://127.0.0.1:7890' },
    };

    const fields = extractConfigFields(config);
    expect(fields.proxyUrl).toBe('http://127.0.0.1:7890');
  });
});

describe('isConfigValid', () => {
  it('returns false for null', () => {
    expect(isConfigValid(null)).toBe(false);
  });

  it('returns false when no model primary', () => {
    expect(isConfigValid({ agents: { defaults: {} } })).toBe(false);
  });

  it('returns false when provider missing', () => {
    expect(isConfigValid({
      agents: { defaults: { model: { primary: 'rc/gpt-4o' } } },
      models: { providers: {} },
    })).toBe(false);
  });

  it('returns true when model + provider match', () => {
    expect(isConfigValid({
      agents: { defaults: { model: { primary: 'rc/gpt-4o' } } },
      models: { providers: { rc: { baseUrl: 'https://api.openai.com' } } },
    })).toBe(true);
  });
});
