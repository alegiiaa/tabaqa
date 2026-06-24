import { useI18n } from '../i18n/I18nContext'

/**
 * Lightweight bilingual helper for the dashboard. The landing page uses the
 * global i18n dictionary; the app screens carry their copy inline via tx(en, ar)
 * to keep them self-contained, while still honouring the chosen language + RTL.
 */
export function useTx() {
  const { lang, dir } = useI18n()
  return {
    lang,
    dir,
    tx: (en: string, ar: string) => (lang === 'ar' ? ar : en),
  }
}
