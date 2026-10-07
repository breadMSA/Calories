// Small presentational primitives.

import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  variant = 'secondary',
  size = 'md',
  block,
  loading,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: 'sm' | 'md';
  block?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      className={`btn btn-${variant} btn-${size}${block ? ' btn-block' : ''} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner small /> : children}
    </button>
  );
}

export function IconButton({
  label,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" className={`icon-btn ${className}`} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  );
}

export function Spinner({ small }: { small?: boolean }) {
  return <span className={`spinner${small ? ' spinner-sm' : ''}`} role="status" aria-label="載入中" />;
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? <p className="field-error">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { suffix?: string }>(
  function TextInput({ suffix, className = '', ...rest }, ref) {
    if (!suffix) return <input ref={ref} className={`input ${className}`} {...rest} />;
    return (
      <div className="input-group">
        <input ref={ref} className={`input ${className}`} {...rest} />
        <span className="input-suffix">{suffix}</span>
      </div>
    );
  },
);

/** Numeric input that keeps a string draft so users can type "1." or clear the field. */
export function NumberInput({
  value,
  onChange,
  suffix,
  id,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string;
  onChange: (value: string) => void;
  suffix?: string;
}) {
  return (
    <TextInput
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={value}
      suffix={suffix}
      onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))}
      {...rest}
    />
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = 'md',
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
  label: string;
  size?: 'sm' | 'md';
}) {
  const name = useId();
  return (
    <div className={`segmented segmented-${size}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <label key={o.value} className={`segmented-item${o.value === value ? ' is-active' : ''}`}>
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={o.value === value}
            onChange={() => onChange(o.value)}
          />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

export function ProgressBar({
  value,
  max,
  tone = 'accent',
  limit,
  label,
}: {
  value: number;
  max: number;
  tone?: 'accent' | 'protein' | 'carbs' | 'fat' | 'water' | 'neutral';
  /** When true, exceeding `max` is shown as a warning rather than success. */
  limit?: boolean;
  label: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const over = max > 0 && value > max;
  return (
    <div
      className={`progress tone-${tone}${over ? (limit ? ' is-over-limit' : ' is-over') : ''}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      aria-valuenow={Math.round(value)}
    >
      <div className="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {children ? <div className="empty-body">{children}</div> : null}
    </div>
  );
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  return (
    <p className="error-note" role="alert">
      {message}
    </p>
  );
}

/** Parses a draft numeric string; returns NaN for empty or invalid input. */
export function parseNum(s: string): number {
  return s.trim() === '' ? NaN : Number(s);
}
