/**
 * M8 三级缓存 — L1 内存 LRU 缓存
 *
 * 实现：有序 Map（插入顺序 = LRU 顺序），超容量时淘汰最久未用项。
 * 容量：20 条（可配置）
 * Key 格式：
 *   - extraction:{pageId}  → ExtractionResult
 *   - apiResponse:{queryHash} → string
 *
 * 特性：
 *   - get() 命中时将 key 移到末尾（表示最近使用）
 *   - set() 若超容则删除 Map 中最老的 key（Map 迭代顺序即插入顺序）
 *   - 不做 TTL 校验（TTL 由 L2 负责）
 */

export class L1Cache<T = unknown> {
  private readonly capacity: number
  private readonly store: Map<string, T>

  constructor(capacity = 20) {
    this.capacity = capacity
    this.store = new Map()
  }

  get(key: string): T | undefined {
    if (!this.store.has(key)) return undefined
    // 命中：将 key 移到末尾（表示最近访问）
    const value = this.store.get(key)!
    this.store.delete(key)
    this.store.set(key, value)
    return value
  }

  set(key: string, value: T): void {
    if (this.store.has(key)) {
      // 已存在：删除旧位置，重新插入到末尾
      this.store.delete(key)
    } else if (this.store.size >= this.capacity) {
      // 超容：淘汰最久未用（Map 第一个 key）
      const oldestKey = this.store.keys().next().value
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey)
      }
    }
    this.store.set(key, value)
  }

  has(key: string): boolean {
    return this.store.has(key)
  }

  delete(key: string): void {
    this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }

  get size(): number {
    return this.store.size
  }

  /** 仅调试用：返回所有 key（LRU 顺序，最旧在前） */
  keys(): string[] {
    return Array.from(this.store.keys())
  }
}

/** 全局单例：提取结果缓存 */
export const extractionL1Cache = new L1Cache<unknown>(20)

/** 全局单例：API 响应缓存（此级别在 L3 之前做快速命中） */
export const apiResponseL1Cache = new L1Cache<string>(20)
