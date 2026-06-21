/**
 * Global Abort Registry
 *
 * Maintains a set of active AbortControllers so that a global
 * ABORT_ALL_REQUESTS signal can cancel all in-flight requests at once.
 * Used by the Escape key binding to immediately halt all providers.
 */

const activeControllers = new Set<AbortController>();

/** Register a controller for global abort tracking. */
export function registerAbortController(controller: AbortController): void {
  activeControllers.add(controller);
}

/** Remove a controller from tracking. */
export function unregisterAbortController(controller: AbortController): void {
  activeControllers.delete(controller);
}

/** Abort all registered in-flight requests. */
export function abortAllRequests(reason: string = 'ABORT_ALL_REQUESTS'): void {
  for (const controller of activeControllers) {
    if (!controller.signal.aborted) {
      controller.abort(reason);
    }
  }
  activeControllers.clear();
}

/** Number of currently active (non-aborted) requests. */
export function getActiveRequestCount(): number {
  let count = 0;
  for (const controller of activeControllers) {
    if (!controller.signal.aborted) count++;
  }
  return count;
}

/**
 * Create an AbortController that auto-registers with the global registry
 * and auto-unregisters when aborted.
 */
export function createRegisteredAbortController(): AbortController {
  const controller = new AbortController();
  registerAbortController(controller);
  controller.signal.addEventListener('abort', () => {
    unregisterAbortController(controller);
  });
  return controller;
}
