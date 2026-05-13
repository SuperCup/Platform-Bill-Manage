import { DATA } from '../shared/data.js';
import { escapeHtml } from '../shared/format.js';
import { Table, pill, callout, PageHead } from '../shared/ui.js';

export function RetailReconcilePage() {
  const tasks = DATA.retail.reconciliationTasks || [];
  const audits = (DATA.retail.costChangeAudit || []).slice(0, 40);
  const cur = DATA.retail.currentFinanceOperatingMonth || '—';

  const taskRows = tasks.map((t) => [
    escapeHtml(t.id),
    escapeHtml(String(t.billId)),
    pill(t.severity === 'high' ? '高风险' : '注意'),
    escapeHtml(t.title),
    `<span style="font-size:12px;color:var(--muted);line-height:1.45">${escapeHtml(t.detail)}</span>`,
    pill(t.status),
    `<span class="toolbar" style="gap:4px;flex-wrap:wrap">
      <a class="link" data-action="openBizBillDetail" data-bill-id="${escapeHtml(String(t.billId))}">账单</a>
      ${t.status === '待处理' ? `<button type="button" class="btn btn-ghost" data-action="reconcileTaskDone" data-task-id="${escapeHtml(t.id)}">标记已办</button>` : ''}
    </span>`,
  ]);

  const auditRows = audits.map((a) => [
    escapeHtml(a.time),
    escapeHtml(a.operator),
    escapeHtml(a.recordId),
    escapeHtml(a.action),
    escapeHtml(a.financePeriod || '—'),
    escapeHtml(a.detail || ''),
  ]);

  return `
    ${PageHead('结算核对', `财务入账月 ${escapeHtml(cur)}：历史月已推送数不可直接修改，差异在本月体现`)}
    ${callout(
      'info',
      '流程要点（对照制度）',
      '① 平台账单无活动ID → 以「业务账单 + Excel 补贴」与关联成本合计强校验为分配依据。② 已推送财务的归集成本不可跨月回溯改数；错配在当期财务月做调整分录并留痕。③ 账单「已同步」后自动对照结算项目与成本归集项目，生成待办，避免结算后遗忘成本侧调整导致库存偏差。'
    )}
    <div style="height:12px"></div>
    <div class="card">
      <div class="card-head">待办（项目 / 归集一致性）</div>
      <div class="card-body">
        ${
          taskRows.length
            ? Table(['待办ID', '账单ID', '等级', '标题', '说明', '状态', '操作'], taskRows)
            : `<div style="padding:8px;color:var(--muted)">暂无待办</div>`
        }
      </div>
    </div>
    <div style="height:12px"></div>
    <div class="card">
      <div class="card-head">成本侧操作留痕（最近）</div>
      <div class="card-body">
        ${
          auditRows.length
            ? Table(['时间', '操作人', '成本记录', '动作', '财务归属月', '明细'], auditRows)
            : `<div style="padding:8px;color:var(--muted)">暂无记录</div>`
        }
      </div>
    </div>
  `;
}
