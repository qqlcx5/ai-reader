/**
 * 安全的密钥存储
 * 参考 doc/tasks/model-management.md 章节 3
 * 使用 chrome.storage.local 存储 API Key（不要用 storage.sync 避免跨设备同步泄露）
 */
const SECRET_PREFIX = 'secret::';

/**
 * 存储秘密
 */
export async function setSecret(key: string, value: string): Promise<void> {
  await chrome.storage.local.set({ [`${SECRET_PREFIX}${key}`]: value });
}

/**
 * 读取秘密
 */
export async function getSecret(key: string): Promise<string | undefined> {
  const result = await chrome.storage.local.get(`${SECRET_PREFIX}${key}`);
  const value = result[`${SECRET_PREFIX}${key}`];
  return typeof value === 'string' ? value : undefined;
}

/**
 * 删除秘密
 */
export async function deleteSecret(key: string): Promise<void> {
  await chrome.storage.local.remove(`${SECRET_PREFIX}${key}`);
}

/**
 * 列出所有秘密的 key
 */
export async function listSecretKeys(): Promise<string[]> {
  const all = await chrome.storage.local.get();
  return Object.keys(all)
    .filter((k) => k.startsWith(SECRET_PREFIX))
    .map((k) => k.slice(SECRET_PREFIX.length));
}

/**
 * 简单的 XOR 编码（仅用于避免明文出现在 UI，并非真正加密）
 * 真正安全应该用 crypto.subtle + 用户密码
 */
const ENCODE_KEY = 'readchat-static-key-v1';

export function lightEncode(text: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(
      text.charCodeAt(i) ^ ENCODE_KEY.charCodeAt(i % ENCODE_KEY.length)
    );
  }
  return btoa(unescape(encodeURIComponent(result)));
}

export function lightDecode(encoded: string): string {
  try {
    const text = decodeURIComponent(escape(atob(encoded)));
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(
        text.charCodeAt(i) ^ ENCODE_KEY.charCodeAt(i % ENCODE_KEY.length)
      );
    }
    return result;
  } catch {
    return '';
  }
}
