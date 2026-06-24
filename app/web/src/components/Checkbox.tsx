import { type InputHTMLAttributes } from 'react'

/**
 * Modern shadcn-style checkbox.
 *
 * A real, accessible <input type="checkbox"> (kept focusable + toggleable, just
 * visually hidden) layered under a styled box that fills with the brand colour
 * and animates a check in when selected — replacing the native `accent-color`
 * tick. Forwards every input prop (checked, onChange, disabled, name, …).
 */
export function Checkbox({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <span className={`ui-checkbox${className ? ` ${className}` : ''}`}>
      <input {...props} type="checkbox" />
      <span className="ui-checkbox-box" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
        </svg>
      </span>
    </span>
  )
}
