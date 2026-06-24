import { useState, type FormEvent } from 'react'
import { useI18n } from '../i18n/I18nContext'
import { USECASE_OPTIONS } from '../i18n/strings'
import { supabase } from '../lib/supabase'

export function SignUp() {
  const { t, lang } = useI18n()
  const [submitted, setSubmitted] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    if (!form.checkValidity()) {
      form.reportValidity()
      return
    }
    const data = new FormData(form)
    setSending(true)
    setError(null)
    // Anonymous insert into public.access_requests (RLS: anon INSERT only — no
    // `.select()`, since anon has no SELECT policy and RETURNING would be rejected).
    const { error: insertError } = await supabase.from('access_requests').insert({
      name: String(data.get('name') ?? '').trim(),
      email: String(data.get('email') ?? '').trim(),
      company: String(data.get('company') ?? '').trim() || null,
      usecase: String(data.get('usecase') ?? '').trim() || null,
    })
    setSending(false)
    if (insertError) {
      setError(t('su.error'))
      return
    }
    setSubmitted(true)
  }

  return (
    <section className="signup" id="access">
      <div className="glow" />
      <div className="wrap center">
        <div className="eyebrow">{t('su.eyebrow')}</div>
        <div className="h2" style={{ fontSize: 'clamp(34px,5.4vw,54px)' }}>
          {t('su.h2')}
        </div>
        <p className="lead center" style={{ margin: '16px auto 0' }}>
          {t('su.lead')}
        </p>

        {submitted ? (
          <div className="signup-success">{t('su.success')}</div>
        ) : (
          <form className="signup-card" onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label>{t('su.name')}</label>
              <input type="text" name="name" required placeholder={t('su.name.ph')} />
            </div>
            <div className="field">
              <label>{t('su.email')}</label>
              <input type="email" name="email" required placeholder={t('su.email.ph')} />
            </div>
            <div className="field">
              <label>{t('su.company')}</label>
              <input type="text" name="company" required placeholder={t('su.company.ph')} />
            </div>
            <div className="field">
              <label>{t('su.use')}</label>
              <select name="usecase">
                {USECASE_OPTIONS[lang].map((opt) => (
                  <option key={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn btn-primary" disabled={sending}>
              {sending ? t('su.sending') : t('su.submit')}
            </button>
            {error && (
              <p className="formnote" role="alert" style={{ color: '#ef4444' }}>
                {error}
              </p>
            )}
            <p className="formnote">{t('su.note')}</p>
          </form>
        )}
      </div>
    </section>
  )
}
