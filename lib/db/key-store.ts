/**
 * M8 存储与数据层 — API Key 明文存储（chrome.storage.local）
 *
 * API Key 只存 chrome.storage.local，不写入 IndexedDB。
 * Key 格式：`apiKey:{providerId}`
 *
 * 注意：此文件仅在 Extension 环境下运行（background / content / popup）。
 * 单元测试环境需 mock chrome.storage.local。
 */

const KEY_PREFIX = 'apiKey:'
const PROVIDER_INDEX_KEY = 'apiKey:__index__'

function storageKey(providerId: string): string {
  return `${KEY_PREFIX}${providerId}`
}

/** 保存 API Key（覆盖） */
export async function saveKey(providerId: string, apiKey: string): Promise<void> {
  await chrome.storage.local.set({ [storageKey(providerId)]: apiKey })
  // 维护已配置 provider ID 索引
  const current = await listConfiguredProviders()
  if (!current.includes(providerId)) {
    await chrome.storage.local.set({ [PROVIDER_INDEX_KEY]: [...current, providerId] })
  }
}

/** 读取 API Key；未配置返回 null */
export async function getKey(providerId: string): Promise<string | null> {
  const result = await chrome.storage.local.get(storageKey(providerId))
  const value = result[storageKey(providerId)]
  return typeof value === 'string' && value.length > 0 ? value : null
}

/** 删除 API Key */
export async function deleteKey(providerId: string): Promise<void> {
  await chrome.storage.local.remove(storageKey(providerId))
  // 从索引中移除
  const current = await listConfiguredProviders()
  await chrome.storage.local.set({
    [PROVIDER_INDEX_KEY]: current.filter((id) => id !== providerId),
  })
}

/** 列出所有已配置 API Key 的 Provider ID */
export async function listConfiguredProviders(): Promise<string[]> {
  const result = await chrome.storage.local.get(PROVIDER_INDEX_KEY)
  const index = result[PROVIDER_INDEX_KEY]
  return Array.isArray(index) ? (index as string[]) : []
}

/** 检查指定 Provider 是否已配置 API Key */
export async function hasKey(providerId: string): Promise<boolean> {
  const key = await getKey(providerId)
  return key !== null
}
