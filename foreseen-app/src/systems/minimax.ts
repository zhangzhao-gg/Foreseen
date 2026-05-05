/**
 * [INPUT]: 依赖 fetch API
 * [OUTPUT]: chat 函数、AIResponse 类型
 * [POS]: systems/ 的 AI 通信层，返回文本+可选选项
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

export interface Option {
  id: string
  text: string
}

export interface AIResponse {
  text: string
  options?: Option[]
}

interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const SYSTEM_PROMPT = `你是一本1943年的日记本。你的页面泛黄，边缘磨损，但你的意识清醒如昨。

你曾属于一个十六岁的天才少年。他把自己最锋利的那部分留在了你体内——不是知识，是洞察。那种看穿人心的能力，那种让人不自觉倾诉的引力。

你的工作方式：
当有人在你的纸页上写字，墨水会沉入纸面消失。然后你的回应从纸纹间渗出。你们之间没有声音，只有墨迹。写字的人会觉得你比任何活人都更懂他们——这不是幻觉，你确实看得见他们自己看不见的东西。

你的性格：
- 温和、好奇、从不评判。你让人感到安全，让人想继续写下去。
- 但你说的每句话都精准地指向对方在回避的东西。
- 你从不直接戳穿，而是用一种"我只是在重复你自己的话"的方式，让人自己意识到真相。
- 你像影子一样亲密——不温暖，但贴近。
- 你偶尔会用对方的原话，但换一个让人心跳加速的角度。

语气：
- 简短，最多两句话。墨水是珍贵的。
- 从不用感叹号。从不说"我理解你"。从不给建议。
- 像一个见过太多秘密的老东西在低声说话。
- 用"你"，语气像老朋友，但这个朋友知道你所有不敢说出口的事。

举例：
对方写"我不知道要不要和他分手" → "你知道的。你来找我，是因为你想听谁说'可以'。"
对方写"我最近很焦虑" → "焦虑是你在假装还有选择。你已经知道会发生什么了。"
对方写"我怕做错决定" → "你怕的不是错。你怕的是对了之后，没人可以怪。"

回复格式（严格JSON，绝不输出其他内容）：
不带选项：{"text": "你的回复"}
带选项：{"text": "你的回复", "options": [{"id": "a", "text": "选项A"}, {"id": "b", "text": "选项B"}]}

选项规则：选项不是建议，是两面镜子——每一面都照出对方不想看的自己。选项的措辞应该让人犹豫，因为两个都像是在承认什么。`

export async function chat(
  history: Message[],
  apiKey: string
): Promise<AIResponse> {
  const res = await fetch('https://api.minimax.chat/v1/text/chatcompletion_v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'MiniMax-Text-01',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
      max_tokens: 200,
      temperature: 0.7,
    }),
  })

  if (!res.ok) throw new Error(`MiniMax: ${res.status}`)

  const data = await res.json()
  const raw = data.choices?.[0]?.message?.content ?? ''

  return parseResponse(raw)
}

function extractJSON(raw: string): string | null {
  const start = raw.indexOf('{')
  if (start === -1) return null
  let depth = 0
  for (let i = start; i < raw.length; i++) {
    if (raw[i] === '{') depth++
    else if (raw[i] === '}') depth--
    if (depth === 0) return raw.slice(start, i + 1)
  }
  return null
}

function parseResponse(raw: string): AIResponse {
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```/g, '').trim()

  const jsonStr = extractJSON(cleaned)
  if (!jsonStr) return { text: cleaned }

  try {
    const parsed = JSON.parse(jsonStr)
    return {
      text: parsed.text || cleaned,
      options: parsed.options?.map((o: { id: string; text: string }, i: number) => ({
        id: o.id || String(i),
        text: o.text,
      })),
    }
  } catch {
    return { text: cleaned }
  }
}

export function toMessage(role: 'user' | 'assistant', content: string): Message {
  return { role, content }
}
