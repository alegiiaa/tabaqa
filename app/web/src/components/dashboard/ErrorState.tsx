import { useTx } from '../../lib/tx'
import { ApiError } from '../../lib/api'

type Tx = (en: string, ar: string) => string

/**
 * Turns any thrown error (an {@link ApiError} or anything else) into a friendly,
 * bilingual title + body — so a judge who hits a cold-starting lambda or a
 * blinked connection sees "Couldn't reach the scoring service · Try again"
 * instead of the browser's raw "Failed to fetch".
 */
export function apiErrorMessage(err: unknown, tx: Tx): { title: string; body: string } {
  const kind = err instanceof ApiError ? err.kind : 'network'
  switch (kind) {
    case 'timeout':
      return {
        title: tx('This is taking longer than usual', 'يستغرق هذا وقتًا أطول من المعتاد'),
        body: tx(
          'The scoring service didn’t respond in time — it may be waking up. Try again.',
          'لم تستجب خدمة التقييم في الوقت المناسب — قد تكون قيد الإقلاع. أعد المحاولة.',
        ),
      }
    case 'server':
      return {
        title: tx('The scoring service hit a snag', 'واجهت خدمة التقييم عائقًا'),
        body: tx(
          'Something went wrong on our side. Please try again in a moment.',
          'حدث خطأ لدينا. يرجى إعادة المحاولة بعد لحظات.',
        ),
      }
    case 'client': {
      const raw = err instanceof Error ? err.message.trim() : ''
      // Hide technical bodies (pydantic arrays, "Request failed (4xx)") behind a
      // clean line; surface a genuine human-readable message when the API sends one.
      const technical = /^[[{]/.test(raw) || /^Request failed/.test(raw) || raw === ''
      return {
        title: tx('That request couldn’t be completed', 'تعذّر إتمام الطلب'),
        body: technical
          ? tx('Please check the details and try again.', 'يرجى التحقق من التفاصيل وإعادة المحاولة.')
          : raw,
      }
    }
    case 'network':
    default:
      return {
        title: tx('Couldn’t reach the scoring service', 'تعذّر الوصول إلى خدمة التقييم'),
        body: tx('Check your connection and try again.', 'تحقّق من اتصالك وأعد المحاولة.'),
      }
  }
}

/**
 * Shared failure surface. `inline` renders a compact one-line strip (for panels
 * that already have their own layout); the default is a centred card that mirrors
 * the empty-state so a failed screen never looks broken.
 */
export function ErrorState({
  error,
  onRetry,
  inline = false,
}: {
  error: unknown
  onRetry?: () => void
  inline?: boolean
}) {
  const { tx } = useTx()
  const { title, body } = apiErrorMessage(error, tx)
  const retry = tx('Try again', 'أعد المحاولة')

  if (inline) {
    return (
      <div className="err-inline" role="alert">
        <span className="err-inline-msg"><b>{title}.</b> {body}</span>
        {onRetry && (
          <button className="btn btn-ghost btn-sm err-inline-retry" onClick={onRetry}>{retry}</button>
        )}
      </div>
    )
  }

  return (
    <div className="err-state" role="alert">
      <div className="err-state-icon" aria-hidden>⚠</div>
      <div className="err-state-title">{title}</div>
      <p className="err-state-body">{body}</p>
      {onRetry && (
        <button className="btn btn-primary" onClick={onRetry}>{retry}</button>
      )}
    </div>
  )
}
