/**
 * Command bus — light-weight cross-entry event broadcast for global actions.
 *
 * Used by background scripts to fan out commands (e.g. ABORT_ALL_REQUESTS)
 * to all extension entry points (popup / side-panel / options) without each
 * page needing a long-lived connection.
 *
 * API:
 *   - send(message): broadcast to all tabs/frames
 *   - on(type, handler): register listener (returns unsubscribe fn)
 *   - emit(type, payload): locally dispatch a message (testable in isolation)
 *
 * This module deliberately keeps no external deps so it can be imported from
 * background, content, and any UI entrypoint.
 */

export type CommandType =
  | 'ABORT_ALL_REQUESTS'
  | 'EXTRACT_PAGE'
  | 'OPEN_SIDE_PANEL'
  | 'TOGGLE_SIDE_PANEL';

export interface CommandMessage<T = unknown> {
  type: CommandType;
  payload?: T;
  ts: number;
  source?: 'background' | 'sidepanel' | 'popup' | 'options' | 'content';
}

type CommandHandler<T = unknown> = (message: CommandMessage<T>) => void;

const listeners = new Map<CommandType, Set<CommandHandler>>();

function isBrowserRuntimeAvailable(): boolean {
  return typeof browser !== 'undefined' && !!browser.runtime?.sendMessage;
}

export function on<T = unknown>(type: CommandType, handler: CommandHandler<T>): () => void {
  let set = listeners.get(type);
  if (!set) {
    set = new Set();
    listeners.set(type, set);
  }
  set.add(handler as CommandHandler);
  return () => {
    set?.delete(handler as CommandHandler);
  };
}

export function emit<T = unknown>(
  type: CommandType,
  payload?: T,
  source?: CommandMessage['source'],
): void {
  const message: CommandMessage<T> = {
    type,
    payload,
    ts: Date.now(),
    source,
  };
  const set = listeners.get(type);
  if (!set) return;
  for (const handler of set) {
    try {
      handler(message);
    } catch (err) {
      console.error('[command-bus] handler failed for', type, err);
    }
  }
}

/**
 * Send a command via browser.runtime to all listeners. Each receiving entry
 * point should call `bindRuntimeListener()` once at startup to fan in.
 */
export function send<T = unknown>(
  type: CommandType,
  payload?: T,
  source?: CommandMessage['source'],
): void {
  emit(type, payload, source);
  if (!isBrowserRuntimeAvailable()) return;
  const message: CommandMessage<T> = {
    type,
    payload,
    ts: Date.now(),
    source,
  };
  try {
    browser.runtime.sendMessage(message as any).catch(() => {
      /* no receivers — fine */
    });
  } catch {
    /* best-effort */
  }
}

/**
 * Wire browser.runtime.onMessage into the local listener registry. Idempotent.
 * Returns a teardown fn.
 */
let runtimeBound = false;
export function bindRuntimeListener(): () => void {
  if (runtimeBound) return () => {};
  if (typeof browser === 'undefined' || !browser.runtime?.onMessage) {
    return () => {};
  }
  runtimeBound = true;
  const listener = (msg: CommandMessage, _sender: unknown) => {
    if (!msg || typeof msg !== 'object' || !msg.type) return;
    if (listeners.has(msg.type)) emit(msg.type, msg.payload, msg.source);
  };
  (browser.runtime.onMessage as any).addListener(listener);
  return () => {
    try {
      (browser.runtime.onMessage as any).removeListener(listener);
    } catch {
      /* ignore */
    }
    runtimeBound = false;
  };
}

export function resetCommandBus(): void {
  listeners.clear();
  runtimeBound = false;
}
