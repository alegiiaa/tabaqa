import { useMemo } from 'react'
import { qrGeometry } from '../lib/qrgeom'

/**
 * Branded Tabaqa QR — matches the saved design (assets/qr-code.png): connected
 * rounded "pill" data modules, extra-rounded finder eyes, and the Tabaqa stacked
 * mark knocked out of the centre. Rendered as inline SVG so it prints crisply and
 * carries a UNIQUE value per document (each report keeps its own verify link).
 *
 * Display-only, Watheeq-style: the QR is a quiet document element — no buttons or
 * chrome. The look is built without an imperative styling library: dark modules
 * are drawn as circles, and adjacent dark modules are bridged with a bar — the
 * union reads as rounded pills for runs and dots for singletons. Error correction
 * is fixed at H so the centre logo excavation stays scannable.
 */

// The Tabaqa mark (three stacked rounded bars) in a 100×92 box — see Logo.tsx.
function MarkGlyph({ x, y, size, fill }: { x: number; y: number; size: number; fill: string }) {
  return (
    <svg x={x} y={y} width={size} height={size} viewBox="0 0 100 92" preserveAspectRatio="xMidYMid meet">
      <g fill={fill}>
        <rect x="6" y="66" width="88" height="20" rx="8" />
        <rect x="6" y="39" width="88" height="20" rx="8" />
        <rect x="6" y="12" width="88" height="20" rx="8" transform="rotate(-8 50 22)" />
      </g>
    </svg>
  )
}

// One extra-rounded finder eye: a rounded-square ring + a rounded-square pupil.
function Eye({ gx, gy, fg }: { gx: number; gy: number; fg: string }) {
  return (
    <g>
      <rect x={gx} y={gy} width={7} height={7} rx={2.4} fill={fg} />
      <rect x={gx + 1} y={gy + 1} width={5} height={5} rx={1.7} fill="#ffffff" />
      <rect x={gx + 2} y={gy + 2} width={3} height={3} rx={1.05} fill={fg} />
    </g>
  )
}

export function StyledQR({
  value,
  size = 84,
  fg = '#000000',
  logo = true,
  className,
}: {
  value: string
  size?: number
  fg?: string
  logo?: boolean
  className?: string
}) {
  const geom = useMemo(() => qrGeometry(value, { logo }), [value, logo])
  const { n, T, dots, eyes, logoBox } = geom
  if (n === 0) return null            // over-capacity → caller shows a text fallback

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${T} ${T}`}
      role="img"
      aria-label="Verification QR code"
      shapeRendering="geometricPrecision"
    >
      <rect x={0} y={0} width={T} height={T} fill="#ffffff" />
      {dots.map((s, i) =>
        s.kind === 'circle'
          ? <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={fg} />
          : <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} fill={fg} />,
      )}
      {eyes.map((e, i) => <Eye key={`e${i}`} gx={e.gx} gy={e.gy} fg={fg} />)}
      {logoBox && (
        <>
          <rect x={logoBox.x} y={logoBox.y} width={logoBox.s} height={logoBox.s} rx={1.6} fill="#ffffff" />
          <MarkGlyph
            x={logoBox.x + logoBox.s * 0.14}
            y={logoBox.y + logoBox.s * 0.14}
            size={logoBox.s * 0.72}
            fill={fg}
          />
        </>
      )}
    </svg>
  )
}
