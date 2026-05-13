import { $ } from './dom.js';
import { escapeHtml } from './format.js';

export function pill(status) {
  const map = {
    '进行中': 'pill-info',
    '已结束': 'pill-neutral',
    '未开始': 'pill-warning',
    '归集中': 'pill-info',
    '已归集': 'pill-success',
    '已同步': 'pill-success',
    '编辑中': 'pill-info',
    '待归集': 'pill-warning',
    '已确认': 'pill-success',
    '已分配': 'pill-success',
    '待分配': 'pill-warning',
    '待归集（零售）': 'pill-warning',
    '已结算': 'pill-success',
    '部分结算': 'pill-warning',
    '未结算': 'pill-neutral',
    '已就绪': 'pill-success',
    '抓取中': 'pill-info',
    '抓取失败': 'pill-warning',
    '高风险': 'pill-warning',
    '注意': 'pill-warning',
    '已办': 'pill-success',
    '待处理': 'pill-warning',
    '财务已锁定': 'pill-neutral',
    '可认领': 'pill-success',
    '一致': 'pill-success',
    '不一致': 'pill-danger',
  };
  const cls = map[status] || 'pill-neutral';
  return `<span class="pill ${cls}">${escapeHtml(status)}</span>`;
}

export function toast(title, message) {
  const host = $('#toast-host');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<strong>${escapeHtml(title)}</strong>${escapeHtml(message)}`;
  host.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

export function openModal({ title, bodyHtml, footerHtml }) {
  $('#modal-title').textContent = title ?? 'Modal';
  $('#modal-body').innerHTML = bodyHtml ?? '';
  $('#modal-footer').innerHTML = footerHtml ?? '';
  const bd = $('#modal-backdrop');
  bd.classList.remove('hidden');
  bd.setAttribute('aria-hidden', 'false');
}

export function closeModal() {
  const bd = $('#modal-backdrop');
  bd.classList.add('hidden');
  bd.setAttribute('aria-hidden', 'true');
  $('#modal-body').innerHTML = '';
  $('#modal-footer').innerHTML = '';
}

export function PageHead(title, subtitle, actionsHtml = '') {
  return `
    <div class="page-head">
      <div>
        <h1 class="page-title">${escapeHtml(title)}</h1>
        ${subtitle ? `<div class="page-subtitle">${escapeHtml(subtitle)}</div>` : ''}
      </div>
      <div class="toolbar">${actionsHtml}</div>
    </div>
  `;
}

export function Tabs(items, activeId) {
  return `
    <div class="tabs">
      ${items
        .map(
          (t) =>
            `<div class="tab ${t.id === activeId ? 'active' : ''}" data-tab="${escapeHtml(t.id)}">${escapeHtml(t.label)}</div>`
        )
        .join('')}
    </div>
  `;
}

export function StatGrid(stats) {
  return `
    <div class="grid">
      ${stats
        .map((s) => {
          const tone = s.tone ? `tone-${s.tone}` : '';
          return `
            <div class="stat ${tone}">
              <div class="stat-value">${escapeHtml(s.value)}</div>
              <div class="stat-label">${escapeHtml(s.label)}</div>
            </div>
          `;
        })
        .join('')}
    </div>
  `;
}

export function Table(headers, rows) {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (r) =>
                `<tr>${r.map((cell) => `<td>${cell}</td>`).join('')}</tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

export function callout(type, title, body) {
  return `
    <div class="callout callout-${type}">
      ${title ? `<div class="callout-title">${escapeHtml(title)}</div>` : ''}
      <div>${escapeHtml(body)}</div>
    </div>
  `;
}

