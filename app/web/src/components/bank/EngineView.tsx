// The engine, seen from inside the phone. Reached only by tapping the Tabaqa mark
// on the bank's home screen — never a tab, because this is NOT the customer's view
// (a customer's bank app must never browse other applicants).
//
// It answers the question the journey provokes: "that worked for Ahmed — does it
// hold?" The Scale Explorer takes it from 1 to 1,000,000 applicants, each one an
// individual the same §10 rules decide.

import { ScaleExplorer } from '../dashboard/ScaleExplorer'
import { PERSONA_LIST } from './connectors'

const DEC_AR: Record<string, { t: string; cls: string }> = {
  approved: { t: 'موافقة تلقائية', cls: 'ok' },
  declined: { t: 'رفض تلقائي', cls: 'bad' },
  review: { t: 'مراجعة يدوية', cls: 'warn' },
}

export function EngineView({ onBack }: { onBack: () => void }) {
  return (
    <div className="bk-engine">
      <header className="bk-engine-head">
        <button className="bk-back" onClick={onBack} aria-label="رجوع">‹</button>
        <div>
          <b>محرك Tabaqa</b>
          <small>خرجتَ من تطبيق المصرف — هذه واجهة المحرك نفسه</small>
        </div>
      </header>

      {/* The three §10 outcomes, computed — the bridge from Ahmed to the million. */}
      <section className="bk-engine-sec">
        <h3>القرارات الثلاثة — محسوبة، لا موسومة</h3>
        <p className="bk-engine-p">
          نفس المحرك، نفس السياسة، ثلاثة ملفات ببيانات مختلفة — والنتيجة تختلف لأن البيانات تختلف.
        </p>
        <div className="bk-engine-personas">
          {PERSONA_LIST.map((p) => {
            const d = DEC_AR[p.decision]
            return (
              <div key={p.id} className="bk-engine-persona">
                <div className="bk-engine-persona-top">
                  <b>{p.nameAr}</b>
                  <span className={`bk-engine-dec ${d.cls}`}>{d.t}</span>
                </div>
                <small>{p.reasonAr}</small>
              </div>
            )
          })}
        </div>
      </section>

      {/* The scale story — 1 → 1,000,000. */}
      <section className="bk-engine-sec">
        <ScaleExplorer />
      </section>
    </div>
  )
}
