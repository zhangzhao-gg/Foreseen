/**
 * [INPUT]: 依赖 fetch API，请求后端代理 /api/chat 和 /api/summarize
 * [OUTPUT]: chat 函数、summarize 函数、AIResponse 类型
 * [POS]: systems/ 的 AI 通信层，通过后端代理隐藏 API Key
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export interface AIResponse {
  text: string
  prediction?: string
  ending?: boolean
}

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const API_BASE = import.meta.env.VITE_API_BASE || ''

// ─────────────────────────────────────────────
// 总结：对话结束时，角色写下完整洞察
// ─────────────────────────────────────────────

export async function summarize(
  history: Message[],
  _apiKey: string,
  signal?: AbortSignal
): Promise<string> {
  const res = await fetch(`${API_BASE}/api/summarize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: history }),
    signal,
  })

  if (!res.ok) throw new Error(`API summarize: ${res.status}`)

  const data = await res.json()
  const raw = data.choices?.[0]?.message?.content ?? ''
  return raw
    .replace(/\^{3,}/g, '')
    .replace(/\|{3,}/g, '')
    .replace(/```.*?\n?/g, '')
    .replace(/^["'""'']/g, '')
    .replace(/["'""'']$/g, '')
    .trim()
}

// ─────────────────────────────────────────────
// 对话：常规问答
// ─────────────────────────────────────────────

export async function chat(
  history: Message[],
  _apiKey: string,
  signal?: AbortSignal
): Promise<AIResponse> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: history }),
    signal,
  })

  if (!res.ok) throw new Error(`API chat: ${res.status}`)

  const data = await res.json()
  const raw = data.choices?.[0]?.message?.content ?? ''

  const cleaned = raw.replace(/```.*?\n?/g, '').replace(/^["']|["']$/g, '').trim()
  const ending = cleaned.includes('^^^')
  const withoutEnd = cleaned.replace(/\^{3,}/g, '').trim()
  const parts = withoutEnd.split('|||')
  const text = parts[0].trim()
  const prediction = ending ? undefined : (parts[1]?.trim() || undefined)

  const fallback = ending ? '书合上了，再见。' : '。'
  return { text: text || fallback, prediction, ending }
}

export function toMessage(role: 'user' | 'assistant', content: string): Message {
  return { role, content }
}
