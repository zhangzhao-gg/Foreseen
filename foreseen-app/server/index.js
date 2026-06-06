/**
 * [INPUT]: 环境变量 MINIMAX_KEY，来自前端的 /api/chat 和 /api/summarize 请求
 * [OUTPUT]: 代理转发至 MiniMax API，隐藏 API Key
 * [POS]: server/ 的唯一入口，轻量代理层
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

const http = require('http')
const { SYSTEM_PROMPT, SUMMARIZE_PROMPT } = require('./prompts')

const PORT = process.env.PORT || 3001
const MINIMAX_KEY = process.env.MINIMAX_KEY
const MINIMAX_URL = 'https://api.minimax.chat/v1/text/chatcompletion_v2'
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || 'https://foreseen.okethan.top'

if (!MINIMAX_KEY) {
  console.error('MINIMAX_KEY 未设置')
  process.exit(1)
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(JSON.stringify(data))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

async function proxy(req, res, isSummarize) {
  const body = await readBody(req)
  let parsed
  try {
    parsed = JSON.parse(body)
  } catch {
    return sendJson(res, 400, { error: 'invalid json' })
  }

  const { messages } = parsed
  if (!messages) return sendJson(res, 400, { error: 'messages required' })

  // 后端注入系统提示词，前端只传用户/助手消息
  const fullMessages = isSummarize
    ? [{ role: 'system', content: SYSTEM_PROMPT }, ...messages, { role: 'user', content: SUMMARIZE_PROMPT }]
    : [{ role: 'system', content: SYSTEM_PROMPT }, ...messages]

  const payload = JSON.stringify({
    model: 'MiniMax-Text-01',
    messages: fullMessages,
    max_tokens: isSummarize ? 500 : 200,
    temperature: isSummarize ? 0.8 : 0.7,
  })

  const url = new URL(MINIMAX_URL)
  const options = {
    hostname: url.hostname,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MINIMAX_KEY}`,
      'Content-Length': Buffer.byteLength(payload),
    },
  }

  const upstream = require('https').request(options, (upRes) => {
    const chunks = []
    upRes.on('data', c => chunks.push(c))
    upRes.on('end', () => {
      const raw = Buffer.concat(chunks).toString()
      sendJson(res, upRes.statusCode, JSON.parse(raw))
    })
  })

  upstream.on('error', (err) => {
    sendJson(res, 502, { error: err.message })
  })

  upstream.write(payload)
  upstream.end()
}

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    return res.end()
  }

  if (req.method === 'POST' && req.url === '/api/chat') {
    return proxy(req, res, false)
  }
  if (req.method === 'POST' && req.url === '/api/summarize') {
    return proxy(req, res, true)
  }

  sendJson(res, 404, { error: 'not found' })
})

server.listen(PORT, () => {
  console.log(`proxy listening on :${PORT}`)
})
