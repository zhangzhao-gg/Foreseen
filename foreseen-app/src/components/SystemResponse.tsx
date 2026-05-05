/**
 * [INPUT]: 依赖 react/useEffect/useRef, gsap
 * [OUTPUT]: SystemResponse 组件，墨水从纸纤维间凝聚渗出
 * [POS]: components/ 的系统回应渲染器，SVG displacement 凝聚动效
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import './SystemResponse.css'

interface Props {
  lines: string[]
}

export default function SystemResponse({ lines }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const animatedCountRef = useRef(0)

  useEffect(() => {
    if (!containerRef.current) return
    const els = containerRef.current.querySelectorAll('.system-response__line')

    for (let i = animatedCountRef.current; i < els.length; i++) {
      gsap.fromTo(
        els[i],
        { opacity: 0, filter: 'blur(1.5px)' },
        {
          opacity: 1,
          filter: 'blur(0px)',
          duration: 1.5,
          delay: (i - animatedCountRef.current) * 0.3,
          ease: 'power2.out',
        }
      )
    }
    animatedCountRef.current = els.length
  }, [lines.length])

  return (
    <div ref={containerRef} className="system-response">
      {lines.map((line, i) => (
        <p key={i} className="system-response__line">
          {line}
        </p>
      ))}
    </div>
  )
}
