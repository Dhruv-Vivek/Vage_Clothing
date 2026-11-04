'use client';

const ANONYMOUS_KEY = 'vage_product_intelligence_visitor';
const SESSION_KEY = 'vage_product_intelligence_session';

function browserId(storage, key) {
  try {
    let value = storage.getItem(key);
    if (!value) {
      value = globalThis.crypto?.randomUUID?.();
      if (!value) value = 'vage-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
      storage.setItem(key, value);
    }
    return value;
  } catch {
    return globalThis.crypto?.randomUUID?.() || 'vage-' + Date.now().toString(36);
  }
}

/** Analytics is fire-and-forget and must never block shopping or checkout. */
export function trackProductEvent(event) {
  if (typeof window === 'undefined' || !event || typeof event !== 'object') return;

  const payload = {
    ...event,
    eventId: globalThis.crypto?.randomUUID?.() || ('evt-' + Date.now() + '-' + Math.random().toString(36).slice(2)),
    anonymousId: browserId(window.localStorage, ANONYMOUS_KEY),
    sessionId: browserId(window.sessionStorage, SESSION_KEY),
    path: window.location.pathname,
  };

  try {
    fetch('/api/analytics/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      keepalive: true,
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {
    // Analytics is deliberately best-effort.
  }
}
