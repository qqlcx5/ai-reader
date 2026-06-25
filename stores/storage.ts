/**
 * Chrome storage 工具
 * 参考 doc/tasks/foundation.md 章节 4
 * 参考 doc/tasks/persistence.md 章节 1
 *
 * ⚠️ chrome-extensions 规则 #7：SW 是 ephemeral，不能使用全局变量
 *  - 长期状态用 chrome.storage.local
 *  - 临时状态用 chrome.storage.session（SW 重启后保留，浏览器关闭后清除）
 */

const PREFIX = 'readchat::';

export async function getLocal<T>(key: string): Promise<T | undefined> {
  const result = await chrome.storage.local.get(`${PREFIX}${key}`);
  return result[`${PREFIX}${key}`] as T | undefined;
}

export async function setLocal<T>(key: string, value: T): Promise<void> {
  await chrome.storage.local.set({ [`${PREFIX}${key}`]: value });
}

export async function removeLocal(key: string): Promise<void> {
  await chrome.storage.local.remove(`${PREFIX}${key}`);
}

export async function getSession<T>(key: string): Promise<T | undefined> {
  const result = await chrome.storage.session.get(`${PREFIX}${key}`);
  return result[`${PREFIX}${key}`] as T | undefined;
}

export async function setSession<T>(key: string, value: T): Promise<void> {
  await chrome.storage.session.set({ [`${PREFIX}${key}`]: value });
}

/**
 * 监听变化
 */
export function watchLocal<T>(
  key: string,
  callback: (newValue: T | undefined) => void
): () => void {
  const listener = (
    changes: { [k: string]: chrome.storage.StorageChange },
    area: chrome.storage.AreaName
  ) => {
    if (area === 'local' && changes[`${PREFIX}${key}`]) {
      callback(changes[`${PREFIX}${key}`].newValue as T | undefined);
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
