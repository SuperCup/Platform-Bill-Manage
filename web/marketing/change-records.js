import { DATA } from '../shared/data.js';
import { escapeHtml } from '../shared/format.js';
import { getQueryParams } from '../shared/router.js';
import { Table, callout } from '../shared/ui.js';

export const PLATFORMS = ['微信', '微信小店', '支付宝', '支付宝碰一下', '抖音来客'];
const EVENT_TYPES = ['变更项目号', '修改活动基本信息', '关联项目', '新建活动'];

const INVENTORY_NOTICE =
  '入账截止后发生的变更，在当月入账库存不体现，顺延至下个库存周期。';

function formatChangeAmount(n) {
  if (n === null || n === undefined || n === '' || n === 0) return '—';
  const v = typeof n === 'number' ? n : Number(n);
  if (Number.isNaN(v) || v === 0) return '—';
  const abs = Math.abs(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (v > 0) return `<span class="mkt-amt-pos">+${abs}</span>`;
  return `<span class="mkt-amt-neg">-${abs}</span>`;
}

function formatMonthAmount(n) {
  const v = typeof n === 'number' ? n : Number(n) || 0;
  const abs = Math.abs(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (v > 0) return `<span class="mkt-amt-pos">+${abs}</span>`;
  if (v < 0) return `<span class="mkt-amt-neg">-${abs}</span>`;
  return '0.00';
}

function projectLink(id) {
  if (!id || id === '无') return '无';
  const hasDetail = !!(DATA.marketing?.projectDetails || {})[id];
  if (hasDetail) {
    const href = `#/marketing?marketingTab=projectDetail&mktProject=${encodeURIComponent(id)}`;
    return `<a class="link" href="${href}">${escapeHtml(id)}</a>`;
  }
  return `<a class="link" href="#" data-action="openMktChangeProject" data-project-id="${escapeHtml(id)}">${escapeHtml(id)}</a>`;
}

function activityLink(id) {
  if (!id) return '—';
  return `<a class="link" href="#" data-action="openMktChangeActivity" data-activity-id="${escapeHtml(id)}">${escapeHtml(id)}</a>`;
}

function filterRecords(rows, { platform, srcProj, dstProj, eventType, operator, opFrom, opTo }) {
  let list = [...rows];
  if (platform) list = list.filter((r) => r.platform === platform);
  if (srcProj) {
    const q = srcProj.toLowerCase();
    list = list.filter(
      (r) =>
        String(r.srcProject || '').toLowerCase().includes(q) ||
        (srcProj && r.srcProject === srcProj)
    );
  }
  if (dstProj) {
    const q = dstProj.toLowerCase();
    list = list.filter(
      (r) =>
        String(r.dstProject || '').toLowerCase().includes(q) ||
        (dstProj && r.dstProject === dstProj)
    );
  }
  if (eventType) list = list.filter((r) => r.eventType === eventType);
  if (operator) {
    const q = operator.toLowerCase();
    list = list.filter((r) => String(r.operator || '').toLowerCase().includes(q));
  }
  if (opFrom) list = list.filter((r) => (r.operatedAt || '') >= opFrom);
  if (opTo) {
    let end = opTo;
    if (end.length <= 10) end = `${end} 23:59:59`;
    else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(end)) end = `${end}:59`;
    list = list.filter((r) => (r.operatedAt || '') <= end);
  }
  return list.sort((a, b) => (b.operatedAt || '').localeCompare(a.operatedAt || ''));
}

function filterMonthlyRows(rows, { monthFrom, monthTo }) {
  let list = [...rows];
  if (monthFrom) list = list.filter((m) => (m.month || '') >= monthFrom);
  if (monthTo) list = list.filter((m) => (m.month || '') <= monthTo);
  return list;
}

function selectOptions(values, selected, allLabel = '全部') {
  return `<option value="">${allLabel}</option>${values
    .map(
      (v) =>
        `<option value="${escapeHtml(v)}"${v === selected ? ' selected' : ''}>${escapeHtml(v)}</option>`
    )
    .join('')}`;
}

function defaultMonthlyBreakdown(rec) {
  const amt = rec.changeAmount || 0;
  if (!amt) return [];
  const opMonth = (rec.operatedAt || '').slice(0, 7);
  return [{ month: opMonth || '2026-05', amount: amt, bills: [{ billNo: '—', amount: amt, remark: rec.remark || '未拆分账单明细' }] }];
}

/** 修改记录详情（抽屉）：活动 + 历史月份金额拆分 */
export function buildMktChangeRecordDetailHtml(rec, filters = {}) {
  if (!rec) return '<div style="padding:12px;color:var(--muted)">未找到记录</div>';

  const fMonthFrom = filters.monthFrom || '';
  const fMonthTo = filters.monthTo || '';
  const breakdown = filterMonthlyRows(rec.monthlyBreakdown || defaultMonthlyBreakdown(rec), {
    monthFrom: fMonthFrom,
    monthTo: fMonthTo,
  });

  const kv = (k, v) =>
    `<div class="bill-kv-item"><span class="bill-kv-label">${escapeHtml(k)}</span><span class="bill-kv-value">${v}</span></div>`;

  const monthRows = breakdown.flatMap((m) => {
    const bills = m.bills || [];
    if (!bills.length) {
      return [[escapeHtml(m.month), formatMonthAmount(m.amount), '—', '—']];
    }
    return bills.map((b, idx) => [
      idx === 0 ? escapeHtml(m.month) : '',
      idx === 0 ? formatMonthAmount(m.amount) : '',
      escapeHtml(b.billNo || '—'),
      `<span title="${escapeHtml(b.remark || '')}">${escapeHtml(b.remark || '—')}${b.amount != null ? `（${typeof b.amount === 'number' && b.amount < 0 ? '-' : ''}${Math.abs(b.amount).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}）` : ''}</span>`,
    ]);
  });

  const sumFiltered = breakdown.reduce((s, m) => s + (m.amount || 0), 0);
  const totalChange = rec.changeAmount || 0;

  const monthlyTable = monthRows.length
    ? Table(['归属月份', '当月转移金额', '账单编号', '账单明细说明'], monthRows)
    : '<div style="padding:12px;color:var(--muted)">当前筛选条件下暂无月份拆分数据</div>';

  return `
    <div class="mkt-change-detail" data-trace-id="${escapeHtml(rec.traceId)}">
      ${callout('info', '', INVENTORY_NOTICE)}
      <div style="height:12px"></div>
      <div class="kv-grid" style="grid-template-columns:1fr;margin-bottom:14px">
        ${kv('Trace ID', escapeHtml(rec.traceId))}
        ${kv('活动ID', activityLink(rec.activityId))}
        ${kv('平台', escapeHtml(rec.platform))}
        ${kv('事件类型', escapeHtml(rec.eventType))}
        ${kv('操作时间', escapeHtml(rec.operatedAt))}
        ${kv('源项目 → 变更后', `${projectLink(rec.srcProject)} → ${rec.dstProject && rec.dstProject !== '无' ? projectLink(rec.dstProject) : '无'}`)}
        ${kv('变动金额合计', formatChangeAmount(totalChange))}
        ${kv('备注', escapeHtml(rec.remark || '—'))}
        ${rec.postedAfterDeadline ? kv('入账说明', '<span class="mkt-amt-neg">变更发生在入账截止后，影响下一库存周期</span>') : ''}
      </div>

      <div class="filters" style="margin-bottom:12px;padding:10px 12px">
        <div class="toolbar" style="flex-wrap:wrap;gap:10px 14px;align-items:flex-end">
          <label class="pms-inv-filter-item">
            <span class="pms-inv-filter-label">归属月份开始</span>
            <input class="input" type="month" id="mkt-detail-month-from" style="min-width:130px" value="${escapeHtml(fMonthFrom)}" />
          </label>
          <label class="pms-inv-filter-item">
            <span class="pms-inv-filter-label">归属月份结束</span>
            <input class="input" type="month" id="mkt-detail-month-to" style="min-width:130px" value="${escapeHtml(fMonthTo)}" />
          </label>
          <button type="button" class="btn btn-primary btn-sm" data-action="mktChangeDetailFilterApply">查询</button>
          <button type="button" class="btn btn-sm" data-action="mktChangeDetailFilterReset">重置</button>
        </div>
      </div>

      <div class="mkt-section-title" style="margin-bottom:8px">历史月份金额变动（按账单明细拆分）</div>
      <div class="page-subtitle" style="margin-bottom:10px">
        筛选范围内拆分合计：<b>${formatMonthAmount(sumFiltered)}</b>
        ${breakdown.length && Math.abs(sumFiltered - totalChange) > 0.01 ? `（与变动金额 ${totalChange < 0 ? '-' : '+'}${Math.abs(totalChange).toLocaleString('zh-CN', { minimumFractionDigits: 2 })} 存在入账周期差异时，以财务关账口径为准）` : ''}
      </div>
      <div class="table-wrap">${monthlyTable}</div>
    </div>`;
}

export function MarketingChangeRecordsPage() {
  const q = getQueryParams();
  const fPlatform = (q.get('mktPlatform') || '').trim();
  const fSrcProj = (q.get('mktSrcProj') || '').trim();
  const fDstProj = (q.get('mktDstProj') || '').trim();
  const fEventType = (q.get('mktEventType') || '').trim();
  const fOperator = (q.get('mktOperator') || '').trim();
  const fOpFrom = (q.get('mktOpFrom') || '').trim();
  const fOpTo = (q.get('mktOpTo') || '').trim();
  const page = Math.max(1, Number(q.get('mktPage')) || 1);
  const pageSize = 10;

  const allRows = (DATA.marketing?.modificationRecords || []).filter((r) =>
    PLATFORMS.includes(r.platform)
  );
  const filtered = filterRecords(allRows, {
    platform: fPlatform,
    srcProj: fSrcProj,
    dstProj: fDstProj,
    eventType: fEventType,
    operator: fOperator,
    opFrom: fOpFrom.replace('T', ' '),
    opTo: fOpTo.replace('T', ' '),
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pg = Math.min(page, totalPages);
  const slice = filtered.slice((pg - 1) * pageSize, pg * pageSize);

  const projectIds = [
    ...new Set(allRows.flatMap((r) => [r.srcProject, r.dstProject].filter((p) => p && p !== '无'))),
  ].sort();

  const tableRows = slice.map((rec) => {
    const ops = `<a class="link" href="#" data-action="openMktChangeDetail" data-trace-id="${escapeHtml(rec.traceId)}">详情</a>`;
    return [
      escapeHtml(rec.traceId),
      escapeHtml(rec.eventType),
      escapeHtml(rec.operatedAt),
      escapeHtml(rec.operator || '—'),
      activityLink(rec.activityId),
      escapeHtml(rec.platform),
      rec.srcProject && rec.srcProject !== '无' ? projectLink(rec.srcProject) : '无',
      rec.dstProject && rec.dstProject !== '无' ? projectLink(rec.dstProject) : '无',
      formatChangeAmount(rec.changeAmount),
      `<span title="${escapeHtml(rec.remark || '')}" style="display:inline-block;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(rec.remark || '—')}</span>`,
      ops,
    ];
  });

  const prevQs = new URLSearchParams(q);
  prevQs.set('marketingTab', 'changeRecords');
  if (pg > 1) prevQs.set('mktPage', String(pg - 1));
  else prevQs.delete('mktPage');
  const nextQs = new URLSearchParams(q);
  nextQs.set('marketingTab', 'changeRecords');
  if (pg < totalPages) nextQs.set('mktPage', String(pg + 1));
  else nextQs.delete('mktPage');

  const pager = `
    <div class="pagination-bar">
      <div class="pagination-meta">共 ${filtered.length} 条，每页 ${pageSize} 条</div>
      <div class="pagination-actions">
        ${pg > 1 ? `<a class="btn btn-sm" href="#/marketing?${prevQs.toString()}">上一页</a>` : '<span class="btn btn-sm" style="opacity:.5">上一页</span>'}
        <span class="pagination-meta">${pg} / ${totalPages}</span>
        ${pg < totalPages ? `<a class="btn btn-sm" href="#/marketing?${nextQs.toString()}">下一页</a>` : '<span class="btn btn-sm" style="opacity:.5">下一页</span>'}
      </div>
    </div>`;

  const opFromInput = fOpFrom.includes(' ') ? fOpFrom.replace(' ', 'T').slice(0, 16) : fOpFrom;
  const opToInput = fOpTo.includes(' ') ? fOpTo.replace(' ', 'T').slice(0, 16) : fOpTo;

  return `
    <div class="mkt-change-page">
      <h1 class="page-title">修改记录</h1>
      <p class="mkt-change-desc">
        新建活动、绑定项目、修改活动关键基本信息（id等）、活动绑定项目变更等操作会在该页面记录，以便追溯项目对应的账单变更来源；
      </p>
      ${callout('warning', '入账说明', INVENTORY_NOTICE)}

      <div class="filters mkt-change-filters">
        <div class="toolbar" style="flex-wrap:wrap;gap:10px 14px;align-items:flex-end">
          <label class="pms-inv-filter-item">
            <span class="pms-inv-filter-label">平台</span>
            <select class="select" id="mkt-ch-platform" style="min-width:110px">${selectOptions(PLATFORMS, fPlatform)}</select>
          </label>
          <label class="pms-inv-filter-item">
            <span class="pms-inv-filter-label">源项目</span>
            <select class="select" id="mkt-ch-src" style="min-width:120px">${selectOptions(projectIds, fSrcProj)}</select>
          </label>
          <label class="pms-inv-filter-item">
            <span class="pms-inv-filter-label">变更后项目</span>
            <select class="select" id="mkt-ch-dst" style="min-width:120px">${selectOptions(projectIds, fDstProj)}</select>
          </label>
          <label class="pms-inv-filter-item">
            <span class="pms-inv-filter-label">事件类型</span>
            <select class="select" id="mkt-ch-event" style="min-width:140px">${selectOptions(EVENT_TYPES, fEventType)}</select>
          </label>
          <label class="pms-inv-filter-item">
            <span class="pms-inv-filter-label">操作人</span>
            <input class="input" id="mkt-ch-operator" style="min-width:100px" value="${escapeHtml(fOperator)}" placeholder="操作人" />
          </label>
          <label class="pms-inv-filter-item">
            <span class="pms-inv-filter-label">操作开始</span>
            <input class="input" type="datetime-local" id="mkt-ch-op-from" style="min-width:170px" value="${escapeHtml(opFromInput)}" />
          </label>
          <label class="pms-inv-filter-item">
            <span class="pms-inv-filter-label">操作结束</span>
            <input class="input" type="datetime-local" id="mkt-ch-op-to" style="min-width:170px" value="${escapeHtml(opToInput)}" />
          </label>
          <button type="button" class="btn btn-primary" data-action="mktChangeFilterApply">查询</button>
          <button type="button" class="btn btn-sm" data-action="mktChangeFilterReset">重置</button>
        </div>
      </div>

      <div class="card" style="margin-top:12px">
        <div class="card-body" style="padding-bottom:8px">
          ${
            tableRows.length
              ? Table(
                  ['Trace ID', '事件类型', '操作时间', '操作人', '活动ID', '平台', '源项目', '变更后项目', '变动金额', '备注', '操作'],
                  tableRows
                )
              : '<div style="padding:24px;text-align:center;color:var(--muted)">当前筛选条件下暂无记录</div>'
          }
          ${filtered.length > 0 ? pager : ''}
        </div>
      </div>
    </div>
  `;
}
