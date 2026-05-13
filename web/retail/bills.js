import { DATA } from '../shared/data.js';
import { escapeHtml, formatMoney } from '../shared/format.js';
import { Table, pill } from '../shared/ui.js';
import { getQueryParams } from '../shared/router.js';
import { getPrimaryProjectId } from './financeRules.js';

export const BILL_TYPES    = ['新增', '追加'];
export const BILL_STATUSES = ['编辑中', '已同步'];

/** 计算某业务账单关联的成本记录列表 */
export function getLinkedCostRecords(billId) {
  return DATA.retail.costRecords.filter(r => r.linkedBizBillId === billId);
}

/** 计算某业务账单关联成本合计（已 claimed 金额之和） */
export function getLinkedCostTotal(billId) {
  return getLinkedCostRecords(billId).reduce((s, r) => s + (r.claimed || 0), 0);
}

/** Excel 补贴合计（新数据结构） */
export function getExcelTotal(bill) {
  return (bill.excelFiles || []).reduce((s, f) => s + (f.excelSubsidy || 0), 0);
}

// ── 列表页 ───────────────────────────────────────────────────────────────────
export function RetailBillsPage() {
  const q           = getQueryParams();
  const fCust       = (q.get('bbCust')    || '').trim();
  const fProj       = (q.get('bbProj')    || '').trim();
  const fType       = (q.get('bbType')    || '').trim();
  const fStatus     = (q.get('bbStatus')  || '').trim();
  const fName       = (q.get('bbName')    || '').trim();
  const fId         = (q.get('bbId')      || '').trim();
  const fPmsId      = (q.get('bbPmsId')   || '').trim();

  let bills = [...DATA.retail.bizBills].sort((a, b) => b.id - a.id);
  if (fCust)   bills = bills.filter(b => b.customer.includes(fCust));
  if (fProj)   bills = bills.filter(b => b.project.includes(fProj));
  if (fType)   bills = bills.filter(b => b.billType === fType);
  if (fStatus) bills = bills.filter(b => b.status === fStatus);
  if (fName)   bills = bills.filter(b => b.name.includes(fName));
  if (fId)     bills = bills.filter(b => String(b.id).includes(fId));
  if (fPmsId)  bills = bills.filter(b => String(b.pmsBillId || '').includes(fPmsId));

  const rows = bills.map(b => {
    const isSynced = b.status === '已同步';
    const ops = `<span class="toolbar" style="gap:4px">
      <a class="link" data-action="openBizBillDetail" data-bill-id="${b.id}" style="font-size:13px">详情</a>
      ${isSynced ? `<a class="link" data-action="bizBillReportCustoms" data-bill-id="${b.id}" style="font-size:13px">报关</a>` : ''}
    </span>`;
    return [
      ops,
      escapeHtml(String(b.id)),
      escapeHtml(String(b.pmsBillId || '')),
      escapeHtml(b.customer),
      escapeHtml(b.product),
      `<span title="${escapeHtml(b.name)}" style="display:inline-block;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(b.name)}</span>`,
      escapeHtml(b.start),
      escapeHtml(b.end),
      escapeHtml(b.project),
      escapeHtml(b.manager || ''),
      b.quoteAmount > 0 ? `<b>${formatMoney(b.quoteAmount)}</b>` : '0.00',
      b.taxExcludedSubsidy ? formatMoney(b.taxExcludedSubsidy) : '',
      escapeHtml(b.billType),
      pill(b.status),
    ];
  });

  const typeOpts   = BILL_TYPES.map(t =>
    `<option value="${t}"${fType === t ? ' selected' : ''}>${t}</option>`).join('');
  const statusOpts = BILL_STATUSES.map(s =>
    `<option value="${s}"${fStatus === s ? ' selected' : ''}>${s}</option>`).join('');

  return `
    <div class="page-head" style="margin-bottom:10px">
      <div style="font-size:13px;color:var(--muted)">
        <span>即时零售</span>
        <span style="margin:0 4px;color:var(--border-2)">›</span>
        <span style="color:var(--text)">业务账单</span>
      </div>
      <div class="toolbar">
        <button class="btn btn-primary" data-action="createBizBill">创建账单</button>
      </div>
    </div>

    <div class="card">
      <div class="card-body" style="padding-bottom:4px">
        <div class="filters">
          <div style="display:flex;flex-direction:column;gap:8px">

            <div class="toolbar">
              <div style="display:flex;align-items:center;gap:5px">
                <span class="page-subtitle" style="white-space:nowrap;flex-shrink:0">结构客户</span>
                <input class="input" id="bbf-cust" style="min-width:120px" value="${escapeHtml(fCust)}" placeholder="🔍" />
              </div>
              <div style="display:flex;align-items:center;gap:5px">
                <span class="page-subtitle" style="white-space:nowrap;flex-shrink:0">项目编号</span>
                <input class="input" id="bbf-proj" style="min-width:120px" value="${escapeHtml(fProj)}" />
              </div>
              <div style="display:flex;align-items:center;gap:5px">
                <span class="page-subtitle" style="white-space:nowrap;flex-shrink:0">账单类型</span>
                <select class="select" id="bbf-type" style="min-width:100px">
                  <option value="">全部</option>${typeOpts}
                </select>
              </div>
              <div style="display:flex;align-items:center;gap:5px">
                <span class="page-subtitle" style="white-space:nowrap;flex-shrink:0">状态</span>
                <select class="select" id="bbf-status" style="min-width:100px">
                  <option value="">全部</option>${statusOpts}
                </select>
              </div>
              <div style="display:flex;align-items:center;gap:5px">
                <span class="page-subtitle" style="white-space:nowrap;flex-shrink:0">账单名称</span>
                <input class="input" id="bbf-name" style="min-width:130px" value="${escapeHtml(fName)}" />
              </div>
              <div style="display:flex;align-items:center;gap:5px">
                <span class="page-subtitle" style="white-space:nowrap;flex-shrink:0">账单ID</span>
                <input class="input" id="bbf-id" style="min-width:90px" value="${escapeHtml(fId)}" />
              </div>
              <div style="display:flex;align-items:center;gap:5px">
                <span class="page-subtitle" style="white-space:nowrap;flex-shrink:0">PMS账单ID</span>
                <input class="input" id="bbf-pms-id" style="min-width:90px" value="${escapeHtml(fPmsId)}" />
              </div>
              <button class="btn btn-primary" data-action="filterBizBillsApply">筛选</button>
              <button class="btn" data-action="resetBizBillsFilter">重置</button>
            </div>

          </div>
        </div>
        <div style="height:12px"></div>
        ${Table(
          ['操作','ID','PMS账单ID','客户','产品名称','业务账单名称','开始日期','结束日期','项目编号','中台负责人','报价总金额','未税补贴金额','账单类型','状态'],
          rows
        )}
      </div>
    </div>
  `;
}

// ── 详情 HTML（供 drawer 渲染） ───────────────────────────────────────────────
export function BizBillDetailHtml(billId) {
  const b = DATA.retail.bizBills.find(x => String(x.id) === String(billId));
  if (!b) return `<div style="padding:20px;color:var(--muted)">未找到账单记录（ID: ${escapeHtml(String(billId))}）。</div>`;

  const val = (v) => v ? escapeHtml(String(v)) : `<span class="bill-kv-empty">—</span>`;
  const numVal = (v) => (v !== undefined && v !== null && v !== '') ? escapeHtml(String(v)) : `<span class="bill-kv-empty">—</span>`;
  const moneyVal = (v) => (v > 0) ? escapeHtml(formatMoney(v)) : `<span class="bill-kv-empty">—</span>`;

  const kv = (label, value, spanCls = '') =>
    `<div class="bill-kv-item${spanCls ? ' ' + spanCls : ''}">
      <span class="bill-kv-label">${escapeHtml(label)}</span>
      <span class="bill-kv-value">${value}</span>
    </div>`;

  // ── 关联成本计算 ──
  const linkedRecords = getLinkedCostRecords(b.id);
  const linkedTotal   = linkedRecords.reduce((s, r) => s + r.claimed, 0);
  const excelTotal    = getExcelTotal(b);
  const isMatch       = linkedRecords.length > 0 && Math.abs(linkedTotal - excelTotal) < 0.01;
  const hasNoLink     = linkedRecords.length === 0;
  const diffAmt       = linkedTotal - excelTotal;
  const matchBadge    = hasNoLink
    ? `<span class="pill pill-neutral" style="margin-left:8px">暂无成本</span>`
    : isMatch
      ? `<span class="pill pill-success" style="margin-left:8px">金额匹配</span>`
      : `<span class="pill pill-danger" style="margin-left:8px">金额不匹配</span>`;

  const settleProj = b.project || '';
  const projRows = linkedRecords.map((r) => {
    const pid = getPrimaryProjectId(r);
    const rowMatch = !settleProj ? true : !pid ? false : pid === settleProj;
    return [escapeHtml(r.id), escapeHtml(pid || '—'), rowMatch ? pill('一致') : pill('不一致')];
  });
  const hasProjectMismatch = linkedRecords.some((r) => {
    const pid = getPrimaryProjectId(r);
    return settleProj && pid && pid !== settleProj;
  });
  const hasMissingProject = linkedRecords.some((r) => (r.claimed || 0) > 0 && !getPrimaryProjectId(r));

  // ── 报价组信息 ──
  const qg = b.quoteGroup || {};
  const quotationRows = (qg.quotations || []).map(q => [
    escapeHtml(q.no || ''),
    escapeHtml(q.name || ''),
    escapeHtml(q.type || ''),
    formatMoney(q.quoteTotalAmount || 0),
    formatMoney(q.requestTotalAmount || 0),
    formatMoney(q.paidAmount || 0),
    formatMoney(q.inProcessAmount || 0),
    formatMoney(q.remainingAmount || 0),
  ]);

  // ── Excel文件 ──
  const excelRows = (b.excelFiles || []).map(f => [
    escapeHtml(String(f.id)),
    escapeHtml(f.fileName || ''),
    escapeHtml(String(f.totalRows ?? '')),
    escapeHtml(String(f.uploadedRows ?? '')),
    f.isValid ? '是' : '否',
    escapeHtml(f.fieldTemplate || ''),
    escapeHtml(f.excelStart || ''),
    escapeHtml(f.excelEnd || ''),
    f.excelGmv > 0 ? formatMoney(f.excelGmv) : '—',
    f.excelSubsidy > 0 ? `<b>${formatMoney(f.excelSubsidy)}</b>` : '—',
  ]);

  // ── 关联成本记录 ──
  const linkedCostRows = linkedRecords.map(r => [
    escapeHtml(r.id),
    escapeHtml(r.month),
    escapeHtml(r.platform),
    escapeHtml(r.customer),
    escapeHtml(r.entity || ''),
    formatMoney(r.actual),
    `<b>${formatMoney(r.claimed)}</b>`,
    pill(r.actual <= r.claimed ? '已分配' : '部分分配'),
  ]);

  return `
    <div style="display:flex;flex-direction:column;gap:12px">

      <!-- ① 业务账单信息 -->
      <div class="card">
        <div class="card-head" style="font-weight:600">业务账单信息</div>
        <div class="card-body" style="padding:0">
          <div class="bill-kv-grid">
            ${kv('ID', `<span style="font-weight:700;font-size:14px">${b.id}</span>`)}
            ${kv('业务账单名称', val(b.name), 'span-2')}
            ${kv('所属客户',   val(b.customer))}
            ${kv('所属项目',   val(b.project))}
            ${kv('中台负责人', val(b.manager))}
            ${kv('付款主体',   val(b.payer))}
            ${kv('收款主体',   val(b.payee))}
            ${kv('科目',       val(b.subject))}
            ${kv('开始日期',   val(b.start))}
            ${kv('结束日期',   val(b.end))}
            ${kv('订单总数',   numVal(b.orderCount))}
            ${kv('GMV金额',    b.gmvAmount > 0 ? escapeHtml(String(b.gmvAmount)) : `<span class="bill-kv-empty">—</span>`)}
            ${kv('未税补贴金额', b.taxExcludedSubsidy > 0 ? escapeHtml(formatMoney(b.taxExcludedSubsidy)) : `<span class="bill-kv-empty">—</span>`)}
            ${kv('失败原因',   val(b.failReason))}
            ${kv('产品名称',   val(b.product))}
            ${kv('状态',       `${pill(b.status)}`)}
            ${kv('明镜结算单', val(b.settlementSheet))}
            ${kv('提交人',     val(b.submitter))}
            ${kv('提交时间',   val(b.submitTime), 'span-2')}
            ${kv('审核用户',   val(b.reviewer))}
            ${kv('审核时间',   val(b.reviewTime), 'span-2')}
            ${kv('审核备注',   val(b.reviewNote), 'span-3')}
            ${kv('撤销人',     val(b.canceller))}
            ${kv('撤销时间',   val(b.cancelTime), 'span-2')}
            ${kv('撤销原因',   val(b.cancelReason))}
            ${kv('撤销失败原因', val(b.cancelFailReason), 'span-2')}
            ${kv('账单类型',   val(b.billType))}
            ${kv('来源账单名称', val(b.sourceBillName), 'span-2')}
          </div>
        </div>
      </div>

      <!-- ② 报价组信息 -->
      <div class="card">
        <div class="card-head" style="font-weight:600">报价组信息</div>
        <div class="card-body" style="padding:0">
          <!-- 统计 -->
          <div class="bill-kv-grid-4">
            ${kv('报价总金额', moneyVal(qg.quoteTotalAmount), 'span-4')}
            ${kv('请款总金额',   moneyVal(qg.requestTotalAmount))}
            ${kv('已请款金额',   moneyVal(qg.paidAmount))}
            ${kv('请款中金额',   moneyVal(qg.inProcessAmount))}
            ${kv('剩余请款金额', moneyVal(qg.remainingAmount))}
            ${kv('关联账单的数量',   numVal(qg.linkedBillCount))}
            ${kv('关联账单订单数量', numVal(qg.linkedBillOrderCount))}
            ${kv('关联账单GMV',      qg.linkedBillGmv > 0 ? escapeHtml(String(qg.linkedBillGmv)) : `<span class="bill-kv-empty">—</span>`)}
            ${kv('关联账单补贴金额', moneyVal(qg.linkedBillSubsidy))}
          </div>
          <!-- 报价单表格 -->
          <div style="padding:10px 0 0">
            <div style="font-size:12px;font-weight:600;color:var(--muted);padding:0 12px 6px">报价单</div>
            ${quotationRows.length
              ? Table(['报价单编号','报价单名称','报价单类型','报价总金额','总请款金额','已请款金额','请款中金额','剩余请款金额'], quotationRows)
              : `<div style="padding:6px 12px 10px;color:var(--muted);font-size:13px">暂无报价单</div>`}
          </div>
        </div>
      </div>

      <!-- ③ Excel文件 -->
      <div class="card">
        <div class="card-head" style="font-weight:600">
          Excel文件
          <div style="flex:1"></div>
          <button class="btn" data-action="refreshBizBillExcel" data-bill-id="${b.id}">刷新</button>
        </div>
        <div class="card-body">
          ${excelRows.length
            ? Table(['id','文件名称','总行数','上传行数','是否有效','字段映射模板','Excel开始时间','Excel结束时间','ExcelGMV','Excel补贴金额'], excelRows)
            : `<div style="padding:4px 0;color:var(--muted);font-size:13px">暂未上传Excel文件</div>`}
        </div>
      </div>

      <!-- ④ 其他凭证 -->
      <div class="card">
        <div class="card-head" style="font-weight:600">
          其他凭证
          <div style="flex:1"></div>
          <button class="btn" data-action="refreshBizBillVoucher" data-bill-id="${b.id}">刷新</button>
        </div>
        <div class="card-body">
          ${(b.otherVouchers || []).length > 0
            ? Table(['日期','品牌','GMV','未税补贴金额','备注','创建人','创建时间','附件'],
                (b.otherVouchers || []).map(v => [
                  escapeHtml(v.date || ''), escapeHtml(v.brand || ''),
                  v.gmv > 0 ? formatMoney(v.gmv) : '—',
                  v.subsidy > 0 ? formatMoney(v.subsidy) : '—',
                  escapeHtml(v.remark || ''), escapeHtml(v.creator || ''),
                  escapeHtml(v.createTime || ''), v.attachment || '—',
                ]))
            : `<div style="padding:4px 0;color:var(--muted);font-size:13px">没有数据</div>`}
        </div>
      </div>

      <!-- ④b 项目一致性（结算 vs 成本归集） -->
      <div class="card">
        <div class="card-head" style="font-weight:600">
          项目一致性核对
          ${
            hasNoLink
              ? `<span class="pill pill-neutral" style="margin-left:8px">无关联成本</span>`
              : hasProjectMismatch || hasMissingProject
                ? `<span class="pill pill-danger" style="margin-left:8px">存在风险</span>`
                : `<span class="pill pill-success" style="margin-left:8px">归集一致</span>`
          }
        </div>
        <div class="card-body" style="font-size:13px">
          <div style="margin-bottom:8px;color:var(--muted)">账单所属项目：<b style="color:var(--text)">${escapeHtml(settleProj || '—')}</b>。请与每条关联成本的归集主项目比对；不一致时库存扣减与财务成本可能偏离。</div>
          ${
            linkedRecords.length
              ? Table(['成本记录', '归集主项目', '与账单项目'], projRows)
              : `<div style="color:var(--muted)">无关联成本记录</div>`
          }
          ${
            hasProjectMismatch || hasMissingProject
              ? `<div class="callout callout-warning" style="margin-top:10px;font-size:12px">
                  <div class="callout-title">建议动作</div>
                  前往「结算核对」查看或生成待办；在财务入账月做当期调整，勿直接改已锁定历史月数据。
                </div>`
              : ''
          }
        </div>
      </div>

      <!-- ⑤ 关联成本记录（内部追踪） -->
      <div class="card">
        <div class="card-head" style="font-weight:600">
          关联成本记录${matchBadge}
          <div style="flex:1"></div>
          <div style="display:flex;gap:16px;align-items:center;font-size:13px">
            <span>关联成本合计：<b>${formatMoney(linkedTotal)}</b></span>
            <span>Excel补贴合计：<b>${formatMoney(excelTotal)}</b></span>
            ${!hasNoLink && !isMatch ? `<span style="color:var(--danger)">差异：<b>${formatMoney(Math.abs(diffAmt))}</b></span>` : ''}
          </div>
        </div>
        <div class="card-body">
          ${hasNoLink
            ? `<div style="padding:6px 0;color:var(--muted);font-size:13px">暂未关联成本记录。请在「成本管理」中完成分配并关联本账单。</div>`
            : Table(['成本记录ID','月份','平台','客户','二级实体','实际成本','已分配金额','状态'], linkedCostRows)}
          ${!hasNoLink ? `
            <div style="margin-top:10px;padding:10px 12px;background:${isMatch ? 'rgba(5,150,105,.06)' : 'rgba(220,38,38,.06)'};border:1px solid ${isMatch ? 'rgba(5,150,105,.25)' : 'rgba(220,38,38,.25)'};border-radius:var(--radius);font-size:13px">
              <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:center">
                <div><span style="color:var(--muted)">关联成本合计：</span><b>${formatMoney(linkedTotal)}</b></div>
                <div><span style="color:var(--muted)">Excel补贴合计：</span><b>${formatMoney(excelTotal)}</b></div>
                ${isMatch
                  ? `<div style="color:var(--success);font-weight:600">✓ 金额一致</div>`
                  : `<div style="color:var(--danger);font-weight:600">✗ 差异 ${formatMoney(Math.abs(diffAmt))}，请核对</div>`}
              </div>
            </div>` : ''}
        </div>
      </div>

    </div>
  `;
}
