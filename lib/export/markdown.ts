/**
 * M6 — Markdown rendering for export.
 *
 * Pure function: takes structured conversation data and returns a
 * markdown string suitable for Obsidian, WebDAV, or zip export.
 */
import type { Conversation, Message } from './view-models';

export interface MarkdownInput {
  title: string;
  conversation: Conversation;
  messages: Message[];
  /** ISO 8601 timestamp, defaults to now. */
  exportedAt?: string;
}

/** Format a single message. `user` messages get a `## Q` heading. */
export function formatMessage(message: Message, index: number): string {
  const heading =
    message.role === 'user'
      ? `## Q${index + 1}`
      : message.role === 'assistant'
        ? `## A${index + 1}`
        : `## Note ${index + 1}`;
  const meta = message.providerName
    ? `\n*${message.providerName}${message.model ? ` · ${message.model}` : ''}*\n`
    : '';
  return `${heading}\n\n${meta}${message.content.trim()}\n`;
}

/** Build the YAML front-matter block at the top of the markdown. */
export function buildFrontMatter(input: MarkdownInput): string {
  const lines = [
    '---',
    `title: ${yamlEscape(input.title)}`,
    `source: ${yamlEscape(input.conversation.url || '')}`,
    `mode: ${input.conversation.mode}`,
    `exportedAt: ${input.exportedAt ?? new Date().toISOString()}`,
    `messageCount: ${input.messages.length}`,
    '---',
    '',
  ];
  return lines.join('\n');
}

export function buildMarkdown(input: MarkdownInput): string {
  const sorted = [...input.messages].sort((a, b) => a.createdAt - b.createdAt);
  const body = sorted
    .map((m, i) => formatMessage(m, i))
    .join('\n---\n\n');
  return `${buildFrontMatter(input)}\n# ${input.title}\n\n${body}`.trimEnd() + '\n';
}

function yamlEscape(value: string): string {
  if (!value) return '""';
  // Quote when the value would break a YAML plain scalar:
  //   - leading indicator chars (-, ?, :, &, *, !, |, >, ', ", %, @, `, #, ,, [, {)
  //   - a colon followed by space/end (the actual mapping delimiter)
  //   - " #" (space-hash starts a comment)
  //   - reserved bare words / numbers that YAML would coerce
  //   - other flow-unsafe chars anywhere (&, ?, {, }, [, ], ,, #)
  //   - newlines
  // A bare `:` inside a URL like `https://host/path` is *not* dangerous on
  // its own (no trailing space), so plain URLs pass through unquoted.
  const needsQuote =
    /^[-?:,&*!|>'"%@`#,{}\[\]\s]/.test(value) ||
    /[:]\s/.test(value) ||
    /[&#{}[\],]/.test(value) ||
    /[\n\r]/.test(value) ||
    /\s#/.test(value) ||
    /^(true|false|null|~|yes|no|on|off|-?\d)/.test(value);
  if (needsQuote) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return value;
}
