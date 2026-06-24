import { motion } from 'framer-motion'
import type { CSSProperties } from 'react'

/**
 * GlowHorizon — an animated, glowing arc that rises into view like a horizon.
 *
 * Adapted from the original Tailwind-based component to this project, which does
 * NOT use Tailwind: every utility class has been folded into inline styles, and
 * the palette is tuned for a WHITE background — a near-white core blends into the
 * page so only the saturated blue rim reads as the glowing "horizon line".
 */

const EASE = [0.16, 1, 0.3, 1] as const
const DURATION = 2

export type GlowHorizonVariant = 'top' | 'bottom' | 'left' | 'right'

const VARIANTS: Record<
  GlowHorizonVariant,
  { axis: 'x' | 'y'; scaleAxis: 'scaleX' | 'scaleY'; enterPct: string; restPct: string }
> = {
  top: { axis: 'y', scaleAxis: 'scaleY', enterPct: '-100%', restPct: '-50%' },
  bottom: { axis: 'y', scaleAxis: 'scaleY', enterPct: '100%', restPct: '50%' },
  left: { axis: 'x', scaleAxis: 'scaleX', enterPct: '100%', restPct: '50%' },
  right: { axis: 'x', scaleAxis: 'scaleX', enterPct: '-100%', restPct: '-50%' },
}

/**
 * Stacked arcs, painted back → front (largest → smallest). Each smaller layer
 * sits on top of the larger ones, so every colour shows only as a thin concentric
 * band at the rim — together they read as one iridescent "atmosphere" around a
 * clean white sphere. The white core (front, largest opaque fill) keeps the
 * interior sleek and the headline readable. Retune the sphere here.
 */
const ARCS: Array<{ color: string; size: string; initialOffset?: string; blur?: number; boxShadow?: string; delay: number }> = [
  { color: '#bfe0ff', size: '133%', initialOffset: '10%', blur: 60, delay: 0 },   // soft light-blue — outer atmosphere
  { color: '#8ec5ff', size: '128%', initialOffset: '10%', blur: 40, delay: 0 },   // light blue
  { color: '#5aa9fb', size: '124%', initialOffset: '10%', blur: 24, delay: 0 },   // sky blue — body
  { color: '#ffffff', size: '121.5%', boxShadow: '0 0 34px 9px rgba(219,238,255,.92)', delay: 1.2 }, // bright white glowing crest
  { color: '#ffffff', size: '120%', initialOffset: '10%', blur: 22, delay: 0.6 }, // sleek white core (interior)
]

export interface GlowHorizonProps {
  className?: string
  style?: CSSProperties
  variant?: GlowHorizonVariant
}

export default function GlowHorizon({ className, style, variant = 'top' }: GlowHorizonProps) {
  const { axis, scaleAxis, enterPct, restPct } = VARIANTS[variant]

  return (
    <motion.div
      aria-hidden
      className={className}
      style={{ position: 'absolute', width: '100%', height: '100%', isolation: 'isolate', ...style }}
      initial={{ [axis]: enterPct, [scaleAxis]: 1.5, opacity: 0, filter: 'blur(15px)' }}
      animate={{ [axis]: restPct, [scaleAxis]: 1, opacity: 1, filter: 'blur(0px)' }}
      transition={{ duration: DURATION, ease: EASE }}
    >
      {ARCS.map((arc, i) => (
        <Arc key={i} variant={variant} {...arc} />
      ))}
    </motion.div>
  )
}

function Arc({
  variant,
  color,
  size,
  initialOffset,
  blur,
  boxShadow,
  delay,
}: {
  variant: GlowHorizonVariant
  color: string
  size: string
  initialOffset?: string
  blur?: number
  boxShadow?: string
  delay: number
}) {
  const scale = parseFloat(size) / 100
  const { axis, enterPct } = VARIANTS[variant]
  const sign = enterPct.startsWith('-') ? -1 : 1
  const startPct = initialOffset ? `${sign * Math.abs(parseFloat(initialOffset) - 50)}%` : undefined

  return (
    <motion.div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: '100%',
        scale,
        background: color,
        ...(blur !== undefined && { filter: `blur(${blur}px)` }),
        ...(boxShadow && { boxShadow }),
      }}
      initial={startPct ? { [axis]: startPct } : false}
      animate={startPct ? { [axis]: 0 } : undefined}
      transition={{ duration: DURATION, ease: EASE, delay }}
    />
  )
}
