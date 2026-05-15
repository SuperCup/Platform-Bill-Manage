import { DATA } from '../shared/data.js';
import { escapeHtml, formatMoney } from '../shared/format.js';
import { PageHead, Table, callout, pill } from '../shared/ui.js';
import { getSubTab, getQueryParams } from '../shared/router.js';
import { RetailBillsPage } from './bills.js';
import { RetailProjectCostPage } from './project-cost.js';

const RTL_COST_QUERY_KEYS = [
  'retailCostPlatform',
  'retailCostMonth',
  'retailCostCust',
  'rtlManualMonth',
  'retailCostView',
  'rtlAutoPage',
  'rtlManualPage',
];

const PAGE_SIZE_AUTO = 5;
const PAGE_SIZE_MANUAL = 10;

/** 成本管理页 URL：`retailTab=costMgmt`。`overrides` 中空字符串表示从 URL 中移除该键。 */
export function mergeRetailCostQuery(overrides = {}) {
  const q = getQueryParams();
  const p = new URLSearchParams();
  p.set('retailTab', 'costMgmt');
  for (const k of RTL_COST_QUERY_KEYS) {
    let v;
    if (Object.prototype.hasOwnProperty.call(overrides, k)) {
      v = overrides[k];
      if (v === null || v === undefined || v === '') continue;
    } else {
      v = q.get(k);
      if (!v) continue;
    }
    p.set(k, String(v));
  }
  return `#/retail?${p.toString()}`;
}

function linkedBillCell(r) {
  if (!r.linkedBizBillId) {
    return r.pending > 0
      ? `<a class="link" data-action="openRetailAllocate" data-record-id="${escapeHtml(r.id)}" style="font-size:12px">选择业务账单</a>`
      : '—';
  }
  const bill = DATA.retail.bizBills.find(b => b.id === r.linkedBizBillId);
  const name  = bill ? bill.name : String(r.linkedBizBillId);
  const short = name.length > 28 ? name.slice(0, 28) + '…' : name;
  return `<a class="link" data-action="openBizBillDetail" data-bill-id="${escapeHtml(String(r.linkedBizBillId))}" style="font-size:12px" title="${escapeHtml(name)}">${escapeHtml(String(r.linkedBizBillId))}</a><br><span style="font-size:11px;color:var(--muted)">${escapeHtml(short)}</span>`;
}

export function RetailPage() {
  const tabKey = getSubTab('retail', 'costMgmt');
  let body = '';
  if      (tabKey === 'costMgmt')    body = RetailCostMgmt();
  else if (tabKey === 'bills')       body = RetailBillsPage();
  else if (tabKey === 'projectCost') body = RetailProjectCostPage();
  else                               body = RetailCostMgmt();

  const noHead = ['costMgmt', 'bills', 'projectCost'].includes(tabKey);
  const head   = noHead ? '' : PageHead('即时零售', '美团闪购 / 淘宝闪购 / 京东到家 / 多点');
  return `${head}<div id="subpage">${body}</div>`;
}

function retailCostTabHref(platformId) {
  return mergeRetailCostQuery({ retailCostPlatform: platformId });
}

function costPaginationBar(page, totalPages, totalItems, pageSize, pageKey) {
  const tp = Math.max(1, totalPages);
  const pg = Math.min(Math.max(1, page), tp);
  const prevHref = pg > 1 ? mergeRetailCostQuery({ [pageKey]: String(pg - 1) }) : '';
  const nextHref = pg < tp ? mergeRetailCostQuery({ [pageKey]: String(pg + 1) }) : '';
  const rangeLabel =
    totalItems === 0
      ? '共 0 条'
      : `共 ${totalItems} 条，每页 ${pageSize} 条`;
  return `
    <div class="pagination-bar">
      <span class="pagination-meta">${escapeHtml(rangeLabel)} · 第 ${pg} / ${tp} 页</span>
      <span class="pagination-actions">
        ${
          pg > 1
            ? `<a class="btn btn-ghost btn-sm" href="${prevHref}">上一页</a>`
            : `<span class="btn btn-ghost btn-sm" style="opacity:.4;pointer-events:none">上一页</span>`
        }
        ${
          pg < tp
            ? `<a class="btn btn-ghost btn-sm" href="${nextHref}">下一页</a>`
            : `<span class="btn btn-ghost btn-sm" style="opacity:.4;pointer-events:none">下一页</span>`
        }
      </span>
    </div>`;
}

function RetailCostMgmtAuto(plat, q) {
  const monthFilter = (q.get('retailCostMonth') || '').trim();
  const custKw      = (q.get('retailCostCust')   || '').trim().toLowerCase();

  let raw = DATA.retail.costRecords.filter(r => r.platform === plat);
  if (monthFilter) raw = raw.filter(r => r.month === monthFilter);

  const byCustomer = new Map();
  for (const r of raw) {
    if (custKw && !r.customer.toLowerCase().includes(custKw)) continue;
    if (!byCustomer.has(r.customer)) {
      byCustomer.set(r.customer, { customer: r.customer, rows: [], actual: 0, allocated: 0 });
    }
    const g = byCustomer.get(r.customer);
    const pending = r.actual - r.claimed;
    g.actual    += r.actual;
    g.allocated += r.claimed;
    g.rows.push({ ...r, allocated: r.claimed, pending, status: pending <= 0 ? '已分配' : '待分配' });
  }

  const customers = [...byCustomer.values()].sort((a, b) =>
    a.customer.localeCompare(b.customer, 'zh-CN')
  );

  const monthsFromCosts = [...new Set(DATA.retail.costRecords.map((r) => r.month))].sort().reverse();
  const monthOptions = [`<option value="">全部月份</option>`,
    ...monthsFromCosts.map(m => `<option value="${m}"${monthFilter === m ? ' selected' : ''}>${m}</option>`),
  ].join('');

  const custVal = escapeHtml(q.get('retailCostCust') || '');

  const totalPages = Math.max(1, Math.ceil(customers.length / PAGE_SIZE_AUTO));
  let autoPage = parseInt(q.get('rtlAutoPage') || '1', 10);
  if (!Number.isFinite(autoPage) || autoPage < 1) autoPage = 1;
  if (autoPage > totalPages) autoPage = totalPages;
  const start = (autoPage - 1) * PAGE_SIZE_AUTO;
  const customersPage = customers.slice(start, start + PAGE_SIZE_AUTO);

  const blocks = customersPage.map(g => {
    const pendingTotal = g.actual - g.allocated;
    const status       = pendingTotal <= 0 ? '已分配' : '待分配';

    const innerRows = g.rows.map(r => {
      const projList = r.allocDetail?.projects || [];
      const projCell = projList.length
        ? projList.map(p =>
            `<a class="link" style="font-size:12px" data-action="openProject" data-project="${escapeHtml(p.projectId)}">${escapeHtml(p.projectId)}</a>`
          ).join('<br>')
        : `<span style="color:var(--muted);font-size:12px">未分配</span>`;

      const ops = `<span class="toolbar" style="gap:6px;flex-wrap:wrap">
        <button type="button" class="btn btn-ghost" data-action="allocCostToProject"
          data-record-id="${escapeHtml(r.id)}">分配项目</button>
        <button type="button" class="btn btn-ghost" data-action="openRetailAllocDetail"
          data-record-id="${escapeHtml(r.id)}">明细</button>
      </span>`;

      return [
        escapeHtml(r.month),
        escapeHtml(r.entity),
        escapeHtml(r.costType || '平台活动账单'),
        `<b>${escapeHtml(formatMoney(r.actual))}</b>`,
        escapeHtml(formatMoney(r.allocated)),
        `<span style="color:${r.pending > 0 ? '#d97706' : '#059669'};font-weight:700">${escapeHtml(formatMoney(r.pending))}</span>`,
        pill(r.status),
        projCell,
        linkedBillCell(r),
        ops,
      ];
    });

    return `
      <details class="cost-customer-block" open>
        <summary class="cost-customer-summary">
          <span class="cost-expand-icon" aria-hidden="true">▸</span>
          <strong>${escapeHtml(g.customer)}</strong>
          <span>汇总实际：<b>${escapeHtml(formatMoney(g.actual))}</b></span>
          <span>已分配：<b>${escapeHtml(formatMoney(g.allocated))}</b></span>
          <span>待分配：<b style="color:${pendingTotal > 0 ? '#d97706' : '#059669'}">${escapeHtml(formatMoney(pendingTotal))}</b></span>
          <span>${pill(status)}</span>
        </summary>
        <div class="cost-customer-body">
          ${Table(
            ['月份', '二级实体', '成本类型', '实际成本', '已分配', '待分配', '状态', '归集项目', '业务账单', '操作'],
            innerRows
          )}
        </div>
      </details>
    `;
  }).join('');

  const pager =
    customers.length > 0
      ? costPaginationBar(autoPage, totalPages, customers.length, PAGE_SIZE_AUTO, 'rtlAutoPage')
      : '';

  return `
    <div class="card">
      <div class="card-body">
        <div class="filters">
          <div class="toolbar">
            <select class="select" id="rtl-cost-month">${monthOptions}</select>
            <input class="input" id="rtl-cost-cust" placeholder="客户" value="${custVal}" />
            <button type="button" class="btn btn-primary" data-action="filterRetailCost">查询</button>
            <button type="button" class="btn" data-action="resetRetailCost">重置</button>
          </div>
        </div>
        <div style="height:12px"></div>
        ${blocks || `<div style="padding:12px 4px;color:var(--muted);font-size:13px">暂无数据</div>`}
        ${pager}
      </div>
    </div>
  `;
}

function RetailCostMgmtManual(plat, q) {
  const manualList = DATA.retail.manualTransferCosts || [];
  const manualMonthQ = (q.get('rtlManualMonth') || '').trim();
  const manualRowsFiltered = manualList.filter(
    (e) => e.platform === plat && (!manualMonthQ || e.month === manualMonthQ)
  );

  const monthSetCosts = new Set(DATA.retail.costRecords.map((r) => r.month));
  const monthSetAll = new Set(monthSetCosts);
  for (const e of manualList) {
    if (e.month) monthSetAll.add(e.month);
  }
  const monthsAll = [...monthSetAll].sort().reverse();

  const manualMonthOptions = [...new Set([...monthsAll, manualMonthQ].filter(Boolean))]
    .sort()
    .reverse()
    .map(
      (m) => `<option value="${escapeHtml(m)}"${manualMonthQ === m ? ' selected' : ''}>${escapeHtml(m)}</option>`
    )
    .join('');

  const totalPages = Math.max(1, Math.ceil(manualRowsFiltered.length / PAGE_SIZE_MANUAL));
  let manualPage = parseInt(q.get('rtlManualPage') || '1', 10);
  if (!Number.isFinite(manualPage) || manualPage < 1) manualPage = 1;
  if (manualPage > totalPages) manualPage = totalPages;
  const mStart = (manualPage - 1) * PAGE_SIZE_MANUAL;
  const manualSlice = manualRowsFiltered.slice(mStart, mStart + PAGE_SIZE_MANUAL);

  const manualTableRows = manualSlice.map((e) => {
    const pname = (DATA.pms?.projects || []).find((p) => p.id === e.projectId)?.name || '—';
    const vc = (e.vouchers || []).length;
    const vchCell =
      vc > 0
        ? `<span style="font-size:12px;color:var(--muted)">${vc} 个</span><br><a class="link" data-action="viewRtlManualVouchers" data-manual-id="${escapeHtml(e.id)}">查看</a>`
        : `<span style="color:var(--muted)">—</span>`;
    const logCount = (e.editLogs || []).length;
    const ops = `
      <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
        <a class="link" data-action="openRtlManualCostModal" data-manual-id="${escapeHtml(e.id)}">编辑</a>
        <span style="color:var(--border)">|</span>
        <a class="link" data-action="viewRtlManualEditLogs" data-manual-id="${escapeHtml(e.id)}">日志${logCount ? `(${logCount})` : ''}</a>
      </div>`;
    return [
      escapeHtml(e.month),
      `<b>${escapeHtml(formatMoney(e.amount))}</b>`,
      escapeHtml(e.costType),
      `<a class="link" data-action="openProject" data-project="${escapeHtml(e.projectId)}">${escapeHtml(e.projectId)}</a><br><span style="font-size:11px;color:var(--muted)">${escapeHtml(pname)}</span>`,
      vchCell,
      escapeHtml(e.operator || '—'),
      escapeHtml(e.createdAt || '—'),
      ops,
    ];
  });

  const pager =
    manualRowsFiltered.length > 0
      ? costPaginationBar(manualPage, totalPages, manualRowsFiltered.length, PAGE_SIZE_MANUAL, 'rtlManualPage')
      : '';

  return `
    <div class="card">
      <div class="card-body">
        ${callout(
          'info',
          '说明',
          `<ul style="margin:0;padding-left:18px;line-height:1.6;font-size:13px;color:var(--text)">
            <li>事故单请直接到 PMS 选择相关科目做负结算，无需创建成本记录。</li>
            <li>请款错用优惠券核销科目，导致必须关联账单，可与财务沟通后，联系技术人员修改科目，无需此处创建成本记录。</li>
          </ul>`,
          { htmlBody: true }
        )}
        <div style="height:12px"></div>
        <div class="filters">
          <div class="toolbar" style="flex-wrap:wrap">
            <span class="page-subtitle" style="align-self:center;margin-right:4px">按月份查看</span>
            <select class="select" id="rtl-manual-month-filter">
              <option value="">全部月份</option>${manualMonthOptions}
            </select>
            <button type="button" class="btn btn-primary" data-action="filterRtlManualMonth">查询</button>
            <button type="button" class="btn" data-action="resetRtlManualMonth">重置</button>
          </div>
        </div>
        <div style="height:14px"></div>
        <div class="toolbar" style="flex-wrap:wrap;gap:10px;align-items:center">
          <div class="page-subtitle" style="margin:0">当前平台：<b>${escapeHtml(plat)}</b></div>
          <button type="button" class="btn btn-primary" data-action="openRtlManualCostModal">登记人工转入</button>
          <span style="font-size:12px;color:var(--muted)">在弹窗中填写信息并上传账单凭证（登记与编辑均留痕）。</span>
        </div>
        <div style="height:16px"></div>
        ${
          manualTableRows.length
            ? Table(['归属月', '成本金额', '成本类型', '关联项目', '凭证', '登记人', '登记时间', '操作'], manualTableRows)
            : `<div style="padding:10px 4px;color:var(--muted);font-size:13px">当前筛选下暂无人工转入记录</div>`
        }
        ${pager}
      </div>
    </div>
  `;
}

// ── 成本管理 ──────────────────────────────────────────────────────────────────
function RetailCostMgmt() {
  const PLATFORMS = DATA.retail.costPlatforms;
  const q         = getQueryParams();
  let plat        = q.get('retailCostPlatform') || '';
  if (!PLATFORMS.includes(plat)) plat = PLATFORMS[0];

  const view = q.get('retailCostView') === 'manual' ? 'manual' : 'auto';

  const platformTabs = PLATFORMS.map(p => {
    const active = p === plat;
    return `<a class="tab ${active ? 'active' : ''}" href="${retailCostTabHref(p)}">${escapeHtml(p)}</a>`;
  }).join('');

  const viewTabs = `
    <div class="tabs tabs-linked cost-mgmt-view-tabs" role="tablist">
      <a class="tab ${view === 'auto' ? 'active' : ''}" href="${mergeRetailCostQuery({ retailCostView: 'auto', rtlManualPage: '' })}">自动化成本</a>
      <a class="tab ${view === 'manual' ? 'active' : ''}" href="${mergeRetailCostQuery({ retailCostView: 'manual', rtlAutoPage: '' })}">人工转入成本</a>
    </div>`;

  return `
    <div class="tabs tabs-linked">${platformTabs}</div>
    ${viewTabs}
    <div style="height:12px"></div>
    ${view === 'auto' ? RetailCostMgmtAuto(plat, q) : RetailCostMgmtManual(plat, q)}
  `;
}
