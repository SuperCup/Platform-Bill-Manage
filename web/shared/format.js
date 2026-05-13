export function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function formatMoney(n) {
  if (n === null || n === undefined || n === '') return '—';
  const v = typeof n === 'number' ? n : Number(String(n).replace(/[¥,]/g, ''));
  if (Number.isNaN(v)) return String(n);
  return `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

