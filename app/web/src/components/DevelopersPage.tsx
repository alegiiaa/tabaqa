import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

const API = 'https://tabaqa-api.vercel.app'

function Code({ lang, children }: { lang: string; children: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="dv-code">
      <div className="dv-code-bar">
        <span>{lang}</span>
        <button
          onClick={() => { navigator.clipboard?.writeText(children); setCopied(true); setTimeout(() => setCopied(false), 1200) }}
        >{copied ? 'Copied ✓' : 'Copy'}</button>
      </div>
      <pre><code>{children}</code></pre>
    </div>
  )
}

function Endpoint({ method, path, children }: { method: string; path: string; children: ReactNode }) {
  return (
    <div className="dv-ep">
      <div className="dv-ep-head">
        <span className={`dv-method ${method.toLowerCase()}`}>{method}</span>
        <code className="dv-path">{path}</code>
      </div>
      {children}
    </div>
  )
}

const NAV = [
  ['overview', 'Overview'], ['quickstart', 'Quickstart'], ['score', 'Score'],
  ['insights', 'Insights'], ['affordability', 'Affordability'], ['assistant', 'Assistant'],
  ['model', 'Data model'], ['errors', 'Errors'], ['validation', 'How it’s validated'],
] as const

export function DevelopersPage() {
  return (
    <div className="dv">
      <header className="dv-top">
        <Link to="/" className="dv-logo">طبقة · Tabaqa <span>Developers</span></Link>
        <nav className="dv-top-links">
          <a href={`${API}/docs`} target="_blank" rel="noreferrer">API Console ↗</a>
          <Link to="/demo" className="btn btn-primary btn-sm">Try the demo →</Link>
        </nav>
      </header>

      <div className="dv-wrap">
        <aside className="dv-side">
          {NAV.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
          <div className="dv-side-foot">Base URL<code>{API}</code></div>
        </aside>

        <main className="dv-main">
          <section id="overview">
            <h1>Tabaqa API</h1>
            <p className="dv-lead">
              The credit-intelligence layer for Saudi open banking — as an API. Send a person's
              bank + wallet transactions; get back <strong>verified income</strong>, a
              <strong> 1–99 score</strong>, a risk flag, a SAMA-compliant affordability decision,
              and a plain-language financial read.
            </p>
            <div className="dv-facts">
              <div><span>Base URL</span><code>{API}</code></div>
              <div><span>Content type</span><code>application/json</code></div>
              <div><span>Auth</span><code>none (public demo)</code></div>
              <div><span>Console</span><a href={`${API}/docs`} target="_blank" rel="noreferrer">/docs ↗</a></div>
            </div>
            <p className="dv-note">
              The public demo is open. In production each lender gets an API key
              (<code>Authorization: Bearer …</code>) — the scoring engine is stateless, so keys gate
              access and rate, not state.
            </p>
          </section>

          <section id="quickstart">
            <h2>60-second quickstart</h2>
            <p>Score the demo applicant <code>con_8842</code> — one call returns the reveal, score,
              labelled transactions, and the financial-intelligence read.</p>
            <Code lang="bash">{`curl -s ${API}/v1/score \\
  -H 'Content-Type: application/json' \\
  -d '{"connection_id":"con_8842"}'`}</Code>
            <Code lang="json">{`{
  "tabaqa_score": 82,
  "pd": 0.041,
  "risk_flag": "low",
  "income": {
    "true_monthly_income": 10000,   // the reveal
    "bank_only_income": 4000,       // what a bank alone sees
    "reveal_delta": 6000,
    "verified_share": 0.92
  },
  "reasons": ["regular_income", "wallet_income_verified", "zero_nsf"],
  "insights": { "summary_line": "Fahd A. shows SAR 10,000/mo …" },
  "transactions": [ { "merchant": "Jahez", "pfc_primary": "INCOME" } ]
}`}</Code>
            <p className="dv-muted">Sample connections: <code>con_8842</code>, <code>con_gig_driver</code>,
              <code>con_sme_owner</code>, <code>con_thin_file</code>.</p>
          </section>

          <section id="score">
            <h2>① Verified income + 1–99 score</h2>
            <Endpoint method="POST" path="/v1/score">
              <p>Provide <strong>exactly one</strong> income source: <code>connection_id</code>,
                <code>form</code>, <code>statement</code> (a real uploaded CSV), or <code>fixture</code>.</p>
            </Endpoint>
            <h4>Score an uploaded statement (the "use my own data" path)</h4>
            <Code lang="bash">{`curl -s ${API}/v1/score -H 'Content-Type: application/json' -d '{
  "statement": {
    "name": "Sara",
    "rows": [
      {"date":"2026-03-25","description":"راتب","amount":7000,"source":"bank"},
      {"date":"2026-03-15","description":"Jahez payout","amount":2600,"source":"wallet"},
      {"date":"2026-03-10","description":"بنده","amount":-320,"source":"bank"}
    ],
    "context": {"bank_name":"alrajhi","wallet_name":"barq"}
  }
}'`}</Code>
            <table className="dv-table">
              <thead><tr><th>Response field</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>tabaqa_score</code></td><td>1–99 (higher = lower risk)</td></tr>
                <tr><td><code>pd</code> · <code>risk_flag</code></td><td>Probability of default · low / medium / high</td></tr>
                <tr><td><code>income.*</code></td><td>true vs bank-only income, reveal delta, verified share</td></tr>
                <tr><td><code>reason_codes[]</code></td><td>Every point of the score, explained</td></tr>
                <tr><td><code>transactions[]</code></td><td>Labelled with merchant, txn_type, verification, Plaid PFC</td></tr>
                <tr><td><code>insights</code></td><td>The financial-intelligence read (also at <code>/v1/insights</code>)</td></tr>
              </tbody>
            </table>
          </section>

          <section id="insights">
            <h2>② The deep financial read</h2>
            <Endpoint method="POST" path="/v1/insights">
              <p>Same inputs as <code>/v1/score</code>. Returns the "deep meaning" of the history —
                Claude-narrated when a key is set, else a faithful templated version.</p>
            </Endpoint>
            <Code lang="json">{`{
  "summary_line": "Fahd A. shows SAR 10,000/mo verified income (Gig 52%, Salary 40%, P2P 8%) …",
  "narrative": "Verified monthly income is SAR 10,000, of which SAR 4,000 is bank-side …",
  "highlights": ["Wallet reveal adds SAR 6,000/mo over bank-only view"],
  "risks": [],
  "income_trend": { "direction": "stable", "monthly": [ … ] },
  "diversification": { "label": "diversified", "concentration": 0.52 },
  "spending": { "monthly_total": 3550, "by_category": [ … ] },
  "savings_rate": 0.34, "runway_months": 2.8,
  "health": { "stability": 100, "resilience": 93, "diversification": 48 },
  "generated_by": "claude:claude-sonnet-4-6"
}`}</Code>
          </section>

          <section id="affordability">
            <h2>③ Responsible-lending decision</h2>
            <Endpoint method="POST" path="/v1/affordability">
              <p>Tests financing against income under the real <strong>SAMA Responsible Lending</strong>
                caps. Set <code>customer_type</code> (<code>employee</code> 33.33% / <code>retiree</code> 25%)
                or a custom <code>dbr_cap</code>.</p>
            </Endpoint>
            <Code lang="bash">{`curl -s ${API}/v1/affordability -H 'Content-Type: application/json' -d '{
  "connection_id":"con_8842","amount":60000,"tenor_months":48,
  "annual_rate":0.10,"customer_type":"employee"
}'`}</Code>
            <Code lang="json">{`{
  "installment": 1521.76, "dbr_after": 0.2322, "decision": "APPROVE",
  "bank_only": { "verified_income": 4000, "decision": "DECLINE" },   // the reveal's impact
  "dbr_policy": {
    "cap": 0.3333,
    "label": "SAMA salary-deduction cap — employees (33.33% of gross salary)",
    "citation": "SAMA Responsible Lending Principles, Circular 46538/99, Chapter IV"
  }
}`}</Code>
          </section>

          <section id="assistant">
            <h2>④ Conversational guide</h2>
            <Endpoint method="POST" path="/v1/assistant">
              <p>A Tabaqa-aware assistant (Claude when a key is set, else a bilingual scripted
                fallback). The Anthropic key stays server-side.</p>
            </Endpoint>
            <Code lang="bash">{`curl -s ${API}/v1/assistant -H 'Content-Type: application/json' -d '{
  "messages":[{"role":"user","content":"How do I connect my bank?"}],
  "context":{"section":"connect","connected":false}
}'`}</Code>
          </section>

          <section id="model">
            <h2>Core data model</h2>
            <p>Every transaction the pipeline emits:</p>
            <Code lang="json">{`{
  "source": "wallet:barq",            // "bank:<name>" | "wallet:<name>"
  "timestamp": "2026-03-15",
  "amount": 2600, "direction": "inflow",
  "raw_desc": "JAHEZ-RYD دفعة",
  "merchant": "Jahez", "category": "gig_platform",
  "txn_type": "gig_income",           // salary | gig_income | p2p | loan_obligation | purchase | internal_movement
  "verification": "source_verified",  // amount_verified | source_verified | inferred
  "pfc_primary": "INCOME", "pfc_detailed": "INCOME_OTHER_INCOME"   // Plaid PFC taxonomy
}`}</Code>
            <p className="dv-muted">The 3-tier <code>verification</code> is the trust signal:
              amount-verified (salary matched to a Masdr payslip IBAN ±5%), source-verified (gig from a
              registered establishment), inferred (P2P). The score rewards the <em>verified share</em> —
              never a raw P2P transfer.</p>
          </section>

          <section id="errors">
            <h2>Errors</h2>
            <p>Standard HTTP codes; the body is <code>{'{"detail": "..."}'}</code>.</p>
            <table className="dv-table">
              <thead><tr><th>Status</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>422</code></td><td>Could not process the input (bad/missing fields, or not exactly one income source).</td></tr>
                <tr><td><code>404</code></td><td>Unknown <code>connection_id</code> (the detail lists known ones).</td></tr>
                <tr><td><code>5xx</code></td><td>Server error — retry.</td></tr>
              </tbody>
            </table>
          </section>

          <section id="validation">
            <h2>How the model is validated</h2>
            <p>Tabaqa's numbers are measured, not asserted (<code>app/eval/</code>):</p>
            <ul className="dv-checks">
              <li><strong>Enricher accuracy</strong> — an honest, adversarial eval (messy Arabic,
                transliteration, long-tail merchants) → <strong>94.2% income-class accuracy</strong>.</li>
              <li><strong>PD model on real defaults</strong> — the same six features, fit on the public
                <strong> Berka / PKDD'99</strong> dataset (1M+ real transactions + loan outcomes) →
                <strong> 5-fold CV AUC 0.858, KS 0.562</strong>; default rate falls 38.7% → 0% across
                score bands. Reproducible via <code>python3 eval/berka_train.py</code>.</li>
            </ul>
            <p className="dv-muted">Grounded in standard tooling — <code>optbinning</code> scorecards,
              the Plaid PFC taxonomy, and SAMA responsible-lending caps — and validated against open data.</p>
            <div className="dv-end">
              <Link to="/demo" className="btn btn-primary">Try the live demo →</Link>
              <a className="btn btn-ghost" href={`${API}/docs`} target="_blank" rel="noreferrer">Open the API Console ↗</a>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
