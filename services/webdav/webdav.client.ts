import { createClient, type WebDAVClient } from 'webdav/web'
import type { WebDAVConfig } from '@/types/sync'

export interface ConnectionTestResult {
  ok: boolean
  error?: string
}

export interface WebDAVRemote {
  /** Probe + ensure the base directory exists. */
  test(): Promise<ConnectionTestResult>
  hasData(): Promise<boolean>
  putText(path: string, text: string): Promise<void>
  getText(path: string): Promise<string>
  remove(path: string): Promise<void>
}

export function normalizeBasePath(path: string): string {
  let p = (path || '').trim() || '/auramind'
  if (!p.startsWith('/')) p = '/' + p
  return p.replace(/\/+$/, '')
}

export function createWebDAVRemote(cfg: WebDAVConfig): WebDAVRemote {
  const client: WebDAVClient = createClient(cfg.url, {
    username: cfg.username,
    password: cfg.password,
  })
  const base = normalizeBasePath(cfg.basePath)

  return {
    async test() {
      try {
        if (!(await client.exists(base))) {
          await client.createDirectory(base, { recursive: true })
        }
        return { ok: true }
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) }
      }
    },
    async hasData() {
      try {
        return await client.exists(`${base}/data.json`)
      } catch {
        return false
      }
    },
    async putText(path, text) {
      await client.putFileContents(`${base}/${path}`, text, { overwrite: true })
    },
    async getText(path) {
      const data = await client.getFileContents(`${base}/${path}`, { format: 'text' })
      return typeof data === 'string' ? data : new TextDecoder().decode(data)
    },
    async remove(path) {
      try {
        await client.deleteFile(`${base}/${path}`)
      } catch {
        // best-effort
      }
    },
  }
}
