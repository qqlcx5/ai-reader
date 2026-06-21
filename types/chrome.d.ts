// Minimal Chrome extension API type declarations for AI Reader.
// This avoids adding @types/chrome as a dependency.

declare namespace chrome {
  // ─── storage ──────────────────────────────────────────────────────
  namespace storage {
    interface StorageArea {
      get(keys?: string | string[] | null): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
      remove(keys: string | string[]): Promise<void>;
      clear(): Promise<void>;
    }

    interface StorageChange {
      oldValue?: unknown;
      newValue?: unknown;
    }

    const local: StorageArea;
    const session: StorageArea;

    const onChanged: {
      addListener(
        callback: (changes: Record<string, StorageChange>, areaName: string) => void,
      ): void;
      removeListener(
        callback: (changes: Record<string, StorageChange>, areaName: string) => void,
      ): void;
    };
  }

  // ─── runtime ──────────────────────────────────────────────────────
  namespace runtime {
    interface MessageSender {
      id?: string;
      url?: string;
      tab?: chrome.tabs.Tab;
      frameId?: number;
    }

    interface Port {
      name: string;
      postMessage(message: unknown): void;
      onMessage: {
        addListener(callback: (message: unknown, port: Port) => void): void;
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onMessage: {
      addListener(
        callback: (
          message: any,
          sender: MessageSender,
          sendResponse: (response?: any) => void,
        ) => boolean | void,
      ): void;
      removeListener(
        callback: (
          message: any,
          sender: MessageSender,
          sendResponse: (response?: any) => void,
        ) => boolean | void,
      ): void;
    };

    function sendMessage(message: unknown): Promise<unknown>;
    function getViews(): Window[];
    function openOptionsPage(): void;
  }

  // ─── tabs ─────────────────────────────────────────────────────────
  namespace tabs {
    interface Tab {
      id?: number;
      index: number;
      windowId: number;
      url?: string;
      title?: string;
      active: boolean;
      status?: string;
    }

    interface TabActiveInfo {
      tabId: number;
      windowId: number;
    }

    interface TabChangeInfo {
      status?: string;
      url?: string;
      title?: string;
    }

    const onActivated: {
      addListener(callback: (activeInfo: TabActiveInfo) => void): void;
    };

    const onUpdated: {
      addListener(
        callback: (tabId: number, changeInfo: TabChangeInfo, tab: Tab) => void,
      ): void;
    };

    function query(queryInfo: {
      active?: boolean;
      currentWindow?: boolean;
      windowId?: number;
    }): Promise<Tab[]>;

    function create(createProperties: { url?: string; windowId?: number }): Promise<Tab>;

    function sendMessage(tabId: number, message: unknown): Promise<unknown>;
  }

  // ─── sidePanel ────────────────────────────────────────────────────
  namespace sidePanel {
    interface PanelOptions {
      windowId?: number;
      tabId?: number;
    }

    function open(options: PanelOptions): Promise<void>;
  }

  // ─── windows ──────────────────────────────────────────────────────
  namespace windows {
    interface Window {
      id?: number;
      focused: boolean;
    }

    function getCurrent(): Promise<Window>;
  }

  // ─── alarms ───────────────────────────────────────────────────────
  namespace alarms {
    interface Alarm {
      name: string;
      scheduledTime: number;
      periodInMinutes?: number;
    }

    interface AlarmCreateInfo {
      delayInMinutes?: number;
      periodInMinutes?: number;
      when?: number;
    }

    function create(name: string, alarmInfo: AlarmCreateInfo): Promise<void>;
    function clear(name?: string): Promise<boolean>;
    function get(name: string): Promise<Alarm | undefined>;
    function getAll(): Promise<Alarm[]>;

    const onAlarm: {
      addListener(callback: (alarm: Alarm) => void): void;
      removeListener(callback: (alarm: Alarm) => void): void;
    };
  }

  // ─── action ───────────────────────────────────────────────────────
  namespace action {
    interface BadgeTextDetails {
      text: string;
      tabId?: number;
    }

    interface BadgeColorDetails {
      color: string;
      tabId?: number;
    }

    function setBadgeText(details: BadgeTextDetails): Promise<void>;
    function setBadgeBackgroundColor(details: BadgeColorDetails): Promise<void>;
  }

  // ─── commands ─────────────────────────────────────────────────────
  namespace commands {
    interface Command {
      name: string;
      shortcut: string;
      description?: string;
    }

    const onCommand: {
      addListener(callback: (command: string, tab?: chrome.tabs.Tab) => void): void;
    };

    function getAll(): Promise<Command[]>;
  }
}
