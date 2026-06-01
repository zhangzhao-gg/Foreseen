/**
 * [INPUT]: 依赖 localStorage API
 * [OUTPUT]: DiaryEntry 类型、getAllEntries、saveEntry
 * [POS]: systems/ 的持久化层，管理对话记录的本地存储
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export interface DiaryEntry {
  id: string
  summary: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  date: string
  roundCount: number
  createdAt: number
}

const KEY = 'foreseen_diary'

export function getAllEntries(): DiaryEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveEntry(entry: DiaryEntry): void {
  const entries = getAllEntries()
  entries.push(entry)
  localStorage.setItem(KEY, JSON.stringify(entries))
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}
