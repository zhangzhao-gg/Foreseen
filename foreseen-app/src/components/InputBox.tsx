/**
 * [INPUT]: 依赖 react, gsap
 * [OUTPUT]: InputBox 组件，含墨水吸收动画 + 幽灵打字预言
 * [POS]: components/ 的输入层，文字在原地消失不跳位
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import gsap from 'gsap'
import './InputBox.css'

interface Props {
  onSubmit: (text: string) => void
  onFaded?: () => void
  fading?: boolean
  prediction?: string
}

export default function InputBox({ onSubmit, onFaded, fading, prediction }: Props) {
  const [value, setValue] = useState('')
  const [idle, setIdle] = useState(false)
  const [active, setActive] = useState(false)
  const [frozenText, setFrozenText] = useState('')
  const [ghostText, setGhostText] = useState('')

  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const ghostTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const ghostIndexRef = useRef(0)
  const ghostActiveRef = useRef(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const inkRef = useRef<HTMLParagraphElement>(null)
  const onFadedRef = useRef(onFaded)
  onFadedRef.current = onFaded

  // 停止幽灵打字
  const stopGhost = useCallback(() => {
    ghostActiveRef.current = false
    clearTimeout(ghostTimerRef.current)
    ghostIndexRef.current = 0
  }, [])

  // 挂载淡入
  useEffect(() => {
    if (!fading && boxRef.current) {
      gsap.fromTo(boxRef.current,
        { opacity: 0, filter: 'blur(1.5px)' },
        { opacity: 1, filter: 'none', duration: 1.2, ease: 'power2.out' }
      )
    }
    if (!fading) textareaRef.current?.focus()
  }, [fading])

  // 幽灵打字：prediction 变化时启动
  useEffect(() => {
    if (!prediction || fading) return
    ghostActiveRef.current = true
    ghostIndexRef.current = 0
    setGhostText('')

    // 延迟 0.8s 再开始打字
    const startDelay = setTimeout(() => {
      if (!ghostActiveRef.current) return
      typeNext(prediction)
    }, 800)

    return () => {
      clearTimeout(startDelay)
      stopGhost()
    }
  }, [prediction, fading, stopGhost])

  // 逐字打字：前3字慢，停顿1s，后续正常
  const typeNext = useCallback((text: string) => {
    if (!ghostActiveRef.current) return
    if (ghostIndexRef.current >= text.length) return

    ghostIndexRef.current++
    setGhostText(text.slice(0, ghostIndexRef.current))

    let delay: number
    if (ghostIndexRef.current < 3) {
      delay = 250 + Math.random() * 150
    } else if (ghostIndexRef.current === 3) {
      delay = 1000
    } else {
      delay = 120 + Math.random() * 100
      if (Math.random() < 0.08) delay += 400
    }

    ghostTimerRef.current = setTimeout(() => typeNext(text), delay)
  }, [])

  // 墨水吸收动画
  useEffect(() => {
    if (!fading || !inkRef.current) return

    const tl = gsap.timeline()
    tl.fromTo(
      inkRef.current,
      { opacity: 1, y: 0, filter: 'blur(0px)' },
      {
        opacity: 0,
        y: 3,
        filter: 'blur(1.5px)',
        scale: 0.99,
        duration: 1.5,
        ease: 'power2.in',
        onComplete: () => {
          setFrozenText('')
          onFadedRef.current?.()
        },
      }
    )
    return () => { tl.kill() }
  }, [fading])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // 用户开始打字，幽灵退场
    if (ghostActiveRef.current) {
      stopGhost()
      setGhostText('')
    }

    setValue(e.target.value)
    setActive(true)
    setIdle(false)

    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setIdle(true), 2000)
  }, [stopGhost])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      // 如果有幽灵文字且用户没打字，回车确认幽灵文字
      const text = value.trim() || ghostText.trim()
      if (!text) return

      stopGhost()
      setGhostText('')
      setFrozenText(text)
      setValue('')
      setActive(false)
      setIdle(false)
      onSubmit(text)
    }
  }, [value, ghostText, onSubmit, stopGhost])

  const displayText = value || ghostText
  const isGhost = !value && !!ghostText

  return (
    <div ref={boxRef} className={`input-box ${active ? 'input-box--active' : ''} ${idle ? 'input-box--idle' : ''}`}>
      {/* 冻结文字：提交后显示，原地播放吸收动画 */}
      {fading && frozenText && (
        <p ref={inkRef} className="input-box__ink">{frozenText}</p>
      )}

      {/* 幽灵文字层：AI 预言逐字显现 */}
      {isGhost && !fading && (
        <p className="input-box__ghost">{ghostText}</p>
      )}

      {/* 输入区：吸收期间隐藏 */}
      <textarea
        ref={textareaRef}
        className={`input-box__textarea${fading ? ' input-box__textarea--hidden' : ''}${isGhost ? ' input-box__textarea--hidden' : ''}`}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        rows={1}
        disabled={fading}
      />
    </div>
  )
}
