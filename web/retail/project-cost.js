/**
 * 项目成本追踪
 * 以项目为维度，按月汇总归集成本，并展示调整记录。
 */
import { DATA } from '../shared/data.js';
import { escapeHtml, formatMoney } from '../shared/format.js';
import { Table, StatGrid, callout, pill, PageHead } from '../shared/ui.js';
import { getQueryParams } from '../shared/router.js';

// ── 从 costRecords 聚合出 projectId → { name, months: Map<month, {amount, recordIds}> }
function buildProjectMonthMap(fProj, fCust, fMonth) {
  const projMap = new Map();

  for (const rec of DATA.retail.costRecords) {
    for (const pa of (rec.allocDetail?.projects || [])) {
      const pid = pa.projectId;
      if (!pid) continue;
      if (fProj && !pid.toLowerCase().includes(fProj.toLowerCase())) continue;
      if (fCust && !rec.customer.toLowerCase().includes(fCust.toLowerCase())) continue;
      if (fMonth && rec.month !== fMonth) continue;

      if (!projMap.has(pid)) {
        projMap.set(pid, {
          id:       pid,
          name:     pa.projectName || pid,
          customer: rec.customer,
          months:   new Map(),
        });
      }
      const pdata  = projMap.get(pid);
      const mkey   = rec.month;
      if (!pdata.months.has(mkey)) pdata.months.set(mkey, { amount: 0, recordIds: [], hasAdjust: false });
      const mdata  = pdata.months.get(mkey);
      mdata.amount    += (pa.amount || 0);
      mdata.recordIds.push(rec.id);
    }
  }

  // 标记有 costChangeAudit 的月
  const auditByRecord = new Map();
  for (const a of (DATA.retail.costChangeAudit || [])) {
    if (!auditByRecord.has(a.recordId)) auditByRecord.set(a.recordId, []);
    auditByRecord.get(a.recordId).push(a);
  }
  for (const pdata of projMap.values()) {
    for (const mdata of pdata.months.values()) {
      mdata.hasAdjust = mdata.recordIds.some(id => auditByRecord.has(id));
      mdata.audits    = mdata.recordIds.flatMap(id => auditByRecord.get(id) || []);
    }
  }

  return projMap;
}

// 获取 reconciliationTasks 中针对某项目的待办数量（通过 bizBill.project 对应）
function getOpenTasksForProject(pid) {
  return (DATA.retail.reconciliationTasks || []).filter(t => {
    if (t.status !== '待处理') return false;
    const bill = DATA.retail.bizBills.find(b => b.id === t.billId);
    return bill?.project === pid;
  }).length;
}

export function RetailProjectCostPage() {
  const q      = getQueryParams();
  const fProj  = (q.get('pcProj')  || '').trim();
  const fCust  = (q.get('pcCust')  || '').trim();
  const fMonth = (q.get('pcMonth') || '').trim();

  const projMap   = buildProjectMonthMap(fProj, fCust, fMonth);
  const allMonths = [...new Set(DATA.retail.costRecords.map(r => r.month))].sort();
  const months    = fMonth ? [fMonth] : allMonths;

  const monthOpts = [`<option value="">全部月份</option>`,
    ...allMonths.map(m => `<option value="${m}"${fMonth === m ? ' selected' : ''}>${m}</option>`),
  ].join('');

  // ── 统计
  let totalCost   = 0;
  let adjCount    = 0;
  let taskCount   = 0;
  for (const pd of projMap.values()) {
    for (const md of pd.months.values()) {
      totalCost += md.amount;
      if (md.hasAdjust) adjCount++;
    }
    taskCount += getOpenTasksForProject(pd.id);
  }

  // ── 主列表
  const blocks = [...projMap.values()]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(pd => {
      const projTotal  = [...pd.months.values()].reduce((s, m) => s + m.amount, 0);
      const openTasks  = getOpenTasksForProject(pd.id);
      const hasAdjust  = [...pd.months.values()].some(m => m.hasAdjust);

      // 月度明细行
      const monthRows = [...pd.months.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, md]) => {
          // 关联成本记录列
          const recLinks = md.recordIds.map(rid => {
            const r = DATA.retail.costRecords.find(x => x.id === rid);
            return r ? `<span style="font-size:11px;color:var(--muted)">${escapeHtml(r.platform)} / ${escapeHtml(r.entity)}</span>` : escapeHtml(rid);
          }).join('<br>');

          // 调整记录
          const adjustHtml = md.audits.length
            ? md.audits.map(a =>
                `<div style="font-size:11px;color:var(--muted);margin-top:2px">
                  [${escapeHtml(a.financePeriod || '')}] ${escapeHtml(a.action)}：${escapeHtml(a.detail)}
                </div>`
              ).join('')
            : `<span style="font-size:11px;color:var(--muted)">无</span>`;

          return [
            escapeHtml(month),
            recLinks,
            `<b>${escapeHtml(formatMoney(md.amount))}</b>`,
            md.hasAdjust
              ? `<span class="pill pill-warning" style="font-size:11px">有调整</span>`
              : `<span class="pill pill-neutral" style="font-size:11px">无</span>`,
            `<div>${adjustHtml}</div>`,
          ];
        });

      // 全部调整明细（展开区）
      const allAudits = [...pd.months.values()].flatMap(m => m.audits);
      const auditRows = allAudits.map(a => [
        escapeHtml(a.time),
        escapeHtml(a.operator || '—'),
        escapeHtml(a.recordId),
        escapeHtml(a.action),
        escapeHtml(a.financePeriod || '—'),
        `<span style="font-size:12px">${escapeHtml(a.detail || '—')}</span>`,
      ]);

      const summaryBadge = `
        ${hasAdjust ? pill('有调整') : ''}
        ${openTasks > 0 ? `<span class="pill pill-warning">${openTasks} 个待办</span>` : ''}
      `;

      return `
        <details class="cost-customer-block" open>
          <summary class="cost-customer-summary">
            <span class="cost-expand-icon" aria-hidden="true">▸</span>
            <strong>${escapeHtml(pd.id)}</strong>
            <span style="color:var(--muted)">${escapeHtml(pd.name)}</span>
            <span style="color:var(--muted);font-size:12px">${escapeHtml(pd.customer)}</span>
            <span>合计：<b>${escapeHtml(formatMoney(projTotal))}</b></span>
            <span>${summaryBadge}</span>
            <span style="margin-left:auto">
              <a class="link" style="font-size:12px" href="#/retail?retailTab=projectCost&pcProj=${encodeURIComponent(pd.id)}">仅看此项目</a>
            </span>
          </summary>
          <div class="cost-customer-body">
            ${Table(
              ['月份', '归集来源（平台 / 实体）', '归集金额', '调整标记', '调整记录'],
              monthRows
            )}
            ${auditRows.length ? `
              <div style="margin-top:12px">
                <div style="font-size:12px;font-weight:600;color:var(--muted);padding:0 0 6px">操作留痕</div>
                ${Table(['时间', '操作人', '成本记录', '动作', '财务归属月', '明细'], auditRows)}
              </div>` : ''}
          </div>
        </details>
      `;
    }).join('');

  return `
    ${PageHead('项目成本追踪', '按项目汇总各月归集成本及调整记录')}
    ${StatGrid([
      { value: String(projMap.size),              label: '涉及项目数' },
      { value: formatMoney(totalCost),            label: '归集成本合计' },
      { value: String(adjCount),                  label: '月份中有调整记录', tone: adjCount > 0 ? 'warning' : undefined },
      { value: String(taskCount),                 label: '待处理结算核对待办', tone: taskCount > 0 ? 'warning' : undefined },
    ])}
    <div style="height:12px"></div>
    <div class="card">
      <div class="card-head">项目成本列表</div>
      <div class="card-body">
        <div class="filters">
          <div class="toolbar">
            <input class="input" id="pc-proj"  placeholder="项目编号" value="${escapeHtml(fProj)}" />
            <input class="input" id="pc-cust"  placeholder="客户关键词" value="${escapeHtml(fCust)}" />
            <select class="select" id="pc-month">${monthOpts}</select>
            <button type="button" class="btn btn-primary" data-action="filterProjectCost">查询</button>
            <button type="button" class="btn" data-action="resetProjectCost">重置</button>
          </div>
        </div>
        <div style="height:12px"></div>
        ${blocks || `<div style="padding:12px 4px;color:var(--muted);font-size:13px">
            暂无归集记录。请先在「成本管理」中为成本行分配项目。
          </div>`}
      </div>
    </div>
  `;
}
