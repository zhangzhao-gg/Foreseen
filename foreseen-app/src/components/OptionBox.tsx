/**
 * [INPUT]: 依赖 react/useEffect/useRef/useCallback, gsap
 * [OUTPUT]: OptionBox 组件，日记本写出的两行念头，点击后原地吸收
 * [POS]: components/ 的选项渲染器，看起来像纸上的文字而非 UI 按钮
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useEffect, useRef, useCallback } from 'react'
import gsap from 'gsap'
import './OptionBox.css'

interface Option {
  id: string
  text: string
}

interface Props {
  options: Option[]
  onChoice: (id: string) => void
}

export default function OptionBox({ options, onChoice }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const lockedRef = useRef(false)

  useEffect(() => {
    if (!containerRef.current) return
    lockedRef.current = false
    const items = containerRef.current.querySelectorAll('.option-line, .option-box__or')
    items.forEach((item, i) => {
      gsap.fromTo(
        item,
        { opacity: 0, filter: 'blur(3px)' },
        {
          opacity: 1,
          filter: 'blur(0px)',
          duration: 1.5,
          delay: 0.8 + i * 0.4,
          ease: 'power2.out',
        }
      )
    })
  }, [options])

  const handleClick = useCallback((id: string, el: HTMLElement) => {
    if (lockedRef.current) return
    lockedRef.current = true

    // 选中行高亮后立即通知上层
    gsap.to(el, {
      textShadow: '0 0 2px var(--ink-deep)',
      fontWeight: 600,
      duration: 0.3,
      ease: 'power2.out',
      onComplete: () => onChoice(id),
    })
  }, [onChoice])

  return (
    <div ref={containerRef} className="option-box">
      {options.map((opt) => (
        <span
          key={opt.id}
          className="option-line"
          onClick={(e) => handleClick(opt.id, e.currentTarget)}
        >
          {opt.text}
        </span>
      ))}
      <span className="option-box__or">或者：</span>
    </div>
  )
}
