/**
 * M6 — WebDAV client wrapper.
 *
 * `webdav` v5 ships a browser build (`dist/web/index.js`) but only
 * publishes node typings. We dynamically import the module so the
 * typescript compiler doesn't pull in node-only types into the
 * main bundle, and we provide a narrow typed surface for our use
 * cases (upload a file, list a directory, ensure directory exists).
 */
import { WebDAVAuthError, type WebDAVOptions } from './types';

export interface WebDAVClient {
  putFileContents(
    path: string,
    data: string | Blob | ArrayBuffer,
    options?: { overwrite?: boolean },
  ): Promise<unknown>;
  getDirectoryContents(path: string): Promise<unknown>;
  createDirectory(path: string, options?: { recursive?: boolean }): Promise<unknown>;
  stat(path: string): Promise<unknown>;
}

let cachedModule: typeof import('webdav') | null = null;

async function loadModule(): Promise<typeof import('webdav')> {
  if (cachedModule) return cachedModule;
  // The `webdav` package's "browser" field routes to dist/web/index.js
  // during bundling; here we just import the default export.
  const mod = (await import('webdav' as string)) as typeof import('webdav');
  cachedModule = mod;
  return mod;
}

/**
 * Create a client and verify connectivity in one step.
 * Returns `true` if the server responded to a PROPFIND on `backupPath`.
 */
export async function testConnection(options: WebDAVOptions): Promise<boolean> {
  const client = createWebDAVClient(options);
  try {
    await client.stat(options.backupPath || '/');
    return true;
  } catch (err) {
    throw mapWebDAVError(err);
  }
}

export function createWebDAVClient(options: WebDAVOptions): WebDAVClient {
  // The factory is async; we expose a thin proxy that loads the module on
  // first use. This keeps the public surface synchronous for callers.
  let clientPromise: Promise<WebDAVClient> | null = null;
  const getClient = async (): Promise<WebDAVClient> => {
    if (clientPromise) return clientPromise;
    clientPromise = (async () => {
      const mod = await loadModule();
      // webdav 5.x createClient returns a `WebDAVClient` from the web bundle.
      const c = mod.createClient(options.url, {
        username: options.username,
        password: options.password,
      }) as unknown as WebDAVClient;
      return c;
    })();
    return clientPromise;
  };

  return {
    async putFileContents(path, data, opts) {
      const c = await getClient();
      try {
        return await c.putFileContents(path, data, opts);
      } catch (err) {
        throw mapWebDAVError(err);
      }
    },
    async getDirectoryContents(path) {
      const c = await getClient();
      return c.getDirectoryContents(path);
    },
    async createDirectory(path, opts) {
      const c = await getClient();
      return c.createDirectory(path, opts);
    },
    async stat(path) {
      const c = await getClient();
      return c.stat(path);
    },
  };
}

/**
 * Upload a markdown note under the configured backup path.
 * Creates intermediate directories if missing.
 */
export async function uploadNote(
  client: WebDAVClient,
  options: WebDAVOptions,
  filename: string,
  content: string,
): Promise<string> {
  const dateDir = new Date().toISOString().split('T')[0];
  const dir = joinPath(options.backupPath, dateDir);
  await ensureDir(client, dir);
  const remotePath = joinPath(dir, filename);
  await client.putFileContents(remotePath, content, { overwrite: true });
  return remotePath;
}

/**
 * Upload a full JSON backup under the configured backup path.
 *
 * When `backupPath` is empty, the file is placed at the WebDAV root
 * with no leading slash (so the returned path matches the bare
 * filename). Otherwise it is nested under `/<backupPath>/`.
 */
export async function uploadBackup(
  client: WebDAVClient,
  options: WebDAVOptions,
  json: string,
): Promise<string> {
  const date = new Date().toISOString().split('T')[0];
  const filename = `ai-reader-backup-${date}.json`;
  const dir = options.backupPath.replace(/^\/+|\/+$/g, '');
  const remotePath = dir ? `/${dir}/${filename}` : filename;
  await client.putFileContents(remotePath, json, { overwrite: true });
  return remotePath;
}

/** Recursively ensure a directory exists. */
export async function ensureDir(
  client: WebDAVClient,
  remotePath: string,
): Promise<void> {
  const parts = remotePath.split('/').filter(Boolean);
  let acc = '';
  for (const part of parts) {
    acc += `/${part}`;
    try {
      await client.stat(acc);
    } catch {
      try {
        await client.createDirectory(acc);
      } catch (err) {
        // If two callers race, one createDirectory will fail with 405; that's fine.
        if (!isAlreadyExists(err)) throw mapWebDAVError(err);
      }
    }
  }
}

function isAlreadyExists(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { status?: number; message?: string };
  return (
    e.status === 405 ||
    (typeof e.message === 'string' && /already exists/i.test(e.message))
  );
}

function mapWebDAVError(err: unknown): Error {
  if (!err || typeof err !== 'object') return err as Error;
  const e = err as { status?: number; message?: string };
  if (e.status === 401 || e.status === 403) {
    return new WebDAVAuthError(e.status);
  }
  return err as Error;
}

export function joinPath(...parts: string[]): string {
  return parts
    .filter((p) => p && p.length > 0)
    .join('/')
    .replace(/\/+/g, '/')
    .replace(/^\//, '/');
}
