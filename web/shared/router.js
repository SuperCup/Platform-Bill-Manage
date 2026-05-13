export function getRoute() {
  const h = window.location.hash || '#/retail';
  const m = h.match(/^#(\/[^?]*)(\?.*)?$/);
  return m ? m[1] : '/retail';
}

export function getQueryParams() {
  const h = window.location.hash || '';
  const qIndex = h.indexOf('?');
  const qs = qIndex >= 0 ? h.slice(qIndex + 1) : '';
  return new URLSearchParams(qs);
}

export function setQueryParam(key, value) {
  const route = getRoute();
  const p = getQueryParams();
  if (value === null || value === undefined || value === '') p.delete(key);
  else p.set(key, value);
  const qs = p.toString();
  window.location.hash = `#${route}${qs ? `?${qs}` : ''}`;
}

export function getSubTab(scope, fallback) {
  const p = getQueryParams();
  return p.get(`${scope}Tab`) || fallback;
}

