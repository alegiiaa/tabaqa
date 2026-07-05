/** U3 · tap-to-explain — a small ⓘ that opens a plain-language popover.
 *
 * Tap/click to open (touch-first — judges may review on phones), tap anywhere
 * else / Escape / scroll to close. Rendered through a portal so transformed or
 * overflow-hidden ancestors can never clip it; position is computed from the
 * trigger rect and clamped to the viewport, which also keeps it RTL-safe.
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTx } from '../../lib/tx'
import { GLOSSARY, type GlossaryKey } from '../../lib/glossary'

interface Pos { top: number; left: number; width: number; above: boolean }

export function InfoTip({ k }: { k: GlossaryKey }) {
  const { tx, dir } = useTx()
  const [pos, setPos] = useState<Pos | null>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const entry = GLOSSARY[k]

  function toggle(e: React.MouseEvent) {
    e.stopPropagation() // triggers often live inside clickable cards
    if (pos) { setPos(null); return }
    const r = btn.current?.getBoundingClientRect()
    if (!r) return
    const width = Math.min(300, window.innerWidth - 24)
    const left = Math.min(Math.max(12, r.left + r.width / 2 - width / 2), window.innerWidth - width - 12)
    const above = r.top > 150
    setPos({ top: above ? r.top - 8 : r.bottom + 8, left, width, above })
  }

  useEffect(() => {
    if (!pos) return
    const close = (e: Event) => {
      if (e.target instanceof Node && btn.current?.contains(e.target)) return
      setPos(null)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setPos(null) }
    const scroll = () => setPos(null)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', esc)
    window.addEventListener('scroll', scroll, true)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', esc)
      window.removeEventListener('scroll', scroll, true)
    }
  }, [pos])

  return (
    <>
      <button
        ref={btn}
        type="button"
        className="tip-btn"
        aria-label={tx('What is this?', 'ما هذا؟')}
        aria-expanded={!!pos}
        onClick={toggle}
      >
        i
      </button>
      {pos && createPortal(
        <span
          className="tip-pop"
          role="tooltip"
          dir={dir}
          style={{
            top: pos.top,
            left: pos.left,
            width: pos.width,
            transform: pos.above ? 'translateY(-100%)' : undefined,
          }}
        >
          <b>{tx(entry.term[0], entry.term[1])}</b>
          {tx(entry.body[0], entry.body[1])}
        </span>,
        document.body,
      )}
    </>
  )
}
