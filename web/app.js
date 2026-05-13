// Deprecated entry.
// This file is kept only for reference/history.
// Use `web/main.js` as the current entry.

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatMoney(n) {
  if (n === null || n === undefined || n === '') return '—';
  const v = typeof n === 'number' ? n : Number(String(n).replace(/[¥,]/g, ''));
  if (Number.isNaN(v)) return String(n);
  return `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pill(status) {
  const map = {
    'In Progress': 'pill-info',
    'Finished': 'pill-neutral',
    'Not Started': 'pill-warning',
    'Aggregating': 'pill-info',
    'Aggregated': 'pill-success',
    'Pending': 'pill-warning',
    'Confirmed': 'pill-success',
    'Allocated': 'pill-success',
    'To Allocate': 'pill-warning',
    'To Aggregate': 'pill-warning',
    'Settled': 'pill-success',
    'Partially Settled': 'pill-warning',
    'Unsettled': 'pill-neutral',
    'Ready': 'pill-success',
    'Crawling': 'pill-info',
    'Crawl Failed': 'pill-warning',
    'High Risk': 'pill-warning',
    'Attention': 'pill-warning',
  };
  const cls = map[status] || 'pill-neutral';
  return `<span class="pill ${cls}">${escapeHtml(status)}</span>`;
}

function toast(title, message) {
  const host = $('#toast-host');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<strong>${escapeHtml(title)}</strong>${escapeHtml(message)}`;
  host.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function openModal({ title, bodyHtml, footerHtml }) {
  $('#modal-title').textContent = title ?? 'Modal';
  $('#modal-body').innerHTML = bodyHtml ?? '';
  $('#modal-footer').innerHTML = footerHtml ?? '';
  const bd = $('#modal-backdrop');
  bd.classList.remove('hidden');
  bd.setAttribute('aria-hidden', 'false');
}
function closeModal() {
  const bd = $('#modal-backdrop');
  bd.classList.add('hidden');
  bd.setAttribute('aria-hidden', 'true');
  $('#modal-body').innerHTML = '';
  $('#modal-footer').innerHTML = '';
}

$('#modal-close').addEventListener('click', closeModal);
$('#modal-backdrop').addEventListener('click', (e) => {
  if (e.target === $('#modal-backdrop')) closeModal();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// ── Mock data ───────────────────────────────────────────────────────────────
const DATA = {
  marketing: {
    activities: [
      { id: 'ACT-2605-001', name: 'May WeChat Coupon Campaign', platform: 'WeChat Coupon', customer: 'Hema', project: 'SG-260479', start: '2026-05-01', end: '2026-05-31', status: 'In Progress' },
      { id: 'ACT-2604-002', name: 'Apr Alipay Tap Promo', platform: 'Alipay Tap', customer: 'Coca-Cola', project: 'SG-260380', start: '2026-04-01', end: '2026-04-30', status: 'Finished' },
      { id: 'ACT-2605-003', name: 'May Douyin Group-buy Boost', platform: 'Douyin Group-buy', customer: 'Hema', project: 'SG-260479', start: '2026-05-01', end: '2026-05-31', status: 'In Progress' },
      { id: 'ACT-2606-004', name: 'WeChat Store 618 Warm-up', platform: 'WeChat Store', customer: 'Master Kong', project: 'SG-260217', start: '2026-06-01', end: '2026-06-18', status: 'Not Started' },
    ],
    bills: [
      { id: 'BL-2604-001', activity: 'Apr Alipay Tap Promo', platform: 'Alipay Tap', customer: 'Coca-Cola', month: '2026-04', amount: 8340, status: 'Aggregated', project: 'SG-260380' },
      { id: 'BL-2604-002', activity: 'Apr Alipay Coupon Holiday', platform: 'Alipay Coupon', customer: 'Coca-Cola', month: '2026-04', amount: 3280, status: 'Aggregated', project: 'SG-260309' },
      { id: 'BL-2605-001', activity: 'May WeChat Coupon Campaign', platform: 'WeChat Coupon', customer: 'Hema', month: '2026-05', amount: 18480, status: 'Pending', project: 'SG-260479' },
      { id: 'BL-2605-002', activity: 'May Douyin Group-buy Boost', platform: 'Douyin Group-buy', customer: 'Hema', month: '2026-05', amount: 24360, status: 'Pending', project: 'SG-260479' },
    ],
    costs: [
      { month: '2026-04', platform: 'Alipay', customer: 'Coca-Cola', projects: 'SG-260380 · SG-260309', cost: 11620, status: 'Confirmed' },
      { month: '2026-04', platform: 'Douyin', customer: 'Nayuki', projects: 'SG-260540', cost: 12760, status: 'Confirmed' },
      { month: '2026-05', platform: 'WeChat', customer: 'Hema', projects: 'SG-260479', cost: 18480, status: 'Aggregating' },
      { month: '2026-05', platform: 'Douyin', customer: 'Hema', projects: 'SG-260479', cost: 24360, status: 'Aggregating' },
    ],
  },
  retail: {
    sources: [
      { platform: 'Meituan Instashopping', lastCrawl: '2026-05-08 03:15', monthsReady: 3, status: 'Ready', total: 384200 },
      { platform: 'Taobao Instashopping', lastCrawl: '2026-05-08 04:22', monthsReady: 3, status: 'Ready', total: 127640 },
      { platform: 'JD Daojia', lastCrawl: '2026-05-08 03:55', monthsReady: 0, status: 'Crawl Failed', total: null },
      { platform: 'Dmall', lastCrawl: '2026-05-08 02:40', monthsReady: 3, status: 'Ready', total: 56880 },
    ],
    costRecords: [
      { month: '2026-04', platform: 'Meituan Instashopping', customer: 'Master Kong', entity: 'Noodles', actual: 48320, claimed: 48320 },
      { month: '2026-04', platform: 'Meituan Instashopping', customer: 'Master Kong', entity: 'Beverages', actual: 31600, claimed: 31600 },
      { month: '2026-04', platform: 'Meituan Instashopping', customer: 'Master Kong', entity: 'Official Flagship', actual: 12480, claimed: 0 },
      { month: '2026-04', platform: 'Taobao Instashopping', customer: 'Coca-Cola', entity: 'Coca-Cola', actual: 24160, claimed: 24160 },
      { month: '2026-05', platform: 'Meituan Instashopping', customer: 'Master Kong', entity: 'Noodles', actual: 52800, claimed: 0 },
      { month: '2026-05', platform: 'Taobao Instashopping', customer: 'Coca-Cola', entity: 'Coca-Cola', actual: 19840, claimed: 0 },
      { month: '2026-05', platform: 'Dmall', customer: 'Hema', entity: 'Hema Fresh', actual: 18200, claimed: 0 },
    ],
    allocationDetails: [
      { id: 'MT-2605-001', entity: 'Noodles', start: '2026-05-01', end: '2026-05-07', original: 8240, allocated: 8240, status: 'Allocated' },
      { id: 'MT-2605-002', entity: 'Noodles', start: '2026-05-08', end: '2026-05-14', original: 9680, allocated: 9680, status: 'Allocated' },
      { id: 'MT-2605-003', entity: 'Noodles', start: '2026-05-15', end: '2026-05-21', original: 11200, allocated: 11200, status: 'Allocated' },
      { id: 'MT-2605-004', entity: 'Noodles', start: '2026-05-22', end: '2026-05-31', original: 23680, allocated: 0, status: 'To Allocate' },
    ],
    allocationRecords: [
      { id: 'RC-2604-001', month: '2026-04', platform: 'Meituan Instashopping', customer: 'Master Kong', entity: 'Noodles', project: 'SG-260217', amount: 48320, operator: 'Liu Yun', time: '2026-05-02', status: 'Aggregated' },
      { id: 'RC-2604-002', month: '2026-04', platform: 'Meituan Instashopping', customer: 'Master Kong', entity: 'Beverages', project: 'SG-260309', amount: 31600, operator: 'Liu Yun', time: '2026-05-02', status: 'Aggregated' },
      { id: 'RC-2604-003', month: '2026-04', platform: 'Taobao Instashopping', customer: 'Coca-Cola', entity: 'Coca-Cola', project: 'SG-260380', amount: 24160, operator: 'Zhang Ming', time: '2026-05-03', status: 'Aggregated' },
      { id: 'RC-2605-001', month: '2026-05', platform: 'Meituan Instashopping', customer: 'Master Kong', entity: 'Noodles', project: 'SG-260217', amount: 52800, operator: 'Liu Yun', time: '—', status: 'To Aggregate' },
    ],
  },
  pms: {
    projects: [
      { id: 'SG-260479', name: 'Hema May Campaign', customer: 'Hema', type: 'Marketing + Retail', quote: 150000, cost: 109560, status: 'In Progress' },
      { id: 'SG-260380', name: 'Coca-Cola Apr Campaign', customer: 'Coca-Cola', type: 'Marketing', quote: 45000, cost: 35900, status: 'In Progress' },
      { id: 'SG-260309', name: 'Coca-Cola Holiday Promo', customer: 'Coca-Cola', type: 'Marketing', quote: 12000, cost: 11620, status: 'In Progress' },
      { id: 'SG-260540', name: 'Nayuki May-1 Group-buy', customer: 'Nayuki', type: 'Marketing', quote: 18000, cost: 12760, status: 'Finished' },
      { id: 'SG-260217', name: 'Master Kong May Retail', customer: 'Master Kong', type: 'Retail', quote: 200000, cost: 101120, status: 'In Progress' },
      { id: 'SG-260116', name: 'Hema New Year Festival', customer: 'Hema', type: 'Marketing + Retail', quote: 80000, cost: 76400, status: 'Finished' },
      { id: 'SG-260025', name: 'Dmall Q1 Special', customer: 'Coca-Cola', type: 'Retail', quote: 30000, cost: 18200, status: 'In Progress' },
    ],
    settlements: [
      { id: 'ST-2604-001', project: 'SG-260479', name: 'Hema May Campaign', customer: 'Hema', quote: 150000, settled: 60000, date: '2026-05-10', status: 'Partially Settled', invoiced: 0 },
      { id: 'ST-2604-002', project: 'SG-260380', name: 'Coca-Cola Apr Campaign', customer: 'Coca-Cola', quote: 45000, settled: 0, date: '—', status: 'Unsettled', invoiced: 0 },
      { id: 'ST-2604-003', project: 'SG-260540', name: 'Nayuki May-1 Group-buy', customer: 'Nayuki', quote: 18000, settled: 18000, date: '2026-04-30', status: 'Settled', invoiced: 18000 },
    ],
  },
};

// ── Components ──────────────────────────────────────────────────────────────
function PageHead(title, subtitle, actionsHtml = '') {
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

function Tabs(items, activeId) {
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

function StatGrid(stats) {
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

function Table(headers, rows) {
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

function callout(type, title, body) {
  return `
    <div class="callout callout-${type}">
      ${title ? `<div class="callout-title">${escapeHtml(title)}</div>` : ''}
      <div>${escapeHtml(body)}</div>
    </div>
  `;
}

// ── Pages ───────────────────────────────────────────────────────────────────
function ArchPage() {
  const diagram = `
    <div class="card">
      <div class="card-head">System Communication Architecture</div>
      <div class="card-body">
        <div style="overflow:auto">
          <svg viewBox="0 0 980 520" width="980" style="max-width:100%; display:block;">
            <defs>
              <marker id="arr" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                <path d="M0,0.5 L0,6.5 L7,3.5z" fill="#94a3b8"></path>
              </marker>
              <marker id="arrA" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                <path d="M0,0.5 L0,6.5 L7,3.5z" fill="#1677ff"></path>
              </marker>
            </defs>

            <rect x="20" y="40" width="170" height="210" rx="8" fill="#ffffff" stroke="#dbe3f0"/>
            <text x="105" y="28" text-anchor="middle" font-size="12" fill="#64748b" font-family="system-ui">In-Store Platforms</text>

            <rect x="20" y="290" width="170" height="200" rx="8" fill="#ffffff" stroke="#dbe3f0"/>
            <text x="105" y="278" text-anchor="middle" font-size="12" fill="#64748b" font-family="system-ui">Instant Retail Platforms</text>

            <rect x="235" y="120" width="190" height="120" rx="10" fill="#f8fbff" stroke="#1677ff" stroke-width="2"/>
            <text x="330" y="154" text-anchor="middle" font-size="18" font-weight="700" fill="#1677ff" font-family="system-ui">In-Store Marketing</text>
            <text x="330" y="176" text-anchor="middle" font-size="11" fill="#64748b" font-family="system-ui">Activity ↔ Bill Aggregation ↔ Monthly Cost</text>
            <text x="330" y="195" text-anchor="middle" font-size="11" fill="#64748b" font-family="system-ui">No-overlap; project-change reference validation</text>

            <rect x="235" y="330" width="190" height="120" rx="10" fill="#fbfaff" stroke="#7c3aed" stroke-width="2"/>
            <text x="330" y="364" text-anchor="middle" font-size="18" font-weight="700" fill="#7c3aed" font-family="system-ui">Instant Retail</text>
            <text x="330" y="386" text-anchor="middle" font-size="11" fill="#64748b" font-family="system-ui">Crawler bills → Month+Customer+Entity cost</text>
            <text x="330" y="405" text-anchor="middle" font-size="11" fill="#64748b" font-family="system-ui">Operator allocation with auto-split + editable details</text>

            <rect x="485" y="210" width="215" height="170" rx="10" fill="#ffffff" stroke="#0f172a" stroke-width="2.2"/>
            <text x="592" y="245" text-anchor="middle" font-size="22" font-weight="800" fill="#0f172a" font-family="system-ui">PMS</text>
            <text x="592" y="267" text-anchor="middle" font-size="11" fill="#64748b" font-family="system-ui">Project quote · settlement · invoicing</text>
            <text x="592" y="286" text-anchor="middle" font-size="11" fill="#64748b" font-family="system-ui">Monthly cost summary · inventory monitoring</text>
            <text x="592" y="305" text-anchor="middle" font-size="11" fill="#64748b" font-family="system-ui">Shared project pool as the source of truth</text>

            <rect x="740" y="130" width="220" height="80" rx="10" fill="#ffffff" stroke="#059669" />
            <text x="850" y="168" text-anchor="middle" font-size="16" font-weight="700" fill="#059669" font-family="system-ui">Customer Settlement</text>
            <text x="850" y="190" text-anchor="middle" font-size="11" fill="#64748b" font-family="system-ui">Bills summary · settlement · invoicing</text>

            <rect x="740" y="240" width="220" height="80" rx="10" fill="#ffffff" stroke="#d97706" />
            <text x="850" y="278" text-anchor="middle" font-size="16" font-weight="700" fill="#d97706" font-family="system-ui">Inventory Monitoring</text>
            <text x="850" y="300" text-anchor="middle" font-size="11" fill="#64748b" font-family="system-ui">Quote - actual cost = remaining inventory</text>

            <rect x="740" y="350" width="220" height="80" rx="10" fill="#ffffff" stroke="#2563eb" />
            <text x="850" y="388" text-anchor="middle" font-size="16" font-weight="700" fill="#2563eb" font-family="system-ui">Finance Cost</text>
            <text x="850" y="410" text-anchor="middle" font-size="11" fill="#64748b" font-family="system-ui">Monthly rollup by customer/project</text>

            <!-- Platform mini boxes -->
            <g font-family="system-ui" font-size="12" fill="#0f172a">
              <rect x="36" y="62" width="138" height="42" rx="8" fill="#ffffff" stroke="#dbe3f0"/><text x="105" y="88" text-anchor="middle">WeChat</text>
              <rect x="36" y="112" width="138" height="42" rx="8" fill="#ffffff" stroke="#dbe3f0"/><text x="105" y="138" text-anchor="middle">Alipay</text>
              <rect x="36" y="162" width="138" height="42" rx="8" fill="#ffffff" stroke="#dbe3f0"/><text x="105" y="188" text-anchor="middle">Douyin</text>
            </g>
            <g font-family="system-ui" font-size="12" fill="#0f172a">
              <rect x="36" y="312" width="138" height="38" rx="8" fill="#ffffff" stroke="#dbe3f0"/><text x="105" y="336" text-anchor="middle">Meituan</text>
              <rect x="36" y="358" width="138" height="38" rx="8" fill="#ffffff" stroke="#dbe3f0"/><text x="105" y="382" text-anchor="middle">Taobao</text>
              <rect x="36" y="404" width="138" height="38" rx="8" fill="#ffffff" stroke="#dbe3f0"/><text x="105" y="428" text-anchor="middle">JD Daojia</text>
              <rect x="36" y="450" width="138" height="38" rx="8" fill="#ffffff" stroke="#dbe3f0"/><text x="105" y="474" text-anchor="middle">Dmall</text>
            </g>

            <!-- arrows -->
            <line x1="190" y1="84" x2="232" y2="150" stroke="#94a3b8" stroke-width="1.6" marker-end="url(#arr)"/>
            <line x1="190" y1="134" x2="232" y2="170" stroke="#94a3b8" stroke-width="1.6" marker-end="url(#arr)"/>
            <line x1="190" y1="184" x2="232" y2="190" stroke="#94a3b8" stroke-width="1.6" marker-end="url(#arr)"/>

            <line x1="190" y1="331" x2="232" y2="360" stroke="#94a3b8" stroke-width="1.6" marker-end="url(#arr)"/>
            <line x1="190" y1="377" x2="232" y2="382" stroke="#94a3b8" stroke-width="1.6" marker-end="url(#arr)"/>
            <line x1="190" y1="423" x2="232" y2="404" stroke="#94a3b8" stroke-width="1.6" marker-end="url(#arr)"/>
            <line x1="190" y1="469" x2="232" y2="426" stroke="#94a3b8" stroke-width="1.6" marker-end="url(#arr)"/>

            <line x1="425" y1="175" x2="485" y2="250" stroke="#1677ff" stroke-width="2" marker-end="url(#arrA)"/>
            <path d="M485,245 C455,240 450,210 425,185" fill="none" stroke="#1677ff" stroke-width="1.6" stroke-dasharray="4,3" marker-end="url(#arrA)"/>

            <line x1="425" y1="390" x2="485" y2="325" stroke="#7c3aed" stroke-width="2" marker-end="url(#arrA)"/>
            <path d="M485,332 C455,344 450,372 425,382" fill="none" stroke="#7c3aed" stroke-width="1.6" stroke-dasharray="4,3" marker-end="url(#arrA)"/>

            <line x1="700" y1="270" x2="740" y2="170" stroke="#94a3b8" stroke-width="1.6" marker-end="url(#arr)"/>
            <line x1="700" y1="295" x2="740" y2="280" stroke="#94a3b8" stroke-width="1.6" marker-end="url(#arr)"/>
            <line x1="700" y1="318" x2="740" y2="390" stroke="#94a3b8" stroke-width="1.6" marker-end="url(#arr)"/>
          </svg>
        </div>
      </div>
    </div>
  `;

  const principles = `
    <div class="two-col">
      <div class="card">
        <div class="card-head">In-Store Marketing — Aggregation Rules</div>
        <div class="card-body">
          ${callout('info', '', 'Bills are aggregated by activity. No overlap is allowed. Auto-run on the 1st of each month; operators can trigger manual aggregation when needed.')}
          <div style="height:10px"></div>
          ${callout('warning', 'Project-change validation', 'If an activity changes its linked project after bills have been aggregated, the system validates existing references to prevent inconsistencies.')}
        </div>
      </div>
      <div class="card">
        <div class="card-head">Instant Retail — Allocation Rules</div>
        <div class="card-body">
          ${callout('info', '', 'Bills have no activity id. Costs are generated by Month + Customer + Secondary Entity. Operators input project allocation amounts on the 1st of each month.')}
          <div style="height:10px"></div>
          ${callout('warning', 'Auto-split details', 'The system auto-splits stored bill details to match the allocation amount. If details are insufficient, operators can edit selected line items.')}
        </div>
      </div>
    </div>
  `;

  return `
    ${PageHead('System Architecture', 'Communication diagram and the key business rules')}
    ${diagram}
    <div style="height:12px"></div>
    ${principles}
  `;
}

function MarketingPage() {
  const tabKey = getSubTab('marketing', 'activities');
  const tabs = [
    { id: 'activities', label: 'Activities' },
    { id: 'bills', label: 'Bill Aggregation' },
    { id: 'costs', label: 'Monthly Cost' },
  ];

  let body = '';
  if (tabKey === 'activities') body = MarketingActivities();
  if (tabKey === 'bills') body = MarketingBills();
  if (tabKey === 'costs') body = MarketingCosts();

  return `
    ${PageHead('In-Store Marketing', 'WeChat / Alipay / Douyin activity operations')}
    ${Tabs(tabs, tabKey)}
    <div id="subpage">${body}</div>
  `;
}

function MarketingActivities() {
  const rows = DATA.marketing.activities.map((a) => [
    escapeHtml(a.id),
    escapeHtml(a.name),
    escapeHtml(a.platform),
    escapeHtml(a.customer),
    `<a class="link" data-action="openProject" data-project="${escapeHtml(a.project)}">${escapeHtml(a.project)}</a>`,
    escapeHtml(a.start),
    escapeHtml(a.end),
    pill(a.status),
    `<button class="btn btn-ghost" data-action="openActivity" data-id="${escapeHtml(a.id)}">Details</button>`,
  ]);

  return `
    <div class="card">
      <div class="card-head">
        Activity List
        <div class="toolbar">
          <button class="btn">Export</button>
          <button class="btn btn-primary" data-action="createActivity">New Activity</button>
        </div>
      </div>
      <div class="card-body">
        <div class="filters">
          <div class="toolbar">
            <input class="input" id="mkt-q" placeholder="Activity name" />
            <select class="select" id="mkt-platform">
              <option value="">All platforms</option>
              <option>WeChat Coupon</option>
              <option>WeChat Store</option>
              <option>Alipay Coupon</option>
              <option>Alipay Tap</option>
              <option>Douyin Group-buy</option>
            </select>
            <select class="select" id="mkt-status">
              <option value="">All status</option>
              <option>In Progress</option>
              <option>Finished</option>
              <option>Not Started</option>
            </select>
            <input class="input" id="mkt-cust" placeholder="Customer" />
            <button class="btn" data-action="filterMarketingActivities">Search</button>
          </div>
        </div>
        <div style="height:10px"></div>
        ${callout('info', '', 'Activities are linked to projects. If the linked project changes, aggregated bill references will be validated to prevent overlap and inconsistencies.')}
        <div style="height:10px"></div>
        ${Table(
          ['Activity ID', 'Activity Name', 'Platform', 'Customer', 'Linked Project', 'Start', 'End', 'Status', ''],
          rows
        )}
      </div>
    </div>
  `;
}

function MarketingBills() {
  const rows = DATA.marketing.bills.map((b) => [
    escapeHtml(b.id),
    escapeHtml(b.activity),
    escapeHtml(b.platform),
    escapeHtml(b.customer),
    escapeHtml(b.month),
    `<b>${escapeHtml(formatMoney(b.amount))}</b>`,
    pill(b.status),
    `<a class="link" data-action="openProject" data-project="${escapeHtml(b.project)}">${escapeHtml(b.project)}</a>`,
    `<button class="btn btn-ghost" data-action="aggregateOne" data-id="${escapeHtml(b.id)}">Aggregate</button>`,
  ]);

  return `
    <div class="card">
      <div class="card-head">
        Bill Aggregation
        <div class="toolbar">
          <button class="btn" data-action="aggregateBatch">Batch Aggregate</button>
          <button class="btn btn-primary" data-action="aggregateManual">Manual Aggregate</button>
        </div>
      </div>
      <div class="card-body">
        ${callout('warning', 'No-overlap rule', 'Auto aggregation runs on the 1st day of each month. Aggregation is based on activity bills and MUST NOT overlap. Once aggregated, the record is bound to the linked project.')}
        <div style="height:10px"></div>
        <div class="filters">
          <div class="toolbar">
            <select class="select" id="mkt-month">
              <option>2026-05</option>
              <option>2026-04</option>
            </select>
            <select class="select" id="mkt-bill-status">
              <option value="">All status</option>
              <option>Pending</option>
              <option>Aggregated</option>
            </select>
            <button class="btn" data-action="filterMarketingBills">Query</button>
          </div>
        </div>
        <div style="height:10px"></div>
        ${Table(
          ['Bill ID', 'Activity', 'Platform', 'Customer', 'Month', 'Amount', 'Status', 'Project', ''],
          rows
        )}
      </div>
    </div>
  `;
}

function MarketingCosts() {
  const totalApr = DATA.marketing.costs.filter((c) => c.month === '2026-04').reduce((s, c) => s + c.cost, 0);
  const totalMay = DATA.marketing.costs.filter((c) => c.month === '2026-05').reduce((s, c) => s + c.cost, 0);

  const rows = DATA.marketing.costs.map((c) => [
    escapeHtml(c.month),
    escapeHtml(c.platform),
    escapeHtml(c.customer),
    `<span class="link" data-action="openProjectsFromCost" data-projects="${escapeHtml(c.projects)}">${escapeHtml(c.projects)}</span>`,
    `<b>${escapeHtml(formatMoney(c.cost))}</b>`,
    pill(c.status),
    `<button class="btn btn-ghost" data-action="exportCostRow">Export</button>`,
  ]);

  return `
    ${StatGrid([
      { value: formatMoney(totalApr), label: 'Apr total cost' },
      { value: formatMoney(totalMay), label: 'May aggregating', tone: 'warning' },
      { value: '2', label: 'Confirmed months', tone: 'success' },
      { value: '1', label: 'Aggregating', tone: 'warning' },
    ])}
    <div style="height:12px"></div>
    <div class="card">
      <div class="card-head">
        Monthly Cost Rollup
        <div class="toolbar">
          <button class="btn">Export Report</button>
        </div>
      </div>
      <div class="card-body">
        <div class="filters">
          <div class="toolbar">
            <select class="select"><option>2026-05</option><option>2026-04</option></select>
            <select class="select"><option value="">All platforms</option><option>WeChat</option><option>Alipay</option><option>Douyin</option></select>
            <input class="input" placeholder="Customer" />
            <button class="btn">Query</button>
          </div>
        </div>
        <div style="height:10px"></div>
        ${Table(['Month', 'Platform', 'Customer', 'Projects', 'Cost', 'Status', ''], rows)}
      </div>
    </div>
  `;
}

function RetailPage() {
  const tabKey = getSubTab('retail', 'import');
  const tabs = [
    { id: 'import', label: 'Bill Import' },
    { id: 'allocation', label: 'Cost Allocation' },
    { id: 'records', label: 'Allocation Records' },
  ];

  let body = '';
  if (tabKey === 'import') body = RetailImport();
  if (tabKey === 'allocation') body = RetailAllocation();
  if (tabKey === 'records') body = RetailRecords();

  return `
    ${PageHead('Instant Retail', 'Meituan / Taobao / JD Daojia / Dmall')}
    ${Tabs(tabs, tabKey)}
    <div id="subpage">${body}</div>
  `;
}

function RetailImport() {
  const cards = DATA.retail.sources
    .map(
      (s) => `
      <div class="card">
        <div class="card-head">
          ${escapeHtml(s.platform)}
          ${pill(s.status)}
        </div>
        <div class="card-body">
          <div class="page-subtitle">Last crawl: ${escapeHtml(s.lastCrawl)}</div>
          <div class="page-subtitle">Months ready: ${escapeHtml(String(s.monthsReady))}</div>
          <div style="height:8px"></div>
          <div style="font-size:18px; font-weight:800">${escapeHtml(formatMoney(s.total))}</div>
        </div>
      </div>
    `
    )
    .join('');

  const rows = DATA.retail.costRecords.map((r) => {
    const remaining = r.actual - r.claimed;
    const status = remaining <= 0 ? 'Allocated' : 'To Allocate';
    return [
      escapeHtml(r.month),
      escapeHtml(r.platform),
      escapeHtml(r.customer),
      escapeHtml(r.entity),
      `<b>${escapeHtml(formatMoney(r.actual))}</b>`,
      escapeHtml(formatMoney(r.claimed)),
      `<span style="color:${remaining > 0 ? '#d97706' : '#059669'}; font-weight:700">${escapeHtml(formatMoney(remaining))}</span>`,
      pill(status),
      `<button class="btn btn-ghost" data-action="openAllocation" data-entity="${escapeHtml(r.entity)}">Allocate</button>`,
    ];
  });

  return `
    <div class="card">
      <div class="card-head">
        Import Status
        <div class="toolbar">
          <button class="btn" data-action="crawlNow">Trigger Crawl</button>
        </div>
      </div>
      <div class="card-body">
        <div class="grid" style="grid-template-columns:repeat(4, minmax(0, 1fr)); gap:10px;">
          ${cards}
        </div>
      </div>
    </div>
    <div style="height:12px"></div>
    <div class="card">
      <div class="card-head">Monthly Cost Records (Month + Customer + Secondary Entity)</div>
      <div class="card-body">
        ${callout('info', '', 'Bills have no activity id. Costs are generated by Month + Customer + Secondary Entity. The table shows actual cost and claimed/remaining amounts.')}
        <div style="height:10px"></div>
        <div class="filters">
          <div class="toolbar">
            <select class="select"><option>2026-05</option><option>2026-04</option></select>
            <select class="select">
              <option value="">All platforms</option>
              <option>Meituan Instashopping</option>
              <option>Taobao Instashopping</option>
              <option>JD Daojia</option>
              <option>Dmall</option>
            </select>
            <input class="input" placeholder="Customer" />
            <select class="select"><option value="">All status</option><option>To Allocate</option><option>Allocated</option></select>
            <button class="btn">Query</button>
          </div>
        </div>
        <div style="height:10px"></div>
        ${Table(['Month', 'Platform', 'Customer', 'Entity', 'Actual', 'Claimed', 'Remaining', 'Status', ''], rows)}
      </div>
    </div>
  `;
}

function RetailAllocation() {
  const actualTotal = 52800;
  const claimed = DATA.retail.allocationDetails.reduce((s, d) => s + (d.allocated || 0), 0);
  const remaining = actualTotal - claimed;

  const detailRows = DATA.retail.allocationDetails.map((d) => {
    const allocCell =
      d.status === 'Allocated'
        ? `<b style="color:#059669">${escapeHtml(formatMoney(d.allocated))}</b>`
        : `<input class="input" style="min-width:120px" value="${escapeHtml(String(d.original))}" data-action="editAlloc" data-id="${escapeHtml(d.id)}" />`;
    return [
      escapeHtml(d.id),
      escapeHtml(d.entity),
      escapeHtml(d.start),
      escapeHtml(d.end),
      escapeHtml(formatMoney(d.original)),
      allocCell,
      pill(d.status),
    ];
  });

  const body = `
    ${callout('warning', '', 'Select month/platform/customer/entity. Enter project allocation amount. The system auto-splits bill details to match the amount; if details are insufficient, you may edit some records.')}
    <div style="height:10px"></div>

    <div class="card">
      <div class="card-head">Allocation Target</div>
      <div class="card-body">
        <div class="toolbar">
          <div>
            <div class="page-subtitle">Month</div>
            <select class="select"><option>2026-05</option><option>2026-04</option></select>
          </div>
          <div>
            <div class="page-subtitle">Platform</div>
            <select class="select"><option>Meituan Instashopping</option></select>
          </div>
          <div>
            <div class="page-subtitle">Customer</div>
            <select class="select"><option>Master Kong</option></select>
          </div>
          <div>
            <div class="page-subtitle">Entity</div>
            <select class="select"><option>Noodles</option></select>
          </div>
        </div>
      </div>
    </div>

    <div style="height:12px"></div>
    ${StatGrid([
      { value: formatMoney(actualTotal), label: 'Actual total cost' },
      { value: formatMoney(claimed), label: 'Claimed', tone: 'success' },
      { value: formatMoney(remaining), label: 'Remaining', tone: 'warning' },
      { value: '1', label: 'Projects in allocation' },
    ])}

    <div style="height:12px"></div>
    <div class="card">
      <div class="card-head">Project Allocation</div>
      <div class="card-body">
        ${Table(
          ['Project', 'Project Name', 'Allocated Amount', ''],
          [
            [
              `<a class="link" data-action="openProject" data-project="SG-260217">SG-260217</a>`,
              escapeHtml('Master Kong May Retail'),
              `<input class="input" id="alloc-amount" placeholder="Enter amount" value="${escapeHtml(String(actualTotal))}" />`,
              `<button class="btn btn-ghost" data-action="removeProjectRow">Remove</button>`,
            ],
            [
              `<button class="btn btn-ghost" data-action="addProjectRow">+ Add project</button>`,
              '—',
              '—',
              '—',
            ],
          ]
        )}
      </div>
    </div>

    <div style="height:12px"></div>
    <div class="card">
      <div class="card-head">Auto-split Bill Details</div>
      <div class="card-body">
        <div class="page-subtitle">
          The system splits by time order. Unallocated remainder can be edited at the line level.
        </div>
        <div style="height:10px"></div>
        ${Table(['Detail ID', 'Entity', 'Start', 'End', 'Original', 'Allocated', 'Status'], detailRows)}
      </div>
    </div>
  `;

  return `
    <div class="card">
      <div class="card-head">
        Cost Allocation
        <div class="toolbar">
          <button class="btn" data-action="saveDraft">Save Draft</button>
          <button class="btn btn-primary" data-action="submitAggregate">Submit & Aggregate</button>
        </div>
      </div>
      <div class="card-body">${body}</div>
    </div>
  `;
}

function RetailRecords() {
  const rows = DATA.retail.allocationRecords.map((r) => [
    escapeHtml(r.id),
    escapeHtml(r.month),
    escapeHtml(r.platform),
    escapeHtml(r.customer),
    escapeHtml(r.entity),
    `<a class="link" data-action="openProject" data-project="${escapeHtml(r.project)}">${escapeHtml(r.project)}</a>`,
    `<b>${escapeHtml(formatMoney(r.amount))}</b>`,
    escapeHtml(r.operator),
    escapeHtml(r.time),
    pill(r.status),
    `<button class="btn btn-ghost" data-action="adjustAllocation" data-id="${escapeHtml(r.id)}">Adjust</button>`,
  ]);

  return `
    <div class="card">
      <div class="card-head">
        Allocation Records
        <div class="toolbar">
          <button class="btn">Export</button>
        </div>
      </div>
      <div class="card-body">
        <div class="filters">
          <div class="toolbar">
            <select class="select"><option>2026-05</option><option>2026-04</option></select>
            <select class="select"><option value="">All platforms</option><option>Meituan Instashopping</option><option>Taobao Instashopping</option></select>
            <select class="select"><option value="">All status</option><option>Aggregated</option><option>To Aggregate</option></select>
            <button class="btn">Query</button>
          </div>
        </div>
        <div style="height:10px"></div>
        ${Table(['Record ID', 'Month', 'Platform', 'Customer', 'Entity', 'Project', 'Amount', 'Operator', 'Time', 'Status', ''], rows)}
      </div>
    </div>
  `;
}

function PmsPage() {
  const tabKey = getSubTab('pms', 'projects');
  const tabs = [
    { id: 'projects', label: 'Projects' },
    { id: 'monitor', label: 'Cost Monitoring' },
    { id: 'settlement', label: 'Settlement & Invoicing' },
  ];
  let body = '';
  if (tabKey === 'projects') body = PmsProjects();
  if (tabKey === 'monitor') body = PmsMonitor();
  if (tabKey === 'settlement') body = PmsSettlement();
  return `
    ${PageHead('PMS', 'Project quote, settlement, invoicing, and cost inventory monitoring')}
    ${Tabs(tabs, tabKey)}
    <div id="subpage">${body}</div>
  `;
}

function PmsProjects() {
  const totalQuote = DATA.pms.projects.reduce((s, p) => s + p.quote, 0);
  const totalCost = DATA.pms.projects.reduce((s, p) => s + p.cost, 0);
  const remaining = totalQuote - totalCost;

  const rows = DATA.pms.projects.map((p) => {
    const inv = p.quote - p.cost;
    const invColor = inv < 5000 ? '#dc2626' : '#059669';
    return [
      `<a class="link" data-action="openProject" data-project="${escapeHtml(p.id)}">${escapeHtml(p.id)}</a>`,
      escapeHtml(p.name),
      escapeHtml(p.customer),
      escapeHtml(p.type),
      `<b>${escapeHtml(formatMoney(p.quote))}</b>`,
      escapeHtml(formatMoney(p.cost)),
      `<b style="color:${invColor}">${escapeHtml(formatMoney(inv))}</b>`,
      pill(p.status),
      `<button class="btn btn-ghost" data-action="projectDetail" data-project="${escapeHtml(p.id)}">Open</button>`,
    ];
  });

  return `
    ${StatGrid([
      { value: String(DATA.pms.projects.filter((p) => p.status === 'In Progress').length), label: 'In progress projects', tone: 'info' },
      { value: formatMoney(totalQuote), label: 'Total quoted' },
      { value: formatMoney(totalCost), label: 'Aggregated cost' },
      { value: formatMoney(remaining), label: 'Remaining inventory', tone: remaining < 0 ? 'danger' : 'success' },
    ])}
    <div style="height:12px"></div>
    <div class="card">
      <div class="card-head">
        Project List
        <div class="toolbar">
          <button class="btn">Export</button>
          <button class="btn btn-primary" data-action="newProject">New Project</button>
        </div>
      </div>
      <div class="card-body">
        <div class="filters">
          <div class="toolbar">
            <input class="input" placeholder="Project ID / name" />
            <select class="select"><option value="">All customers</option><option>Hema</option><option>Coca-Cola</option><option>Master Kong</option></select>
            <select class="select"><option value="">All types</option><option>Marketing</option><option>Retail</option><option>Marketing + Retail</option></select>
            <select class="select"><option value="">All status</option><option>In Progress</option><option>Finished</option></select>
            <button class="btn">Search</button>
          </div>
        </div>
        <div style="height:10px"></div>
        ${Table(['Project', 'Name', 'Customer', 'Type', 'Quote', 'Cost', 'Remaining', 'Status', ''], rows)}
      </div>
    </div>
  `;
}

function PmsMonitor() {
  const warn = DATA.pms.projects
    .map((p) => ({ ...p, remaining: p.quote - p.cost }))
    .filter((p) => p.remaining < 5000)
    .sort((a, b) => a.remaining - b.remaining);

  const rows = warn.map((p) => [
    `<a class="link" data-action="openProject" data-project="${escapeHtml(p.id)}">${escapeHtml(p.id)}</a>`,
    escapeHtml(p.name),
    escapeHtml(p.customer),
    escapeHtml(formatMoney(p.quote)),
    escapeHtml(formatMoney(p.cost)),
    `<b style="color:#dc2626">${escapeHtml(formatMoney(p.remaining))}</b>`,
    `${Math.min(100, Math.round((p.cost / p.quote) * 1000) / 10)}%`,
    `<span class="pill pill-warning">High Risk</span>`,
  ]);

  return `
    ${callout('danger', 'Overuse warning', 'Projects below inventory threshold require action: adjust spend, renegotiate quote, or settle earlier.')}
    <div style="height:12px"></div>
    <div class="card">
      <div class="card-head">Inventory Warning Projects</div>
      <div class="card-body">
        ${Table(['Project', 'Name', 'Customer', 'Quote', 'Cost', 'Remaining', 'Burn rate', 'Alert'], rows)}
      </div>
    </div>
  `;
}

function PmsSettlement() {
  const rows = DATA.pms.settlements.map((s) => [
    escapeHtml(s.id),
    `<a class="link" data-action="openProject" data-project="${escapeHtml(s.project)}">${escapeHtml(s.project)}</a>`,
    escapeHtml(s.name),
    escapeHtml(s.customer),
    `<b>${escapeHtml(formatMoney(s.quote))}</b>`,
    `<b>${escapeHtml(formatMoney(s.settled))}</b>`,
    escapeHtml(s.date),
    pill(s.status),
    escapeHtml(formatMoney(s.invoiced)),
    `<button class="btn btn-ghost" data-action="settleDetail" data-id="${escapeHtml(s.id)}">Open</button>`,
  ]);

  return `
    ${StatGrid([
      { value: formatMoney(DATA.pms.settlements.reduce((s, x) => s + x.settled, 0)), label: 'Settled', tone: 'success' },
      { value: formatMoney(DATA.pms.settlements.filter((x) => x.status === 'Partially Settled').reduce((s, x) => s + x.settled, 0)), label: 'Partially settled', tone: 'warning' },
      { value: formatMoney(DATA.pms.settlements.filter((x) => x.status === 'Unsettled').reduce((s, x) => s + (x.quote - x.settled), 0)), label: 'To settle' },
      { value: formatMoney(DATA.pms.settlements.reduce((s, x) => s + x.invoiced, 0)), label: 'Invoiced', tone: 'success' },
    ])}
    <div style="height:12px"></div>
    <div class="card">
      <div class="card-head">
        Settlement & Invoicing
        <div class="toolbar">
          <button class="btn" data-action="requestInvoice">Request Invoice</button>
          <button class="btn btn-primary" data-action="startSettlement">Start Settlement</button>
        </div>
      </div>
      <div class="card-body">
        <div class="filters">
          <div class="toolbar">
            <select class="select"><option value="">All customers</option><option>Hema</option><option>Coca-Cola</option><option>Nayuki</option></select>
            <select class="select"><option value="">All status</option><option>Settled</option><option>Partially Settled</option><option>Unsettled</option></select>
            <input class="input" placeholder="Project ID" />
            <button class="btn">Query</button>
          </div>
        </div>
        <div style="height:10px"></div>
        ${Table(['Settlement ID', 'Project', 'Project Name', 'Customer', 'Quote', 'Settled', 'Date', 'Status', 'Invoiced', ''], rows)}
      </div>
    </div>
  `;
}

// ── Routing ────────────────────────────────────────────────────────────────
const ROUTES = {
  '/arch': ArchPage,
  '/marketing': MarketingPage,
  '/retail': RetailPage,
  '/pms': PmsPage,
};

function getRoute() {
  const h = window.location.hash || '#/arch';
  const m = h.match(/^#(\/[^?]*)(\?.*)?$/);
  return m ? m[1] : '/arch';
}

function getQueryParams() {
  const h = window.location.hash || '';
  const qIndex = h.indexOf('?');
  const qs = qIndex >= 0 ? h.slice(qIndex + 1) : '';
  const p = new URLSearchParams(qs);
  return p;
}

function setQueryParam(key, value) {
  const route = getRoute();
  const p = getQueryParams();
  if (value === null || value === undefined || value === '') p.delete(key);
  else p.set(key, value);
  const qs = p.toString();
  window.location.hash = `#${route}${qs ? `?${qs}` : ''}`;
}

function getSubTab(scope, fallback) {
  const p = getQueryParams();
  const key = p.get(`${scope}Tab`) || fallback;
  return key;
}

function render() {
  const path = getRoute();
  const page = $('#page');
  const fn = ROUTES[path] || ROUTES['/arch'];
  page.innerHTML = fn();

  // top nav
  const topnav = $('#topnav');
  const navItems = [
    { href: '#/arch', label: 'Architecture' },
    { href: '#/marketing', label: 'Marketing' },
    { href: '#/retail', label: 'Retail' },
    { href: '#/pms', label: 'PMS' },
  ];
  topnav.innerHTML = navItems
    .map((n) => `<a href="${n.href}" class="${getRoute() === n.href.slice(1) ? 'active' : ''}">${escapeHtml(n.label)}</a>`)
    .join('');

  // side nav active
  $$('.sidenav-item').forEach((a) => {
    const href = a.getAttribute('href') || '';
    a.classList.toggle('active', href.slice(1) === getRoute());
  });

  // tabs click
  $$('.tab').forEach((t) => {
    t.addEventListener('click', () => {
      const activeRoute = getRoute();
      const scope = activeRoute === '/marketing' ? 'marketing' : activeRoute === '/retail' ? 'retail' : 'pms';
      setQueryParam(`${scope}Tab`, t.dataset.tab);
    });
  });
}

window.addEventListener('hashchange', render);
render();

// ── Actions ────────────────────────────────────────────────────────────────
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  if (!action) return;

  if (action === 'createActivity') {
    openModal({
      title: 'New Activity (Frontend Only)',
      bodyHtml: `
        <div class="toolbar" style="gap:10px; flex-wrap:wrap">
          <div><div class="page-subtitle">Name</div><input class="input" placeholder="Activity name" style="min-width:260px"/></div>
          <div><div class="page-subtitle">Platform</div>
            <select class="select">
              <option>WeChat Coupon</option><option>WeChat Store</option><option>Alipay Coupon</option><option>Alipay Tap</option><option>Douyin Group-buy</option>
            </select>
          </div>
          <div><div class="page-subtitle">Customer</div><input class="input" placeholder="Customer" /></div>
          <div><div class="page-subtitle">Linked Project</div><input class="input" placeholder="SG-xxxxxx" /></div>
        </div>
        <div style="height:10px"></div>
        ${callout('warning', 'Validation', 'If the linked project changes after aggregation, the system will validate existing bill references.')}
      `,
      footerHtml: `<button class="btn" id="modal-cancel">Cancel</button><button class="btn btn-primary" id="modal-ok">Create</button>`,
    });
    $('#modal-cancel').addEventListener('click', closeModal);
    $('#modal-ok').addEventListener('click', () => {
      toast('Created', 'Mock activity created (no backend).');
      closeModal();
    });
    return;
  }

  if (action === 'openActivity') {
    toast('Activity', `Open details for ${el.dataset.id}`);
    return;
  }

  if (action === 'openProject') {
    const pid = el.dataset.project || '';
    openModal({
      title: `Project ${pid}`,
      bodyHtml: `
        ${callout('info', '', 'This is a frontend-only placeholder for project details. In the real system, PMS is the source of truth for project quote/settlement/invoicing.')}
        <div style="height:10px"></div>
        <div class="toolbar" style="gap:10px; flex-wrap:wrap">
          <div><div class="page-subtitle">Project</div><input class="input" value="${escapeHtml(pid)}"/></div>
          <div><div class="page-subtitle">Quote</div><input class="input" value="(mock)" /></div>
          <div><div class="page-subtitle">Aggregated Cost</div><input class="input" value="(mock)" /></div>
        </div>
      `,
      footerHtml: `<button class="btn" id="modal-close2">Close</button>`,
    });
    $('#modal-close2').addEventListener('click', closeModal);
    return;
  }

  if (action === 'aggregateBatch' || action === 'aggregateManual' || action === 'aggregateOne') {
    toast('Aggregation', 'Mock aggregation triggered. (No overlap checks are simulated in this prototype UI.)');
    return;
  }

  if (action === 'crawlNow') {
    toast('Crawler', 'Mock crawler trigger submitted.');
    return;
  }

  if (action === 'openAllocation') {
    window.location.hash = '#/retail?retailTab=allocation';
    toast('Allocation', `Open allocation for entity: ${el.dataset.entity || ''}`);
    return;
  }

  if (action === 'saveDraft') {
    toast('Saved', 'Draft saved locally (mock).');
    return;
  }
  if (action === 'submitAggregate') {
    toast('Submitted', 'Allocation submitted and aggregated (mock).');
    return;
  }
  if (action === 'adjustAllocation') {
    toast('Adjust', `Open adjustment for record ${el.dataset.id || ''}`);
    return;
  }

  if (action === 'newProject') {
    toast('PMS', 'Mock new project flow.');
    return;
  }
  if (action === 'requestInvoice' || action === 'startSettlement') {
    toast('PMS', 'Mock settlement/invoicing action.');
    return;
  }

  // filters
  if (action === 'filterMarketingActivities' || action === 'filterMarketingBills') {
    toast('Filter', 'Filters applied (visual only).');
    return;
  }
});

