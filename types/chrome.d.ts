// Minimal Chrome extension API type declarations for AI Reader.
// This avoids adding @types/chrome as a dependency.

declare namespace chrome {
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
    const sync: StorageArea;

    const onChanged: {
      addListener(
        callback: (changes: Record<string, StorageChange>, areaName: string) => void,
      ): void;
      removeListener(
        callback: (changes: Record<string, StorageChange>, areaName: string) => void,
      ): void;
    };
  }

  namespace cookies {
    interface Cookie {
      name: string;
      value: string;
      domain: string;
      path: string;
      secure: boolean;
      httpOnly: boolean;
      sameSite: string;
      expirationDate?: number;
    }

    interface GetDetails {
      url: string;
      name: string;
    }

    function get(details: GetDetails): Promise<Cookie | null>;
    function getAll(details: Partial<GetDetails>): Promise<Cookie[]>;
    function set(details: Partial<Cookie> & { url: string; name: string; value: string }): Promise<Cookie>;
    function remove(details: { url: string; name: string }): Promise<void>;
  }

  namespace contextMenus {
    type ContextType =
      | 'all' | 'page' | 'frame' | 'selection' | 'link' | 'editable'
      | 'image' | 'video' | 'audio' | 'launcher' | 'browser_action'
      | 'page_action' | 'action';

    interface CreateProperties {
      id?: string;
      title?: string;
      type?: 'normal' | 'checkbox' | 'radio' | 'separator';
      contexts?: ContextType[];
      parentId?: string | number;
      documentUrlPatterns?: string[];
      checked?: boolean;
      enabled?: boolean;
    }

    interface OnClickData {
      menuItemId: string | number;
      parentMenuItemId?: string | number;
      selectionText?: string;
      linkUrl?: string;
      srcUrl?: string;
      pageUrl?: string;
      frameUrl?: string;
      editable?: boolean;
      checked?: boolean;
    }

    function create(
      createProperties: CreateProperties,
      callback?: () => void,
    ): number | string;

    function remove(menuItemId: string | number, callback?: () => void): void;
    function removeAll(callback?: () => void): void;
    function update(
      id: string | number,
      updateProperties: Partial<CreateProperties>,
      callback?: () => void,
    ): void;

    const onClicked: {
      addListener(
        callback: (info: OnClickData, tab?: tabs.Tab) => void,
      ): void;
      removeListener(
        callback: (info: OnClickData, tab?: tabs.Tab) => void,
      ): void;
    };
  }

  namespace runtime {
    interface MessageSender {
      tab?: tabs.Tab;
      frameId?: number;
      id?: string;
      url?: string;
      origin?: string;
    }

    function sendMessage(
      message: unknown,
      callback?: (response: unknown) => void,
    ): Promise<unknown>;
    function sendMessage(
      extensionId: string,
      message: unknown,
      callback?: (response: unknown) => void,
    ): Promise<unknown>;

    const lastError: { message?: string } | undefined;

    const onMessage: {
      addListener(
        callback: (
          message: unknown,
          sender: MessageSender,
          sendResponse: (response?: unknown) => void,
        ) => boolean | void,
      ): void;
      removeListener(
        callback: (
          message: unknown,
          sender: MessageSender,
          sendResponse: (response?: unknown) => void,
        ) => boolean | void,
      ): void;
    };

    const onInstalled: {
      addListener(
        callback: (details: {
          reason: 'install' | 'update' | 'chrome_update' | 'shared_module_update';
          previousVersion?: string;
        }) => void,
      ): void;
    };
  }

  namespace tabs {
    interface Tab {
      id?: number;
      index: number;
      windowId: number;
      url?: string;
      title?: string;
      favIconUrl?: string;
      status?: string;
      active: boolean;
      pinned: boolean;
    }

    interface QueryInfo {
      active?: boolean;
      currentWindow?: boolean;
      windowId?: number;
      url?: string | string[];
      status?: string;
    }

    function query(queryInfo: QueryInfo): Promise<Tab[]>;
    function get(tabId: number): Promise<Tab>;
    function create(createProperties: {
      url?: string;
      active?: boolean;
      windowId?: number;
    }): Promise<Tab>;
    function update(
      tabId: number,
      updateProperties: { url?: string; active?: boolean },
    ): Promise<Tab | undefined>;
    function sendMessage(
      tabId: number,
      message: unknown,
      callback?: (response: unknown) => void,
    ): void;

    const onActivated: {
      addListener(
        callback: (activeInfo: { tabId: number; windowId: number }) => void,
      ): void;
      removeListener(
        callback: (activeInfo: { tabId: number; windowId: number }) => void,
      ): void;
    };

    const onUpdated: {
      addListener(
        callback: (
          tabId: number,
          changeInfo: { status?: string; url?: string; title?: string },
          tab: Tab,
        ) => void,
      ): void;
    };
  }

  namespace sidePanel {
    interface OpenOptions {
      tabId?: number;
      windowId?: number;
    }
    function open(options: OpenOptions): Promise<void>;
    function setOptions(options: {
      enabled?: boolean;
      path?: string;
      tabId?: number;
    }): Promise<void>;
    function getOptions(options: { tabId?: number }): Promise<{ enabled?: boolean; path?: string }>;
  }

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
    function create(name: string, alarmInfo: AlarmCreateInfo): void;
    function clear(name: string): Promise<boolean>;
    function clearAll(): Promise<boolean>;
    function get(name: string): Promise<Alarm | undefined>;
    function getAll(): Promise<Alarm[]>;
    const onAlarm: {
      addListener(callback: (alarm: Alarm) => void): void;
      removeListener(callback: (alarm: Alarm) => void): void;
    };
  }
}
