import { DATA } from '../shared/data.js';
import { escapeHtml, formatMoney } from '../shared/format.js';
import { PageHead, Table, StatGrid, callout, pill } from '../shared/ui.js';
import { getSubTab, getQueryParams } from '../shared/router.js';
import { RetailBillsPage } from './bills.js';
import { RetailReconcilePage } from './reconcile.js';
import { RetailProjectCostPage } from './project-cost.js';

function linkedBillCell(r) {
  if (!r.linkedBizBillId) {
    return r.pending > 0
      ? `<span style="color:var(--muted);font-size:12px">未关联</span>`
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
  else if (tabKey === 'records')     body = RetailRecords();
  else if (tabKey === 'bills')       body = RetailBillsPage();
  else if (tabKey === 'reconcile')   body = RetailReconcilePage();
  else if (tabKey === 'projectCost') body = RetailProjectCostPage();
  else                               body = RetailCostMgmt();

  const noHead = ['costMgmt', 'bills', 'reconcile', 'projectCost'].includes(tabKey);
  const head   = noHead ? '' : PageHead('即时零售', '美团闪购 / 淘宝闪购 / 京东到家 / 多点');
  return `${head}<div id="subpage">${body}</div>`;
}

// ── 成本管理 ──────────────────────────────────────────────────────────────────
function retailCostTabHref(platformId) {
  const p = new URLSearchParams();
  p.set('retailTab', 'costMgmt');
  p.set('retailCostPlatform', platformId);
  const q = getQueryParams();
  const m = q.get('retailCostMonth');
  const c = q.get('retailCostCust');
  if (m) p.set('retailCostMonth', m);
  if (c) p.set('retailCostCust', c);
  return `#/retail?${p.toString()}`;
}

function RetailCostMgmt() {
  const PLATFORMS  = DATA.retail.costPlatforms;
  const q          = getQueryParams();
  let   plat       = q.get('retailCostPlatform') || '';
  if (!PLATFORMS.includes(plat)) plat = PLATFORMS[0];

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

  const platformTabs = PLATFORMS.map(p => {
    const active = p === plat;
    return `<a class="tab ${active ? 'active' : ''}" href="${retailCostTabHref(p)}">${escapeHtml(p)}</a>`;
  }).join('');

  const months = [...new Set(DATA.retail.costRecords.map(r => r.month))].sort().reverse();
  const monthOptions = [`<option value="">全部月份</option>`,
    ...months.map(m => `<option value="${m}"${monthFilter === m ? ' selected' : ''}>${m}</option>`),
  ].join('');

  const custVal = escapeHtml(q.get('retailCostCust') || '');

  const blocks = customers.map(g => {
    const pendingTotal = g.actual - g.allocated;
    const status       = pendingTotal <= 0 ? '已分配' : '待分配';

    const innerRows = g.rows.map(r => {
      // 已归集项目
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
        ${r.pending > 0
          ? `<button type="button" class="btn btn-ghost" data-action="openRetailAllocate"
               data-record-id="${escapeHtml(r.id)}">关联账单</button>`
          : ''}
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
            ['月份', '二级实体', '成本类型', '实际成本', '已分配', '待分配', '状态', '归集项目', '关联账单', '操作'],
            innerRows
          )}
        </div>
      </details>
    `;
  }).join('');

  return `
    <div class="tabs tabs-linked">${platformTabs}</div>
    <div style="height:12px"></div>
    <div class="card">
      <div class="card-head">成本汇总（按客户）</div>
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
      </div>
    </div>
  `;
}

// ── 分配记录 ───────────────────────────────────────────────────────────────────
function RetailRecords() {
  const q         = getQueryParams();
  const fMonth    = (q.get('recMonth')  || '').trim();
  const fPlatform = (q.get('recPlat')   || '').trim();
  const fStatus   = (q.get('recStatus') || '').trim();

  let rows = DATA.retail.allocationRecords;
  if (fMonth)    rows = rows.filter(r => r.month    === fMonth);
  if (fPlatform) rows = rows.filter(r => r.platform === fPlatform);
  if (fStatus)   rows = rows.filter(r => r.status   === fStatus);

  const allMonths    = [...new Set(DATA.retail.allocationRecords.map(r => r.month))].sort().reverse();
  const allPlatforms = DATA.retail.costPlatforms;
  const allStatuses  = ['已归集', '待归集（零售）'];

  const monthOpts  = [`<option value="">全部月份</option>`, ...allMonths.map(m => `<option value="${m}"${fMonth === m ? ' selected' : ''}>${m}</option>`)].join('');
  const platOpts   = [`<option value="">全部平台</option>`, ...allPlatforms.map(p => `<option value="${p}"${fPlatform === p ? ' selected' : ''}>${p}</option>`)].join('');
  const statusOpts = [`<option value="">全部状态</option>`, ...allStatuses.map(s => `<option value="${s}"${fStatus === s ? ' selected' : ''}>${s}</option>`)].join('');

  const tableRows = rows.map(r => [
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
    `<button class="btn btn-ghost" data-action="adjustAllocation" data-id="${escapeHtml(r.id)}">调整</button>`,
  ]);

  return `
    <div class="card">
      <div class="card-head">
        分配记录
        <div class="toolbar">
          <button class="btn" data-action="exportAllocationRecords">导出</button>
        </div>
      </div>
      <div class="card-body">
        <div class="filters">
          <div class="toolbar">
            <select class="select" id="rec-month">${monthOpts}</select>
            <select class="select" id="rec-plat">${platOpts}</select>
            <select class="select" id="rec-status">${statusOpts}</select>
            <button type="button" class="btn btn-primary" data-action="filterAllocationRecords">查询</button>
            <button type="button" class="btn" data-action="resetAllocationRecords">重置</button>
          </div>
        </div>
        <div style="height:10px"></div>
        ${tableRows.length
          ? Table(['记录ID', '月份', '平台', '客户', '二级实体', '关联项目', '分配金额', '操作人', '操作时间', '状态', ''], tableRows)
          : `<div style="padding:8px;color:var(--muted)">暂无记录</div>`}
      </div>
    </div>
  `;
}
