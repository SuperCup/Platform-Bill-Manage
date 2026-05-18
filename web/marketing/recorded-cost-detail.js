import { DATA } from '../shared/data.js';
import { escapeHtml } from '../shared/format.js';
import { Table, callout, pill } from '../shared/ui.js';

function fmtNum(n) {
  if (n === null || n === undefined || n === '') return '0.00';
  const v = typeof n === 'number' ? n : Number(n);
  if (Number.isNaN(v)) return String(n);
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function filterByMonth(byMonth, month) {
  if (!month) return byMonth || [];
  return (byMonth || []).filter((g) => g.month === month);
}

/** 已入账成本明细抽屉：按财务归属月查看成本记录 */
export function buildMktRecordedCostDetailHtml(projectId, filters = {}) {
  const proj = DATA.marketing?.projectDetails?.[projectId];
  if (!proj) {
    return '<div style="padding:12px;color:var(--muted)">未找到项目</div>';
  }

  const byMonth = proj.recordedCostByMonth || [];
  const fMonth = filters.month || '';
  const groups = filterByMonth(byMonth, fMonth);
  const records = groups.flatMap((g) => g.records || []);
  const totalRecorded = proj.recordedCost ?? 0;
  const sumShown = records.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const monthOptions = byMonth.map((g) => g.month).filter(Boolean);

  const monthOpts = `<option value="">全部月份</option>${monthOptions
    .map(
      (m) =>
        `<option value="${escapeHtml(m)}"${m === fMonth ? ' selected' : ''}>${escapeHtml(m)}</option>`
    )
    .join('')}`;

  const summaryRows = groups.map((g) => [
    escapeHtml(g.month),
    fmtNum(g.amount),
    String((g.records || []).length),
    `<a class="link" href="#" data-action="mktRecordedCostPickMonth" data-project-id="${escapeHtml(projectId)}" data-month="${escapeHtml(g.month)}">查看记录</a>`,
  ]);

  const detailRows = records.map((r) => [
    escapeHtml(r.id || '—'),
    escapeHtml(r.financeMonth || '—'),
    escapeHtml(r.platform || '—'),
    escapeHtml(r.activityId || '—'),
    escapeHtml(r.billNo || '—'),
    `<span class="mkt-amt-pos">${fmtNum(r.amount)}</span>`,
    escapeHtml(r.postedAt || '—'),
    pill(r.status || '已入账'),
    `<span title="${escapeHtml(r.remark || '')}">${escapeHtml(r.remark || '—')}</span>`,
  ]);

  const summaryTable = summaryRows.length
    ? Table(['财务归属月', '当月已入账合计', '记录数', '操作'], summaryRows)
    : '<div style="padding:12px;color:var(--muted)">暂无月份汇总</div>';

  const detailTable = detailRows.length
    ? Table(
        ['成本记录ID', '财务归属月', '平台', '活动ID', '账单编号', '入账金额', '入账时间', '状态', '说明'],
        detailRows
      )
    : '<div style="padding:12px;color:var(--muted)">当前筛选下暂无成本记录</div>';

  const detailTitle = fMonth ? `成本记录明细 · ${escapeHtml(fMonth)}` : '成本记录明细';

  return `
    <div class="mkt-recorded-cost-detail" data-project-id="${escapeHtml(projectId)}">
      ${callout(
        'info',
        '',
        '已入账成本按<strong>财务归属月</strong>汇总；下方可查看各月入账的成本记录明细。入账截止后登记的变更顺延至下一库存周期体现。'
      )}
      <div class="kv-grid" style="grid-template-columns:repeat(2,1fr);gap:10px 16px;margin:12px 0 14px">
        <div class="bill-kv-item">
          <span class="bill-kv-label">项目编号</span>
          <span class="bill-kv-value">${escapeHtml(proj.id)}</span>
        </div>
        <div class="bill-kv-item">
          <span class="bill-kv-label">已入账成本合计</span>
          <span class="bill-kv-value"><b>${fmtNum(totalRecorded)}</b></span>
        </div>
        <div class="bill-kv-item">
          <span class="bill-kv-label">统计截止</span>
          <span class="bill-kv-value">${escapeHtml(proj.recordedCostCutoff || proj.progressAsOf || '—')}</span>
        </div>
        <div class="bill-kv-item">
          <span class="bill-kv-label">筛选范围合计</span>
          <span class="bill-kv-value">${fmtNum(sumShown)}</span>
        </div>
      </div>

      <div class="filters" style="margin-bottom:12px;padding:10px 12px">
        <div class="toolbar" style="flex-wrap:wrap;gap:10px 14px;align-items:flex-end">
          <label class="pms-inv-filter-item">
            <span class="pms-inv-filter-label">财务归属月</span>
            <select class="select" id="mkt-recorded-month" style="min-width:140px">${monthOpts}</select>
          </label>
          <button type="button" class="btn btn-primary btn-sm" data-action="mktRecordedCostFilterApply" data-project-id="${escapeHtml(projectId)}">查询</button>
          <button type="button" class="btn btn-sm" data-action="mktRecordedCostFilterReset" data-project-id="${escapeHtml(projectId)}">重置</button>
        </div>
      </div>

      <div class="mkt-section-title" style="margin-bottom:8px">按月汇总</div>
      <div class="table-wrap" style="margin-bottom:16px">${summaryTable}</div>

      <div class="mkt-section-title" style="margin-bottom:8px">${detailTitle}</div>
      <div class="table-wrap">${detailTable}</div>
    </div>`;
}

export function openMktRecordedCostDetailDrawer(projectId, filters = {}, openDrawerFn) {
  const proj = DATA.marketing?.projectDetails?.[projectId];
  openDrawerFn({
    title: proj ? `已入账成本明细 · ${proj.id}` : '已入账成本明细',
    bodyHtml: buildMktRecordedCostDetailHtml(projectId, filters),
  });
}
