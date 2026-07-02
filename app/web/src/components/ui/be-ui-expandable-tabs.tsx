import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'

/**
 * ExpandableTabs — a dock-style pill of icon tabs. Clicking a tab expands its
 * label inline and docks a content panel above the bar; clicking again (or
 * Escape / an outside click) collapses it.
 *
 * Adapted from the original shadcn/Tailwind component to THIS project, which
 * does NOT use Tailwind (see postcss.config.js): the utility classes have been
 * replaced with project `.dock-*` CSS classes (in styles.css) tuned for the
 * white/blue Tabaqa palette, and the heavy measuring logic has been swapped for
 * Framer Motion's native `width: 'auto'` / `height: 'auto'` animations.
 */

export type ExpandableTabsItem = {
  id: string
  label: string
  icon: ReactNode
  content: ReactNode
}

export interface ExpandableTabsProps {
  items: ExpandableTabsItem[]
  /** Controlled active id (null = collapsed). */
  value?: string | null
  /** Uncontrolled initial active id. */
  defaultValue?: string | null
  onValueChange?: (id: string | null) => void
  className?: string
  style?: CSSProperties
}

const PANEL_SPRING = { type: 'spring', stiffness: 420, damping: 40, mass: 0.5 } as const

export function ExpandableTabs({
  items,
  value,
  defaultValue = null,
  onValueChange,
  className,
  style,
}: ExpandableTabsProps) {
  const reduce = useReducedMotion()
  const rootRef = useRef<HTMLDivElement>(null)

  const controlled = value !== undefined
  const [internal, setInternal] = useState<string | null>(defaultValue)
  const activeId = controlled ? value : internal
  const active = items.find((item) => item.id === activeId) ?? null

  const setActive = useCallback(
    (next: string | null) => {
      if (!controlled) setInternal(next)
      onValueChange?.(next)
    },
    [controlled, onValueChange],
  )

  // Close on Escape or any pointer-down outside the dock.
  useEffect(() => {
    if (!active) return

    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setActive(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActive(null)
    }

    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [active, setActive])

  return (
    <div ref={rootRef} className={`dock-root${className ? ` ${className}` : ''}`} style={style}>
      <AnimatePresence initial={false}>
        {active ? (
          <motion.div
            key={active.id}
            className="dock-panel"
            initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0, y: 6, filter: 'blur(4px)' }}
            animate={
              reduce ? { opacity: 1 } : { opacity: 1, height: 'auto', y: 0, filter: 'blur(0px)' }
            }
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, y: 6, filter: 'blur(4px)' }}
            transition={reduce ? { duration: 0.12 } : PANEL_SPRING}
          >
            <div className="dock-card">{active.content}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="dock-bar" role="tablist" aria-label="Project links" aria-orientation="horizontal">
        {items.map((item) => {
          const isActive = item.id === active?.id
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={item.label}
              onClick={() => setActive(isActive ? null : item.id)}
              className={`dock-tab${isActive ? ' is-active' : ''}`}
            >
              <span className="dock-icon" aria-hidden>
                {item.icon}
              </span>
              <span className="dock-label">{item.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default ExpandableTabs
