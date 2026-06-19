// Typed message helpers for Chrome extension messaging
import { browser } from 'wxt/browser';

export interface ExtractContentRequest {
  action: 'extractContent';
}

export interface ExtractContentResponse {
  title: string;
  content: string;
  url: string;
  wordCount: number;
}

export interface OpenSidePanelRequest {
  action: 'openSidePanel';
}

export type MessageRequest = ExtractContentRequest | OpenSidePanelRequest;
export type MessageResponse = ExtractContentResponse | void;

export function sendToTab<T>(tabId: number, msg: MessageRequest): Promise<T> {
  return browser.tabs.sendMessage(tabId, msg) as Promise<T>;
}

export function sendToBackground<T>(msg: MessageRequest): Promise<T> {
  return browser.runtime.sendMessage(msg) as Promise<T>;
}
