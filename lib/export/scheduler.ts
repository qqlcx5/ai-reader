/**
 * M6 — Auto-backup scheduler.
 *
 * Uses `chrome.alarms` to schedule a daily backup at the configured
 * time. The actual upload work happens in the background entrypoint,
 * which listens for the `auto-backup` alarm.
 */
import type { ExportConfig } from '@/modules/storage/types';

export const AUTO_BACKUP_ALARM = 'ai-reader-auto-backup';
const MIN_INTERVAL_MINUTES = 1; // chrome.alarms refuses < 1

/**
 * Translate the user-friendly `autoBackupIntervalDays` (M7) and an
 * optional `autoBackupTime` field into a chrome.alarms delay.
 *
 * chrome.alarms supports two modes:
 *   - `delayInMinutes`: one-shot
 *   - `periodInMinutes`: recurring
 *
 * We use a one-shot alarm and re-schedule on every run. That keeps the
 * timing tied to the wall clock (so DST changes don't drift the
 * schedule) at the cost of one extra chrome.alarms.create call.
 *
 * Time math is done in UTC so the delay is deterministic and
 * timezone-independent; the user-facing time (default 02:00) is
 * interpreted against UTC consistently across machines.
 */
export function computeNextDelay(now: Date, hour: number, minute: number): number {
  const target = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    hour,
    minute,
    0,
    0,
  );
  let next = target;
  if (next <= now.getTime()) {
    // Target already passed today (in UTC) — roll to the same time tomorrow.
    next += 24 * 60 * 60 * 1000;
  }
  const ms = next - now.getTime();
  return Math.max(MIN_INTERVAL_MINUTES, Math.ceil(ms / 60_000));
}

interface ChromeAlarmsApi {
  create(name: string, options: { delayInMinutes: number }): Promise<void> | void;
  clear(name: string): Promise<boolean> | boolean;
}

function getAlarmsApi(): ChromeAlarmsApi | null {
  // WXT exposes `browser` as the cross-browser extension global; the
  // `chrome` namespace is the same object at runtime. Tests stub one or
  // the other. The `alarms` permission is declared in wxt.config.ts, but
  // the type surface is loose, so we narrow at runtime and bail out when
  // the API is missing.
  const candidates: unknown[] = [];
  if (typeof browser !== 'undefined') candidates.push(browser);
  if (typeof chrome !== 'undefined') candidates.push(chrome);
  for (const c of candidates) {
    if (!c || typeof c !== 'object') continue;
    const alarms = (c as Record<string, unknown>).alarms as Partial<ChromeAlarmsApi> | undefined;
    if (alarms && typeof alarms.create === 'function' && typeof alarms.clear === 'function') {
      return alarms as ChromeAlarmsApi;
    }
  }
  return null;
}

export async function scheduleAutoBackup(
  config: ExportConfig,
  options: { hour?: number; minute?: number; now?: Date } = {},
): Promise<void> {
  const alarms = getAlarmsApi();
  if (!alarms) return;
  if (!config.autoBackupEnabled) {
    await alarms.clear(AUTO_BACKUP_ALARM);
    return;
  }
  const now = options.now ?? new Date();
  // M7 stores a 24h interval; we map to a daily time using a default of 02:00.
  const hour = options.hour ?? 2;
  const minute = options.minute ?? 0;
  const delayInMinutes = computeNextDelay(now, hour, minute);
  await alarms.create(AUTO_BACKUP_ALARM, { delayInMinutes });
}

export async function cancelAutoBackup(): Promise<void> {
  const alarms = getAlarmsApi();
  if (!alarms) return;
  await alarms.clear(AUTO_BACKUP_ALARM);
}
