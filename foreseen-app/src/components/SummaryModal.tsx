/**
 * [INPUT]: 依赖 react, gsap
 * [OUTPUT]: SummaryModal 组件，全屏模态展示角色洞察
 * [POS]: components/ 的结束态展示层，覆盖在书页之上
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import './SummaryModal.css'

interface Props {
  text: string
  onClose: () => void
}

export default function SummaryModal({ text, onClose }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.6 })
    gsap.fromTo(
      cardRef.current,
      { opacity: 0, scale: 0.95, filter: 'blur(4px)' },
      { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 1.2, delay: 0.3, ease: 'power2.out' }
    )
  }, [])

  const handleClose = () => {
    gsap.to(cardRef.current, { opacity: 0, scale: 0.97, duration: 0.6, ease: 'power2.in' })
    gsap.to(backdropRef.current, { opacity: 0, duration: 0.8, delay: 0.2, onComplete: onClose })
  }

  return (
    <div ref={backdropRef} className="summary-modal">
      <div ref={cardRef} className="summary-modal__card">
        <p className="summary-modal__text">{text}</p>
        <button className="summary-modal__close" onClick={handleClose}>翻页</button>
      </div>
    </div>
  )
}
