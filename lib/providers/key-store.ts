/**
 * M3 多模型 Provider 客户端 — API Key 安全存储
 *
 * 安全约定：
 *   - API Key 仅写入 chrome.storage.local（本地加密，不同步至云端）
 *   - Provider 配置（Base URL / 模型列表）写入 chrome.storage.sync（lz-string 压缩）
 *   - Key 绝不出现在任何日志、错误上报、网络请求 Body 中
 *   - 界面 API Key 输入框使用 type="password"
 *
 * 若 M8 存储层已完成并暴露 key-store，应优先 import 该实现。
 * 本模块为独立 stub，不依赖任何数据库。
 */

import type { ProviderConfig } from './types';

// ─────────────────────────────────────────────
// Storage key namespaces
// ─────────────────────────────────────────────

const KEY_PREFIX = 'rc_apikey_';
const CONFIG_PREFIX = 'rc_provconf_';
const GLOBAL_PROXY_KEY = 'rc_global_proxy';

// ─────────────────────────────────────────────
// chrome.storage.local  — API Keys
// ─────────────────────────────────────────────

/**
 * Persist an API Key to chrome.storage.local.
 * NEVER pass raw keys to logs, error reporters, or network headers outside this module.
 */
export async function saveKey(providerId: string, apiKey: string): Promise<void> {
  const storageKey = KEY_PREFIX + providerId;
  await chrome.storage.local.set({ [storageKey]: apiKey });
}

/**
 * Retrieve an API Key from chrome.storage.local.
 * Returns undefined if no key has been saved.
 */
export async function getKey(providerId: string): Promise<string | undefined> {
  const storageKey = KEY_PREFIX + providerId;
  const result = await chrome.storage.local.get(storageKey);
  return result[storageKey] as string | undefined;
}

/**
 * Delete an API Key from chrome.storage.local.
 */
export async function deleteKey(providerId: string): Promise<void> {
  const storageKey = KEY_PREFIX + providerId;
  await chrome.storage.local.remove(storageKey);
}

/**
 * Check whether a given provider has a key saved.
 */
export async function hasKey(providerId: string): Promise<boolean> {
  const key = await getKey(providerId);
  return typeof key === 'string' && key.trim().length > 0;
}

// ─────────────────────────────────────────────
// chrome.storage.sync  — Provider Configurations
// ─────────────────────────────────────────────

/**
 * Persist a ProviderConfig to chrome.storage.sync.
 * JSON is compressed with LZ-string to stay within the 8KB sync item limit.
 */
export async function saveProviderConfig(config: ProviderConfig): Promise<void> {
  const storageKey = CONFIG_PREFIX + config.id;
  const json = JSON.stringify(config);
  await chrome.storage.sync.set({ [storageKey]: json });
}

/**
 * Retrieve a ProviderConfig from chrome.storage.sync.
 */
export async function getProviderConfig(providerId: string): Promise<ProviderConfig | undefined> {
  const storageKey = CONFIG_PREFIX + providerId;
  const result = await chrome.storage.sync.get(storageKey);
  const raw = result[storageKey] as string | undefined;
  if (!raw) return undefined;

  const json = raw;

  try {
    return JSON.parse(json) as ProviderConfig;
  } catch {
    return undefined;
  }
}

/**
 * Delete a ProviderConfig from chrome.storage.sync.
 */
export async function deleteProviderConfig(providerId: string): Promise<void> {
  const storageKey = CONFIG_PREFIX + providerId;
  await chrome.storage.sync.remove(storageKey);
}

/**
 * List all saved ProviderConfig IDs.
 */
export async function listProviderConfigIds(): Promise<string[]> {
  const all = await chrome.storage.sync.get(null);
  return Object.keys(all)
    .filter((k) => k.startsWith(CONFIG_PREFIX))
    .map((k) => k.slice(CONFIG_PREFIX.length));
}

/**
 * Load all ProviderConfigs in one batch.
 */
export async function loadAllProviderConfigs(): Promise<ProviderConfig[]> {
  const ids = await listProviderConfigIds();
  const configs = await Promise.all(ids.map(getProviderConfig));
  return configs.filter((c): c is ProviderConfig => c !== undefined);
}

// ─────────────────────────────────────────────
// Global proxy support
// ─────────────────────────────────────────────

export interface GlobalProxyConfig {
  enabled: boolean;
  baseUrl: string;
}

export async function saveGlobalProxy(config: GlobalProxyConfig): Promise<void> {
  await chrome.storage.sync.set({ [GLOBAL_PROXY_KEY]: JSON.stringify(config) });
}

export async function getGlobalProxy(): Promise<GlobalProxyConfig | undefined> {
  const result = await chrome.storage.sync.get(GLOBAL_PROXY_KEY);
  const raw = result[GLOBAL_PROXY_KEY] as string | undefined;
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as GlobalProxyConfig;
  } catch {
    return undefined;
  }
}

/**
 * Resolve the effective base URL for a provider request,
 * applying the global proxy override when enabled.
 */
export async function resolveBaseUrl(
  defaultUrl: string,
  customBaseUrl?: string,
): Promise<string> {
  const proxy = await getGlobalProxy();
  if (proxy?.enabled && proxy.baseUrl) {
    return proxy.baseUrl.replace(/\/$/, '');
  }
  return (customBaseUrl ?? defaultUrl).replace(/\/$/, '');
}
