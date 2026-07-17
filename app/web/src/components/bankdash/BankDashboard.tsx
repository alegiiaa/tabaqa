// Bank Dashboard (PRODUCT_SPEC §15) — the bank's own view of the applications
// Tabaqa decided. Not a sales surface: monitoring, auditability and exception
// management. "For approved standard cases, no employee action is required" —
// so what earns its place here is Sara's honest decline and Khalid's contradiction.
//
// Every figure is read off the engine (PERSONAS → derive.ts → financeMath.ts) or
// off appdata.ts, which derives the four operational fields §15 asks for without
// inventing any of them. Nothing on this page is authored prose about a number.

import { useMemo, useState } from 'react'
import { useTx } from '../../lib/tx'
import { PERSONAS, Persona } from '../bank/connectors'
import { PersonaId } from '../bank/raw'
import { PRODUCT, fmt, pct } from '../bank/financeMath'
import { BANK_CONFIG } from '../bank/derive'
import { SAMA_CAP_EMPLOYEE } from '../../lib/lenders'
import {
  APP_ROWS, AppRow, AuditStep, VerifyRow, ENGINE_MS_NOTE, CONNECTOR_LATENCY_MS, RETRIEVAL_MS,
  REQUESTED_AMOUNT, auditSteps, ceilingFor, completion, grantableFor, rowFor, selectedOffer,
  submittedAt, verifyRows,
} from './appdata'

type L = { ar: string; en: string }

export function BankDashboard() {
  const { tx, dir } = useTx()
  // ?app=<persona> — rehearsal shortcut straight to a detail page.
  const seed = useMemo(() => {
    const q = new URLSearchParams(window.location.search).get('app')
    return q && q in PERSONAS ? (q as PersonaId) : null
  }, [])
  const [open, setOpen] = useState<PersonaId | null>(seed)

  return (
    <div className="bdx" dir={dir}>
      <header className="bdx-top">
        <div>
          <span className="bdx-mark">مصرف الواحة</span>
          <h1>{tx('Financing applications', 'طلبات التمويل')}</h1>
          <p>{tx(
            'Applications decided by the embedded Tabaqa engine — monitoring, audit and exception management.',
            'طلبات صادر فيها قرار عبر محرّك Tabaqa المضمَّن — للمتابعة والتدقيق ومعالجة الاستثناءات.',
          )}</p>
        </div>
        <span className="bdx-env">{tx('Demo data', 'بيانات تجريبية')}</span>
      </header>

      {open ? (
        <Detail p={PERSONAS[open]} onBack={() => setOpen(null)} />
      ) : (
        <Table rows={APP_ROWS} onOpen={setOpen} />
      )}
    </div>
  )
}

// ── Main table (§15) ─────────────────────────────────────────────────────────

function Table({ rows, onOpen }: { rows: AppRow[]; onOpen: (id: PersonaId) => void }) {
  const { tx } = useTx()
  const auto = rows.filter((r) => r.persona.decision !== 'review').length

  return (
    <>
      <div className="bdx-stats">
        <Stat v={String(rows.length)} l={tx('Applications', 'الطلبات')} />
        <Stat v={String(rows.filter((r) => r.persona.decision === 'approved').length)} l={tx('Approved', 'موافقة')} tone="ok" />
        <Stat v={String(rows.filter((r) => r.persona.decision === 'declined').length)} l={tx('Declined', 'رفض')} tone="bad" />
        <Stat v={String(rows.filter((r) => r.persona.decision === 'review').length)} l={tx('Needs review', 'تتطلب مراجعة')} tone="warn" />
        <Stat v={`${Math.round((auto / rows.length) * 100)}%`} l={tx('Decided without an employee', 'قرار دون تدخّل موظف')} />
      </div>

      <div className="bdx-tw">
        <table className="bdx-tbl">
          <thead>
            <tr>
              <th>{tx('Application ID', 'رقم الطلب')}</th>
              <th>{tx('Customer', 'العميل')}</th>
              <th>{tx('Product', 'المنتج')}</th>
              <th className="num">{tx('Requested', 'المبلغ المطلوب')}</th>
              <th className="num">{tx('Approved', 'المبلغ المعتمد')}</th>
              <th>{tx('Decision', 'القرار')}</th>
              <th>{tx('Grade', 'التصنيف')}</th>
              <th className="num">{tx('Completion', 'اكتمال الملف')}</th>
              <th>{tx('Submitted', 'تاريخ الطلب')}</th>
              <th className="num">{tx('Processing', 'زمن المعالجة')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} onClick={() => onOpen(r.persona.id)} tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && onOpen(r.persona.id)}>
                <td><span className="mono" dir="ltr">{r.id}</span></td>
                <td>
                  <b>{r.persona.nameAr}</b>
                  <small className="bdx-sub">{r.persona.nameEn}</small>
                </td>
                <td>{r.product}</td>
                <td className="num">{fmt(r.requested)}</td>
                <td className="num">
                  {r.approved === null
                    ? <span className="bdx-none">—</span>
                    : <b>{fmt(r.approved)}</b>}
                </td>
                <td><Pill d={r.persona.decision} /></td>
                <td><span className="bdx-grade">{r.grade}</span></td>
                <td className="num">
                  <Meter pct={r.completionPct} />
                </td>
                <td>
                  <span className="mono" dir="ltr">{r.submitted.date}</span>
                  <small className="bdx-sub mono" dir="ltr">{r.submitted.time}</small>
                </td>
                <td className="num mono" dir="ltr">{(r.processingMs / 1000).toFixed(2)}s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="bdx-note">
        {tx(
          `Processing time = the five connectors' real retrieval latency (${RETRIEVAL_MS} ms, sequential); the engine itself runs ${ENGINE_MS_NOTE.en}. Submission timestamps are the retrieved_at stamps in the connector payloads. Completion = the share of the six verification checks that cleared.`,
          `زمن المعالجة = زمن الجلب الفعلي للموصلات الخمسة (${RETRIEVAL_MS} ملّي ثانية، تسلسليًا)؛ والمحرّك نفسه يعمل في ${ENGINE_MS_NOTE.ar}. تواريخ الطلبات مأخوذة من طوابع retrieved_at في حمولات الموصلات. اكتمال الملف = نسبة ما اجتاز من فحوص التحقق الستة.`,
        )}
      </p>
      <p className="bdx-note">{tx('Select a row to open the application file.', 'اختر صفًا لفتح ملف الطلب.')}</p>
    </>
  )
}

// ── Detail page (§15) ────────────────────────────────────────────────────────

function Detail({ p, onBack }: { p: Persona; onBack: () => void }) {
  const { tx } = useTx()
  const r = rowFor(p)
  const rec = p.raw.employment.record
  const comp = completion(p)
  const offer = selectedOffer(p)
  const ceiling = ceilingFor(p.installmentRoom)
  const age = ageOf(p)
  const SAR = tx('SAR', 'ر.س')

  return (
    <>
      <button className="bdx-back" onClick={onBack}>{tx('‹ All applications', '‹ كل الطلبات')}</button>

      <div className="bdx-dhead">
        <div>
          <h2>{p.nameAr}</h2>
          <span className="bdx-sub mono" dir="ltr">{r.id} · {p.nameEn}</span>
        </div>
        <Pill d={p.decision} big />
      </div>

      {/* Decision summary (§15) — the engine's own words, not a restatement. */}
      <Section title={tx('Decision summary', 'ملخّص القرار')}>
        <div className={`bdx-dec ${p.decision}`}>
          <b>{decisionLabel(p, tx)}</b>
          <p>{tx(p.reasonEn, p.reasonAr)}</p>
          <span className="bdx-sub">{p.noteAr}</span>
        </div>
        {p.decision === 'approved' && (
          <p className="bdx-note">{tx(
            'Standard approved case — no employee action required (spec §15).',
            'حالة موافقة قياسية — لا تتطلب أي إجراء من الموظف (المواصفة §15).',
          )}</p>
        )}
      </Section>

      {/* Customer summary (§15) */}
      <Section title={tx('Customer summary', 'ملخّص العميل')}>
        <div className="bdx-facts">
          <Fact l={tx('Name', 'الاسم')} v={p.nameAr} />
          {/* Age: §15 asks for it, the employment registry payload has no
              date_of_birth — so the row is omitted rather than invented. */}
          {age !== null && <Fact l={tx('Age', 'العمر')} v={String(age)} />}
          <Fact l={tx('Employment sector', 'قطاع العمل')} v={p.profile.sector} />
          <Fact l={tx('Employer', 'جهة العمل')} v={String(rec.employer_name)} />
          <Fact
            l={tx('Monthly salary', 'الراتب الشهري')}
            v={`${fmt(p.profile.verifiedSalary)} ${SAR}`}
            sub={p.profile.salaryMatchesEmployment
              ? tx('verified against the employment source', 'موثّق ومطابق لمصدر التوظيف')
              : tx(`derived from transactions — the source claims ${fmt(p.profile.claimedSalary)}`, `مستنبط من الحركات — المصدر يعلن ${fmt(p.profile.claimedSalary)}`)}
            tone={p.profile.salaryMatchesEmployment ? undefined : 'warn'}
          />
          <Fact
            l={tx('Employment duration', 'مدة الخدمة')}
            v={tx(`${p.profile.serviceYears} years`, `${p.profile.serviceYears} سنوات`)}
            sub={tx(`since ${rec.employment_start_date}`, `منذ ${rec.employment_start_date}`)}
          />
        </div>
      </Section>

      {/* Financial summary (§15) */}
      <Section title={tx('Financial summary', 'الملخّص المالي')}>
        <div className="bdx-facts">
          <Fact
            l={tx('Total eligible income', 'إجمالي الدخل المعتمد')}
            v={`${fmt(p.eligibleIncome)} ${SAR}`}
            sub={tx(`bank-only view: ${fmt(p.bankOnlyIncome)}`, `على بيانات المصرف وحده: ${fmt(p.bankOnlyIncome)}`)}
          />
          <Fact l={tx('Essential expenses', 'المصروفات الأساسية')} v={`${fmt(p.profile.essentials)} ${SAR}`} />
          <Fact
            l={tx('Existing obligations', 'الالتزامات القائمة')}
            v={`${fmt(p.profile.obligations)} ${SAR}`}
            sub={tx(`${r.obligationLines.length} lines · ${r.obligationLines.filter((o) => o.seenInTransactions).length} corroborated`, `${r.obligationLines.length} التزامات · ${r.obligationLines.filter((o) => o.seenInTransactions).length} مطابق لحركات فعلية`)}
          />
          <Fact
            l={tx('Available monthly installment', 'القسط الشهري المتاح')}
            v={`${fmt(p.installmentRoom)} ${SAR}`}
            sub={`${fmt(p.eligibleIncome)} × ${(SAMA_CAP_EMPLOYEE * 100).toFixed(2)}% − ${fmt(p.profile.obligations)}`}
            tone={p.installmentRoom <= 0 ? 'bad' : undefined}
          />
          <Fact
            l={tx('Maximum approved financing', 'أقصى تمويل معتمد')}
            v={maxFinancingValue(p, ceiling, SAR)}
            sub={maxFinancingNote(p, tx)}
            tone={p.decision === 'approved' ? undefined : 'warn'}
          />
        </div>

        {/* The obligation lines, each cross-checked against real debits. */}
        <div className="bdx-obl">
          {r.obligationLines.map((o, i) => (
            <div className="bdx-obl-row" key={i}>
              <span className={`bdx-ic ${o.seenInTransactions ? 'ok' : 'bad'}`}>{o.seenInTransactions ? '✓' : '✕'}</span>
              <span>{o.type}</span>
              <b className="mono" dir="ltr">{fmt(o.monthly)}</b>
              <small className="bdx-sub">{o.seenInTransactions
                ? tx('matched to a real recurring debit', 'مطابق لخصم متكرر فعلي')
                : tx('reported by the bureau, not seen in transactions', 'مُبلَّغ من السجل الائتماني ولم يظهر في الحركات')}</small>
            </div>
          ))}
        </div>
      </Section>

      {/* Data verification (§15) */}
      <Section
        title={tx('Data verification', 'التحقق من البيانات')}
        aside={<span className={`bdx-count ${comp.passed === comp.total ? 'ok' : 'warn'}`} dir="ltr">{comp.passed}/{comp.total}</span>}
      >
        <div className="bdx-vrows">
          {verifyRows(p).map((v, i) => <VRow key={i} v={v} />)}
        </div>
      </Section>

      {/* Offer selected (§15) — only for a journey that reached the offers screen. */}
      <Section title={tx('Offer selected', 'العرض المختار')}>
        {offer ? (
          <div className="bdx-facts">
            <Fact l={tx('Amount', 'المبلغ')} v={`${fmt(grantableFor(p))} ${SAR}`} />
            <Fact l={tx('Term', 'المدة')} v={tx(`${offer.months} months`, `${offer.months} شهرًا`)} />
            <Fact l={tx('Monthly installment', 'القسط الشهري')} v={`${fmt(offer.installment)} ${SAR}`} />
            <Fact l={tx('APR', 'معدل النسبة السنوي')} v={pct(offer.apr)} />
            <Fact l={tx('Total repayment', 'إجمالي المبلغ المستحق')} v={`${fmt(offer.total)} ${SAR}`}
                  sub={tx(`incl. ${fmt(offer.adminFee)} admin fee`, `شاملًا ${fmt(offer.adminFee)} رسوم إدارية`)} />
          </div>
        ) : (
          <div className="bdx-empty">
            <b>{tx('No offer selected', 'لا يوجد عرض مختار')}</b>
            <p>{p.decision === 'declined'
              ? tx('The application was declined before the offers screen — no offer was ever presented.', 'رُفض الطلب قبل شاشة العروض — لم يُعرض أي عرض إطلاقًا.')
              : tx('The application is with a human reviewer — no offer is presented until the income conflict is resolved.', 'الطلب لدى مراجع بشري — لا تُعرض أي عروض قبل حسم التعارض في الدخل.')}</p>
          </div>
        )}
      </Section>

      {/* Audit timeline (§15) */}
      <Section title={tx('Audit timeline', 'سجل التدقيق')}>
        <div className="bdx-time">
          {auditSteps(p).map((s, i) => <Step key={i} s={s} n={i + 1} />)}
        </div>
        <p className="bdx-note">{tx(
          `Retrieval: ${Object.entries(CONNECTOR_LATENCY_MS).map(([k, v]) => `${k} ${v}ms`).join(' · ')} = ${RETRIEVAL_MS}ms.`,
          `زمن الجلب: ${Object.entries(CONNECTOR_LATENCY_MS).map(([k, v]) => `${k} ${v}`).join(' · ')} = ${RETRIEVAL_MS} ملّي ثانية.`,
        )}</p>
      </Section>

      <p className="bdx-foot">{tx(
        `Product: ${PRODUCT.nameAr} · income floor ${fmt(BANK_CONFIG.minEligibleIncome)} ${SAR} · salary counted at ${BANK_CONFIG.salaryCountPct * 100}%, stable side income at ${BANK_CONFIG.stableSideIncomePct * 100}% (bank-configurable, spec §7). Decisions computed by the embedded Tabaqa engine.`,
        `المنتج: ${PRODUCT.nameAr} · حد أدنى للدخل ${fmt(BANK_CONFIG.minEligibleIncome)} ${SAR} · يُحتسب الراتب بنسبة ${BANK_CONFIG.salaryCountPct * 100}% والدخل الجانبي المستقر بنسبة ${BANK_CONFIG.stableSideIncomePct * 100}% (قابل للضبط من المصرف — المواصفة §7). القرارات محسوبة عبر محرّك Tabaqa المضمَّن.`,
      )}</p>
    </>
  )
}

// ── pieces ───────────────────────────────────────────────────────────────────

/**
 * §15 asks for the applicant's age. The employment registry payload carries no
 * date_of_birth for any of the three, so this returns null and the row is dropped.
 * Kept live (rather than deleted) so a payload that DOES carry one renders it —
 * measured against the submission date, never the wall clock, so it cannot drift.
 */
function ageOf(p: Persona): number | null {
  const dob = p.raw.employment.record.date_of_birth
  if (typeof dob !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null
  const [by, bm, bd] = dob.split('-').map(Number)
  const [sy, sm, sd] = submittedAt(p).date.split('-').map(Number)
  if (!sy) return null
  return sy - by - (sm < bm || (sm === bm && sd < bd) ? 1 : 0)
}

function maxFinancingValue(p: Persona, ceiling: number, SAR: string): string {
  // Approved → the ceiling the engine cleared. Declined → the computed 0 (no room
  // under the cap is the decline itself). Review → nothing is approved, and a
  // ceiling built on an income the engine refused to reconcile would be the exact
  // lie this product exists to refuse. So: em dash.
  if (p.decision === 'review') return '—'
  return `${fmt(ceiling)} ${SAR}`
}

function maxFinancingNote(p: Persona, tx: (e: string, a: string) => string): string {
  if (p.decision === 'approved') {
    return tx(`granted ${fmt(grantableFor(p))} of the ${fmt(REQUESTED_AMOUNT)} requested`, `اعتُمد ${fmt(grantableFor(p))} من أصل ${fmt(REQUESTED_AMOUNT)} مطلوبة`)
  }
  if (p.decision === 'declined') {
    return tx('no room under the cap — nothing can be extended', 'لا يوجد متسع تحت الحد النظامي — لا يمكن منح أي مبلغ')
  }
  return tx('not approved — pending human review of the income conflict', 'لم يُعتمد — بانتظار مراجعة بشرية للتعارض في الدخل')
}

function decisionLabel(p: Persona, tx: (e: string, a: string) => string): string {
  if (p.decision === 'approved') return tx('Automatically approved', 'موافقة تلقائية')
  if (p.decision === 'declined') return tx('Declined', 'رفض')
  return tx('Routed to manual review', 'محال لمراجعة يدوية')
}

function Pill({ d, big }: { d: Persona['decision']; big?: boolean }) {
  const { tx } = useTx()
  const label = d === 'approved' ? tx('Approved', 'موافقة') : d === 'declined' ? tx('Declined', 'رفض') : tx('Review', 'مراجعة')
  return <span className={`bdx-pill ${d}${big ? ' big' : ''}`}>{label}</span>
}

function Meter({ pct: v }: { pct: number }) {
  return (
    <span className="bdx-meter">
      <span className="bdx-meter-bar"><i style={{ width: `${v}%` }} className={v === 100 ? 'ok' : 'warn'} /></span>
      <b className="mono" dir="ltr">{v}%</b>
    </span>
  )
}

function Stat({ v, l, tone }: { v: string; l: string; tone?: 'ok' | 'bad' | 'warn' }) {
  return (
    <div className={`bdx-stat${tone ? ' ' + tone : ''}`}>
      <span className="bdx-stat-v">{v}</span>
      <span className="bdx-stat-l">{l}</span>
    </div>
  )
}

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bdx-sec">
      <div className="bdx-sec-head">
        <h3>{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
}

function Fact({ l, v, sub, tone }: { l: string; v: string; sub?: string; tone?: 'warn' | 'bad' }) {
  return (
    <div className={`bdx-fact${tone ? ' ' + tone : ''}`}>
      <small>{l}</small>
      <b>{v}</b>
      {sub && <span className="bdx-sub">{sub}</span>}
    </div>
  )
}

function VRow({ v }: { v: VerifyRow }) {
  const { tx, lang } = useTx()
  const pick = (x: L) => (lang === 'ar' ? x.ar : x.en)
  const badge = v.state === 'conflict'
    ? tx('Conflict', 'تعارض')
    : v.state === 'verified' ? tx('Verified', 'موثّق') : tx('Retrieved', 'مُستلم')
  return (
    <div className={`bdx-vrow ${v.state}`}>
      <span className={`bdx-ic ${v.state === 'conflict' ? 'bad' : 'ok'}`}>{v.state === 'conflict' ? '✕' : '✓'}</span>
      <div className="bdx-vtxt">
        <b>{pick(v.label)} <span className={`bdx-badge ${v.state}`}>{badge}</span></b>
        <span className="bdx-sub">{pick(v.detail)}</span>
      </div>
    </div>
  )
}

function Step({ s, n }: { s: AuditStep; n: number }) {
  const { lang } = useTx()
  const pick = (x: L) => (lang === 'ar' ? x.ar : x.en)
  return (
    <div className={`bdx-step ${s.state}`}>
      <span className="bdx-step-ic">{s.state === 'done' ? '✓' : '○'}</span>
      <div className="bdx-step-txt">
        <b><span className="bdx-step-n mono" dir="ltr">{n}</span> {pick(s.label)}</b>
        {s.detail && <span className="bdx-sub">{pick(s.detail)}</span>}
      </div>
    </div>
  )
}
