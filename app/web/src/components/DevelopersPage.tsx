import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

const API = 'https://tabaqa-api.vercel.app'

/** One ping on mount — the hero says "live" because it just checked, not because we claim it. */
function useApiLive(): boolean | null {
  const [live, setLive] = useState<boolean | null>(null)
  useEffect(() => {
    let on = true
    fetch(`${API}/health`).then((r) => on && setLive(r.ok)).catch(() => on && setLive(false))
    return () => { on = false }
  }, [])
  return live
}

/** Highlight the sidebar link of the section currently in view. */
function useScrollSpy(ids: readonly string[]): string {
  const [active, setActive] = useState(ids[0])
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => { for (const e of entries) if (e.isIntersecting) setActive(e.target.id) },
      { rootMargin: '-15% 0px -75% 0px' },
    )
    ids.forEach((id) => { const el = document.getElementById(id); if (el) obs.observe(el) })
    return () => obs.disconnect()
  }, [ids])
  return active
}

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

// ── live playground ────────────────────────────────────────────────────────
const EP: { path: string; label: string; body: string }[] = [
  { path: '/v1/score', label: 'Score', body: JSON.stringify({ connection_id: 'con_8842' }, null, 2) },
  { path: '/v1/insights', label: 'Insights', body: JSON.stringify({ connection_id: 'con_8842' }, null, 2) },
  {
    path: '/v1/affordability', label: 'Affordability',
    body: JSON.stringify({ connection_id: 'con_8842', amount: 60000, tenor_months: 48, annual_rate: 0.10, customer_type: 'employee' }, null, 2),
  },
]

type Lang = 'curl' | 'js' | 'python'
type RunResult =
  | { kind: 'ok'; status: number; ok: boolean; ms: number; scope: string | null; limit: string | null; remaining: string | null; body: string }
  | { kind: 'err'; message: string }
  | null
type IssueResult = { kind: 'key'; key: string; note: string } | { kind: 'err'; message: string } | null

function compact(bodyStr: string): string {
  try { return JSON.stringify(JSON.parse(bodyStr)) } catch { return bodyStr.replace(/\s+/g, ' ').trim() }
}

function snippet(lang: Lang, path: string, bodyStr: string, key: string): string {
  if (lang === 'curl') {
    const auth = key ? ` \\\n  -H 'Authorization: Bearer ${key}'` : ''
    return `curl -s ${API}${path} \\\n  -H 'Content-Type: application/json'${auth} \\\n  -d '${compact(bodyStr)}'`
  }
  if (lang === 'js') {
    const auth = key ? `,\n    "Authorization": "Bearer ${key}"` : ''
    return `const res = await fetch("${API}${path}", {\n  method: "POST",\n  headers: {\n    "Content-Type": "application/json"${auth}\n  },\n  body: JSON.stringify(${compact(bodyStr)})\n});\nconst data = await res.json();\nconsole.log(data);`
  }
  const auth = key ? `,\n    headers={"Authorization": "Bearer ${key}"}` : ''
  return `import requests, json\n\nbody = json.loads('''${compact(bodyStr)}''')\nres = requests.post("${API}${path}", json=body${auth})\nprint(res.status_code, res.json())`
}

function Playground() {
  const [epIdx, setEpIdx] = useState(0)
  const [body, setBody] = useState(EP[0].body)
  const [apiKey, setApiKey] = useState<string>(() => {
    try { return localStorage.getItem('tabaqa_dev_key') || '' } catch { return '' }
  })
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<RunResult>(null)
  const [issuing, setIssuing] = useState(false)
  const [issued, setIssued] = useState<IssueResult>(null)
  const [lang, setLang] = useState<Lang>('curl')

  const ep = EP[epIdx]

  function selectEp(i: number) { setEpIdx(i); setBody(EP[i].body); setResult(null) }

  async function run() {
    setRunning(true); setResult(null)
    const t0 = performance.now()
    try {
      const res = await fetch(`${API}${ep.path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
        body,
      })
      const ms = Math.round(performance.now() - t0)
      const text = await res.text()
      let pretty = text
      try { pretty = JSON.stringify(JSON.parse(text), null, 2) } catch { /* leave raw */ }
      setResult({
        kind: 'ok', status: res.status, ok: res.ok, ms,
        scope: res.headers.get('x-ratelimit-scope'),
        limit: res.headers.get('x-ratelimit-limit'),
        remaining: res.headers.get('x-ratelimit-remaining'),
        body: pretty,
      })
    } catch (e) {
      setResult({ kind: 'err', message: e instanceof Error ? e.message : String(e) })
    } finally { setRunning(false) }
  }

  async function issueKey() {
    setIssuing(true); setIssued(null)
    try {
      const res = await fetch(`${API}/v1/keys`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: 'playground' }),
      })
      const data = await res.json()
      if (res.ok && data.api_key) {
        setApiKey(data.api_key)
        try { localStorage.setItem('tabaqa_dev_key', data.api_key) } catch { /* ignore */ }
        setIssued({ kind: 'key', key: data.api_key, note: data.note || '' })
      } else {
        setIssued({ kind: 'err', message: data.detail || 'Key issuance is currently unavailable — anonymous calls still work.' })
      }
    } catch (e) {
      setIssued({ kind: 'err', message: e instanceof Error ? e.message : String(e) })
    } finally { setIssuing(false) }
  }

  return (
    <div className="dv-pg">
      <div className="dv-pg-keybar">
        <div className="dv-pg-keyfield">
          <label>API key <span>optional — anonymous demo works too</span></label>
          <input value={apiKey} onChange={e => setApiKey(e.target.value)} spellCheck={false}
            placeholder="tbq_sk_…  (leave blank to call anonymously)" />
        </div>
        <button className="btn btn-ghost btn-sm" onClick={issueKey} disabled={issuing}>
          {issuing ? 'Issuing…' : 'Get a sandbox key'}
        </button>
      </div>
      {issued?.kind === 'key' && (
        <div className="dv-pg-issued ok">
          <strong>Sandbox key issued — shown once, store it now:</strong>
          <code>{issued.key}</code>
          <p>{issued.note}</p>
        </div>
      )}
      {issued?.kind === 'err' && <div className="dv-pg-issued warn">{issued.message}</div>}

      <div className="dv-pg-tabs">
        {EP.map((e, i) => (
          <button key={e.path} className={i === epIdx ? 'active' : ''} onClick={() => selectEp(i)}>
            <span className="dv-method post">POST</span> {e.path}
          </button>
        ))}
      </div>

      <textarea className="dv-pg-body mono" value={body} spellCheck={false}
        onChange={e => setBody(e.target.value)} rows={Math.min(14, body.split('\n').length + 1)} />
      <div className="dv-pg-actions">
        <button className="btn btn-primary" onClick={run} disabled={running}>{running ? 'Running…' : 'Run ▶'}</button>
        <span className="dv-pg-target mono">POST {API}{ep.path}</span>
      </div>

      {result?.kind === 'ok' && (
        <div className="dv-pg-res">
          <div className="dv-pg-resbar">
            <span className={`dv-pg-status ${result.ok ? 'ok' : 'bad'}`}>{result.status}</span>
            <span className="dv-pg-ms">{result.ms} ms</span>
            {result.scope && <span className="dv-pg-chip">scope: {result.scope}</span>}
            {result.remaining && <span className="dv-pg-chip">remaining: {result.remaining}/{result.limit}</span>}
          </div>
          <pre className="dv-pg-out"><code>{result.body}</code></pre>
        </div>
      )}
      {result?.kind === 'err' && (
        <div className="dv-pg-res">
          <div className="dv-pg-resbar"><span className="dv-pg-status bad">network</span></div>
          <pre className="dv-pg-out"><code>{result.message}</code></pre>
        </div>
      )}

      <div className="dv-pg-snip">
        <div className="dv-pg-sniptabs">
          {(['curl', 'js', 'python'] as Lang[]).map(l => (
            <button key={l} className={l === lang ? 'active' : ''} onClick={() => setLang(l)}>
              {l === 'js' ? 'JavaScript' : l === 'python' ? 'Python' : 'cURL'}
            </button>
          ))}
        </div>
        <Code lang={lang === 'js' ? 'javascript' : lang === 'python' ? 'python' : 'bash'}>
          {snippet(lang, ep.path, body, apiKey)}
        </Code>
      </div>
    </div>
  )
}

const NAV = [
  ['overview', 'Overview'], ['playground', 'Playground'],
  ['auth', 'Authentication'], ['score', 'Score'],
  ['insights', 'Insights'], ['affordability', 'Affordability'], ['assistant', 'Assistant'],
  ['model', 'Data model'], ['errors', 'Errors'], ['validation', 'How it’s validated'],
] as const
const NAV_IDS = NAV.map(([id]) => id)

export function DevelopersPage() {
  const live = useApiLive()
  const active = useScrollSpy(NAV_IDS)
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
          {NAV.map(([id, label]) => (
            <a key={id} href={`#${id}`} className={active === id ? 'on' : ''}>{label}</a>
          ))}
          <div className="dv-side-foot">Base URL<code>{API}</code></div>
        </aside>

        <main className="dv-main">
          <section id="overview" className="dv-hero">
            <div className="dv-hero-l">
              <div className="dv-hero-eyebrow">
                <span>Tabaqa API</span>
                {live !== null && (
                  <span className={`dv-live ${live ? 'ok' : 'down'}`}>
                    <i />{live ? 'API live — this page just checked' : 'API unreachable — check your network'}
                  </span>
                )}
              </div>
              <h1>The credit decision,<br />in <em>one call</em></h1>
              <p className="dv-lead">
                The credit-intelligence layer for Saudi open banking — as an API. Send a person's
                bank + wallet transactions; get back <strong>verified income</strong>, a
                <strong> 1–99 score</strong>, a risk flag, a SAMA-compliant affordability decision,
                and a plain-language financial read.
              </p>
              <div className="dv-facts">
                <div><span>Base URL</span><code>{API}</code></div>
                <div><span>Content type</span><code>application/json</code></div>
                <div><span>Auth</span><code>anonymous demo · Bearer key</code></div>
                <div><span>Console</span><a href={`${API}/docs`} target="_blank" rel="noreferrer">/docs ↗</a></div>
              </div>
              <p className="dv-note">
                Call it anonymously to try it, or issue a <strong>self-serve sandbox key</strong> below and
                send it as <code>Authorization: Bearer …</code> for attributed, rate-limited access. The
                scoring engine is stateless, so keys gate <em>access and rate</em>, never state.
              </p>
            </div>
            <div className="dv-hero-r">
              <div className="dv-hero-cap">The whole integration — five lines</div>
              <Code lang="bash">{`curl -s ${API}/v1/score \\
  -H 'Content-Type: application/json' \\
  -d '{"connection_id":"con_8842"}'`}</Code>
              <Code lang="json">{`{
  "tabaqa_score": 82,
  "risk_flag": "low",
  "income": {
    "true_monthly_income": 10000,  // the reveal
    "bank_only_income": 4000,      // what a bank alone sees
    "verified_share": 0.92
  },
  "reasons": ["regular_income", "wallet_income_verified"]
}`}</Code>
              <p className="dv-muted">Sample connections: <code>con_8842</code>, <code>con_gig_driver</code>,
                <code> con_sme_owner</code>, <code>con_thin_file</code> — or <a href="#playground">run it in the
                playground ↓</a></p>
            </div>
          </section>

          <section id="playground">
            <h2>Playground</h2>
            <p>Hit the real API from your browser. Pick an endpoint, edit the body, and Run — no key
              needed to start. Issue a sandbox key to see attributed rate-limit headers.</p>
            <Playground />
          </section>

          <section id="auth">
            <h2>Authentication</h2>
            <p>Three tiers, so the demo stays frictionless and production stays governed:</p>
            <table className="dv-table">
              <thead><tr><th>Tier</th><th>How</th><th>Limits & access</th></tr></thead>
              <tbody>
                <tr><td><strong>Anonymous</strong></td><td>no header</td><td>Open demo — presets + uploaded statements. Unmetered, best-effort.</td></tr>
                <tr><td><strong>Sandbox</strong> <code>tbq_sk_…</code></td><td>self-serve above</td><td>Attributed, per-key daily limit, <code>X-RateLimit-*</code> headers.</td></tr>
                <tr><td><strong>Live</strong> <code>tbq_lk_…</code></td><td>via access request</td><td>Higher limits; unlocks passport persistence + decision webhooks.</td></tr>
              </tbody>
            </table>
            <p className="dv-muted">Send the key as <code>Authorization: Bearer &lt;key&gt;</code> (or
              <code>X-API-Key: &lt;key&gt;</code>). Keys are stored hashed — the plaintext is shown only once
              at issuance. Need a live key? <Link to="/#access">Request access →</Link></p>
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
