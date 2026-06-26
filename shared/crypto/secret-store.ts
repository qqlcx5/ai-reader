const STORAGE_PREFIX = 'readchat_';

export async function getSecret(key: string): Promise<string | null> {
  const fullKey = `${STORAGE_PREFIX}secret_${key}`;
  const result = await chrome.storage.local.get(fullKey);
  return (result[fullKey] as string) ?? null;
}

export async function setSecret(key: string, value: string): Promise<void> {
  const fullKey = `${STORAGE_PREFIX}secret_${key}`;
  await chrome.storage.local.set({ [fullKey]: value });
}

export async function removeSecret(key: string): Promise<void> {
  const fullKey = `${STORAGE_PREFIX}secret_${key}`;
  await chrome.storage.local.remove(fullKey);
}
