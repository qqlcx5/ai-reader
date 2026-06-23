/**
 * M4 Arena 多模型并发调度器
 *
 * 接收已勾选 Provider 列表（1～4 个），为每个 Provider 创建独立 AbortController，
 * 并发调用 IEngine.chatStream()，互不阻塞，向每个 Provider 分发独立回调。
 */

import type { IEngine, ChatStreamOptions, RequestMetrics, ProviderError } from '@/lib/providers/types'
import { getKey } from '@/lib/db/key-store'
import { getEngine } from '@/lib/providers/registry'

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

export interface ArenaProviderConfig {
  /** 引擎 ID（与 registry 注册 id 一致） */
  engineId: string
  /** 显示名称 */
  name: string
  /** 模型标识（如 "gpt-4o"） */
  model: string
  /** 自定义 base URL（代理支持） */
  customBaseUrl?: string
  /** 额外参数（temperature、top_p 等） */
  parameters?: Record<string, unknown>
}

export interface ArenaMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ArenaCallbacks {
  /** 每个 Provider 收到新增量文本时触发 */
  onDelta: (engineId: string, delta: string) => void
  /** 流式结束后收到完整指标时触发 */
  onMetrics: (engineId: string, metrics: RequestMetrics) => void
  /** 非致命 / 致命错误时触发 */
  onError: (engineId: string, err: ProviderError) => void
  /** 状态变化（streaming → done / error / aborted） */
  onStatus?: (engineId: string, status: 'streaming' | 'done' | 'error' | 'aborted') => void
}

export interface ArenaRequest {
  providers: ArenaProviderConfig[]
  messages: ArenaMessage[]
  callbacks: ArenaCallbacks
}

export interface ArenaResult {
  engineId: string
  status: 'done' | 'error' | 'aborted'
  metrics: RequestMetrics | null
  error?: ProviderError
}

// ─── 调度器实现 ────────────────────────────────────────────────────────────────

/** 全局 AbortController 注册表，key = engineId */
const _controllers = new Map<string, AbortController>()

/**
 * 中止所有当前运行的 Arena 请求（全局 ABORT_ALL）。
 */
export function abortAll(reason = 'USER_ABORT'): void {
  for (const [, ctrl] of _controllers) {
    ctrl.abort(reason)
  }
  _controllers.clear()
}

/**
 * 中止单个 Provider 的请求。
 */
export function abortProvider(engineId: string, reason = 'USER_ABORT'): void {
  const ctrl = _controllers.get(engineId)
  if (ctrl) {
    ctrl.abort(reason)
    _controllers.delete(engineId)
  }
}

/**
 * 并发启动 1～4 个 Provider 的 chatStream 请求。
 * 返回 Promise<ArenaResult[]>，所有 Provider 完成/失败后 resolve。
 */
export async function runArena(req: ArenaRequest): Promise<ArenaResult[]> {
  const { providers, messages, callbacks } = req

  if (providers.length === 0) return []
  const limited = providers.slice(0, 4)

  const tasks = limited.map((cfg) => runSingleProvider(cfg, messages, callbacks))

  const settled = await Promise.allSettled(tasks)
  return settled.map((s, i) => {
    if (s.status === 'fulfilled') return s.value
    return {
      engineId: limited[i].engineId,
      status: 'error' as const,
      metrics: null,
      error: { code: 'UNKNOWN', message: String(s.reason), provider: limited[i].engineId },
    }
  })
}

/** 单个 Provider 执行体 */
async function runSingleProvider(
  cfg: ArenaProviderConfig,
  messages: ArenaMessage[],
  callbacks: ArenaCallbacks,
): Promise<ArenaResult> {
  const { engineId } = cfg

  // 每次请求前清理旧的 controller
  abortProvider(engineId)
  const controller = new AbortController()
  _controllers.set(engineId, controller)

  let engine: IEngine
  try {
    engine = getEngine(engineId)
  } catch (err) {
    const error: ProviderError = {
      code: 'PROVIDER_NOT_FOUND',
      message: `Provider "${engineId}" not registered`,
      provider: engineId,
    }
    callbacks.onError(engineId, error)
    callbacks.onStatus?.(engineId, 'error')
    _controllers.delete(engineId)
    return { engineId, status: 'error', metrics: null, error }
  }

  const apiKey = await getKey(engineId).catch(() => null)

  callbacks.onStatus?.(engineId, 'streaming')

  const options: ChatStreamOptions = {
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    model: cfg.model,
    apiKey: apiKey ?? '',
    customBaseUrl: cfg.customBaseUrl,
    parameters: cfg.parameters,
    signal: controller.signal,
    onDelta: (delta) => callbacks.onDelta(engineId, delta),
    onMetrics: (m) => callbacks.onMetrics(engineId, m),
    onError: (err) => callbacks.onError(engineId, err),
  }

  try {
    const metrics = await engine.chatStream(options)
    if (controller.signal.aborted) {
      callbacks.onStatus?.(engineId, 'aborted')
      _controllers.delete(engineId)
      return { engineId, status: 'aborted', metrics }
    }
    callbacks.onStatus?.(engineId, 'done')
    _controllers.delete(engineId)
    return { engineId, status: 'done', metrics }
  } catch (err: unknown) {
    _controllers.delete(engineId)
    if (controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
      callbacks.onStatus?.(engineId, 'aborted')
      return { engineId, status: 'aborted', metrics: null }
    }
    const provErr: ProviderError = {
      code: 'STREAM_FAILED',
      message: err instanceof Error ? err.message : String(err),
      provider: engineId,
    }
    callbacks.onError(engineId, provErr)
    callbacks.onStatus?.(engineId, 'error')
    return { engineId, status: 'error', metrics: null, error: provErr }
  }
}
