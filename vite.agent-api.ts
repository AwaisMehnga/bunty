import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const DEFAULT_UPSTREAM = 'https://api.openai.com/v1'
const PROXY_PLACEHOLDER = 'proxy'
const BASE_URL_HEADER = 'x-llm-base-url'

export type AgentApiOptions = {
  llmBaseUrl?: string
  llmApiKey?: string
}

async function readUrl(req: IncomingMessage): Promise<URL> {
  const host = req.headers.host ?? 'localhost'
  return new URL(req.url ?? '/', `http://${host}`)
}

function send(res: ServerResponse, status: number, body: string, type = 'text/plain; charset=utf-8') {
  res.statusCode = status
  res.setHeader('Content-Type', type)
  res.end(body)
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function htmlToMarkdownLite(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

async function readBody(req: IncomingMessage): Promise<Buffer | undefined> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  if (chunks.length === 0) return undefined
  return Buffer.concat(chunks)
}

function resolveUpstreamBase(req: IncomingMessage, options: AgentApiOptions): string | { error: string } {
  const headerRaw = req.headers[BASE_URL_HEADER]
  const fromHeader = typeof headerRaw === 'string' ? headerRaw : Array.isArray(headerRaw) ? headerRaw[0] : ''
  const raw = normalizeBaseUrl(fromHeader || options.llmBaseUrl || DEFAULT_UPSTREAM)

  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return { error: 'invalid upstream base URL' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { error: 'only http/https upstream allowed' }
  }
  return normalizeBaseUrl(raw)
}

function resolveAuthorization(req: IncomingMessage, options: AgentApiOptions): string | undefined {
  const incoming = req.headers.authorization
  if (typeof incoming === 'string') {
    const token = incoming.replace(/^Bearer\s+/i, '').trim()
    if (token && token !== PROXY_PLACEHOLDER) {
      return incoming.startsWith('Bearer ') ? incoming : `Bearer ${token}`
    }
  }
  const key = options.llmApiKey?.trim()
  return key ? `Bearer ${key}` : undefined
}

async function proxyLlmRequest(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  options: AgentApiOptions,
): Promise<boolean> {
  const isLlm = url.pathname === '/api/llm' || url.pathname.startsWith('/api/llm/')
  const isOpenaiAlias = url.pathname === '/api/openai' || url.pathname.startsWith('/api/openai/')
  if (!isLlm && !isOpenaiAlias) return false

  const prefix = isLlm ? '/api/llm' : '/api/openai'
  const suffix = url.pathname.slice(prefix.length) || ''

  const upstreamBase = resolveUpstreamBase(req, options)
  if (typeof upstreamBase === 'object') {
    send(res, 400, upstreamBase.error)
    return true
  }

  const target = `${upstreamBase}${suffix}${url.search}`
  const body = req.method !== 'GET' && req.method !== 'HEAD' ? await readBody(req) : undefined
  const authorization = resolveAuthorization(req, options)

  const headers: Record<string, string> = {
    Accept: typeof req.headers.accept === 'string' ? req.headers.accept : 'application/json',
  }
  if (req.headers['content-type']) {
    headers['Content-Type'] = String(req.headers['content-type'])
  } else if (body) {
    headers['Content-Type'] = 'application/json'
  }
  if (authorization) headers.Authorization = authorization

  const upstream = await fetch(target, {
    method: req.method,
    headers,
    body,
    redirect: 'follow',
  })

  res.statusCode = upstream.status
  const contentType = upstream.headers.get('content-type')
  if (contentType) res.setHeader('Content-Type', contentType)
  const cacheControl = upstream.headers.get('cache-control')
  if (cacheControl) res.setHeader('Cache-Control', cacheControl)

  if (!upstream.body) {
    res.end()
    return true
  }

  const nodeStream = Readable.fromWeb(upstream.body as import('node:stream/web').ReadableStream)
  await pipeline(nodeStream, res)
  return true
}

function attachMiddleware(
  middlewares: { use: (fn: (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => void) => void },
  options: AgentApiOptions,
) {
  middlewares.use(async (req, res, next) => {
    try {
      if (!req.url) return next()
      const url = await readUrl(req)

      if (await proxyLlmRequest(req, res, url, options)) return

      if (url.pathname === '/api/fetch') {
        const target = url.searchParams.get('url')
        const format = url.searchParams.get('format') || 'markdown'
        if (!target) return send(res, 400, 'url required')
        let href = target
        if (href.startsWith('http://')) href = `https://${href.slice(7)}`
        if (!href.startsWith('https://')) return send(res, 400, 'only https allowed')

        const upstream = await fetch(href, {
          headers: { 'User-Agent': 'react-agent/1.0' },
          redirect: 'follow',
        })
        const raw = await upstream.text()
        if (!upstream.ok) return send(res, upstream.status, raw.slice(0, 2000))

        if (format === 'html') return send(res, 200, raw, 'text/html; charset=utf-8')
        if (format === 'text') return send(res, 200, htmlToText(raw))
        return send(res, 200, htmlToMarkdownLite(raw))
      }

      if (url.pathname === '/api/search') {
        const q = url.searchParams.get('q')
        if (!q) return send(res, 400, 'q required')
        const ddg = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`
        const upstream = await fetch(ddg, { headers: { 'User-Agent': 'react-agent/1.0' } })
        const text = await upstream.text()
        return send(res, upstream.status, text, 'application/json; charset=utf-8')
      }

      return next()
    } catch (error) {
      if (!res.headersSent) {
        return send(res, 500, error instanceof Error ? error.message : String(error))
      }
      res.end()
    }
  })
}

export function agentApiPlugin(options: AgentApiOptions = {}): Plugin {
  return {
    name: 'react-agent-api',
    configureServer(server) {
      attachMiddleware(server.middlewares, options)
    },
    configurePreviewServer(server) {
      attachMiddleware(server.middlewares, options)
    },
  }
}
