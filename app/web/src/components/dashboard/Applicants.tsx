import { useEffect, useState } from 'react'
import { useTx } from '../../lib/tx'
import { NewApplicant, type ScoredPayload } from './NewApplicant'
import { Result } from './Result'
import { LenderImpact } from './LenderImpact'
import { api, type ScoreResult } from '../../lib/api'
import {
  listApplicants,
  saveScoredApplicant,
  deleteApplicant,
  PersistenceUnavailable,
  type SavedApplicant,
} from '../../lib/db'

const fmt = (n: number) => Math.round(n).toLocaleString('en-US')

type View =
  | { kind: 'list' }
  | { kind: 'new' }
  | { kind: 'result'; result: ScoreResult; name: string; source: string; initialTab?: 'memo' }

/** The lender-side CRM: score other people (upload / form / persona) and keep a history. */
export function Applicants() {
  const { tx } = useTx()
  const [view, setView] = useState<View>({ kind: 'list' })
  const [applicants, setApplicants] = useState<SavedApplicant[]>([])
  const [loading, setLoading] = useState(true)
  const [persistMsg, setPersistMsg] = useState<string | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      setApplicants(await listApplicants())
      setPersistMsg(null)
    } catch (e: any) {
      if (e instanceof PersistenceUnavailable) {
        setPersistMsg(
          tx(
            'Saved history is unavailable until the applicants/scores migration is applied. Scoring still works.',
            'حفظ السجل غير متاح حتى يتم تطبيق ترحيل قاعدة البيانات. التقييم يعمل.',
          ),
        )
      } else {
        setPersistMsg(tx(
          'Couldn’t load saved applicants — new scoring still works. Reopen this tab to retry.',
          'تعذّر تحميل المتقدمين المحفوظين — التقييم الجديد يعمل. أعد فتح هذا التبويب للمحاولة مجددًا.',
        ))
      }
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onScored(p: ScoredPayload) {
    const source =
      p.input_kind === 'statement'
        ? tx('uploaded statement', 'كشف مرفوع')
        : p.input_kind === 'persona'
          ? tx('sample persona', 'نموذج جاهز')
          : tx('guided form', 'نموذج موجّه')
    setView({ kind: 'result', result: p.result, name: p.name, source })
    try {
      await saveScoredApplicant({
        name: p.name,
        connection_id: p.connection_id ?? p.result.applicant?.connection_id ?? null,
        input_kind: p.input_kind,
        input: p.input,
        result: p.result,
      })
      refresh()
    } catch {
      /* persistence optional — the score is already on screen */
    }
  }

  async function openSaved(a: SavedApplicant) {
    try {
      let result: ScoreResult
      if (a.input_kind === 'persona' && a.connection_id) {
        result = await api.scoreConnection(a.connection_id)
      } else if (a.input_kind === 'statement') {
        result = await api.scoreStatement(a.input)
      } else {
        result = await api.scoreForm(a.input)
      }
      // A saved file re-opened by an officer starts on the decision memo —
      // the reveal theatre already played the first time it was scored.
      setView({ kind: 'result', result, name: a.name, source: tx('saved', 'محفوظ'), initialTab: 'memo' })
    } catch {
      setPersistMsg(tx(
        'Couldn’t re-score this applicant right now. Check your connection and tap the card again.',
        'تعذّر إعادة تقييم هذا المتقدم الآن. تحقق من اتصالك واضغط على البطاقة مجددًا.',
      ))
    }
  }

  async function remove(a: SavedApplicant, e: React.MouseEvent) {
    e.stopPropagation()
    try {
      await deleteApplicant(a.id)
      refresh()
    } catch {
      setPersistMsg(tx(
        'Couldn’t delete this applicant right now — try again in a moment.',
        'تعذّر حذف هذا المتقدم الآن — حاول مجددًا بعد لحظات.',
      ))
    }
  }

  return (
    <div className="screen">
      {persistMsg && <div className="persist-banner" style={{ marginBottom: 18 }}>{persistMsg}</div>}

      {view.kind === 'list' && (
        <>
          <ApplicantsList
            applicants={applicants}
            loading={loading}
            onNew={() => setView({ kind: 'new' })}
            onOpen={openSaved}
            onRemove={remove}
          />
          <LenderImpact />
        </>
      )}
      {view.kind === 'new' && (
        <NewApplicant onScored={onScored} onCancel={() => setView({ kind: 'list' })} />
      )}
      {view.kind === 'result' && (
        <Result
          result={view.result}
          name={view.name}
          source={view.source}
          initialTab={view.initialTab}
          onBack={() => setView({ kind: 'list' })}
        />
      )}
    </div>
  )
}

function ApplicantsList({
  applicants, loading, onNew, onOpen, onRemove,
}: {
  applicants: SavedApplicant[]
  loading: boolean
  onNew: () => void
  onOpen: (a: SavedApplicant) => void
  onRemove: (a: SavedApplicant, e: React.MouseEvent) => void
}) {
  const { tx } = useTx()

  return (
    <div className="list">
      <div className="list-head">
        <div>
          <h1>{tx('Applicants', 'المتقدمون')}</h1>
          <p className="faint">{tx('Score anyone — upload a statement, fill the form, or pick a persona.', 'قيّم أي شخص — ارفع كشفًا، أو املأ النموذج، أو اختر نموذجًا جاهزًا.')}</p>
        </div>
        <button className="btn btn-primary" onClick={onNew}>+ {tx('New applicant', 'متقدم جديد')}</button>
      </div>

      {loading ? (
        <div className="skel-wrap" aria-busy="true">
          <div className="skel" style={{ height: 74 }} />
          <div className="skel" style={{ height: 74 }} />
          <div className="skel" style={{ height: 74 }} />
        </div>
      ) : applicants.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">⬡</div>
          <div className="empty-title">{tx('No applicants yet', 'لا يوجد متقدمون بعد')}</div>
          <p className="faint">{tx('Create your first applicant to see the reveal, the score, the ledger and affordability.', 'أنشئ أول متقدم لرؤية الكشف والدرجة والسجل والقدرة على السداد.')}</p>
          <button className="btn btn-primary" onClick={onNew}>+ {tx('New applicant', 'متقدم جديد')}</button>
        </div>
      ) : (
        <div className="cards">
          {applicants.map((a) => (
            <div className="acard" key={a.id} onClick={() => onOpen(a)} role="button" tabIndex={0}>
              <div className="acard-top">
                <strong>{a.name}</strong>
                <button className="acard-x" onClick={(e) => onRemove(a, e)} aria-label="delete">×</button>
              </div>
              <div className="acard-kind faint small">{a.input_kind}</div>
              {a.score ? (
                <>
                  <div className="acard-reveal">
                    <span className="faint">{fmt(a.score.bank_only_income ?? 0)}</span>
                    <span className="arr">→</span>
                    <span className="accent-num">{fmt(a.score.verified_income ?? 0)}</span>
                  </div>
                  <div className="acard-foot">
                    <span className="tag t-src">{tx('Score', 'الدرجة')} {a.score.tabaqa_score}</span>
                    <span className={`tag ${a.score.risk_flag === 'low' ? 't-ok' : 't-inf'}`}>{a.score.risk_flag}</span>
                  </div>
                </>
              ) : (
                <div className="faint small">{tx('open to score', 'افتح للتقييم')}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
