/**
 * Frontmatter Generator
 *
 * Generates YAML frontmatter for Obsidian notes, including property type
 * mapping (text / number / checkbox / date / datetime / list).
 *
 * Based on obsidian-clipper's generateFrontmatter() in
 * src/utils/shared.ts and src/utils/obsidian-note-creator.ts.
 */

import type { Property } from './types';

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Generate Obsidian-compatible YAML frontmatter from a list of properties.
 *
 * @param properties - Array of key-value property pairs
 * @param typeMap - Optional mapping from property name to Obsidian type
 * @returns YAML frontmatter string (with leading/trailing `---`)
 */
export function generateFrontmatter(
  properties: Property[],
  typeMap: Record<string, string> = {},
): string {
  if (properties.length === 0) return '';

  const lines: string[] = ['---'];

  for (const prop of properties) {
    const type = typeMap[prop.name] || prop.type || 'text';

    switch (type) {
      case 'text':
        lines.push(`${prop.name}: ${escapeYamlValue(String(prop.value))}`);
        break;

      case 'number':
        lines.push(`${prop.name}: ${Number(prop.value)}`);
        break;

      case 'checkbox':
        lines.push(`${prop.name}: ${prop.value ? 'true' : 'false'}`);
        break;

      case 'date':
        lines.push(`${prop.name}: ${formatDate(prop.value)}`);
        break;

      case 'datetime':
        lines.push(`${prop.name}: ${formatDateTime(prop.value)}`);
        break;

      case 'list': {
        const items = Array.isArray(prop.value)
          ? prop.value
          : String(prop.value).split(',').map((s) => s.trim());
        lines.push(`${prop.name}:`);
        for (const item of items) {
          lines.push(`  - ${escapeYamlValue(String(item))}`);
        }
        break;
      }

      default:
        lines.push(`${prop.name}: ${escapeYamlValue(String(prop.value))}`);
    }
  }

  lines.push('---');
  return lines.join('\n') + '\n';
}

/**
 * Build standard frontmatter properties from extracted page metadata.
 *
 * @param title - Page title
 * @param url - Page URL
 * @param author - Author name
 * @param description - Page description
 * @param published - Publication date
 * @param site - Site name / domain
 * @param tags - Optional tags
 * @returns Array of Property objects ready for generateFrontmatter()
 */
export function buildPageFrontmatter(
  title: string,
  url: string,
  author: string = '',
  description: string = '',
  published: string = '',
  site: string = '',
  tags: string[] = [],
): Property[] {
  const properties: Property[] = [];

  if (title) properties.push({ name: 'title', value: title, type: 'text' });
  if (url) properties.push({ name: 'url', value: url, type: 'text' });
  if (author) properties.push({ name: 'author', value: author, type: 'text' });
  if (description) properties.push({ name: 'description', value: description, type: 'text' });
  if (published) properties.push({ name: 'published', value: published, type: 'date' });
  if (site) properties.push({ name: 'site', value: site, type: 'text' });
  if (tags.length > 0) properties.push({ name: 'tags', value: tags, type: 'list' });

  return properties;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function escapeYamlValue(value: string): string {
  // If value contains special YAML characters, wrap in quotes
  if (
    value.includes(':') ||
    value.includes('#') ||
    value.includes('{') ||
    value.includes('}') ||
    value.includes('[') ||
    value.includes(']') ||
    value.includes('&') ||
    value.includes('*') ||
    value.includes('!') ||
    value.includes('|') ||
    value.includes('>') ||
    value.includes('%') ||
    value.includes('@') ||
    value.includes('`') ||
    value.startsWith('"') ||
    value.startsWith("'") ||
    value.trim() === ''
  ) {
    // Escape double quotes inside the string and wrap in double quotes
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return value;
}

function formatDate(value: string | number | boolean): string {
  if (typeof value === 'number') {
    const d = new Date(value);
    return d.toISOString().split('T')[0];
  }
  const str = String(value);
  // If it's already a date string, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const d = new Date(str);
  return isNaN(d.getTime()) ? str : d.toISOString().split('T')[0];
}

function formatDateTime(value: string | number | boolean): string {
  if (typeof value === 'number') {
    return new Date(value).toISOString();
  }
  const str = String(value);
  const d = new Date(str);
  return isNaN(d.getTime()) ? str : d.toISOString();
}
