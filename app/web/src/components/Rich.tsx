import { createElement, type ElementType } from 'react'
import { useI18n } from '../i18n/I18nContext'

interface RichProps {
  /** i18n key to render. */
  k: string
  /** Element/tag to render as (default: span). */
  as?: ElementType
  className?: string
  style?: React.CSSProperties
}

/**
 * Renders a translated string that may contain inline HTML (e.g. <b>, <br>,
 * score chips). Content comes from our own first-party i18n dictionary, so
 * dangerouslySetInnerHTML is safe here.
 */
export function Rich({ k, as = 'span', className, style }: RichProps) {
  const { t } = useI18n()
  return createElement(as, {
    className,
    style,
    dangerouslySetInnerHTML: { __html: t(k) },
  })
}
