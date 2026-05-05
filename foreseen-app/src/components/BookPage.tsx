/**
 * [INPUT]: 依赖 react, gsap, ./InputBox, ./SystemResponse, ./OptionBox, ../systems/minimax
 * [OUTPUT]: BookPage 组件，汤姆日记本交互——同一片纸面，文字出现又消失
 * [POS]: components/ 的根容器
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useCallback, useRef, useState } from 'react'
import gsap from 'gsap'
import InputBox from './InputBox'
import SystemResponse from './SystemResponse'
import OptionBox from './OptionBox'
import { chat, toMessage, type AIResponse, type Option } from '../systems/minimax'
import './BookPage.css'

const log = (tag: string, detail?: unknown) => {
  if (import.meta.env.DEV) console.log(`[Foreseen] ${tag}`, detail ?? '')
}

type Phase = 'input' | 'ink-fading' | 'responding' | 'showing'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const API_KEY = import.meta.env.VITE_MINIMAX_KEY || ''

export default function BookPage() {
  const [phase, setPhase] = useState<Phase>('input')
  const [systemText, setSystemText] = useState<string[]>([])
  const [options, setOptions] = useState<Option[] | null>(null)
  const [promptVisible, setPromptVisible] = useState(true)

  const historyRef = useRef<Message[]>([])
  const pendingRef = useRef<AIResponse | null>(null)
  const inkFadedRef = useRef(false)
  const promptRef = useRef<HTMLParagraphElement>(null)
  const responseRef = useRef<HTMLDivElement>(null)

  const showResponse = useCallback((resp: AIResponse) => {
    log('show', resp.text)
    historyRef.current.push({ role: 'assistant', content: resp.text })

    // 杀掉旧动画，防止 onComplete 踩踏新状态
    if (responseRef.current) {
      gsap.killTweensOf(responseRef.current)
      gsap.set(responseRef.current, { opacity: 1, filter: 'none' })
    }

    setSystemText([resp.text])
    setOptions(resp.options || null)
    setPhase('showing')
  }, [])

  const sendToAI = useCallback(async (userContent: string) => {
    log('sendToAI', userContent)
    historyRef.current.push({ role: 'user', content: userContent })

    let resp: AIResponse
    if (!API_KEY) {
      resp = {
        text: '你写下来了。来找我的人，都是已经知道答案的人。',
        options: [
          { id: 'a', text: '我确实在回避什么' },
          { id: 'b', text: '我只是想理清思路' },
        ],
      }
    } else {
      const msgs = historyRef.current.map(m => toMessage(m.role, m.content))
      resp = await chat(msgs, API_KEY)
    }

    if (inkFadedRef.current) {
      showResponse(resp)
    } else {
      pendingRef.current = resp
    }
  }, [showResponse])

  const handleInkFaded = useCallback(() => {
    log('ink faded')
    inkFadedRef.current = true

    const resp = pendingRef.current
    if (!resp) {
      setPhase('responding')
      return
    }
    pendingRef.current = null
    showResponse(resp)
  }, [showResponse])

  const handleSubmit = useCallback(async (text: string) => {
    log('submit', text)
    setPhase('ink-fading')
    inkFadedRef.current = false
    pendingRef.current = null

    // kill 残留动画，再启动新淡出
    const targets = [promptRef.current, responseRef.current].filter(Boolean)
    targets.forEach(el => {
      gsap.killTweensOf(el!)
      gsap.to(el!, {
        opacity: 0,
        filter: 'blur(1.5px)',
        duration: 1.5,
        ease: 'power2.in',
        onComplete: () => {
          if (el === promptRef.current) setPromptVisible(false)
          if (el === responseRef.current) {
            setSystemText([])
            setOptions(null)
          }
        },
      })
    })

    try {
      await sendToAI(text)
    } catch {
      if (inkFadedRef.current) {
        showResponse({ text: '……让我想想。' })
      } else {
        pendingRef.current = { text: '……让我想想。' }
      }
    }
  }, [sendToAI, showResponse])

  const handleChoice = useCallback(async (id: string) => {
    const chosen = options?.find(o => o.id === id)
    if (!chosen) return
    log('choice', chosen.text)

    pendingRef.current = null
    inkFadedRef.current = true

    // 整个回复区（问题+选项）一起淡出
    if (responseRef.current) {
      gsap.killTweensOf(responseRef.current)
      gsap.to(responseRef.current, {
        opacity: 0,
        filter: 'blur(1.5px)',
        duration: 1,
        ease: 'power2.in',
        onComplete: () => {
          setSystemText([])
          setOptions(null)
          setPhase('responding')
        },
      })
    } else {
      setSystemText([])
      setOptions(null)
      setPhase('responding')
    }

    try {
      await sendToAI(chosen.text)
    } catch {
      showResponse({ text: '……让我想想。' })
    }
  }, [options, sendToAI, showResponse])

  const hasResponse = systemText.length > 0 || !!options

  return (
    <div className="book-page">
      <div className="book-page__vignette" />

      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <filter id="paper-edge">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.04"
            numOctaves="4"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="3"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </svg>

      <div className="book-page__shadow">
        <div className="book-page__paper">
          <span className="book-page__title">Foreseen</span>
          <div className="book-page__grain" />

          <div className="book-page__content">
            {promptVisible && (
              <p ref={promptRef} className="book-page__prompt">写下那件你假装还没决定的事。</p>
            )}

            {phase === 'responding' && (
              <div className="book-page__pulse" />
            )}

            {hasResponse && (
              <div ref={responseRef} className="book-page__response">
                {systemText.length > 0 && <SystemResponse lines={systemText} />}
                {options && (
                  <OptionBox options={options} onChoice={handleChoice} />
                )}
              </div>
            )}

            <InputBox
              onSubmit={handleSubmit}
              onFaded={handleInkFaded}
              fading={phase === 'ink-fading'}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
