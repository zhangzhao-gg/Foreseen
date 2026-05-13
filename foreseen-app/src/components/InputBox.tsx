/**
 * [INPUT]: 依赖 react, gsap, pinyin-pro
 * [OUTPUT]: InputBox 组件，含墨水吸收动画 + 拼音输入法风格幽灵打字
 * [POS]: components/ 的输入层，文字在原地消失不跳位
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import gsap from 'gsap'
import { pinyin } from 'pinyin-pro'
import './InputBox.css'

// ─────────────────────────────────────────────
// 拼音序列生成：将中文句子拆为打字步骤
// ─────────────────────────────────────────────

interface TypeStep {
  committed: string   // 此步骤完成后，已确认的文本
  display: string     // 此步骤在 textarea 中显示的内容
}

function buildTypeSteps(text: string): TypeStep[] {
  const steps: TypeStep[] = []
  let committed = ''

  for (const char of text) {
    const py = isChinese(char) ? pinyin(char, { toneType: 'none' }) : ''

    if (py) {
      // 中文字：逐字母敲拼音，最后确认为汉字
      for (let i = 1; i <= py.length; i++) {
        steps.push({ committed, display: committed + py.slice(0, i) })
      }
      committed += char
      steps.push({ committed, display: committed })
    } else {
      // 非中文：直接追加
      committed += char
      steps.push({ committed, display: committed })
    }
  }

  return steps
}

function isChinese(ch: string): boolean {
  const code = ch.charCodeAt(0)
  return code >= 0x4e00 && code <= 0x9fff
}

// ─────────────────────────────────────────────
// 组件
// ─────────────────────────────────────────────

interface Props {
  onSubmit: (text: string) => void
  onFaded?: () => void
  fading?: boolean
  prediction?: string
}

export default function InputBox({ onSubmit, onFaded, fading, prediction }: Props) {
  const [value, setValue] = useState('')
  const [frozenText, setFrozenText] = useState('')

  const ghostTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const ghostStepRef = useRef(0)
  const ghostActiveRef = useRef(false)
  const userOwnedRef = useRef(false)
  const stepsRef = useRef<TypeStep[]>([])
  const boxRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const inkRef = useRef<HTMLParagraphElement>(null)
  const onFadedRef = useRef(onFaded)
  onFadedRef.current = onFaded

  const stopGhost = useCallback(() => {
    ghostActiveRef.current = false
    clearTimeout(ghostTimerRef.current)
    ghostStepRef.current = 0
    stepsRef.current = []
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
    const steps = buildTypeSteps(prediction)
    if (!steps.length) return

    stepsRef.current = steps
    ghostStepRef.current = 0
    ghostActiveRef.current = true
    userOwnedRef.current = false

    const startDelay = setTimeout(() => {
      if (!ghostActiveRef.current) return
      playStep()
    }, 800)

    return () => {
      clearTimeout(startDelay)
      stopGhost()
    }
  }, [prediction, fading, stopGhost])

  const playStep = useCallback(() => {
    if (!ghostActiveRef.current) return
    const steps = stepsRef.current
    const idx = ghostStepRef.current
    if (idx >= steps.length) return

    const step = steps[idx]
    setValue(step.display)
    ghostStepRef.current++

    // 节奏控制
    const isConfirm = step.display === step.committed && idx > 0
    const prevStep = idx > 0 ? steps[idx - 1] : null
    const isFirstPinyinLetter = prevStep && prevStep.display === prevStep.committed

    let delay: number
    if (isConfirm) {
      // 拼音确认为汉字：短暂停顿模拟选字
      delay = 80 + Math.random() * 60
    } else if (isFirstPinyinLetter) {
      // 开始新字的第一个拼音字母：略长停顿
      delay = 200 + Math.random() * 150
    } else {
      // 拼音中间字母：快速连击
      delay = 90 + Math.random() * 70
    }

    // 前两个字整体慢一些
    if (idx < 6) delay *= 1.5
    // 偶尔犹豫
    if (Math.random() < 0.06) delay += 300

    ghostTimerRef.current = setTimeout(playStep, delay)
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

  const autoResize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [])

  useEffect(() => { autoResize() }, [value, autoResize])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (ghostActiveRef.current) stopGhost()
    userOwnedRef.current = true
    setValue(e.target.value)
  }, [stopGhost])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      // 取已确认的文本（如果 ghost 还在打字中途，用 committed 部分）
      const steps = stepsRef.current
      const idx = ghostStepRef.current
      const ghostCommitted = idx > 0 && steps[idx - 1] ? steps[idx - 1].committed : ''
      const text = userOwnedRef.current ? value.trim() : ghostCommitted.trim()
      if (!text) return

      stopGhost()
      userOwnedRef.current = false
      setFrozenText(text)
      setValue('')
      onSubmit(text)
    }
  }, [value, onSubmit, stopGhost])

  return (
    <div ref={boxRef} className="input-box">
      {fading && frozenText && (
        <p ref={inkRef} className="input-box__ink">{frozenText}</p>
      )}

      <textarea
        ref={textareaRef}
        className={`input-box__textarea${fading ? ' input-box__textarea--hidden' : ''}`}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="继续写……"
        rows={1}
        disabled={fading}
      />
    </div>
  )
}
