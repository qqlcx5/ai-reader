/**
 * WebDAV 客户端
 * 参考 doc/tasks/sync.md 章节 3, 4
 * 最小依赖实现：原生 fetch + Basic Auth
 */
export interface WebdavConfig {
  webdavUrl: string;
  webdavUsername: string;
  webdavPassword: string;
  webdavRemoteDir: string;
}

export interface WebdavTestResult {
  success: boolean;
  message: string;
}

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

function authHeader(config: WebdavConfig): string {
  return 'Basic ' + btoa(`${config.webdavUsername}:${config.webdavPassword}`);
}

/**
 * 测试连接
 */
export async function testWebdavConnection(config: WebdavConfig): Promise<WebdavTestResult> {
  try {
    // 1. PROPFIND 根目录
    const root = joinUrl(config.webdavUrl, '/');
    const res = await fetch(root, {
      method: 'PROPFIND',
      headers: {
        Authorization: authHeader(config),
        Depth: '0',
        'Content-Type': 'application/xml',
      },
    });
    if (!res.ok) {
      return { success: false, message: `连接失败：HTTP ${res.status}` };
    }
    // 2. MKCOL 远程目录
    const dir = joinUrl(config.webdavUrl, `/${config.webdavRemoteDir}`);
    const mkcol = await fetch(dir, {
      method: 'MKCOL',
      headers: { Authorization: authHeader(config) },
    });
    // 405 Method Not Allowed 表示已存在
    if (!mkcol.ok && mkcol.status !== 405) {
      return { success: false, message: `创建目录失败：HTTP ${mkcol.status}` };
    }
    return { success: true, message: '✅ 连接成功' };
  } catch (err) {
    return {
      success: false,
      message: `❌ 错误：${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * 上传文件
 */
export async function putFile(
  config: WebdavConfig,
  path: string,
  data: string | Blob
): Promise<void> {
  const url = joinUrl(config.webdavUrl, `/${config.webdavRemoteDir}/${path}`);
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: authHeader(config),
      'Content-Type': 'application/json',
    },
    body: data,
  });
  if (!res.ok && res.status !== 201 && res.status !== 204) {
    throw new Error(`Upload failed: HTTP ${res.status}`);
  }
}

/**
 * 下载文件
 */
export async function getFile(
  config: WebdavConfig,
  path: string
): Promise<string | null> {
  const url = joinUrl(config.webdavUrl, `/${config.webdavRemoteDir}/${path}`);
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: authHeader(config) },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Download failed: HTTP ${res.status}`);
  }
  return res.text();
}

/**
 * 列举目录
 * 返回文件名数组
 */
export async function listFiles(
  config: WebdavConfig,
  dir: string = ''
): Promise<string[]> {
  const url = joinUrl(config.webdavUrl, `/${config.webdavRemoteDir}/${dir}`);
  const res = await fetch(url, {
    method: 'PROPFIND',
    headers: {
      Authorization: authHeader(config),
      Depth: '1',
    },
  });
  if (!res.ok) return [];
  const text = await res.text();
  // 简单解析：提取 <D:href> 标签
  const matches = text.match(/<[a-z]+:href>([^<]+)<\/[a-z]+:href>/gi) || [];
  const hrefs = matches
    .map((m) => m.replace(/<[^>]+>/g, ''))
    .filter((h) => h && !h.endsWith('/'));
  return hrefs.map((h) => decodeURIComponent(h.split('/').pop() || ''));
}
