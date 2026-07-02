// Tabaqa Base — the design system, in the Uber Base layout but blue & white.
// Clean geometric sans (Inter), no monospace. A living reference for the app.
import { Link } from 'react-router-dom'
import { TabaqaMark } from './Logo'

const Arrow = ({ d = 0 }: { d?: number }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: `rotate(${d}deg)` }}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

const Nav = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l8 19-8-4-8 4 8-19z" /></svg>
)

function Swatch({ name, hex, fg = '#fff', border }: { name: string; hex: string; fg?: string; border?: boolean }) {
  return (
    <div className="b-swatch">
      <div className="b-chip" style={{ background: hex, color: fg, border: border ? '1px solid var(--line-2)' : 'none' }} />
      <div className="b-chip-meta"><strong>{name}</strong><span>{hex}</span></div>
    </div>
  )
}

function TypeSpec({ tag, spec, children }: { tag: string; spec: string; children: React.ReactNode }) {
  return (
    <div className="b-type">
      <div className="b-type-spec">{spec}</div>
      <div className={`b-type-sample ${tag}`}>{children}</div>
    </div>
  )
}

const SPACES: [string, number][] = [['X-Small', 16], ['Small', 24], ['Default', 36], ['Large', 48], ['X-Large', 64]]

export function BasePage() {
  return (
    <div className="base-page" dir="ltr">
      <header className="base-top">
        <Link to="/" className="logo"><TabaqaMark variant="gradient" /><span>Tabaqa</span></Link>
        <span className="base-kicker">Design System · Base</span>
      </header>

      <div className="base-grid">
        {/* ── left: icons, avatars, glyphs ── */}
        <section className="base-col">
          <div className="b-icons">
            {[45, 90, 135, 180, 0, -45].map((d, i) => (
              <span className="b-ic" key={i}><Arrow d={d} /></span>
            ))}
          </div>
          <div className="b-circles">
            <span className="b-circ solid"><Nav /></span>
            <span className="b-circ"><span style={{ color: 'var(--blue)' }}><Nav /></span></span>
            <span className="b-circ solid"><Arrow d={-90} /></span>
            <span className="b-circ"><span style={{ color: 'var(--blue)' }}><Arrow d={-90} /></span></span>
          </div>
          <div className="b-tiles">
            {[
              { c: '#00704A', t: '☕' }, { c: '#2563eb', t: '⬡' }, { c: '#2FA84F', t: '🛒' },
              { c: '#6A1B9A', t: '◰' }, { c: '#1d4ed8', t: '↻' }, { c: '#0f9d63', t: '✓' },
            ].map((x, i) => (
              <span className="b-tile" key={i} style={{ background: x.c }}>{x.t}</span>
            ))}
          </div>
          <div className="b-spacing">
            <div className="b-sub">Spacing</div>
            {SPACES.map(([label, px]) => (
              <div className="b-space-row" key={px}>
                <span className="b-space-n">{px}</span>
                <span className="b-space-bar" style={{ width: px * 1.7 }} />
                <span className="b-space-lbl">{label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── middle: headline, primary colors, components, buttons ── */}
        <section className="base-col base-mid">
          <h1 className="b-headline">This is<br />your <span>Base.</span></h1>

          <div className="b-sub">Primary</div>
          <div className="b-swatches">
            <Swatch name="Blue" hex="#2563EB" />
            <Swatch name="Ink" hex="#0A0D14" />
            <Swatch name="White" hex="#FFFFFF" fg="#0a0d14" border />
          </div>

          <div className="b-card">
            {[
              ['⬡', 'Connected bank', 'Edit'],
              ['◰', 'Connected wallet', 'Edit'],
            ].map(([ic, label, act]) => (
              <div className="b-row" key={label}>
                <span className="b-row-ic">{ic}</span>
                <span className="b-row-label">{label}</span>
                <button className="ub-btn ub-soft ub-sm">{act}</button>
              </div>
            ))}
            <div className="b-row">
              <span className="b-row-ic">✓</span>
              <span className="b-row-label">Verified income</span>
              <span className="b-row-actions">
                <button className="b-iconbtn" aria-label="message">✦</button>
                <button className="b-iconbtn" aria-label="call">↗</button>
              </span>
            </div>
          </div>

          <div className="b-buttons">
            <button className="ub-btn ub-soft ub-full">Label <Arrow /></button>
            <button className="ub-btn ub-primary ub-full">Let’s go <Arrow /></button>
            <button className="ub-btn ub-soft ub-full" disabled>Label <Arrow /></button>
          </div>
        </section>

        {/* ── right: type scale, secondary, controls ── */}
        <section className="base-col">
          <div className="b-sub">Type · Inter</div>
          <div className="b-typescale">
            <TypeSpec tag="b-display" spec="Inter · 60 Medium">Display</TypeSpec>
            <TypeSpec tag="b-heading" spec="Inter · 28 / 40 Medium">Heading</TypeSpec>
            <TypeSpec tag="b-label" spec="Inter · 18 / 28 Medium">Label</TypeSpec>
            <TypeSpec tag="b-para" spec="Inter · 14 / 20 Regular">
              Paragraph — verified income the bank can’t see.
            </TypeSpec>
          </div>

          <div className="b-sub" style={{ marginTop: 26 }}>Secondary</div>
          <div className="b-swatches b-sec">
            <Swatch name="Red 400" hex="#F15238" />
            <Swatch name="Orange 400" hex="#FF7D49" />
            <Swatch name="Green 400" hex="#47B275" />
          </div>

          <div className="b-sub" style={{ marginTop: 26 }}>Controls</div>
          <div className="b-controls">
            <span className="b-toggle on"><i /></span>
            <span className="b-toggle"><i /></span>
            <span className="b-check circ">✓</span>
            <span className="b-check sq">✓</span>
            <span className="b-pin"><span className="b-pin-lbl">Label</span><span className="b-pin-dot" /></span>
          </div>
        </section>
      </div>
    </div>
  )
}
