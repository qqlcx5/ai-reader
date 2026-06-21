/**
 * M3 Provider & LLM Client — Global Abort Registry
 *
 * M1/M4 can broadcast ABORT_ALL_REQUESTS to immediately cancel all in-flight requests.
 */

const activeControllers = new Set<AbortController>();

export function registerAbortController(controller: AbortController): void {
  activeControllers.add(controller);
}

export function unregisterAbortController(controller: AbortController): void {
  activeControllers.delete(controller);
}

export function abortAllRequests(reason = 'ABORT_ALL_REQUESTS'): void {
  for (const controller of activeControllers) {
    if (!controller.signal.aborted) {
      controller.abort(reason);
    }
  }
  activeControllers.clear();
}

export function getActiveRequestCount(): number {
  let count = 0;
  for (const controller of activeControllers) {
    if (!controller.signal.aborted) count++;
  }
  return count;
}

export function createRegisteredAbortController(): AbortController {
  const controller = new AbortController();
  registerAbortController(controller);
  // Auto-unregister when aborted
  controller.signal.addEventListener('abort', () => {
    unregisterAbortController(controller);
  });
  return controller;
}
