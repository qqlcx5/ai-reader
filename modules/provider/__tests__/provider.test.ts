import { describe, it, expect } from 'vitest';
import { OpenAIProvider } from '../providers/openai';
import { AnthropicProvider } from '../providers/anthropic';
import { GeminiProvider } from '../providers/gemini';
import { CustomOpenAIProvider } from '../providers/custom';
import { createProvider } from '../factory';
import type { ProviderConfig, ChatRequest, StreamEvent } from '../types';

describe('Provider factory', () => {
  it('creates OpenAI provider', () => {
    const config: ProviderConfig = { id: '1', name: 'OpenAI', type: 'openai', model: 'gpt-4o', enabled: true, apiKey: 'sk-test' };
    const provider = createProvider(config);
    expect(provider).toBeInstanceOf(OpenAIProvider);
  });

  it('creates Anthropic provider', () => {
    const config: ProviderConfig = { id: '2', name: 'Claude', type: 'anthropic', model: 'claude-3-5-sonnet', enabled: true, apiKey: 'test' };
    const provider = createProvider(config);
    expect(provider).toBeInstanceOf(AnthropicProvider);
  });

  it('creates Gemini provider', () => {
    const config: ProviderConfig = { id: '3', name: 'Gemini', type: 'gemini', model: 'gemini-1.5-pro', enabled: true, apiKey: 'test' };
    const provider = createProvider(config);
    expect(provider).toBeInstanceOf(GeminiProvider);
  });

  it('creates custom provider', () => {
    const config: ProviderConfig = { id: '4', name: 'Custom', type: 'custom', model: 'custom-model', baseUrl: 'http://localhost:3000', enabled: true, apiKey: 'test' };
    const provider = createProvider(config);
    expect(provider).toBeInstanceOf(CustomOpenAIProvider);
  });

  it('throws on unknown type', () => {
    const config = { id: '5', name: 'Unknown', type: 'unknown', model: 'x' } as unknown as ProviderConfig;
    expect(() => createProvider(config)).toThrow('Unknown provider type');
  });
});

describe('OpenAI provider buildBody', () => {
  it('builds correct body with system prompt', () => {
    const config: ProviderConfig = { id: '1', name: 'OpenAI', type: 'openai', model: 'gpt-4o', enabled: true, apiKey: 'sk-test' };
    const provider = new OpenAIProvider(config);
    const request: ChatRequest = {
      providerId: '1',
      systemPrompt: 'You are helpful',
      messages: [{ role: 'user', content: 'Hello' }],
    };
    const body = provider['buildBody'](request) as Record<string, unknown>;
    expect(body.model).toBe('gpt-4o');
    expect(body.stream).toBe(true);
    const messages = body.messages as Array<{ role: string; content: string }>;
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toBe('You are helpful');
    expect(messages[1].role).toBe('user');
  });

  it('includes parameters override', () => {
    const config: ProviderConfig = { id: '1', name: 'OpenAI', type: 'openai', model: 'gpt-4o', enabled: true, apiKey: 'sk-test', parameters: { temperature: 0.5 } };
    const provider = new OpenAIProvider(config);
    const request: ChatRequest = {
      providerId: '1',
      messages: [{ role: 'user', content: 'Hi' }],
      parameters: { temperature: 0.7 },
    };
    const body = provider['buildBody'](request) as Record<string, unknown>;
    expect(body.temperature).toBe(0.7); // request overrides config
  });
});

describe('Anthropic provider buildBody', () => {
  it('builds correct body with system prompt', () => {
    const config: ProviderConfig = { id: '2', name: 'Claude', type: 'anthropic', model: 'claude-3-5-sonnet', enabled: true, apiKey: 'test' };
    const provider = new AnthropicProvider(config);
    const request: ChatRequest = {
      providerId: '2',
      systemPrompt: 'You are Claude',
      messages: [{ role: 'user', content: 'Hello' }],
    };
    const body = provider['buildBody'](request) as Record<string, unknown>;
    expect(body.model).toBe('claude-3-5-sonnet');
    expect(body.stream).toBe(true);
    expect(body.system).toBe('You are Claude');
    const messages = body.messages as Array<{ role: string }>;
    expect(messages[0].role).toBe('user');
  });

  it('converts system role to user', () => {
    const config: ProviderConfig = { id: '2', name: 'Claude', type: 'anthropic', model: 'claude-3-5-sonnet', enabled: true, apiKey: 'test' };
    const provider = new AnthropicProvider(config);
    const request: ChatRequest = {
      providerId: '2',
      messages: [{ role: 'system', content: 'System msg' }, { role: 'user', content: 'Hello' }],
    };
    const body = provider['buildBody'](request) as Record<string, unknown>;
    const messages = body.messages as Array<{ role: string }>;
    expect(messages[0].role).toBe('user'); // system converted to user
  });
});

describe('Gemini provider buildBody', () => {
  it('builds correct body with contents', () => {
    const config: ProviderConfig = { id: '3', name: 'Gemini', type: 'gemini', model: 'gemini-1.5-pro', enabled: true, apiKey: 'test' };
    const provider = new GeminiProvider(config);
    const request: ChatRequest = {
      providerId: '3',
      messages: [{ role: 'user', content: 'Hello' }],
    };
    const body = provider['buildBody'](request) as Record<string, unknown>;
    const contents = body.contents as Array<{ role: string; parts: Array<{ text: string }> }>;
    expect(contents[0].role).toBe('user');
    expect(contents[0].parts[0].text).toBe('Hello');
  });

  it('includes system instruction', () => {
    const config: ProviderConfig = { id: '3', name: 'Gemini', type: 'gemini', model: 'gemini-1.5-pro', enabled: true, apiKey: 'test' };
    const provider = new GeminiProvider(config);
    const request: ChatRequest = {
      providerId: '3',
      systemPrompt: 'You are Gemini',
      messages: [{ role: 'user', content: 'Hello' }],
    };
    const body = provider['buildBody'](request) as Record<string, unknown>;
    expect(body.systemInstruction).toBeDefined();
  });
});

describe('Custom provider validation', () => {
  it('throws without baseUrl', () => {
    const config: ProviderConfig = { id: '4', name: 'Custom', type: 'custom', model: 'custom-model', enabled: true, apiKey: 'test' };
    expect(() => new CustomOpenAIProvider(config)).toThrow('base URL');
  });

  it('throws without model', () => {
    const config: ProviderConfig = { id: '4', name: 'Custom', type: 'custom', model: '', baseUrl: 'http://localhost:3000', enabled: true, apiKey: 'test' };
    expect(() => new CustomOpenAIProvider(config)).toThrow('model');
  });
});

describe('OpenAI parseStreamChunk', () => {
  it('emits delta content', () => {
    const config: ProviderConfig = { id: '1', name: 'OpenAI', type: 'openai', model: 'gpt-4o', enabled: true, apiKey: 'sk-test' };
    const provider = new OpenAIProvider(config);
    const events: StreamEvent[] = [];
    provider['parseStreamChunk'](
      JSON.stringify({ choices: [{ delta: { content: 'Hello' } }] }),
      { emit: (e) => events.push(e) }
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'delta', content: 'Hello' });
  });

  it('emits usage', () => {
    const config: ProviderConfig = { id: '1', name: 'OpenAI', type: 'openai', model: 'gpt-4o', enabled: true, apiKey: 'sk-test' };
    const provider = new OpenAIProvider(config);
    const events: StreamEvent[] = [];
    provider['parseStreamChunk'](
      JSON.stringify({ choices: [{ delta: {} }], usage: { prompt_tokens: 10, completion_tokens: 20 } }),
      { emit: (e) => events.push(e) }
    );
    const usage = events.find((e) => e.type === 'usage');
    expect(usage).toEqual({ type: 'usage', promptTokens: 10, completionTokens: 20 });
  });

  it('emits done on finish_reason', () => {
    const config: ProviderConfig = { id: '1', name: 'OpenAI', type: 'openai', model: 'gpt-4o', enabled: true, apiKey: 'sk-test' };
    const provider = new OpenAIProvider(config);
    const events: StreamEvent[] = [];
    provider['parseStreamChunk'](
      JSON.stringify({ choices: [{ finish_reason: 'stop' }] }),
      { emit: (e) => events.push(e) }
    );
    const done = events.find((e) => e.type === 'done');
    expect(done).toEqual({ type: 'done', finishReason: 'stop' });
  });

  it('ignores malformed JSON', () => {
    const config: ProviderConfig = { id: '1', name: 'OpenAI', type: 'openai', model: 'gpt-4o', enabled: true, apiKey: 'sk-test' };
    const provider = new OpenAIProvider(config);
    const events: StreamEvent[] = [];
    provider['parseStreamChunk']('not json', { emit: (e) => events.push(e) });
    expect(events).toHaveLength(0);
  });
});

describe('Anthropic parseStreamChunk', () => {
  it('emits delta text', () => {
    const config: ProviderConfig = { id: '2', name: 'Claude', type: 'anthropic', model: 'claude-3-5-sonnet', enabled: true, apiKey: 'test' };
    const provider = new AnthropicProvider(config);
    const events: StreamEvent[] = [];
    provider['parseStreamChunk'](
      JSON.stringify({ type: 'content_block_delta', delta: { text: 'Hello' } }),
      { emit: (e) => events.push(e) }
    );
    expect(events[0]).toEqual({ type: 'delta', content: 'Hello' });
  });

  it('emits message_stop', () => {
    const config: ProviderConfig = { id: '2', name: 'Claude', type: 'anthropic', model: 'claude-3-5-sonnet', enabled: true, apiKey: 'test' };
    const provider = new AnthropicProvider(config);
    const events: StreamEvent[] = [];
    provider['parseStreamChunk'](
      JSON.stringify({ type: 'message_stop' }),
      { emit: (e) => events.push(e) }
    );
    expect(events[0]).toEqual({ type: 'done', finishReason: 'stop' });
  });
});

describe('Gemini parseStreamChunk', () => {
  it('emits delta text', () => {
    const config: ProviderConfig = { id: '3', name: 'Gemini', type: 'gemini', model: 'gemini-1.5-pro', enabled: true, apiKey: 'test' };
    const provider = new GeminiProvider(config);
    const events: StreamEvent[] = [];
    provider['parseStreamChunk'](
      JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Hello' }] } }] }),
      { emit: (e) => events.push(e) }
    );
    expect(events[0]).toEqual({ type: 'delta', content: 'Hello' });
  });

  it('emits usage metadata', () => {
    const config: ProviderConfig = { id: '3', name: 'Gemini', type: 'gemini', model: 'gemini-1.5-pro', enabled: true, apiKey: 'test' };
    const provider = new GeminiProvider(config);
    const events: StreamEvent[] = [];
    provider['parseStreamChunk'](
      JSON.stringify({ usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 } }),
      { emit: (e) => events.push(e) }
    );
    const usage = events.find((e) => e.type === 'usage');
    expect(usage).toEqual({ type: 'usage', promptTokens: 10, completionTokens: 20 });
  });
});
