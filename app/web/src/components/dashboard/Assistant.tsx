import { useEffect, useRef, useState } from 'react'
import { useTx } from '../../lib/tx'
import { api, type AssistantMessage } from '../../lib/api'

/** Minimal rich text: **bold** segments + line breaks. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, li) => (
        <span key={li}>
          {li > 0 && <br />}
          {line.split('**').map((seg, i) => (i % 2 ? <strong key={i}>{seg}</strong> : <span key={i}>{seg}</span>))}
        </span>
      ))}
    </>
  )
}

/**
 * Tabaqa Guide — a conversational onboarding assistant. Greets new users, answers
 * "how do I connect my bank?", and points them to the right screen. Powered by Claude
 * via /v1/assistant when a key is set, else a helpful bilingual fallback.
 */
export function Assistant({ section, connected }: { section: string; connected: boolean }) {
  const { tx, lang } = useTx()
  const greeting = tx(
    "Hi! I'm your Tabaqa guide 👋  Ask me anything — how to connect accounts, what your score means, or how to use your own data.",
    'أهلًا! أنا مرشد Tabaqa 👋  اسألني أي شيء — كيف تربط حساباتك، ماذا تعني درجتك، أو كيف تستخدم بياناتك.',
  )
  const [open, setOpen] = useState(false)
  const [nudge, setNudge] = useState(false)
  const [messages, setMessages] = useState<AssistantMessage[]>([{ role: 'assistant', content: greeting }])
  const [chips, setChips] = useState<string[]>([
    tx('How do I connect my bank?', 'كيف أربط حسابي البنكي؟'),
    tx('What does my score mean?', 'ماذا تعني درجتي؟'),
    tx('Can I upload my own statement?', 'هل أرفع كشف حسابي؟'),
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  // First-time visitors: pulse the button + show a one-time invite bubble.
  useEffect(() => {
    if (localStorage.getItem('tabaqa.assistant.seen')) return
    const t = setTimeout(() => setNudge(true), 1200)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  function openPanel() {
    setOpen(true); setNudge(false)
    localStorage.setItem('tabaqa.assistant.seen', '1')
  }

  async function send(text: string) {
    const q = text.trim()
    if (!q || loading) return
    const next = [...messages, { role: 'user' as const, content: q }]
    setMessages(next); setInput(''); setLoading(true)
    try {
      const r = await api.assistant(next, { section, connected })
      setMessages((m) => [...m, { role: 'assistant', content: r.reply }])
      if (r.suggestions?.length) setChips(r.suggestions)
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: tx(
        'Sorry — I had trouble reaching the server. Please try again.',
        'عذرًا — تعذّر الوصول إلى الخادم. حاول مجددًا.',
      ) }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={`asst ${lang === 'ar' ? 'rtl' : ''}`}>
      {open && (
        <div className="asst-panel" role="dialog" aria-label="Tabaqa Guide">
          <div className="asst-head">
            <div className="asst-head-l">
              <span className="asst-orb"><span /></span>
              <div>
                <strong>{tx('Tabaqa Guide', 'مرشد Tabaqa')}</strong>
                <span className="asst-status">{tx('AI assistant · here to help', 'مساعد ذكي · في خدمتك')}</span>
              </div>
            </div>
            <button className="asst-x" onClick={() => setOpen(false)} aria-label="Close">✕</button>
          </div>

          <div className="asst-body" ref={bodyRef}>
            {messages.map((m, i) => (
              <div key={i} className={`asst-msg ${m.role}`}>
                {m.role === 'assistant' && <span className="asst-av">✦</span>}
                <div className="asst-bubble"><Rich text={m.content} /></div>
              </div>
            ))}
            {loading && (
              <div className="asst-msg assistant">
                <span className="asst-av">✦</span>
                <div className="asst-bubble"><span className="asst-typing"><i /><i /><i /></span></div>
              </div>
            )}
          </div>

          {!loading && chips.length > 0 && (
            <div className="asst-chips">
              {chips.slice(0, 3).map((c, i) => (
                <button key={i} className="asst-chip" onClick={() => send(c)}>{c}</button>
              ))}
            </div>
          )}

          <form className="asst-input" onSubmit={(e) => { e.preventDefault(); send(input) }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={tx('Ask anything…', 'اسأل أي شيء…')}
              aria-label={tx('Message', 'رسالة')}
            />
            <button type="submit" disabled={loading || !input.trim()} aria-label={tx('Send', 'إرسال')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg>
            </button>
          </form>
        </div>
      )}

      {nudge && !open && (
        <button className="asst-nudge" onClick={openPanel}>
          {tx('👋 New here? Ask me anything', '👋 جديد؟ اسألني أي شيء')}
        </button>
      )}

      {!open && (
        <button className={`asst-fab ${nudge ? 'pulse' : ''}`} onClick={openPanel} aria-label={tx('Open Tabaqa Guide', 'افتح مرشد Tabaqa')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /></svg>
        </button>
      )}
    </div>
  )
}
