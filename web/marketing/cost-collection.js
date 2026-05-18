import { DATA } from '../shared/data.js';
import { escapeHtml } from '../shared/format.js';
import { Table, pill } from '../shared/ui.js';

export function buildMktCostCollectionDrawerHtml(projectId, channel = 'wechat') {
  const proj = DATA.marketing?.projectDetails?.[projectId];
  const coll = proj?.costCollection || {};
  const channels = coll.channels || [{ id: 'wechat', label: '微信' }];
  const active = channels.find((c) => c.id === channel) ? channel : channels[0]?.id || 'wechat';
  const records = (coll.recordsByChannel || {})[active] || [];

  const tabs = channels
    .map(
      (c) =>
        `<button type="button" class="tab mkt-coll-tab${c.id === active ? ' active' : ''}" data-action="mktCostCollTab" data-project-id="${escapeHtml(projectId)}" data-channel="${escapeHtml(c.id)}">${escapeHtml(c.label)}</button>`
    )
    .join('');

  const rows = records.map((r) => {
    const detail = `<a class="link" href="#" data-action="mktCostCollDetail" data-settle-no="${escapeHtml(r.settleNo)}">详情</a>`;
    return [
      escapeHtml(r.settleNo),
      escapeHtml(r.projectId),
      escapeHtml(r.projectName),
      escapeHtml(r.endDate),
      escapeHtml(String(r.amount)),
      escapeHtml(String(r.orderCount)),
      pill(r.status || '已上报'),
      escapeHtml(r.creator || '—'),
      escapeHtml(r.createdAt),
      detail,
    ];
  });

  const tablePart = rows.length
    ? Table(
        ['单号', '项目编号', '项目名称', '结束日期', '归集金额', '订单笔数', '状态', '创建人', '创建时间', '操作'],
        rows
      )
    : '<div style="padding:16px;color:var(--muted);text-align:center">当前渠道暂无归集记录</div>';

  return `
    <div class="mkt-cost-coll-drawer" data-project-id="${escapeHtml(projectId)}" data-channel="${escapeHtml(active)}">
      <div class="tabs mkt-cost-coll-tabs">${tabs}</div>
      <div class="mkt-cost-coll-section">
        <div class="mkt-cost-coll-head">
          <span class="mkt-section-title">归集记录</span>
          <div class="toolbar">
            <button type="button" class="btn btn-sm" data-action="mktCostCollAdd" data-project-id="${escapeHtml(projectId)}">新增</button>
            <button type="button" class="btn btn-sm" data-action="mktCostCollRefresh" data-project-id="${escapeHtml(projectId)}">刷新</button>
            <button type="button" class="btn btn-sm btn-primary" data-action="mktCostCollExport" data-project-id="${escapeHtml(projectId)}">导出</button>
          </div>
        </div>
        <div class="table-wrap mkt-cost-coll-table-wrap">${tablePart}</div>
        <div class="pagination-bar" style="margin-top:12px">
          <div class="pagination-meta">1-1 of 1</div>
          <div class="pagination-actions">
            <span class="btn btn-sm" style="opacity:.5">‹</span>
            <span class="btn btn-sm btn-primary" style="min-width:32px">1</span>
            <span class="btn btn-sm" style="opacity:.5">›</span>
            <select class="select" style="height:28px;min-width:72px;margin-left:8px"><option>15</option></select>
          </div>
        </div>
      </div>
    </div>`;
}

export function openMktCostCollectionDrawer(projectId, channel, openDrawerFn) {
  const proj = DATA.marketing?.projectDetails?.[projectId];
  const title = proj ? `成本归集 · ${proj.id}` : '成本归集';
  openDrawerFn({
    title,
    bodyHtml: buildMktCostCollectionDrawerHtml(projectId, channel),
  });
}

/** @deprecated 使用 openMktCostCollectionDrawer */
export const buildMktCostCollectionModalHtml = buildMktCostCollectionDrawerHtml;
