// ==================== Messaging Constants ====================

export const MESSAGE_TYPES = {
  CAPTURE_PAGE: 'CAPTURE_PAGE',
  CAPTURE_COMPLETE: 'CAPTURE_COMPLETE',
  START_CHAT: 'START_CHAT',
  CHAT_MESSAGE: 'CHAT_MESSAGE',
  CHAT_STREAM: 'CHAT_STREAM',
  SEARCH_QUERY: 'SEARCH_QUERY',
  SEARCH_RESULTS: 'SEARCH_RESULTS',
  SYNC_UPLOAD: 'SYNC_UPLOAD',
  SYNC_DOWNLOAD: 'SYNC_DOWNLOAD',
  SYNC_STATUS: 'SYNC_STATUS',
  OPEN_SIDE_PANEL: 'OPEN_SIDE_PANEL',
  GET_CURRENT_DOCUMENT: 'GET_CURRENT_DOCUMENT',
  GET_DOCUMENTS: 'GET_DOCUMENTS',
  DELETE_DOCUMENT: 'DELETE_DOCUMENT',
  UPDATE_DOCUMENT: 'UPDATE_DOCUMENT',
  PING: 'PING',
  PONG: 'PONG',
} as const;

export const MESSAGE_TIMEOUT = 30000; // 30 seconds
export const MAX_RETRIES = 3;

// ==================== Storage Keys ====================

export const STORAGE_KEYS = {
  DOCUMENTS: 'ai_reader_documents',
  CHAT_SESSIONS: 'ai_reader_chat_sessions',
  MODELS: 'ai_reader_models',
  SETTINGS: 'ai_reader_settings',
  WEBDAV: 'ai_reader_webdav',
  SEARCH_INDEX: 'ai_reader_search_index',
  SYNC_STATUS: 'ai_reader_sync_status',
} as const;

// ==================== Default Values ====================

export const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI reading assistant. You help users understand and analyze web content. You can summarize articles, answer questions, extract key information, and provide insights based on the content.`;

export const DEFAULT_SETTINGS = {
  theme: 'auto' as const,
  language: 'zh-CN',
  autoCapture: false,
  showFloatingButton: true,
  floatingButtonPosition: 'bottom-right' as const,
  sidePanelWidth: 400,
  defaultSystemPrompt: DEFAULT_SYSTEM_PROMPT,
};

// ==================== Limits ====================

export const MAX_DOCUMENTS = 10000;
export const MAX_CHAT_HISTORY = 100;
export const MAX_MESSAGE_LENGTH = 10000;
export const SEARCH_RESULTS_LIMIT = 50;
export const SYNC_INTERVAL_MINUTES = 30;

// ==================== UI Constants ====================

export const SIDE_PANEL_MIN_WIDTH = 320;
export const SIDE_PANEL_MAX_WIDTH = 800;
export const FLOATING_BUTTON_SIZE = 48;
export const TOAST_DURATION = 3000;

// ==================== Default Models ====================

/**
 * Seed models for first run. Each entry is the source of truth
 * for the model repository's `seedDefaults()` helper. They are
 * marked `enabled: true` and the first one carries `isDefault:
 * true` so the model selector has somewhere to start.
 */
export const DEFAULT_MODELS = [
  {
    id: 'mimo-v2.5-pro',
    name: 'mimo-v2.5-pro',
    provider: 'openai-compatible' as const,
    enabled: true,
    apiKey: 'sk-0FeSEKHeEIobWQYM3arOlSmfd8zbbPE1bhx6gofle9deZxkx',
    baseUrl: 'http://66.154.117.189:3000/v1',
    model: 'mimo-v2.5-pro',
    isDefault: true,
  },
  {
    id: 'claude-sonnet',
    name: 'Claude Sonnet',
    provider: 'openai-compatible' as const,
    enabled: true,
    apiKey: '',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-3-5-sonnet-20241022',
  },
  {
    id: 'gemini-pro',
    name: 'Gemini Pro',
    provider: 'openai-compatible' as const,
    enabled: true,
    apiKey: '',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-1.5-pro',
  },
  {
    id: 'deepseek-v3',
    name: 'DeepSeek V3',
    provider: 'openai-compatible' as const,
    enabled: true,
    apiKey: '',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  },
];

// ==================== Model Providers ====================

export const BUILTIN_PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiKeyRequired: true,
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-4o-mini',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    apiKeyRequired: true,
    models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
    defaultModel: 'claude-3-5-sonnet-20241022',
  },
  {
    id: 'google',
    name: 'Google AI',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    apiKeyRequired: true,
    models: ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    defaultModel: 'gemini-2.0-flash-exp',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKeyRequired: true,
    models: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'google/gemini-2.0-flash-exp'],
    defaultModel: 'openai/gpt-4o',
  },
  {
    id: 'custom',
    name: 'Custom',
    baseUrl: '',
    apiKeyRequired: true,
    models: [],
    defaultModel: '',
  },
] as const;
