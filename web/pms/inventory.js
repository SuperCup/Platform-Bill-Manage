import { DATA } from '../shared/data.js';
import { escapeHtml, formatMoney } from '../shared/format.js';
import { getQueryParams } from '../shared/router.js';
import { Table, pill } from '../shared/ui.js';

/** 金额展示（无货币符号，千分位，两位小数） */
export function formatInventoryAmount(n) {
  if (n === null || n === undefined || n === '') return '0.00';
  const v = typeof n === 'number' ? n : Number(String(n).replace(/,/g, ''));
  if (Number.isNaN(v)) return String(n);
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function amountCell(value) {
  const v = typeof value === 'number' ? value : Number(value) || 0;
  const cls =
    v === 0 ? 'inv-num inv-num-zero' : v < 0 ? 'inv-num inv-num-neg' : 'inv-num';
  return `<td class="${cls}">${formatInventoryAmount(v)}</td>`;
}

function projectCell(row) {
  return `<td class="inv-project">
    <a class="link inv-proj-id" href="#" data-action="openPmsInvProject" data-project-id="${escapeHtml(row.projectId)}">${escapeHtml(row.projectId)}</a>
    <div class="inv-proj-name">${escapeHtml(row.projectName)}</div>
  </td>`;
}

function filterInventoryRows(rows, { period, proj, product, customer }) {
  let list = [...rows];
  if (period) list = list.filter((r) => String(r.period || '') === period);
  if (proj) {
    const q = proj.toLowerCase();
    list = list.filter(
      (r) =>
        String(r.projectId || '').toLowerCase().includes(q) ||
        String(r.projectName || '').toLowerCase().includes(q)
    );
  }
  if (product) {
    const q = product.toLowerCase();
    list = list.filter((r) => String(r.product || '').toLowerCase().includes(q));
  }
  if (customer) {
    const q = customer.toLowerCase();
    list = list.filter((r) => String(r.customer || '').toLowerCase().includes(q));
  }
  return list;
}

const INV_DIR_LABEL = { '+': '入库', '-': '出库' };

function directionCellHtml(direction) {
  if (direction === '+') {
    return '<span class="inv-dir inv-dir-in">▲ 入库</span>';
  }
  if (direction === '-') {
    return '<span class="inv-dir inv-dir-out">▼ 出库</span>';
  }
  return escapeHtml(direction || '—');
}

function directionLabel(direction) {
  return INV_DIR_LABEL[direction] || direction || '—';
}

function amountCellHtml(log) {
  const v = log.amount ?? 0;
  const prefix = log.direction === '+' ? '+' : log.direction === '-' ? '-' : '';
  const cls = log.direction === '-' ? 'inv-num-neg' : '';
  return `<span class="inv-detail-amt ${cls}">${prefix}${formatMoney(v)}</span>`;
}

function statusCellHtml(status) {
  return pill(status || '已入账');
}

function filterDetailLogs(logs, { type, direction, status, dateFrom, dateTo }) {
  let list = [...logs];
  if (type) list = list.filter((l) => l.type === type);
  if (direction) list = list.filter((l) => l.direction === direction);
  if (status) list = list.filter((l) => (l.status || '已入账') === status);
  if (dateFrom) list = list.filter((l) => (l.date || '') >= dateFrom);
  if (dateTo) list = list.filter((l) => (l.date || '') <= dateTo);
  return list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

/** 出入库明细抽屉内容（含核心字段筛选） */
export function buildPmsInvDetailHtml(logKey, projId, projName, product, filters = {}) {
  const allLogs = (DATA.pms?.inventoryLogs || {})[logKey] || [];
  const typeOptions = [...new Set(allLogs.map((l) => l.type).filter(Boolean))];
  const dirOptions = [...new Set(allLogs.map((l) => l.direction).filter(Boolean))];
  const fType = filters.type || '';
  const fDir = filters.direction || '';
  const fStatus = filters.status || '';
  const fFrom = filters.dateFrom || '';
  const fTo = filters.dateTo || '';

  const filtered = filterDetailLogs(allLogs, {
    type: fType,
    direction: fDir,
    status: fStatus,
    dateFrom: fFrom,
    dateTo: fTo,
  });

  const typeOpts = typeOptions
    .map(
      (t) =>
        `<option value="${escapeHtml(t)}"${t === fType ? ' selected' : ''}>${escapeHtml(t)}</option>`
    )
    .join('');
  const dirOpts = dirOptions
    .map(
      (d) =>
        `<option value="${escapeHtml(d)}"${d === fDir ? ' selected' : ''}>${escapeHtml(directionLabel(d))}</option>`
    )
    .join('');

  const rows = filtered.map((log) => [
    escapeHtml(log.date),
    escapeHtml(log.type),
    directionCellHtml(log.direction),
    amountCellHtml(log),
    statusCellHtml(log.status),
    escapeHtml(log.remark || '—'),
  ]);

  const tablePart = rows.length
    ? Table(['日期', '类型', '方向', '金额', '状态', '说明'], rows)
    : `<div style="padding:12px;color:var(--muted)">当前筛选条件下暂无记录</div>`;

  return `
    <div class="pms-inv-detail" data-log-key="${escapeHtml(logKey)}"
      data-project-id="${escapeHtml(projId)}"
      data-project-name="${escapeHtml(projName)}"
      data-product="${escapeHtml(product)}">
      <div style="font-size:12px;color:var(--muted);margin-bottom:10px">${escapeHtml(projId)} · ${escapeHtml(product)}</div>
      <div class="filters" style="margin-bottom:12px;padding:10px 12px">
        <div class="toolbar" style="flex-wrap:wrap;gap:10px 14px;align-items:flex-end">
          <label class="pms-inv-filter-item">
            <span class="pms-inv-filter-label">类型</span>
            <select class="select" id="pms-inv-detail-type" style="min-width:140px">
              <option value="">全部</option>${typeOpts}
            </select>
          </label>
          <label class="pms-inv-filter-item">
            <span class="pms-inv-filter-label">方向</span>
            <select class="select" id="pms-inv-detail-dir" style="min-width:100px">
              <option value="">全部</option>${dirOpts}
            </select>
          </label>
          <label class="pms-inv-filter-item">
            <span class="pms-inv-filter-label">状态</span>
            <select class="select" id="pms-inv-detail-status" style="min-width:100px">
              <option value="">全部</option>
              <option value="待入账"${fStatus === '待入账' ? ' selected' : ''}>待入账</option>
              <option value="已入账"${fStatus === '已入账' ? ' selected' : ''}>已入账</option>
            </select>
          </label>
          <label class="pms-inv-filter-item">
            <span class="pms-inv-filter-label">日期起</span>
            <input class="input" type="date" id="pms-inv-detail-from" style="min-width:130px" value="${escapeHtml(fFrom)}" />
          </label>
          <label class="pms-inv-filter-item">
            <span class="pms-inv-filter-label">日期止</span>
            <input class="input" type="date" id="pms-inv-detail-to" style="min-width:130px" value="${escapeHtml(fTo)}" />
          </label>
          <button type="button" class="btn btn-primary btn-sm" data-action="pmsInvDetailFilterApply">查询</button>
          <button type="button" class="btn btn-sm" data-action="pmsInvDetailFilterReset">重置</button>
        </div>
      </div>
      <div id="pms-inv-detail-table">${tablePart}</div>
    </div>
  `;
}

export function PmsInventoryPage() {
  const q = getQueryParams();
  const defaultPeriod = DATA.pms?.defaultInventoryPeriod || '202404';
  const fPeriod = (q.get('pmsPeriod') || defaultPeriod).trim();
  const fProj = (q.get('pmsProj') || '').trim();
  const fProduct = (q.get('pmsProduct') || '').trim();
  const fCust = (q.get('pmsCust') || '').trim();

  const allRows = DATA.pms?.accountInventory || [];
  const rows = filterInventoryRows(allRows, {
    period: fPeriod,
    proj: fProj,
    product: fProduct,
    customer: fCust,
  });

  const tableBody = rows.length
    ? rows
        .map((row, idx) => {
          const trCls = idx % 2 === 1 ? 'inv-row-alt' : '';
          const logKey = `${row.projectId}|${row.product}`;
          return `<tr class="${trCls}">
            ${projectCell(row)}
            <td>${escapeHtml(row.customer)}</td>
            <td>${escapeHtml(row.product)}</td>
            ${amountCell(row.prevBalance)}
            ${amountCell(row.newBillCost)}
            ${amountCell(row.billSettlement)}
            ${amountCell(row.newPaymentRequest)}
            ${amountCell(row.paymentSettlement)}
            ${amountCell(row.offlineTransfer)}
            ${amountCell(row.occasionalCost)}
            ${amountCell(row.occasionalSettlement)}
            ${amountCell(row.totalInventory)}
            <td class="inv-ops">
              <a class="link" href="#" data-action="openPmsInvDetail"
                data-log-key="${escapeHtml(logKey)}"
                data-project-id="${escapeHtml(row.projectId)}"
                data-project-name="${escapeHtml(row.projectName)}"
                data-product="${escapeHtml(row.product)}">明细</a>
            </td>
          </tr>`;
        })
        .join('')
    : `<tr><td colspan="13" style="text-align:center;padding:24px;color:var(--muted)">当前筛选条件下暂无数据</td></tr>`;

  return `
    <div class="pms-inv-page">
      <div class="pms-inv-head">
        <h1 class="page-title">入账库存</h1>
        <div class="toolbar pms-inv-actions">
          <button type="button" class="btn btn-inv-export" data-action="pmsInvExport">导出</button>
          <button type="button" class="btn btn-inv-transfer" data-action="pmsInvTransfer">库存转移</button>
          <button type="button" class="btn btn-inv-config" data-action="pmsInvProductConfig">项目产品配置</button>
          <button type="button" class="btn btn-inv-cost" data-action="pmsInvBizCost">业务成本</button>
          <button type="button" class="btn btn-inv-deadline" data-action="pmsInvDeadline">入账截止</button>
          <button type="button" class="btn btn-inv-refresh" data-action="pmsInvRefresh">刷新</button>
        </div>
      </div>

      <div class="filters pms-inv-filters">
        <div class="toolbar" style="flex-wrap:wrap;gap:12px 16px">
          <label class="pms-inv-filter-item">
            <span class="pms-inv-filter-label">入账周期(YYYYMM)</span>
            <input class="input" id="pms-inv-period" style="min-width:120px" value="${escapeHtml(fPeriod)}" placeholder="202404" />
          </label>
          <label class="pms-inv-filter-item">
            <span class="pms-inv-filter-label">项目</span>
            <span class="pms-inv-search-wrap">
              <input class="input" id="pms-inv-proj" style="min-width:160px" value="${escapeHtml(fProj)}" placeholder="项目编号 / 名称" />
              <span class="pms-inv-search-icon" aria-hidden="true">⌕</span>
            </span>
          </label>
          <label class="pms-inv-filter-item">
            <span class="pms-inv-filter-label">产品</span>
            <span class="pms-inv-search-wrap">
              <input class="input" id="pms-inv-product" style="min-width:140px" value="${escapeHtml(fProduct)}" />
              <span class="pms-inv-search-icon" aria-hidden="true">⌕</span>
            </span>
          </label>
          <label class="pms-inv-filter-item">
            <span class="pms-inv-filter-label">客户</span>
            <span class="pms-inv-search-wrap">
              <input class="input" id="pms-inv-cust" style="min-width:140px" value="${escapeHtml(fCust)}" />
              ${fCust ? `<button type="button" class="pms-inv-clear" data-action="pmsInvClearCust" title="清除">×</button>` : ''}
              <span class="pms-inv-search-icon" aria-hidden="true">⌕</span>
            </span>
          </label>
          <button type="button" class="btn btn-primary" data-action="pmsInvFilterApply">查询</button>
        </div>
      </div>

      <div class="card" style="margin-top:12px">
        <div class="table-wrap pms-inv-table-wrap">
          <table class="pms-inv-table">
            <thead>
              <tr>
                <th>项目</th>
                <th>客户</th>
                <th>产品</th>
                <th class="inv-th-num">上期结余库存</th>
                <th class="inv-th-num">新增账单成本</th>
                <th class="inv-th-num">账单结算</th>
                <th class="inv-th-num">新增请款</th>
                <th class="inv-th-num">请款结算金额</th>
                <th class="inv-th-num">线下转移金额</th>
                <th class="inv-th-num">个偶成本</th>
                <th class="inv-th-num">个偶结算</th>
                <th class="inv-th-num">总库存金额</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>${tableBody}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}
