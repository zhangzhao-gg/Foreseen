/**
 * [INPUT]: 依赖 react, gsap, ./InputBox, ./SystemResponse, ./SummaryModal, ./HistoryDrawer, ../systems/minimax, ../systems/storage
 * [OUTPUT]: BookPage 组件，汤姆日记本交互——同一位置，写字消失，回应渗出再消失
 * [POS]: components/ 的根容器
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import InputBox from './InputBox'
import SystemResponse from './SystemResponse'
import SummaryModal from './SummaryModal'
import HistoryDrawer from './HistoryDrawer'
import { chat, summarize, toMessage, type AIResponse } from '../systems/minimax'
import { saveEntry, generateId } from '../systems/storage'
import './BookPage.css'

const log = (tag: string, detail?: unknown) => {
  if (import.meta.env.DEV) console.log(`[Foreseen] ${tag}`, detail ?? '')
}

/* 浮尘微粒 — 25 颗金色尘埃，极慢漂移 */
const DUST_COUNT = 35
const DUST_COLORS = [
  { core: 'rgba(255,190,60,0.95)', glow: 'rgba(255,160,30,0.6)' },
  { core: 'rgba(255,130,80,0.9)', glow: 'rgba(255,100,50,0.5)' },
  { core: 'rgba(160,140,255,0.85)', glow: 'rgba(130,100,255,0.5)' },
  { core: 'rgba(100,220,200,0.85)', glow: 'rgba(60,200,180,0.45)' },
  { core: 'rgba(255,80,160,0.8)', glow: 'rgba(255,50,130,0.45)' },
  { core: 'rgba(200,255,120,0.8)', glow: 'rgba(160,230,80,0.4)' },
]
const dustParticles = Array.from({ length: DUST_COUNT }, (_, i) => {
  const size = 3 + (i % 5) * 0.8
  const duration = 8 + (i * 0.9) % 7
  const delay = -(i * 0.6) % duration
  const left = (i * 13 + 5) % 90 + 5
  const top = (i * 19 + 7) % 90 + 5
  const dx = -20 + (i % 9) * 6
  const dy = -40 - (i % 6) * 8
  const peakOpacity = 0.55 + (i % 4) * 0.12
  const color = DUST_COLORS[i % DUST_COLORS.length]
  const twinkleDuration = 1.5 + (i % 5) * 0.5
  const twinkleDelay = (i * 0.3) % twinkleDuration
  const twinklePeak = 2 + (i % 3) * 0.8
  const glowSize = 4 + (i % 4) * 3
  return { size, duration, delay, left, top, dx, dy, peakOpacity, color, twinkleDuration, twinkleDelay, twinklePeak, glowSize }
})

function DustParticles() {
  return (
    <div className="dust-particles">
      {dustParticles.map((p, i) => (
        <div
          key={i}
          className="dust-particle"
          style={{
            width: p.size + 'px',
            height: p.size + 'px',
            left: p.left + '%',
            top: p.top + '%',
            '--dust-duration': p.duration + 's',
            '--dust-delay': p.delay + 's',
            '--dust-dx': p.dx + 'px',
            '--dust-dy': p.dy + 'px',
            '--dust-peak-opacity': p.peakOpacity,
            '--dust-color': p.color.core,
            '--dust-glow-color': p.color.glow,
            '--dust-glow-size': p.glowSize + 'px',
            '--dust-twinkle-duration': p.twinkleDuration + 's',
            '--dust-twinkle-delay': p.twinkleDelay + 's',
            '--dust-twinkle-peak': p.twinklePeak,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}

function TypedPrompt({ text, fading }: { text: string; fading?: boolean }) {
  const [displayed, setDisplayed] = useState('')
  const idxRef = useRef(0)

  useEffect(() => {
    idxRef.current = 0
    setDisplayed('')
    const tick = () => {
      idxRef.current++
      setDisplayed(text.slice(0, idxRef.current))
      if (idxRef.current < text.length) {
        timer = setTimeout(tick, 120 + Math.random() * 80)
      }
    }
    let timer = setTimeout(tick, 600)
    return () => clearTimeout(timer)
  }, [text])

  const cls = `book-page__prompt${fading ? ' book-page__prompt--fading' : ''}`
  return <p className={cls}>{displayed}</p>
}

type Phase = 'input' | 'ink-fading' | 'responding' | 'showing' | 'summarizing'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const API_KEY = import.meta.env.VITE_MINIMAX_KEY || ''

export default function BookPage() {
  const [phase, setPhase] = useState<Phase>('input')
  const [systemText, setSystemText] = useState<string[]>([])
  const [prediction, setPrediction] = useState<string | undefined>()
  const [showPrompt, setShowPrompt] = useState(true)
  const [loaded, setLoaded] = useState(false)
  interface Stain { text: string; top: number; left: number; rotate: number; opacity: number; blur: number; scale: number }
  const [stains, setStains] = useState<Stain[]>([])
  const addStain = useCallback((text: string) => {
    setStains(prev => [...prev, {
      text,
      top: 5 + Math.random() * 80,
      left: Math.random() * 60,
      rotate: -25 + Math.random() * 50,
      opacity: 0.08 + Math.random() * 0.12,
      blur: 0.4 + Math.random() * 0.8,
      scale: 1 + Math.random() * 3,
    }])
  }, [])

  // 模态框
  const [summaryText, setSummaryText] = useState('')
  const [showModal, setShowModal] = useState(false)

  // 抽屉
  const [drawerOpen, setDrawerOpen] = useState(false)

  const historyRef = useRef<Message[]>([])
  const pendingRef = useRef<AIResponse | null>(null)
  const inkFadedRef = useRef(false)
  const responseRef = useRef<HTMLDivElement>(null)
  const bookRef = useRef<HTMLDivElement>(null)
  const paperRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const showTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    document.documentElement.style.setProperty('--vh-lock', window.innerHeight + 'px')
  }, [])

  // unmount cleanup
  useEffect(() => () => { abortRef.current?.abort() }, [])

  // 等字体加载完成即开始仪式
  useEffect(() => {
    document.fonts.ready.then(() => setLoaded(true))
  }, [])

  const sceneRef = useRef<HTMLDivElement>(null)
  const lightRef = useRef<HTMLDivElement>(null)

  // 入口仪式：黑暗 → 光起 → 书现
  useEffect(() => {
    if (!loaded) return
    const book = bookRef.current
    const paper = paperRef.current
    const scene = sceneRef.current
    const light = lightRef.current
    if (!book || !paper || !scene || !light) return

    const tl = gsap.timeline()

    // 初始：全黑，书隐藏，光点为零
    tl.set(scene, { backgroundColor: '#1a1410' })
    tl.set(book, { opacity: 0, scale: 0.95, y: 20 })
    tl.set(paper, { rotateY: -110, transformOrigin: 'left center' })
    tl.set(light, { opacity: 0, scale: 0.3 })

    // 光起：光点扩散
    tl.to(light, { opacity: 1, scale: 1, duration: 2, ease: 'power2.out' }, 0.3)

    // 桌面显现：背景从黑过渡
    tl.to(scene, { backgroundColor: 'transparent', duration: 2.5, ease: 'power1.out' }, 0.8)

    // 书浮现
    tl.to(book, { opacity: 1, scale: 1, y: 0, duration: 2, ease: 'power2.out' }, 1.5)

    // 翻页
    tl.to(paper, { rotateY: 0, duration: 2.5, ease: 'power2.out' }, 2.5)

    // 光缓慢消散（变成常驻微弱环境光）
    tl.to(light, { opacity: 0.3, duration: 3, ease: 'power1.inOut' }, 3)
  }, [loaded])

  const intensityRef = useRef(0)

  const applyIntensity = useCallback((t: number) => {
    const paper = paperRef.current
    if (!paper) return

    paper.style.setProperty('--rune-opacity', (0.3 + t * 0.5).toFixed(2))
    paper.style.setProperty('--rune-duration', (8 - t * 5).toFixed(1) + 's')

    const si = (0.08 + t * 0.12).toFixed(2)
    const sw = (0.04 + t * 0.08).toFixed(2)
    paper.style.boxShadow = `inset 0 0 20px rgba(0,0,0,${si}), inset 0 0 60px rgba(100,70,30,${sw})`

    const r = Math.round(42 + t * (140 - 42))
    const g = Math.round(31 + t * (20 - 31))
    const b = Math.round(24 + t * (20 - 24))
    paper.style.setProperty('--rune-color', `rgb(${r},${g},${b})`)

    const glowAlpha = (t * 0.8).toFixed(2)
    const glowSpread = Math.round(t * 12)
    paper.style.setProperty('--rune-glow', `0 0 ${glowSpread}px rgba(140,20,20,${glowAlpha})`)
  }, [])

  const updateIntensity = useCallback((resp: AIResponse) => {
    const rounds = historyRef.current.filter(m => m.role === 'assistant').length
    const roundScore = Math.min(rounds / 5, 1)
    const shortScore = resp.text.length < 20 ? 0.3 : 0
    const predScore = resp.prediction ? 0.2 : 0
    const endScore = resp.ending ? 0.3 : 0

    const target = Math.min(roundScore + shortScore + predScore + endScore, 1)
    const obj = { val: intensityRef.current }

    gsap.to(obj, {
      val: target,
      duration: 3.5,
      ease: 'power2.inOut',
      onUpdate: () => {
        intensityRef.current = obj.val
        applyIntensity(obj.val)
      },
    })
  }, [applyIntensity])

  // 结束流程：总结 → 存储 → 弹模态
  const triggerEnding = useCallback(async () => {
    log('triggerEnding')
    setSystemText([])
    setPhase('summarizing')

    const controller = new AbortController()
    abortRef.current = controller

    let insight: string
    try {
      if (!API_KEY) {
        insight = '来写字的人。他来了，又走了。和所有人一样——以为翻开书就能找到答案，其实答案在来之前就已经有了。这本书什么都不给。它只是一面镜子，让人看见自己不敢直视的东西。'
      } else {
        const msgs = historyRef.current.map(m => toMessage(m.role, m.content))
        insight = await summarize(msgs, API_KEY, controller.signal)
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      insight = '这本书记住了。'
    }

    if (controller.signal.aborted) return
    if (!insight) insight = '这本书记住了。'

    saveEntry({
      id: generateId(),
      summary: insight,
      messages: [...historyRef.current],
      date: new Date().toISOString().slice(0, 10),
      roundCount: historyRef.current.filter(m => m.role === 'user').length,
      createdAt: Date.now(),
    })

    setSummaryText(insight)
    setShowModal(true)
    setPhase('input')
  }, [])

  const showResponse = useCallback((resp: AIResponse) => {
    log('show', resp.text)
    historyRef.current.push({ role: 'assistant', content: resp.text })
    updateIntensity(resp)

    // 如果是结束回复，不展示文字，直接进总结
    if (resp.ending) {
      triggerEnding()
      return
    }

    if (responseRef.current) {
      gsap.killTweensOf(responseRef.current)
      gsap.set(responseRef.current, { opacity: 1, filter: 'none' })
    }

    setSystemText([resp.text])
    setPrediction(resp.prediction)
    setPhase('showing')

    showTimerRef.current = setTimeout(() => {
      if (responseRef.current) {
        gsap.to(responseRef.current, {
          opacity: 0,
          filter: 'blur(1.5px)',
          duration: 1.5,
          ease: 'power2.in',
          onComplete: () => {
            addStain(resp.text)
            setSystemText([])
            setPhase('input')
          },
        })
      }
    }, 2000)
  }, [updateIntensity, triggerEnding])

  const sendToAI = useCallback(async (userContent: string) => {
    log('sendToAI', userContent)
    historyRef.current.push({ role: 'user', content: userContent })

    const controller = new AbortController()
    abortRef.current = controller

    let resp: AIResponse
    if (!API_KEY) {
      resp = { text: '你写下来了。来找我的人，都是已经知道答案的人。' }
    } else {
      const msgs = historyRef.current.map(m => toMessage(m.role, m.content))
      resp = await chat(msgs, API_KEY, controller.signal)
    }

    if (controller.signal.aborted) return

    if (inkFadedRef.current) {
      showResponse(resp)
    } else {
      pendingRef.current = resp
    }
  }, [showResponse])

  const handleInkFaded = useCallback(() => {
    log('ink faded')
    inkFadedRef.current = true
    setShowPrompt(false)

    const resp = pendingRef.current
    if (!resp) {
      setPhase('responding')
      return
    }
    pendingRef.current = null
    showResponse(resp)
  }, [showResponse])

  const resetPage = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    clearTimeout(showTimerRef.current)
    if (responseRef.current) gsap.killTweensOf(responseRef.current)

    historyRef.current = []
    pendingRef.current = null
    inkFadedRef.current = false
    intensityRef.current = 0
    applyIntensity(0)
    setSystemText([])
    setStains([])
    setPrediction(undefined)
    setShowPrompt(true)
    setPhase('input')
  }, [applyIntensity])

  const handleTurnPage = useCallback(() => {
    const paper = paperRef.current
    if (!paper) return
    if (phase === 'summarizing') return

    resetPage()
    gsap.set(paper, { rotateY: -110, transformOrigin: 'left center' })
    gsap.to(paper, { rotateY: 0, duration: 2.5, ease: 'power2.out' })
  }, [phase, resetPage])

  // 模态关闭 → 翻页
  const handleModalClose = useCallback(() => {
    setShowModal(false)
    setSummaryText('')
    handleTurnPage()
  }, [handleTurnPage])

  const handleSubmit = useCallback(async (text: string) => {
    log('submit', text)
    addStain(text)
    setPhase('ink-fading')
    inkFadedRef.current = false
    pendingRef.current = null

    if (responseRef.current) {
      gsap.killTweensOf(responseRef.current)
      gsap.to(responseRef.current, {
        opacity: 0,
        filter: 'blur(1.5px)',
        duration: 1.5,
        ease: 'power2.in',
        onComplete: () => setSystemText([]),
      })
    }

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

  if (!loaded) {
    return (
      <div className="book-page book-page--loading">
        <div className="loading__surge" />
        <DustParticles />
        <div className="loading__runes">
          <span className="loading__rune">ᚦᛁᛋ ᛒᚩᚳ ᚱᛖᛗᛖᛗᛒᛖᚱᛋ</span>
          <span className="loading__rune">ꙮ</span>
          <span className="loading__rune">ᚠᛟᚱᛖᛋᛖᛖᚾ</span>
        </div>
      </div>
    )
  }

  return (
    <div className="book-page">
      <div ref={sceneRef} className="book-page__scene" />
      <div ref={lightRef} className="book-page__light" />

      <HistoryDrawer open={drawerOpen} onToggle={() => setDrawerOpen(v => !v)} />

      <DustParticles />
      <div className="book-page__vignette" />

      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <filter id="paper-edge">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.08"
            numOctaves="3"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="2.5"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </svg>

      <div ref={bookRef} className="book-page__book">
        <img src="/paper.png" alt="" className="book-page__prop book-page__prop--paper" />
        <img src="/ink.png" alt="" className="book-page__prop book-page__prop--ink" onClick={e => { e.currentTarget.classList.remove('book-page__prop--bounce'); void e.currentTarget.offsetWidth; e.currentTarget.classList.add('book-page__prop--bounce') }} />
        <img src="/bottle.png" alt="" className="book-page__prop book-page__prop--bottle" onClick={e => { e.currentTarget.classList.remove('book-page__prop--bounce'); void e.currentTarget.offsetWidth; e.currentTarget.classList.add('book-page__prop--bounce') }} />
        <img src="/coin.png" alt="" className="book-page__prop book-page__prop--coin book-page__prop--coin-1" onClick={e => { e.currentTarget.classList.remove('book-page__prop--bounce'); void e.currentTarget.offsetWidth; e.currentTarget.classList.add('book-page__prop--bounce') }} />
        <img src="/coin.png" alt="" className="book-page__prop book-page__prop--coin book-page__prop--coin-2" onClick={e => { e.currentTarget.classList.remove('book-page__prop--bounce'); void e.currentTarget.offsetWidth; e.currentTarget.classList.add('book-page__prop--bounce') }} />
        <img src="/coin.png" alt="" className="book-page__prop book-page__prop--coin book-page__prop--coin-3" onClick={e => { e.currentTarget.classList.remove('book-page__prop--bounce'); void e.currentTarget.offsetWidth; e.currentTarget.classList.add('book-page__prop--bounce') }} />
        <img src="/coin.png" alt="" className="book-page__prop book-page__prop--coin book-page__prop--coin-4" onClick={e => { e.currentTarget.classList.remove('book-page__prop--bounce'); void e.currentTarget.offsetWidth; e.currentTarget.classList.add('book-page__prop--bounce') }} />
        <img src="/coin.png" alt="" className="book-page__prop book-page__prop--coin book-page__prop--coin-5" onClick={e => { e.currentTarget.classList.remove('book-page__prop--bounce'); void e.currentTarget.offsetWidth; e.currentTarget.classList.add('book-page__prop--bounce') }} />
        <div className="book-page__spine" />
        <div className="book-page__page-under">
          <span className="page-under__line">the one who writes here never leaves</span>
          <span className="page-under__line">ᚦᛖ ᛒᛟᛟᚲ ᚹᚨᛋ ᚨᛚᚹᚨᛃᛋ ᛟᛈᛖᚾ</span>
          <span className="page-under__line">你来过。你写过。你忘了。</span>
          <span className="page-under__line">ϟ τα γραμμενα μενουν ϟ</span>
          <span className="page-under__line">what was asked cannot be unasked</span>
          <span className="page-under__line">ᛞᛟ ᚾᛟᛏ ᛏᚱᚢᛋᛏ ᚦᛖ ᛒᛚᚨᚾᚲ ᛈᚨᚷᛖ</span>
          <span className="page-under__line">墨水干了，字还在呼吸</span>
          <span className="page-under__line">every question is a confession</span>
          <span className="page-under__line">ᚨᛚᛚ ᛈᚨᚷᛖᛋ ᛚᛖᚨᛞ ᛏᛟ ᚦᛁᛋ ᛟᚾᛖ</span>
          <span className="page-under__line">𐤀𐤋 𐤕𐤊𐤕𐤁 · it was written before you came · 𐤀𐤋 𐤕𐤊𐤕𐤁</span>
          <span className="page-under__line">这本书不回答问题，它只是让你听见自己的声音</span>
          <span className="page-under__line">ᚠᛟᚱᛖᛋᛖᛖᚾ · ᚠᛟᚱᛖᚹᚱᛁᛏᛏᛖᚾ · ᚠᛟᚱᛖᚷᛟᚾᛖ</span>
        </div>
        <div className="book-page__pages" />

        <div ref={paperRef} className="book-page__paper">
          <div className="book-page__gutter" />
          <span className="book-page__title">Foreseen</span>
          <div className="book-page__grain" />

          {/* 铭文区 */}
          <div className="book-page__runes book-page__runes--top">
            <span className="book-page__rune">what is written cannot be unwritten</span>
            <span className="book-page__rune">ᚦᛁᛋ ᛒᚩᚳ ᚱᛖᛗᛖᛗᛒᛖᚱᛋ</span>
            <span className="book-page__rune">the ink remembers · ꙮ · every secret wants to be found</span>
            <span className="book-page__rune">ϟ αληθεια κρυπτεται εν τω μελανι ϟ</span>
            <span className="book-page__rune">ᛞᛟ ᚾᛟᛏ ᚨᛋᚲ · ᛃᛟᚢ ᚨᛚᚱᛖᚨᛞᛃ ᚲᚾᛟᚹ</span>
          </div>

          <div className="book-page__runes book-page__runes--bottom">
            <span className="book-page__rune">ᚹᚺᚨᛏ ᛁᛋ ᛋᛖᛖᚾ ᚲᚨᚾᚾᛟᛏ ᛒᛖ ᚢᚾᛋᛖᛖᚾ</span>
            <span className="book-page__rune">I await the one who already knows</span>
            <span className="book-page__rune">𐤀𐤋 𐤕𐤊𐤕𐤁 · nothing disappears · 𐤀𐤋 𐤕𐤊𐤕𐤁</span>
            <span className="book-page__rune">ᚠᛟᚱᛖᛋᛖᛖᚾ · ᚠᛟᚱᛖᛏᛟᛚᛞ · ᚠᛟᚱᛖᚹᚨᚱᚾᛖᛞ</span>
            <span className="book-page__rune">it only changes form · ꙮ · veritas in atramento</span>
          </div>

          <button className="book-page__turn" onClick={handleTurnPage}>翻页</button>

          <div className="book-page__content">
            {(phase === 'responding' || phase === 'summarizing') && (
              <div className="book-page__pulse" />
            )}

            {systemText.length > 0 && (
              <div ref={responseRef} className="book-page__response">
                <SystemResponse lines={systemText} />
              </div>
            )}

            {(phase === 'input' || phase === 'ink-fading') && (
              <div className="book-page__input-wrap">
                {showPrompt && <TypedPrompt text="你在想什么。" fading={phase === 'ink-fading'} />}
                <InputBox
                  onSubmit={handleSubmit}
                  onFaded={handleInkFaded}
                  fading={phase === 'ink-fading'}
                  prediction={prediction}
                />
              </div>
            )}
          </div>

          {stains.length > 0 && (
            <div className="book-page__stains">
              {stains.map((s, i) => (
                <span
                  key={i}
                  className="book-page__stain"
                  style={{
                    top: s.top + '%',
                    left: s.left + '%',
                    transform: `rotate(${s.rotate}deg) scale(${s.scale})`,
                    color: `rgba(100, 75, 45, ${s.opacity})`,
                    '--stain-blur': `blur(${s.blur}px)`,
                  } as React.CSSProperties}
                >{s.text}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <SummaryModal text={summaryText} onClose={handleModalClose} />
      )}
    </div>
  )
}
