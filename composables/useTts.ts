import { ref, onUnmounted } from 'vue'

/**
 * Read-aloud (TTS) via the Web Speech API — no dependencies, works offline.
 * Best-effort everywhere: environments without speechSynthesis (tests,
 * stripped-down browsers) degrade to no-ops.
 */

/** Rough markdown → plain text for speech: strip syntax, keep sentences. */
export function mdToPlain(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')          // code blocks
    .replace(/`([^`]+)`/g, '$1')              // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')    // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')  // links → keep text
    .replace(/^#{1,6}\s+/gm, '')              // headings
    .replace(/^\s*>\s?/gm, '')                // blockquotes
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, '$1') // emphasis
    .replace(/^\s*[-*+]\s+/gm, '')            // list bullets
    .replace(/\|/g, ' ')                      // table pipes
    .replace(/<[^>]+>/g, ' ')                 // html tags
    .replace(/\n{2,}/g, '\n')
    .trim()
}

function hasSpeech(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/** Prefer a Chinese voice for CJK text, else the first available voice. */
export function pickVoice(text: string): SpeechSynthesisVoice | null {
  if (!hasSpeech()) return null
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return null
  const isCjk = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(text)
  if (isCjk) {
    const zh = voices.find((v) => v.lang.toLowerCase().startsWith('zh'))
    if (zh) return zh
  }
  return voices[0]
}

export function useTts() {
  const speaking = ref(false)
  const error = ref<string | null>(null)

  function stop(): void {
    if (!hasSpeech()) return
    window.speechSynthesis.cancel()
    speaking.value = false
  }

  /** Speak from the start, replacing anything in progress. */
  function speak(markdown: string, rate = 1): void {
    stop()
    toggle(markdown, rate)
  }

  /** Speak a markdown document from the start; toggles off if already speaking. */
  function toggle(markdown: string, rate = 1): void {
    if (!hasSpeech()) {
      error.value = '当前环境不支持语音合成'
      return
    }
    if (speaking.value) {
      stop()
      return
    }
    const text = mdToPlain(markdown)
    if (!text) return

    // Chunk long text: Chrome silently truncates very long utterances.
    const chunks: string[] = []
    const MAX = 220
    const sentences = text.split(/(?<=[。！？.!?\n])/)
    let current = ''
    for (const s of sentences) {
      if ((current + s).length > MAX && current) {
        chunks.push(current)
        current = s
      } else {
        current += s
      }
    }
    if (current.trim()) chunks.push(current)

    const voice = pickVoice(text)
    chunks.forEach((chunk, i) => {
      const u = new SpeechSynthesisUtterance(chunk)
      if (voice) u.voice = voice
      u.lang = voice?.lang || 'zh-CN'
      u.rate = rate
      if (i === 0) {
        u.onstart = () => {
          speaking.value = true
          error.value = null
        }
      }
      if (i === chunks.length - 1) {
        u.onend = () => {
          speaking.value = false
        }
        u.onerror = () => {
          speaking.value = false
        }
      }
      window.speechSynthesis.speak(u)
    })
  }

  onUnmounted(stop)

  return { speaking, error, toggle, speak, stop }
}
