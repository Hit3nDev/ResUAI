"use client";
import { Fragment, ReactNode, useId } from "react";
import { Check as CheckIcon } from "lucide-react";

/* ── Form controls ──────────────────────────────────────────────────────── */
interface BaseProps {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; hint?: string; required?: boolean; optional?: boolean; error?: string; className?: string;
}

function Label({ id, label, required, optional }: { id: string; label: string; required?: boolean; optional?: boolean }) {
  return (
    <label className="label" htmlFor={id}>
      {label}
      {required && <span className="req" aria-hidden>*</span>}
      {optional && <span className="opt">optional</span>}
    </label>
  );
}

export function Field({ label, value, onChange, placeholder, hint, required, optional, error, type = "text", autoComplete, className }:
  BaseProps & { type?: string; autoComplete?: string }) {
  const id = useId();
  return (
    <div className={className}>
      <Label id={id} label={label} required={required} optional={optional} />
      <input id={id} className="input" type={type} value={value} placeholder={placeholder} autoComplete={autoComplete}
        aria-invalid={!!error || undefined} aria-describedby={error ? id + "-e" : hint ? id + "-h" : undefined}
        onChange={e => onChange(e.target.value)} />
      {error ? <div id={id + "-e"} className="err" role="alert">{error}</div>
        : hint ? <div id={id + "-h"} className="hint">{hint}</div> : null}
    </div>
  );
}

export function TextArea({ label, value, onChange, placeholder, hint, required, optional, error, rows = 4, className }: BaseProps & { rows?: number }) {
  const id = useId();
  return (
    <div className={className}>
      <Label id={id} label={label} required={required} optional={optional} />
      <textarea id={id} className="input" rows={rows} value={value} placeholder={placeholder}
        aria-invalid={!!error || undefined} aria-describedby={error ? id + "-e" : hint ? id + "-h" : undefined}
        onChange={e => onChange(e.target.value)} />
      {error ? <div id={id + "-e"} className="err" role="alert">{error}</div>
        : hint ? <div id={id + "-h"} className="hint">{hint}</div> : null}
    </div>
  );
}

export function Select({ label, value, onChange, options, className }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; className?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <Label id={id} label={label} />
      <select id={id} className="input" value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

export function Check({ id, checked, onChange, children }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="check" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(o => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Spinner() { return <span className="spinner" aria-hidden />; }

/* ── Step indicator ─────────────────────────────────────────────────────── */
export function Stepper({ labels, current, done, err, onGo }: {
  labels: string[]; current: number; done: boolean[]; err: boolean[]; onGo: (i: number) => void;
}) {
  return (
    <nav className="steps" aria-label="Steps">
      {labels.map((l, i) => (
        <Fragment key={l}>
          {i > 0 && <i aria-hidden />}
          <button type="button" className="step" title={l} aria-label={`Step ${i + 1}: ${l}`}
            aria-current={current === i ? "step" : undefined}
            data-done={(done[i] && current !== i) || undefined} data-err={(err[i] && current !== i) || undefined}
            onClick={() => onGo(i)}>
            {done[i] && current !== i && !err[i] ? <CheckIcon size={14} strokeWidth={3} /> : i + 1}
          </button>
        </Fragment>
      ))}
    </nav>
  );
}

/* ── Segmented meter (20 cells) ─────────────────────────────────────────── */
export function Meter({ value, color, label }: { value: number; color?: string; label: string }) {
  const on = Math.round((Math.max(0, Math.min(100, value)) / 100) * 20);
  return (
    <div className="meter" role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}
      style={color ? ({ "--c": color } as React.CSSProperties) : undefined}>
      {Array.from({ length: 20 }, (_, i) => <i key={i} data-on={i < on} />)}
    </div>
  );
}

/** Semantic colour for a 0-100 score. */
export function scoreTone(n: number) {
  return n >= 75 ? "var(--ok)" : n >= 55 ? "var(--warn)" : "var(--bad)";
}

/* ── Canvas helpers ─────────────────────────────────────────────────────── */
export function CanvasBar({ children }: { children: ReactNode }) {
  return <div className="canvas-bar">{children}</div>;
}

/** A ghost page with a message on top — shown before there's anything to render. */
export function EmptyCanvas({ title, children }: { title: string; children?: ReactNode }) {
  const widths = [38, 100, 92, 96, 0, 30, 100, 88, 94, 70, 0, 28, 100, 90, 96, 60];
  return (
    <div className="sheet ghost" aria-label="Empty page">
      {widths.map((w, i) => w ? <i key={i} style={{ width: `${w}%` }} /> : <div key={i} style={{ height: 14 }} />)}
      <div className="msg">
        <div className="display" style={{ fontSize: 34, marginBottom: 8 }}>{title}</div>
        {children && <div className="small" style={{ color: "var(--ink-2)", fontSize: 14 }}>{children}</div>}
      </div>
    </div>
  );
}

export function Working({ children }: { children: ReactNode }) {
  return <div className="working" role="status"><div><span className="spinner" />{children}</div></div>;
}

/** Mobile-only Edit / Preview switch. */
export function ViewSwitch({ value, onChange, a, b }: { value: "edit" | "preview"; onChange: (v: "edit" | "preview") => void; a: string; b: string }) {
  return (
    <div className="mview">
      <Segmented label="Panel" value={value} onChange={onChange} options={[{ value: "edit", label: a }, { value: "preview", label: b }]} />
    </div>
  );
}
