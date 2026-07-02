import { AwsClient } from 'aws4fetch'
import type { S3Config } from '@/types/s3'

export interface ConnectionTestResult {
  ok: boolean
  error?: string
}

export interface S3Remote {
  /** Probe bucket accessibility + base path reachability. */
  test(): Promise<ConnectionTestResult>
  hasData(): Promise<boolean>
  putText(path: string, text: string): Promise<void>
  getText(path: string): Promise<string>
  remove(path: string): Promise<void>
  /** Names of files under the base path (best-effort, never throws). */
  listFiles(): Promise<string[]>
}

export function normalizeBasePath(path: string): string {
  let p = (path || '').trim() || '/auramind'
  if (!p.startsWith('/')) p = '/' + p
  return p.replace(/\/+$/, '')
}

export function createS3Remote(cfg: S3Config): S3Remote {
  const client = new AwsClient({
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    region: cfg.region || 'us-east-1',
    service: 's3',
  })
  const Bucket = cfg.bucket
  const basePath = normalizeBasePath(cfg.basePath).replace(/^\//, '')
  const forcePathStyle = cfg.forcePathStyle ?? true

  function resourceUrl(key: string): string {
    const endpoint = cfg.endpoint.replace(/\/+$/, '')
    if (forcePathStyle) {
      // Path-style: https://{endpoint}/{bucket}/{key}
      return `${endpoint}/${Bucket}${key ? '/' + key : ''}`
    }
    // Virtual-hosted-style: https://{bucket}.{endpoint}/{key}
    const u = new URL(endpoint)
    return `${u.protocol}//${Bucket}.${u.host}${u.pathname}${key ? '/' + key : ''}`
  }

  function key(relPath: string): string {
    return basePath ? `${basePath}/${relPath}` : relPath
  }

  return {
    async test() {
      try {
        const resp = await client.fetch(resourceUrl(''), { method: 'HEAD' })
        if (!resp.ok && resp.status !== 403) {
          // 403 = bucket exists but no permission; still ok for existence check
          return { ok: false, error: `HEAD bucket returned ${resp.status}` }
        }
        // Also verify the base path is accessible
        const prefixUrl = resourceUrl('') + (basePath ? `?list-type=2&prefix=${encodeURIComponent(basePath + '/')}&max-keys=1` : '?list-type=2&max-keys=1')
        const listResp = await client.fetch(prefixUrl)
        if (!listResp.ok && listResp.status !== 404) {
          return { ok: false, error: `LIST returned ${listResp.status}` }
        }
        return { ok: true }
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) }
      }
    },

    async hasData() {
      try {
        const resp = await client.fetch(resourceUrl(key('data.json')), { method: 'HEAD' })
        return resp.ok
      } catch {
        return false
      }
    },

    async putText(path, text) {
      const resp = await client.fetch(resourceUrl(key(path)), {
        method: 'PUT',
        body: text,
      })
      if (!resp.ok) {
        throw new Error(`PUT failed: ${resp.status}`)
      }
    },

    async getText(path) {
      const resp = await client.fetch(resourceUrl(key(path)))
      if (!resp.ok) {
        throw new Error(`GET failed: ${resp.status}`)
      }
      return resp.text()
    },

    async remove(path) {
      try {
        await client.fetch(resourceUrl(key(path)), { method: 'DELETE' })
      } catch {
        // best-effort
      }
    },

    async listFiles() {
      try {
        const names: string[] = []
        const Prefix = basePath ? `${basePath}/` : ''
        let continuationToken = ''
        do {
          const params = new URLSearchParams({ 'list-type': '2' })
          if (Prefix) params.set('prefix', Prefix)
          if (continuationToken) params.set('continuation-token', continuationToken)
          const resp = await client.fetch(resourceUrl('') + '?' + params.toString())
          if (!resp.ok) break
          const xml = await resp.text()
          const doc = new DOMParser().parseFromString(xml, 'text/xml')
          for (const keyEl of doc.querySelectorAll('Contents > Key')) {
            const k = keyEl.textContent || ''
            const name = Prefix ? k.slice(Prefix.length) : k
            if (name) names.push(name)
          }
          const truncated = doc.querySelector('IsTruncated')?.textContent === 'true'
          continuationToken = truncated ? (doc.querySelector('NextContinuationToken')?.textContent || '') : ''
        } while (continuationToken)
        return names
      } catch {
        return []
      }
    },
  }
}
