/**
 * 项目成本追踪 — 按平台 Tab 切换 + 项目汇总列表 + 月度明细展开 + 日志侧边栏
 */
import { DATA } from '../shared/data.js';
import { escapeHtml, formatMoney } from '../shared/format.js';
import { Table } from '../shared/ui.js';
import { getQueryParams } from '../shared/router.js';

// 平台 → 产品名称映射（官方旗舰店通过 entity 字段单独判断）
const PLATFORM_PRODUCT = {
  '美团闪购': '美团闪购平台代运营',
  '淘宝闪购': '淘宝闪购平台代运营',
  '京东到家': '京东到家平台代运营',
  '多点':     '多点平台代运营',
};

function deriveProduct(platform, entity) {
  if (entity && entity.includes('官方旗舰店')) return '官方旗舰店运营';
  return PLATFORM_PRODUCT[platform] || platform;
}

function buildProjTabHref(platform) {
  const p = new URLSearchParams();
  p.set('retailTab', 'projectCost');
  p.set('pcPlatform', platform);
  return `#/retail?${p.toString()}`;
}

/**
 * 从 costRecords 聚合出当前平台下的项目列表。
 * 每条 costRecord.allocDetail.projects[] 对应一个项目维度的归集金额。
 */
function buildProjectData(platform) {
  const records   = DATA.retail.costRecords.filter(r => r.platform === platform);
  const deadlines = DATA.retail.financeDeadlines || {};
  const projectMap = new Map();

  for (const rec of records) {
    for (const pa of (rec.allocDetail?.projects || [])) {
      const pid = pa.projectId;
      if (!pid) continue;

      if (!projectMap.has(pid)) {
        // 优先从 bizBills 取产品/付款主体/账单主体（同项目同平台）
        const bill = DATA.retail.bizBills.find(
          b => b.project === pid && (b.platform || '') === platform
        );
        projectMap.set(pid, {
          id:               pid,
          name:             pa.projectName || pid,
          product:          bill?.product || deriveProduct(platform, rec.entity),
          customer:         bill?.customer || rec.customer,
          entity:           rec.entity,
          payer:            bill?.payer  || '—',
          payee:            bill?.payee  || '—',
          totalCost:        0,
          totalRiskControl: 0,
          months:           new Map(),
          recordIds:        [],
        });
      }

      const pd = projectMap.get(pid);
      pd.totalCost        += (pa.amount || 0);
      pd.totalRiskControl += (rec.riskControlAmount || 0);

      if (!pd.months.has(rec.month)) {
        pd.months.set(rec.month, {
          cost:     0,
          deadline: deadlines[rec.month] || '—',
        });
      }
      pd.months.get(rec.month).cost += (pa.amount || 0);

      if (!pd.recordIds.includes(rec.id)) pd.recordIds.push(rec.id);
    }
  }

  return [...projectMap.values()].sort((a, b) => a.id.localeCompare(b.id));
}

// 当月入账截止时间字段说明（隐藏 tooltip）
const DEADLINE_TIP =
  '财务入账截止后，运营人员调整业务账单关联成本，造成当月入账成本发生变更的，' +
  '不对此处已入账核销成本产生影响，所有变动合并至下月成本体现，并在日志中留痕。';

export function RetailProjectCostPage() {
  const PLATFORMS = DATA.retail.costPlatforms;
  const q = getQueryParams();
  let plat = q.get('pcPlatform') || '';
  if (!PLATFORMS.includes(plat)) plat = PLATFORMS[0];

  const platformTabs = PLATFORMS.map(p => {
    const active = p === plat;
    return `<a class="tab ${active ? 'active' : ''}" href="${buildProjTabHref(p)}">${escapeHtml(p)}</a>`;
  }).join('');

  const projects = buildProjectData(plat);

  const blocks = projects.map(pd => {
    // 月度明细行
    const monthRows = [...pd.months.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, md]) => [
        escapeHtml(month),
        `<b>${escapeHtml(formatMoney(md.cost))}</b>`,
        `<span style="font-size:12px">${escapeHtml(md.deadline)}</span>`,
      ]);

    const deadlineHeader = `当月入账截止时间&nbsp;<span
      title="${escapeHtml(DEADLINE_TIP)}"
      style="cursor:help;color:var(--muted);font-size:12px;font-weight:400"
      aria-label="字段说明">ℹ</span>`;

    const monthSection = monthRows.length
      ? Table(['月份', '当月核销成本（未税）', deadlineHeader], monthRows)
      : `<div style="padding:8px;color:var(--muted);font-size:13px">暂无月度归集记录</div>`;

    return `
      <details class="cost-customer-block" open>
        <summary class="cost-customer-summary">
          <span class="cost-expand-icon" aria-hidden="true">▸</span>
          <strong style="min-width:90px;flex-shrink:0">${escapeHtml(pd.id)}</strong>
          <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted)" title="${escapeHtml(pd.name)}">${escapeHtml(pd.name)}</span>
          <span style="font-size:12px;white-space:nowrap;flex-shrink:0">${escapeHtml(pd.product)}</span>
          <span style="font-size:12px;white-space:nowrap;flex-shrink:0">${escapeHtml(pd.customer)}</span>
          <span style="font-size:12px;white-space:nowrap;flex-shrink:0;color:var(--muted)">${escapeHtml(pd.entity)}</span>
          <span style="white-space:nowrap;flex-shrink:0">核销：<b>${escapeHtml(formatMoney(pd.totalCost))}</b></span>
          <span style="white-space:nowrap;flex-shrink:0">风控：<b>${escapeHtml(formatMoney(pd.totalRiskControl))}</b></span>
          <button type="button" class="btn btn-ghost"
            style="font-size:12px;padding:2px 8px;margin-left:auto;flex-shrink:0"
            data-action="openProjectLog"
            data-project-id="${escapeHtml(pd.id)}"
            data-platform="${escapeHtml(plat)}">日志</button>
        </summary>
        <div class="cost-customer-body">
          <div style="display:flex;gap:32px;flex-wrap:wrap;font-size:13px;padding:8px 4px 12px">
            <div><span style="color:var(--muted)">付款主体：</span>${escapeHtml(pd.payer)}</div>
            <div><span style="color:var(--muted)">账单主体：</span>${escapeHtml(pd.payee)}</div>
          </div>
          ${monthSection}
        </div>
      </details>
    `;
  }).join('');

  return `
    <div class="tabs tabs-linked">${platformTabs}</div>
    <div style="height:12px"></div>
    <div class="card">
      <div class="card-head">项目成本列表</div>
      <div class="card-body">
        ${blocks || `<div style="padding:12px 4px;color:var(--muted);font-size:13px">暂无归集记录。请先在「成本管理」中为成本行分配项目。</div>`}
      </div>
    </div>
  `;
}
