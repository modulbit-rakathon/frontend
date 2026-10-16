// /api stays same-origin. The server-side proxy supplies X-Api-Key, never the browser bundle.
import { getShareIssues } from '@pillgaze/core';

export class ApiError extends Error {
  constructor(code, status = 0, retryAfter = 0) {
    super(code);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

async function request(path, { signal, timeout = 15000, ...options } = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, timeout);
  try {
    const response = await fetch(path, { ...options, signal: controller.signal });
    const retryHeader = response.headers.get('Retry-After');
    const retryAfter = retryHeader === null ? 0 : /^\d+$/.test(retryHeader)
      ? Number(retryHeader) : Math.max(0, Math.ceil((Date.parse(retryHeader) - Date.now()) / 1000)) || 0;
    let data;
    try {
      data = await response.json();
    } catch (error) {
      if (controller.signal.aborted) throw error;
      throw new ApiError(response.ok ? 'invalid_response' : `http_${response.status}`, response.status, retryAfter);
    }
    if (!response.ok) {
      throw new ApiError(data?.error?.code ?? `http_${response.status}`, response.status, retryAfter);
    }
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      throw new ApiError('invalid_response', response.status);
    }
    return data;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export function analyzePhoto(file, source, { signal } = {}) {
  if (!['box', 'note', 'regimen'].includes(source)) throw new ApiError('invalid_input');
  if (!file || !['image/jpeg', 'image/png'].includes(file.type)) throw new ApiError('unsupported_media_type');
  if (file.size === 0 || file.size > 10 * 1024 * 1024) throw new ApiError('invalid_image_size');
  const form = new FormData();
  form.append('source', source);
  form.append('image', file);
  return request('/api/analyze', { method: 'POST', body: form, signal, timeout: 120000 });
}

export async function createSharePin(payload, { signal } = {}) {
  const data = await request('/api/share', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload), signal,
  });
  if (typeof data.pin !== 'string' || !/^\d{4}$/.test(data.pin)
      || typeof data.expires_at !== 'string' || !Number.isFinite(Date.parse(data.expires_at))
      || !Number.isSafeInteger(data.expires_in) || data.expires_in <= 0) {
    throw new ApiError('invalid_response');
  }
  return data;
}

export async function claimShare(pin, { signal } = {}) {
  if (typeof pin !== 'string' || !/^\d{4}$/.test(pin)) throw new ApiError('invalid_input');
  const data = await request('/api/share/claim', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }), signal,
  });
  // A consumed PIN cannot be retried. Validate without loading the large catalogue.
  const invalid = getShareIssues(data.medications).some(issue =>
    ['invalid_medication', 'item_count', 'required', 'duplicate_id', 'too_long', 'invalid_unicode'].includes(issue.code));
  if (invalid) throw new ApiError('invalid_response');
  return data;
}

export function apiErrorMessage(error) {
  if (error?.retryAfter > 0) return `Příliš mnoho požadavků. Zkuste to za ${error.retryAfter} sekund.`;
  if (error?.name === 'AbortError') return 'Požadavek byl zrušen nebo server neodpověděl včas.';
  const messages = {
    invalid_response: 'Server vrátil neplatná data. Zkuste to znovu; u jednorázového kódu může být potřeba nový PIN.',
    unsupported_media_type: 'Použijte fotku ve formátu JPEG nebo PNG.',
    invalid_image_size: 'Fotka musí mít velikost od 1 bajtu do 10 MB.',
    invalid_input: 'Zkontrolujte zadané údaje.',
    unauthorized: 'Připojení k backendu nemá platný API klíč. Kontaktujte správce aplikace.',
    http_401: 'Připojení k backendu nemá platný API klíč. Kontaktujte správce aplikace.',
    proxy_not_configured: 'Serverová proxy nemá nastavený backend a API klíč.',
    not_found: 'Kód neexistuje, vypršel nebo už byl použit. Požádejte pacienta o nový.',
    rate_limited: 'Příliš mnoho požadavků. Počkejte chvíli a zkuste to znovu.',
    no_medications: 'Na fotce nebyl rozpoznán žádný lék.',
  };
  return messages[error?.message] ?? 'Požadavek se nepodařil. Zkontrolujte připojení a zkuste to znovu.';
}
