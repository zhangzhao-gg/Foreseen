/**
 * [INPUT]: 依赖 react, gsap
 * [OUTPUT]: InputBox 组件，含墨水吸收动画
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
}

export default function InputBox({ onSubmit, onFaded, fading }: Props) {
  const [value, setValue] = useState('')
  const [idle, setIdle] = useState(false)
  const [active, setActive] = useState(false)
  const [frozenText, setFrozenText] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const inkRef = useRef<HTMLParagraphElement>(null)
  const onFadedRef = useRef(onFaded)
  onFadedRef.current = onFaded

  useEffect(() => {
    if (!fading) textareaRef.current?.focus()
  }, [fading])

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
        filter: 'blur(3px)',
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
    setValue(e.target.value)
    setActive(true)
    setIdle(false)

    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setIdle(true), 2000)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && value.trim()) {
      e.preventDefault()
      const text = value.trim()
      setFrozenText(text)
      setValue('')
      setActive(false)
      setIdle(false)
      onSubmit(text)
    }
  }, [value, onSubmit])

  return (
    <div className={`input-box ${active ? 'input-box--active' : ''} ${idle ? 'input-box--idle' : ''}`}>
      {/* 冻结文字：提交后显示，原地播放吸收动画 */}
      {fading && frozenText && (
        <p ref={inkRef} className="input-box__ink">{frozenText}</p>
      )}

      {/* 输入区：吸收期间隐藏 */}
      <textarea
        ref={textareaRef}
        className={`input-box__textarea${fading ? ' input-box__textarea--hidden' : ''}`}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        rows={1}
        disabled={fading}
      />
    </div>
  )
}
