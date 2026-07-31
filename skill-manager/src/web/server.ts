import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig } from '../core/config.js'
import { exportEnabledSkills, filterSkills } from '../core/skill-catalog.js'
import { readCatalog, writeCatalog } from '../core/skill-sync.js'

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const config = loadConfig(resolve(root, 'config/sources.json'))
const dataDirectory = resolve(root, config.source.dataDirectory)
const staticDirectory = resolve(root, 'web-dist')
const port = Number(process.env.PORT ?? 4173)

const server = createServer(async (request, response) => {
  try {
    await handleRequest(request, response)
  } catch (error) {
    sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) })
  }
})

server.listen(port, () => {
  console.log(`Skill Manager Web: http://localhost:${port}`)
})

async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)

  if (url.pathname === '/api/catalog' && request.method === 'GET') {
    const catalog = await readCatalog(dataDirectory)
    const query = url.searchParams.get('q') ?? undefined
    const category = url.searchParams.get('category') ?? undefined
    const enabled = parseBoolean(url.searchParams.get('enabled'))
    const favorite = parseBoolean(url.searchParams.get('favorite'))
    sendJson(response, 200, {
      ...catalog,
      skills: filterSkills(catalog.skills, { query, category, enabled, favorite }),
    })
    return
  }

  if (url.pathname === '/api/catalog' && request.method === 'PUT') {
    const catalog = await readBody(request)
    await writeCatalog(dataDirectory, catalog)
    sendJson(response, 200, catalog)
    return
  }

  if (url.pathname === '/api/export' && request.method === 'POST') {
    const catalog = await readCatalog(dataDirectory)
    const output = await exportEnabledSkills(catalog, join(dataDirectory, 'enabled-skills.json'))
    sendJson(response, 200, { exported: output.skills.length })
    return
  }

  if (url.pathname.startsWith('/api/content/') && request.method === 'GET') {
    const id = url.pathname.slice('/api/content/'.length)
    if (!/^[a-zA-Z0-9._-]+$/.test(id)) {
      sendJson(response, 400, { error: 'Invalid Skill ID' })
      return
    }
    const content = await readFile(join(dataDirectory, 'content', `${id}.md`), 'utf8')
    response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end(content)
    return
  }

  await serveStatic(url.pathname, response)
}

async function serveStatic(pathname: string, response: ServerResponse): Promise<void> {
  const requested = pathname === '/' ? '/index.html' : pathname
  const filePath = resolve(staticDirectory, `.${requested}`)
  if (!filePath.startsWith(staticDirectory)) {
    sendJson(response, 400, { error: 'Invalid path' })
    return
  }

  try {
    const content = await readFile(filePath)
    response.writeHead(200, { 'Content-Type': contentType(extname(filePath)) })
    response.end(content)
  } catch {
    const fallback = await readFile(join(staticDirectory, 'index.html'))
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    response.end(fallback)
  }
}

async function readBody(request: IncomingMessage): Promise<any> {
  let body = ''
  for await (const chunk of request) {
    body += chunk
  }
  return JSON.parse(body)
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(value))
}

function parseBoolean(value: string | null): boolean | undefined {
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}

function contentType(extension: string): string {
  if (extension === '.js') return 'text/javascript; charset=utf-8'
  if (extension === '.css') return 'text/css; charset=utf-8'
  return 'text/html; charset=utf-8'
}
