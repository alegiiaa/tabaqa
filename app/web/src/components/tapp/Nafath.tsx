// تسجيل الدخول عبر نفاذ (محاكاة) — the app's entry gate.
//
// The spec's identity moment, moved to the front door: type (or pick) a test
// national ID and the sandbox resolves WHO that is out of the 500,000-member
// synthetic population — live type-ahead while typing, and a full reveal
// (name · age · member number) the moment the 10th digit lands. Then the real
// Nafath UX contract runs unchanged: the service shows a two-digit number, the
// user taps the SAME number among three choices in the (simulated) Nafath app
// sheet, and the tap is verified server-side (/sandbox/v1/nafath/verify).
// Everything is labelled محاكاة — production integrates via the NIC/TCC
// agreement, which is a base-URL change in the same flow, not a redesign.

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CAST, nafathInit, nafathVerify, randomCohortMember, suggestIdentities, whoami,
  IdentitySuggestion, NafathSession, WhoAmI,
} from './engines'

type Phase = 'enter' | 'starting' | 'push' | 'checking' | 'ok'

export function NafathLogin({ onDone }: { onDone: (nin: string, s: NafathSession) => void }) {
  const [nin, setNin] = useState('')
  const [phase, setPhase] = useState<Phase>('enter')
  const [session, setSession] = useState<NafathSession | null>(null)
  const [sheet, setSheet] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [sampling, setSampling] = useState(false)

  // the reveal — fires by itself the moment the NIN is complete
  const [who, setWho] = useState<WhoAmI | null>(null)
  const [whoState, setWhoState] = useState<'idle' | 'busy' | 'unknown' | 'offline'>('idle')

  // type-ahead from the population while the NIN is partial
  const [sugg, setSugg] = useState<IdentitySuggestion[]>([])

  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

  const ninOk = /^[12]\d{9}$/.test(nin)

  // who-am-i: stale-guarded — fast typing or a suggestion tap can outrun a reply
  const whoSeq = useRef(0)
  useEffect(() => {
    setWho(null)
    setErr(null)
    if (!ninOk) { setWhoState('idle'); return }
    const seq = ++whoSeq.current
    setWhoState('busy')
    whoami(nin)
      .then((w) => { if (alive.current && whoSeq.current === seq) { setWho(w); setWhoState('idle') } })
      .catch((e: any) => {
        if (!alive.current || whoSeq.current !== seq) return
        setWhoState(e?.message === 'unknown-nin' ? 'unknown' : 'offline')
      })
  }, [nin, ninOk])

  // suggestions for 1–9 typed digits, debounced
  const sugSeq = useRef(0)
  useEffect(() => {
    if (phase !== 'enter' || nin.length === 0 || nin.length >= 10) { setSugg([]); return }
    const seq = ++sugSeq.current
    const t = window.setTimeout(() => {
      void suggestIdentities(nin, 5).then((list) => {
        if (alive.current && sugSeq.current === seq) setSugg(list)
      })
    }, 160)
    return () => window.clearTimeout(t)
  }, [nin, phase])

  async function start() {
    setErr(null)
    setSheet(false) // a cancelled run's 1100ms timer may have left it raised
    setPhase('starting')
    try {
      const s = await nafathInit(nin)
      if (!alive.current) return
      setSession(s)
      setPhase('push')
      // the "push notification" lands after a beat — then the Nafath sheet opens
      window.setTimeout(() => { if (alive.current) setSheet(true) }, 1100)
    } catch (e: any) {
      if (!alive.current) return
      setPhase('enter')
      setErr(e?.message === 'unknown-nin'
        ? 'هذه الهوية غير معروفة في البيئة التجريبية — استخدم الاقتراحات أو إحدى هويات العرض أدناه.'
        : 'أعضاء العينة الاصطناعية يتطلبون اتصالًا بالخادم — جرّب إحدى هويات العرض الثلاث.')
    }
  }

  async function tap(n: number) {
    if (!session) return
    setSheet(false)
    setPhase('checking')
    const ok = await nafathVerify(nin, session, n)
    if (!alive.current) return
    if (ok) {
      setPhase('ok')
      window.setTimeout(() => { if (alive.current) onDone(nin, session) }, 950)
    } else {
      setErr('الرقم المُدخل في نفاذ غير مطابق — أُلغي الطلب. أعد المحاولة واختر الرقم الظاهر هنا.')
      setSession(null)
      setPhase('enter')
    }
  }

  function cancel() {
    setSheet(false)
    setSession(null)
    setPhase('enter')
  }

  async function sample() {
    setSampling(true)
    setErr(null)
    try {
      const m = await randomCohortMember()
      if (alive.current) setNin(m.nin)
    } catch {
      if (alive.current) setErr('تعذّر جلب عضو من العينة — تحقق من تشغيل الخادم.')
    } finally {
      if (alive.current) setSampling(false)
    }
  }

  // three candidates: the real number + two decoys, order seeded by the request id
  const candidates = useMemo(() => {
    if (!session) return []
    const n = session.number
    const d1 = 10 + ((n + 17) % 90)
    const d2 = 10 + ((n + 43) % 90)
    const arr = [n, d1 === n ? d1 + 1 : d1, d2 === n || d2 === d1 ? d2 + 2 : d2]
    let h = 0
    for (const ch of session.requestId) h = (h * 31 + ch.charCodeAt(0)) >>> 0
    for (let i = arr.length - 1; i > 0; i--) {
      h = (h * 1103515245 + 12345) >>> 0
      const j = h % (i + 1)
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }, [session])

  const masked = ninOk ? `${nin.slice(0, 1)}•••••${nin.slice(6)}` : ''

  return (
    <div className="tp-login">
      <div className="tp-login-brand">
        <img src="/tabaqa-mark-blue.png" alt="" />
        <b>تطبيق طبقة</b>
        <p>كل عروض التمويل — بملفٍ واحدٍ صادق</p>
      </div>

      <div className="tp-login-card">
        <div className="tp-nafath-brand">
          <span>نفاذ · النفاذ الوطني الموحد</span>
          <span className="badge">محاكاة</span>
        </div>

        {(phase === 'enter' || phase === 'starting') && (
          <>
            <label className="tp-lab">رقم الهوية الوطنية / الإقامة</label>
            <input
              className="tp-nin" inputMode="numeric" maxLength={10} dir="ltr"
              value={nin} disabled={phase === 'starting'}
              onChange={(e) => setNin(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="1XXXXXXXXX"
              autoFocus
            />

            {sugg.length > 0 && (
              <div className="tp-sugg">
                <small className="tp-sugg-head">مطابقات من عينة 500,000 هوية اختبارية — اختر لإكمال الرقم</small>
                {sugg.map((s) => (
                  <button key={s.nin} className="tp-sugg-row" onClick={() => setNin(s.nin)}>
                    <span className={`tp-ava${s.kind === 'cast' ? ' cast' : ''}`}>{s.nameAr.charAt(0)}</span>
                    <span className="tp-sugg-who">
                      <b>{s.nameAr}</b>
                      <small>{s.hintAr}</small>
                    </span>
                    <span className="tp-sugg-nin">{s.nin}</span>
                  </button>
                ))}
              </div>
            )}
            {nin.length >= 2 && nin.length < 10 && sugg.length === 0 && (
              <p className="tp-hint" style={{ marginTop: 8 }}>
                لا هويات اختبارية تبدأ بهذه الأرقام — هويات العينة تبدأ بـ 1 وهويات العرض بـ 1 أو 2.
              </p>
            )}

            {ninOk && whoState === 'busy' && (
              <div className="tp-whoami wait">جارٍ التعرف على صاحب الهوية من العينة…</div>
            )}
            {who && (
              <div className="tp-whoami">
                <span className="tp-ava big">{who.nameAr.charAt(0)}</span>
                <span className="tp-whoami-txt">
                  <b>{who.nameAr}</b>
                  <small>
                    {who.age} عامًا · الهوية {masked}
                    {who.memberNo != null
                      ? <> · العضو {who.memberNo.toLocaleString('en-US')} من {who.population.toLocaleString('en-US')} في العينة</>
                      : <> · من هويات العرض المنسّقة</>}
                  </small>
                </span>
                <span className="tp-whoami-check">✓</span>
              </div>
            )}
            {whoState === 'unknown' && (
              <p className="tp-err">هذه الهوية غير مسجلة في البيئة التجريبية — اكتب أول أرقامها لتظهر لك الاقتراحات، أو اختر هوية عرض.</p>
            )}
            {whoState === 'offline' && (
              <p className="tp-err">أعضاء العينة يتطلبون اتصالًا بالخادم — وضع بدون اتصال يدعم هويات العرض الثلاث فقط.</p>
            )}
            {err && <p className="tp-err">{err}</p>}

            <button
              className="tp-cta"
              disabled={!ninOk || !who || phase === 'starting'}
              onClick={() => { void start() }}
            >
              {phase === 'starting'
                ? 'جارٍ فتح طلب نفاذ…'
                : who ? `الدخول عبر نفاذ — ${who.nameAr.split(' ')[0]}` : 'الدخول عبر نفاذ'}
            </button>

            <label className="tp-lab" style={{ marginTop: 16 }}>هويات العرض السريعة</label>
            <div className="tp-cast">
              {CAST.map((c) => (
                <button key={c.nin} onClick={() => setNin(c.nin)} disabled={phase === 'starting'}>
                  {c.nameAr}
                  <small>{c.hintAr}</small>
                </button>
              ))}
              <button onClick={() => { void sample() }} disabled={sampling || phase === 'starting'}>
                {sampling ? '…' : 'عضو عشوائي'}
                <small>من عينة 500,000 هوية اختبارية</small>
              </button>
            </div>

            <p className="tp-hint" style={{ marginTop: 12 }}>
              بيئة تجريبية بالكامل: الهويات اصطناعية ولا يوجد اتصال بمنصة نفاذ الفعلية.
              اقتراح الهويات وكشف الاسم قبل التوثيق خاصيتا محاكاة لاستكشاف العينة —
              في الإنتاج لا يظهر أي اسم إلا بعد التحقق عبر نفاذ.
            </p>
          </>
        )}

        {(phase === 'push' || phase === 'checking' || phase === 'ok') && session && (
          <div className="tp-nafath-wait">
            {phase !== 'ok' ? (
              <>
                <p className="tp-nafath-pulse">
                  أهلًا <b>{session.nameAr}</b> — أُرسل إشعار إلى تطبيق نفاذ على جوالك.
                </p>
                <div className="tp-nafath-num">{session.number}</div>
                <p className="tp-nafath-pulse">
                  {phase === 'checking'
                    ? 'جارٍ التحقق من اختيارك…'
                    : <>افتح تطبيق <b>نفاذ</b> واختر الرقم الظاهر أعلاه</>}
                </p>
                {phase === 'push' && (
                  <button className="tp-ghost" onClick={cancel}>إلغاء والعودة</button>
                )}
              </>
            ) : (
              <>
                <div className="tp-done-badge" style={{ marginTop: 26 }}>
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.7 4.6 4.6L19 7.7" /></svg>
                </div>
                <p><b>تم توثيق هويتك عبر نفاذ (محاكاة)</b><br />
                  <span className="tp-hint">{session.nameAr} · {masked}</span>
                </p>
              </>
            )}
          </div>
        )}

        {/* the simulated Nafath app — a sheet standing in for the real push-to-app moment */}
        {sheet && session && (
          <div className="tp-sheet-back" onClick={() => setSheet(true)}>
            <div className="tp-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="tp-sheet-head">
                <b>تطبيق نفاذ</b>
                <span className="badge">محاكاة</span>
              </div>
              <p>
                طلب دخول من <b>تطبيق طبقة</b> — للموافقة، اختر الرقم المطابق للرقم
                الظاهر في الخدمة:
              </p>
              <div className="tp-sheet-nums">
                {candidates.map((n) => (
                  <button key={n} className="tp-sheet-num" onClick={() => { void tap(n) }}>{n}</button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
