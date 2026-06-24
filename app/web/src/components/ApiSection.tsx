import { useI18n } from '../i18n/I18nContext'
import { Rich } from './Rich'

export function ApiSection() {
  const { t } = useI18n()
  return (
    <section className="alt">
      <div className="wrap split">
        <div>
          <div className="eyebrow">{t('api.eyebrow')}</div>
          <Rich k="api.h2" as="div" className="h2" />
          <Rich k="api.lead" as="p" className="lead" style={{ marginTop: 18 }} />
        </div>
        <div className="code">
          <div className="top">
            <span>POST /v1/score</span>
            <span>200 OK</span>
          </div>
          <pre>
            <span className="c">// score a consented applicant</span>
            {'\n'}
            <span className="k">const</span> r = <span className="k">await</span> fetch(<span className="s">"https://api.tabaqa.app/v1/score"</span>, {'{'}
            {'\n'}  method: <span className="s">"POST"</span>,
            {'\n'}  headers: {'{'} Authorization: <span className="s">"Bearer sk_live_…"</span> {'}'},
            {'\n'}  body: {'{'} connection_id: <span className="s">"con_8842"</span> {'}'}
            {'\n'}{'}'})
            {'\n'}<span className="c">// → response</span>
            {'\n'}{'{'}
            {'\n'}  <span className="n2">"tabaqa_score"</span>: <span className="s">82</span>,        <span className="c">// 1 to 99</span>
            {'\n'}  <span className="n2">"pd"</span>: <span className="s">0.041</span>,
            {'\n'}  <span className="n2">"risk_flag"</span>: <span className="s">"low"</span>,
            {'\n'}  <span className="n2">"verified_income"</span>: <span className="s">10000</span>,
            {'\n'}  <span className="n2">"reasons"</span>: [<span className="s">"regular_income"</span>, <span className="s">"wallet_income_verified"</span>, <span className="s">"zero_nsf"</span>]
            {'\n'}{'}'}
          </pre>
        </div>
      </div>
    </section>
  )
}
