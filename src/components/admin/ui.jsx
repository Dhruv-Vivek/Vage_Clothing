'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

/** fetch wrapper for /api/admin/*: JSON in/out, throws Error(message) on any non-2xx response. */
export async function api(url, { method = 'GET', body, formData } = {}) {
  const response = await fetch(url, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: formData ?? (body ? JSON.stringify(body) : undefined),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || 'Request failed.');
    error.status = response.status;
    throw error;
  }
  return payload;
}

export const inputClass =
  'w-full rounded-lg border border-dark-border bg-dark px-3 py-2 text-sm text-white placeholder-gray-600 transition-colors focus:border-lighter-gray focus:outline-none';

export const buttonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';
export const primaryButton = `${buttonClass} bg-white text-black hover:bg-lighter-gray`;
export const ghostButton = `${buttonClass} border border-dark-border text-white hover:border-white`;

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-lighter-gray">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-light-gray">{hint}</span> : null}
    </label>
  );
}

const STATUS_STYLES = {
  ACTIVE: 'border-emerald-500/40 text-emerald-400',
  DRAFT: 'border-amber-500/40 text-amber-400',
  ARCHIVED: 'border-dark-border text-light-gray',
};
const STATUS_LABELS = { ACTIVE: 'Active', DRAFT: 'Draft', ARCHIVED: 'Archived' };

export function StatusBadge({ status }) {
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs ${STATUS_STYLES[status] || STATUS_STYLES.ARCHIVED}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export function StockBadge({ stock, threshold }) {
  if (stock === 0) return <span className="text-sm font-medium text-red-400">Out of stock</span>;
  if (stock <= threshold) return <span className="text-sm font-medium text-amber-400">Low · {stock}</span>;
  return <span className="text-sm text-lighter-gray">{stock}</span>;
}

export function Thumb({ src, alt }) {
  return src ? (
    <img src={src} alt={alt} className="h-12 w-12 flex-none rounded-lg border border-dark-border object-cover" />
  ) : (
    <div className="h-12 w-12 flex-none rounded-lg border border-dashed border-dark-border" aria-hidden="true" />
  );
}

export function PageHeader({ title, description, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 max-w-xl text-sm text-light-gray">{description}</p> : null}
      </div>
      {children ? <div className="flex items-center gap-3">{children}</div> : null}
    </div>
  );
}

export function Pager({ pagination, onPage }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-light-gray">
      <span>
        Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
      </span>
      <div className="flex gap-2">
        <button className={ghostButton} disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}>
          Previous
        </button>
        <button
          className={ghostButton}
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => onPage(pagination.page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

/** Slide-over panel. Closes on Escape or backdrop click; locks page scroll while open. */
export function Drawer({ open, onClose, title, children, footer }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close panel" className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative flex h-full w-full max-w-xl flex-col border-l border-dark-border bg-dark-secondary outline-none"
      >
        <header className="flex items-center justify-between border-b border-dark-border px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-light-gray hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer ? <footer className="border-t border-dark-border px-5 py-4">{footer}</footer> : null}
      </div>
    </div>
  );
}

/** Tiny toast: const { toast, notify } = useToast(); render {toast}; notify('Saved') or notify('Oops', 'error'). */
export function useToast() {
  const [message, setMessage] = useState(null);
  const timer = useRef(null);

  const notify = useCallback((text, tone = 'ok') => {
    clearTimeout(timer.current);
    setMessage({ text, tone });
    timer.current = setTimeout(() => setMessage(null), 3500);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const toast = message ? (
    <div
      role="status"
      className={`fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 rounded-lg border px-4 py-2.5 text-sm shadow-lg ${
        message.tone === 'error'
          ? 'border-red-500/50 bg-dark-secondary text-red-300'
          : 'border-dark-border bg-dark-secondary text-white'
      }`}
    >
      {message.text}
    </div>
  ) : null;

  return { toast, notify };
}

export function useDebounced(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
