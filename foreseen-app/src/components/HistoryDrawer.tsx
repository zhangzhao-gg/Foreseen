/**
 * [INPUT]: 依赖 react, gsap, ../systems/storage
 * [OUTPUT]: HistoryDrawer 组件，左侧抽屉展示历史对话记录
 * [POS]: components/ 的历史浏览层，固定定位不影响主布局
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { getAllEntries, type DiaryEntry } from '../systems/storage'
import './HistoryDrawer.css'

interface Props {
  open: boolean
  onToggle: () => void
}

export default function HistoryDrawer({ open, onToggle }: Props) {
  const [entries, setEntries] = useState<DiaryEntry[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const drawerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setEntries(getAllEntries().reverse())
      setExpandedId(null)
    }
  }, [open])

  useEffect(() => {
    if (!drawerRef.current) return
    gsap.killTweensOf(drawerRef.current)
    gsap.to(drawerRef.current, {
      x: open ? 0 : '-100%',
      duration: 0.5,
      ease: 'power2.inOut',
    })
  }, [open])

  return (
    <>
      <button className="history-drawer__trigger" onClick={onToggle}>
        <span className="history-drawer__trigger-icon">☰</span>
      </button>

      {open && <div className="history-drawer__backdrop" onClick={onToggle} />}

      <div ref={drawerRef} className="history-drawer">
        <div className="history-drawer__header">
          <span className="history-drawer__title">过往记录</span>
          <button className="history-drawer__close" onClick={onToggle}>×</button>
        </div>

        <div className="history-drawer__list">
          {entries.length === 0 && (
            <p className="history-drawer__empty">还没有记录。</p>
          )}

          {entries.map(entry => (
            <div key={entry.id} className="history-drawer__item">
              <div
                className="history-drawer__item-header"
                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              >
                <p className="history-drawer__item-summary">
                  {entry.summary.length > 60 ? entry.summary.slice(0, 60) + '…' : entry.summary}
                </p>
                <span className="history-drawer__item-meta">
                  {entry.date} · {entry.roundCount}轮
                </span>
              </div>

              {expandedId === entry.id && (
                <div className="history-drawer__detail">
                  {entry.messages.map((msg, i) => (
                    <p key={i} className={`history-drawer__msg history-drawer__msg--${msg.role}`}>
                      {msg.content}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
