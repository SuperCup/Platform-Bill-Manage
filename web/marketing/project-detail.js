import { DATA } from '../shared/data.js';
import { escapeHtml } from '../shared/format.js';
import { getQueryParams } from '../shared/router.js';
import { Table, callout, pill } from '../shared/ui.js';

function fmtNum(n) {
  if (n === null || n === undefined || n === '') return '0.00';
  const v = typeof n === 'number' ? n : Number(n);
  if (Number.isNaN(v)) return String(n);
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function kvItem(label, value) {
  return `<div class="mkt-proj-kv"><span class="mkt-proj-k">${escapeHtml(label)}</span><span class="mkt-proj-v">${value}</span></div>`;
}

function projectDetailHref(projectId) {
  const p = new URLSearchParams();
  p.set('marketingTab', 'projectDetail');
  p.set('mktProject', projectId);
  return `#/marketing?${p.toString()}`;
}

export function MarketingProjectDetailPage() {
  const q = getQueryParams();
  const projectId = (q.get('mktProject') || 'SG-260217').trim();
  const proj = DATA.marketing?.projectDetails?.[projectId];

  if (!proj) {
    return `<div style="padding:24px;color:var(--muted)">未找到项目 <b>${escapeHtml(projectId)}</b>，请从列表或修改记录进入。</div>`;
  }

  const budgetPct = proj.budgetTotal > 0 ? ((proj.budgetUsed / proj.budgetTotal) * 100).toFixed(2) : '0';
  const timePct = proj.timeTotal > 0 ? ((proj.timeElapsed / proj.timeTotal) * 100).toFixed(2) : '0';

  const noticeHtml = callout(
    'info',
    '',
    proj.progressNotice ||
      '充值预算：项目充值预算总额；充值金额：已充值到账金额；核销预算：可核销预算上限；核销金额：已核销金额；剩余预算=核销预算-核销金额。',
    { htmlBody: true }
  );

  const batchRows = (proj.batches || []).map((b) => [
    `<a class="link" href="#">${escapeHtml(b.batchCode)}</a>`,
    escapeHtml(b.title),
    escapeHtml(b.mechanism),
    escapeHtml(b.start),
    escapeHtml(b.end),
    pill(b.status),
    escapeHtml(String(b.couponLimit ?? '—')),
    escapeHtml(String(b.totalIssued ?? '—')),
    escapeHtml(b.channel || '—'),
    escapeHtml(b.region || '—'),
    escapeHtml(b.retailer || '—'),
    escapeHtml(b.budgetFromCoupon || '—'),
    escapeHtml(b.remark || '—'),
    escapeHtml(b.sceneType || '—'),
    escapeHtml(b.scope || '—'),
    escapeHtml(b.platform || '—'),
  ]);

  return `
    <div class="mkt-proj-detail">
      <h1 class="page-title mkt-proj-title">${escapeHtml(proj.fullTitle || `${proj.id} ${proj.name}`)}</h1>

      <div class="card mkt-proj-card">
        <div class="card-head">项目进度</div>
        <div class="card-body">
          <div class="mkt-proj-progress-row">
            <div class="mkt-proj-progress-item">
              <span class="mkt-proj-progress-label">预算使用进度</span>
              <span class="mkt-proj-progress-val">${fmtNum(proj.budgetUsed)}/${fmtNum(proj.budgetTotal)} - ${budgetPct}%</span>
              <span class="mkt-proj-progress-sub">(截至${escapeHtml(proj.progressAsOf || '—')})</span>
            </div>
            <div class="mkt-proj-progress-item">
              <span class="mkt-proj-progress-label">项目时间进度</span>
              <span class="mkt-proj-progress-val">${proj.timeElapsed}/${proj.timeTotal} - ${timePct}%</span>
            </div>
            <div class="mkt-proj-progress-item">
              <span class="mkt-proj-progress-label">总成本（截止时间）</span>
              <span class="mkt-proj-progress-val">${fmtNum(proj.totalCost)}</span>
              <span class="mkt-proj-progress-sub">(截至${escapeHtml(proj.totalCostCutoff || proj.progressAsOf || '—')})</span>
            </div>
            <div class="mkt-proj-progress-item">
              <span class="mkt-proj-progress-label">已入账成本金额（截止时间）</span>
              <span class="mkt-proj-progress-val">
                ${fmtNum(proj.recordedCost)}
                <a class="link mkt-proj-detail-link" href="#" data-action="openMktRecordedCostDetail" data-project-id="${escapeHtml(projectId)}">明细</a>
              </span>
              <span class="mkt-proj-progress-sub">(截至${escapeHtml(proj.recordedCostCutoff || proj.progressAsOf || '—')})</span>
            </div>
            <div class="mkt-proj-progress-item">
              <span class="mkt-proj-progress-label">已归集成本（最后操作时间）</span>
              <span class="mkt-proj-progress-val">${fmtNum(proj.collectedCost)}</span>
              <span class="mkt-proj-progress-sub">(${escapeHtml(proj.collectedCostLastOp || '—')})</span>
            </div>
          </div>
          <div style="margin-top:12px">${noticeHtml}</div>
        </div>
      </div>

      <div class="card mkt-proj-card">
        <div class="card-head">项目基础信息</div>
        <div class="card-body">
          <div class="mkt-proj-kv-grid">
            ${kvItem('项目编号', escapeHtml(proj.id))}
            ${kvItem('项目名称', escapeHtml(proj.name))}
            ${kvItem('客户名称', escapeHtml(proj.customer))}
            ${kvItem('客户经理', escapeHtml(proj.customerManager || '—'))}
            ${kvItem('项目经理', escapeHtml(proj.projectManager || '—'))}
            ${kvItem('开始日期', escapeHtml(proj.start))}
            ${kvItem('结束日期', escapeHtml(proj.end))}
            ${kvItem('品类', escapeHtml(proj.category || '—'))}
            ${kvItem('组户', escapeHtml(proj.groupAccount || '—'))}
            ${kvItem('批次结束日期', escapeHtml(proj.batchEndDate || proj.end))}
            ${kvItem('充值预算', fmtNum(proj.rechargeBudget))}
            ${kvItem('充值金额', fmtNum(proj.rechargeAmount))}
            ${kvItem('核销预算', fmtNum(proj.verifyBudget))}
            ${kvItem('核销金额', fmtNum(proj.verifyAmount))}
            ${kvItem('剩余预算', `<span class="${proj.remaining < 0 ? 'mkt-amt-neg' : ''}">${fmtNum(proj.remaining)}</span>`)}
          </div>
          <div class="toolbar mkt-proj-actions">
            <button type="button" class="btn" data-action="mktProjDoc" data-project-id="${escapeHtml(projectId)}">文档</button>
            <button type="button" class="btn" data-action="mktProjWarnUser" data-project-id="${escapeHtml(projectId)}">预警用户</button>
            <button type="button" class="btn btn-primary" data-action="mktOpenCostCollection" data-project-id="${escapeHtml(projectId)}">数据归集</button>
            <button type="button" class="btn" data-action="mktProjSyncPms" data-project-id="${escapeHtml(projectId)}">从PMS同步</button>
          </div>
        </div>
      </div>

      <div class="card mkt-proj-card">
        <div class="card-head">
          <span>批次</span>
          <div class="toolbar">
            <button type="button" class="btn btn-sm" data-action="mktBatchExtParams">扩展参数管理</button>
            <button type="button" class="btn btn-sm" data-action="mktBatchExport">导出</button>
            <button type="button" class="btn btn-sm" data-action="mktBatchImport">导入</button>
            <button type="button" class="btn btn-sm" data-action="mktBatchRefresh">刷新</button>
          </div>
        </div>
        <div class="card-body">
          <div class="filters" style="margin-bottom:12px">
            <div class="toolbar" style="flex-wrap:wrap;gap:8px 12px">
              <select class="select" style="min-width:100px"><option>发券渠道</option></select>
              <input class="input" placeholder="批次编码" style="min-width:100px" />
              <input class="input" placeholder="福利站" style="min-width:90px" />
              <select class="select" style="min-width:90px"><option>创建类型</option></select>
              <select class="select" style="min-width:80px"><option>状态</option></select>
              <input class="input" placeholder="客户零售商" style="min-width:100px" />
            </div>
          </div>
          <div class="table-wrap mkt-batch-table-wrap">
            ${
              batchRows.length
                ? Table(
                    ['批次编码', '标题', '机制', '开始日期', '结束日期', '状态', '券张数上限', '累计发放数', '发券渠道', '客户区域', '客户零售商', '预算来源券', '备注', '场景类型', '适用范围', '适用平台'],
                    batchRows
                  )
                : '<div style="padding:16px;color:var(--muted)">暂无批次</div>'
            }
          </div>
        </div>
      </div>
    </div>
  `;
}

export { projectDetailHref };
