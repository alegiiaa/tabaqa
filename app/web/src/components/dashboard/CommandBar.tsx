import { useEffect, useRef, useState } from 'react'
import { useTx } from '../../lib/tx'
import { api, type AssistantAction, type AssistantMessage } from '../../lib/api'

/** Minimal rich text: **bold** + line breaks. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, li) => (
        <span key={li}>
          {li > 0 && <br />}
          {line.split('**').map((s, i) => (i % 2 ? <strong key={i}>{s}</strong> : <span key={i}>{s}</span>))}
        </span>
      ))}
    </>
  )
}

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/**
 * Tabaqa Copilot — a Wispr-style command capsule anchored to the bottom of the app.
 * Premium midnight-blue glass pill, electric-cyan accents, voice + text. Understands
 * the whole app and *acts* inside Tabaqa (navigates, opens screens) — never the OS.
 * Powered by /v1/assistant; the Anthropic key stays server-side, and it degrades to a
 * deterministic guide when no key is set.
 */
export function CommandBar({
  section, connected, onAction, facts,
}: {
  section: string; connected: boolean; onAction: (a: AssistantAction) => void
  /** The applicant's real scoring output — the only numbers the LLM may use (firewalled server-side). */
  facts?: Record<string, unknown> | null
}) {
  const { tx, lang } = useTx()
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const [listening, setListening] = useState(false)
  const [loading, setLoading] = useState(false)
  const [reply, setReply] = useState<string | null>(null)
  const [acting, setActing] = useState<string | null>(null)
  const [retry, setRetry] = useState<string | null>(null)
  const [recSecs, setRecSecs] = useState(0)
  const [nudge, setNudge] = useState(false)
  const [chips, setChips] = useState<string[]>([
    tx('How do I connect my bank?', 'كيف أربط حسابي؟'),
    tx('How much can I borrow?', 'كم يمكنني أن أقترض؟'),
    tx('Explain my score', 'اشرح درجتي'),
  ])
  const messages = useRef<AssistantMessage[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const recRef = useRef<any>(null)
  const timerRef = useRef<any>(null)

  const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  const voiceOK = !!SR

  useEffect(() => {
    if (localStorage.getItem('tabaqa.copilot.seen')) return
    const t = setTimeout(() => setNudge(true), 1400)
    return () => clearTimeout(t)
  }, [])

  // Seed the hero question from the applicant's REAL numbers once facts arrive
  // (never mid-conversation, and re-worded on language switch). The financing
  // question leads and the score question rides second — offers-first, like the app.
  useEffect(() => {
    if (!facts || messages.current.length) return
    const f = facts as any
    const score = f?.score
    if (score == null) return
    // Already-prime profiles have no "reach Y" gap — ask for the why instead.
    const target = f?.recourse?.already_prime ? null : f?.recourse?.target_score
    setChips([
      tx('How much can I borrow?', 'كم يمكنني أن أقترض؟'),
      target != null && target > score
        ? tx(`Why is my score ${score} — and how do I reach ${target}?`, `ليش درجتي ${score}؟ ووش أسوي عشان أوصل ${target}؟`)
        : tx(`Why is my score ${score} — what lifted it?`, `ليش درجتي ${score}؟ ووش اللي رفعها؟`),
      tx('How is my income verified?', 'كيف يتم توثيق دخلي؟'),
    ])
  }, [facts, tx])
  useEffect(() => () => clearInterval(timerRef.current), [])

  const SECTION_LABEL: Record<string, string> = {
    home: tx('My money', 'أموالي'), income: tx('Income & Score', 'الدخل والدرجة'),
    ledger: tx('Ledger', 'السجل'), financing: tx('Offers', 'العروض'),
    applicants: tx('Applicants', 'المتقدمون'),
  }
  function actingText(a: AssistantAction): string {
    if (a.type === 'navigate' && a.section) return `${tx('Opening', 'فتح')} ${SECTION_LABEL[a.section] ?? a.section}…`
    if (a.type === 'open' && a.target === 'developers') return `${tx('Opening Developer docs', 'فتح وثائق المطوّرين')}…`
    return ''
  }

  function dismissNudge() { setNudge(false); localStorage.setItem('tabaqa.copilot.seen', '1') }

  async function send(text: string) {
    const q = text.trim()
    if (!q || loading) return
    dismissNudge()
    messages.current = [...messages.current, { role: 'user', content: q }]
    setInput(''); setOpen(true); setLoading(true); setReply(null); setActing(null); setRetry(null)
    try {
      const r = await api.assistant(messages.current, { section, connected, facts: facts ?? undefined })
      messages.current = [...messages.current, { role: 'assistant', content: r.reply }]
      setReply(r.reply)
      if (r.suggestions?.length) setChips(r.suggestions)
      if (r.action && r.action.type !== 'none') {
        const label = actingText(r.action)
        if (label) setActing(label)
        setTimeout(() => { onAction(r.action as AssistantAction); setActing(null) }, 850)
      }
    } catch {
      messages.current = messages.current.slice(0, -1)  // drop the failed turn so retry is clean
      setReply(tx('Couldn’t reach the server.', 'تعذّر الوصول إلى الخادم.'))
      setRetry(q)
    } finally {
      setLoading(false)
    }
  }

  function stopTimer() { clearInterval(timerRef.current) }

  function startVoice() {
    if (!voiceOK || listening) return
    const rec = new SR()
    recRef.current = rec
    rec.lang = lang === 'ar' ? 'ar-SA' : 'en-US'
    rec.interimResults = true
    rec.continuous = true
    rec.onresult = (e: any) => {
      let t = ''
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript
      setInput(t)
    }
    rec.onerror = () => { stopTimer(); setListening(false) }
    rec.onend = () => { stopTimer(); setListening(false) }
    setInput(''); dismissNudge(); setListening(true); setRecSecs(0)
    timerRef.current = setInterval(() => setRecSecs((s) => s + 1), 1000)
    rec.start()
  }
  function confirmVoice() {
    const t = input
    stopTimer(); setListening(false)
    try { recRef.current?.stop() } catch { /* ignore */ }
    if (t.trim()) send(t)
  }
  function cancelVoice() {
    stopTimer()
    try { recRef.current?.abort() } catch { /* ignore */ }
    setListening(false); setInput('')
  }

  return (
    <div className={`cmd ${lang === 'ar' ? 'rtl' : ''}`}>
      {nudge && (
        <button className="cmd-nudge" onClick={() => { dismissNudge(); inputRef.current?.focus() }}>
          {tx('Ask me anything — or tap the mic 🎙️', 'اسألني أي شيء — أو اضغط المايك 🎙️')}
        </button>
      )}

      {open && (reply || loading || acting || chips.length > 0) && (
        <div className="cmd-card">
          <button className="cmd-card-x" onClick={() => setOpen(false)} aria-label="Close">✕</button>
          <div className="cmd-card-head"><span className="cmd-orb"><span /></span>{tx('Tabaqa Copilot', 'مساعد Tabaqa')}</div>
          {loading && <div className="cmd-think"><i /><i /><i /></div>}
          {reply && <div className="cmd-reply"><Rich text={reply} /></div>}
          {retry && (
            <button className="cmd-retry" onClick={() => send(retry)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 4v5h-5" /></svg>
              {tx('Tap to retry', 'اضغط لإعادة المحاولة')}
            </button>
          )}
          {acting && <div className="cmd-acting">{acting}</div>}
          {!loading && !retry && chips.length > 0 && (
            <div className="cmd-chips">
              {chips.slice(0, 3).map((c, i) => <button key={i} className="cmd-chip" onClick={() => send(c)}>{c}</button>)}
            </div>
          )}
        </div>
      )}

      {listening ? (
        <div className="cmd-cap recording">
          <button className="cmd-circle cancel" onClick={cancelVoice} aria-label={tx('Cancel', 'إلغاء')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
          <span className="cmd-timer">{fmtTime(recSecs)}</span>
          <div className="cmd-dots" aria-hidden>
            {Array.from({ length: 16 }).map((_, i) => <i key={i} style={{ animationDelay: `${i * 0.07}s` }} />)}
          </div>
          <button className="cmd-circle confirm" onClick={confirmVoice} aria-label={tx('Confirm', 'تأكيد')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4 10-11" /></svg>
          </button>
        </div>
      ) : (
        <form className="cmd-cap" onSubmit={(e) => { e.preventDefault(); send(input) }}>
          <span className="cmd-spark" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /></svg>
          </span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => { dismissNudge(); setOpen(true) }}
            placeholder={tx('Ask Tabaqa anything…', 'اسأل Tabaqa أي شيء…')}
            aria-label={tx('Ask Tabaqa', 'اسأل Tabaqa')}
          />
          {input.trim()
            ? <button type="submit" className="cmd-circle send" aria-label={tx('Send', 'إرسال')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h13M13 6l6 6-6 6" /></svg>
              </button>
            : voiceOK && <button type="button" className="cmd-circle mic" onClick={startVoice} aria-label={tx('Dictate', 'إملاء')}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4" /></svg>
              </button>}
        </form>
      )}
    </div>
  )
}
