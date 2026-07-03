// Pure QR geometry for the branded Tabaqa QR — shared by the React component
// (StyledQR.tsx) and the offline scannability verifier, so both draw the exact
// same shapes. No React, no DOM: value → matrix → SVG primitives in module units.
import qrcode from 'qrcode-generator'

export interface QrShape {
  kind: 'circle' | 'rect'
  x: number; y: number            // circle → centre; rect → top-left
  w?: number; h?: number; r?: number
}

export interface QrGeometry {
  n: number                        // module count per side
  M: number                        // quiet-zone margin (modules)
  T: number                        // total viewBox units (n + 2M)
  dots: QrShape[]                  // data-area dots + connecting bridges
  eyes: { gx: number; gy: number }[]  // finder-eye top-left corners (in viewBox units)
  logoBox: { x: number; y: number; s: number } | null
}

export const QR_MARGIN = 4         // QR-spec minimum quiet zone
const DOT_R = 0.46                 // dot radius (module units) → small gap between runs

/** Build the drawable geometry. Returns n=0 if the value exceeds level-H capacity. */
export function qrGeometry(value: string, opts: { logo?: boolean } = {}): QrGeometry {
  const logo = opts.logo ?? true
  let n = 0
  let dark: boolean[][] = []
  try {
    const qr = qrcode(0, 'H')      // 0 = smallest fitting type; H = highest recovery
    qr.addData(value)
    qr.make()
    n = qr.getModuleCount()
    dark = Array.from({ length: n }, (_, r) =>
      Array.from({ length: n }, (_, c) => qr.isDark(r, c)),
    )
  } catch {
    return { n: 0, M: QR_MARGIN, T: 0, dots: [], eyes: [], logoBox: null }
  }

  const M = QR_MARGIN
  const T = n + M * 2
  const eyes = [
    { gx: M + 0, gy: M + 0 },
    { gx: M + (n - 7), gy: M + 0 },
    { gx: M + 0, gy: M + (n - 7) },
  ]
  const inEye = (r: number, c: number) =>
    [[0, 0], [0, n - 7], [n - 7, 0]].some(([er, ec]) =>
      r >= er && r < er + 7 && c >= ec && c < ec + 7)

  const S = logo ? Math.max(6, Math.round(n * 0.3)) : 0
  const r0 = Math.floor((n - S) / 2)
  const c0 = Math.floor((n - S) / 2)
  const inLogo = (r: number, c: number) => logo && r >= r0 && r < r0 + S && c >= c0 && c < c0 + S
  const paint = (r: number, c: number) => !!dark[r]?.[c] && !inEye(r, c) && !inLogo(r, c)

  const dots: QrShape[] = []
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!paint(r, c)) continue
      const cx = M + c + 0.5
      const cy = M + r + 0.5
      dots.push({ kind: 'circle', x: cx, y: cy, r: DOT_R })
      if (paint(r, c + 1)) dots.push({ kind: 'rect', x: cx, y: cy - DOT_R, w: 1, h: DOT_R * 2 })
      if (paint(r + 1, c)) dots.push({ kind: 'rect', x: cx - DOT_R, y: cy, w: DOT_R * 2, h: 1 })
    }
  }

  const logoBox = logo ? { x: M + c0 - 0.4, y: M + r0 - 0.4, s: S + 0.8 } : null
  return { n, M, T, dots, eyes, logoBox }
}
