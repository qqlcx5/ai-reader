<!--
  MarkdownRenderer.vue

  Lightweight wrapper around `markdown-it` + `DOMPurify` +
  `highlight.js`. The streaming chat surface pipes model output
  through this component on every delta, so we keep the parser
  configuration in one place and cache the instance.

  The component is intentionally stateless: the parent owns the
  raw string (`source`) and decides when to re-render.
-->
<template>
  <div
    class="markdown-renderer"
    :class="contentClass"
    v-html="renderedHTML"
  />
</template>

<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import bash from 'highlight.js/lib/languages/bash'
import json from 'highlight.js/lib/languages/json'
import xml from 'highlight.js/lib/languages/xml'
import css from 'highlight.js/lib/languages/css'
import markdown from 'highlight.js/lib/languages/markdown'
import 'highlight.js/styles/atom-one-dark.css'

/**
 * DOMPurify ≥3.0 strips `target="_blank"` from anchors when a
 * safe `rel` is present (it considers the attribute redundant).
 * We want the attribute to survive so user-authored links open
 * in a new tab; this hook re-attaches it after sanitisation.
 */
function keepTargetAttr(node: Element): void {
  if (node.tagName === 'A' && node.getAttribute('rel')?.includes('noopener')) {
    node.setAttribute('target', '_blank')
  }
}
if (typeof DOMPurify.addHook === 'function') {
  DOMPurify.addHook('afterSanitizeAttributes', keepTargetAttr)
}

const props = withDefaults(
  defineProps<{
    source: string
    /** Optional CSS class on the wrapper. */
    contentClass?: string
    /** Render links to open in a new tab. Default true. */
    openLinksInNewTab?: boolean
  }>(),
  { openLinksInNewTab: true, contentClass: '' }
)

// Register the languages we expect to see most often. We could
// lazy-load the full bundle but for an extension this size of
// selection (~8 languages) is fine and keeps render time short.
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('tsx', typescript)
hljs.registerLanguage('jsx', javascript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('py', python)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('sh', bash)
hljs.registerLanguage('shell', bash)
hljs.registerLanguage('json', json)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('css', css)
hljs.registerLanguage('markdown', markdown)
hljs.registerLanguage('md', markdown)

// One parser instance for the lifetime of the component.
// `markdown-it` is documented as safe to share, and `shallowRef`
// keeps Vue from making the entire instance reactive.
const parser = shallowRef<MarkdownIt | null>(null)

function getParser(): MarkdownIt {
  if (parser.value) return parser.value
  const md = new MarkdownIt({
    html: false, // strip raw HTML; DOMPurify is a second line of defence
    linkify: true,
    typographer: false, // we don't want to mangle CJK punctuation
    breaks: true,
    highlight(str, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return `<pre class="hljs"><code>${
            hljs.highlight(str, { language: lang, ignoreIllegals: true }).value
          }</code></pre>`
        } catch {
          /* fall through */
        }
      }
      return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`
    },
  })
  // Add a `target` attribute to every link so they open in a new
  // tab without us having to walk the DOM afterwards.
  if (props.openLinksInNewTab) {
    const defaultLinkOpen =
      md.renderer.rules.link_open ||
      function defaultLinkOpen(tokens, idx, options, _env, self) {
        return self.renderToken(tokens, idx, options)
      }
    md.renderer.rules.link_open = function linkOpen(tokens, idx, options, env, self) {
      const token = tokens[idx]
      if (token) {
        const targetIndex = token.attrIndex('target')
        if (targetIndex < 0) {
          token.attrPush(['target', '_blank'])
        } else {
          token.attrs![targetIndex][1] = '_blank'
        }
        const relIndex = token.attrIndex('rel')
        if (relIndex < 0) {
          token.attrPush(['rel', 'noopener noreferrer'])
        } else {
          token.attrs![relIndex][1] = 'noopener noreferrer'
        }
      }
      return defaultLinkOpen(tokens, idx, options, env, self)
    }
  }
  parser.value = md
  return md
}

const renderedHTML = computed(() => {
  const md = getParser()
  const dirty = md.render(props.source ?? '')
  // DOMPurify: keep the surface small. We don't need form controls
  // or scripts; even our own link rewriting already added the
  // `target` attribute on the link_open token.
  return DOMPurify.sanitize(dirty, {
    USE_PROFILES: { html: true },
    ALLOWED_ATTR: [
      'href',
      'target',
      'rel',
      'src',
      'alt',
      'title',
      'class',
      'id',
      'checked',
      'disabled',
      'type',
      'start',
    ],
  })
})
</script>

<style>
.markdown-renderer {
  font-size: 0.875rem;
  line-height: 1.6;
  word-wrap: break-word;
  overflow-wrap: anywhere;
}
.markdown-renderer > :first-child {
  margin-top: 0;
}
.markdown-renderer > :last-child {
  margin-bottom: 0;
}
.markdown-renderer h1,
.markdown-renderer h2,
.markdown-renderer h3,
.markdown-renderer h4,
.markdown-renderer h5,
.markdown-renderer h6 {
  font-weight: 600;
  margin: 1em 0 0.5em;
  line-height: 1.3;
}
.markdown-renderer h1 { font-size: 1.4em; }
.markdown-renderer h2 { font-size: 1.25em; }
.markdown-renderer h3 { font-size: 1.1em; }
.markdown-renderer h4 { font-size: 1em; }
.markdown-renderer p {
  margin: 0.5em 0;
}
.markdown-renderer a {
  color: #0ea5e9;
  text-decoration: underline;
}
.markdown-renderer a:hover {
  color: #0284c7;
}
.markdown-renderer code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.85em;
  background: rgba(127, 127, 127, 0.1);
  padding: 0.1em 0.35em;
  border-radius: 0.25em;
}
.markdown-renderer pre {
  margin: 0.75em 0;
  padding: 0.75em 1em;
  border-radius: 0.5em;
  overflow-x: auto;
  font-size: 0.85em;
  background: #1f2937;
  color: #f3f4f6;
}
.markdown-renderer pre code {
  background: transparent;
  padding: 0;
  color: inherit;
  font-size: inherit;
}
.markdown-renderer ul,
.markdown-renderer ol {
  margin: 0.5em 0;
  padding-left: 1.5em;
}
.markdown-renderer li {
  margin: 0.2em 0;
}
.markdown-renderer li > p {
  margin: 0;
}
.markdown-renderer blockquote {
  border-left: 3px solid #d4d4d4;
  padding-left: 0.75em;
  color: inherit;
  opacity: 0.85;
  margin: 0.75em 0;
}
.markdown-renderer hr {
  border: none;
  border-top: 1px solid rgba(127, 127, 127, 0.3);
  margin: 1em 0;
}
.markdown-renderer table {
  border-collapse: collapse;
  margin: 0.75em 0;
  font-size: 0.85em;
}
.markdown-renderer th,
.markdown-renderer td {
  border: 1px solid rgba(127, 127, 127, 0.3);
  padding: 0.35em 0.6em;
  text-align: left;
}
.markdown-renderer th {
  background: rgba(127, 127, 127, 0.1);
  font-weight: 600;
}
.markdown-renderer img {
  max-width: 100%;
  height: auto;
  border-radius: 0.25em;
}
.markdown-renderer input[type='checkbox'] {
  margin-right: 0.35em;
}
/* task lists */
.markdown-renderer ul.contains-task-list {
  list-style: none;
  padding-left: 0.5em;
}
</style>
