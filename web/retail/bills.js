import { DATA } from '../shared/data.js';
import { escapeHtml, formatMoney } from '../shared/format.js';
import { Table, pill } from '../shared/ui.js';
import { getQueryParams } from '../shared/router.js';
import {
  getPrimaryProjectId,
  isRecordFinanceLocked,
  getRecordAllocatedCost,
} from './financeRules.js';

export const ALLOWED_BIZ_CUSTOMERS = ['康师傅方便面', '屈臣氏饮料'];

export const BILL_TYPES    = ['新增', '追加'];
export const BILL_STATUSES = ['新增', '编辑中', '已同步'];

/** 业务账单 ID 比较（dataset 为字符串，data 里多为数字） */
export function billIdEq(a, b) {
  if (a == null || b == null) return a == null && b == null;
  return Number(a) === Number(b);
}

/** 客户名归一化（仅保留康师傅方便面、屈臣氏饮料） */
export function normCustomer(c) {
  const s = String(c || '').trim();
  if (!s) return s;
  if (s.includes('康师傅')) return '康师傅方便面';
  if (s.includes('屈臣氏')) return '屈臣氏饮料';
  return s;
}

export function isAllowedBizCustomer(c) {
  return ALLOWED_BIZ_CUSTOMERS.includes(normCustomer(c));
}

export function customerMatches(a, b) {
  const na = normCustomer(a);
  const nb = normCustomer(b);
  if (!na || !nb) return false;
  return na === nb;
}

/** 计算某业务账单关联的成本记录列表 */
export function getLinkedCostRecords(billId) {
  return DATA.retail.costRecords.filter((r) => billIdEq(r.linkedBizBillId, billId));
}

/** 成本单对本账单可划拨的上限 */
export function costTransferableMax(record, billId) {
  const claimed = record.claimed || 0;
  const actual = record.actual || 0;
  if (billIdEq(record.linkedBizBillId, billId)) return Math.max(0, actual - claimed);
  if (record.linkedBizBillId == null) return Math.max(0, actual - claimed);
  return claimed;
}

/** 「新增成本单」— 从成本管理可选列表 */
export function getCostSourcesForBillAdd(bizBill, billId) {
  return DATA.retail.costRecords.filter((r) => {
    if (isRecordFinanceLocked(r)) return false;
    if (!customerMatches(r.customer, bizBill.customer)) return false;
    if (billIdEq(r.linkedBizBillId, billId)) {
      return costTransferableMax(r, billId) > 0.01;
    }
    return costTransferableMax(r, billId) > 0.01;
  });
}

/** 「新增成本单」— 从其他业务账单可选列表 */
export function getBillSourcesForCostAdd(bizBill, billId) {
  return DATA.retail.bizBills.filter(
    (b) =>
      customerMatches(b.customer, bizBill.customer) &&
      !billIdEq(b.id, billId) &&
      b.status !== '已同步' &&
      getLinkedCostTotal(b.id) > 0
  );
}

/** 业务账单列表「待归集金额」：关联到该账单的成本单认领（分配）金额之和 */
export function getLinkedCostTotal(billId) {
  return getLinkedCostRecords(billId).reduce((s, r) => s + (r.claimed || 0), 0);
}

/** 同平台 + 二级实体 + 归属月 唯一键 */
export function costRecordEntityMonthKey(r) {
  return `${r.platform}|${r.entity || ''}|${r.month || ''}`;
}

/** 合并同键多条自动化成本（金额累加，保留首条元数据） */
export function dedupeCostRecordsByEntityMonth(records) {
  const map = new Map();
  for (const r of records) {
    const key = costRecordEntityMonthKey(r);
    if (!map.has(key)) {
      map.set(key, { ...r });
      continue;
    }
    const ex = map.get(key);
    ex.actual = (ex.actual || 0) + (r.actual || 0);
    ex.claimed = (ex.claimed || 0) + (r.claimed || 0);
    ex.riskControlAmount = (ex.riskControlAmount || 0) + (r.riskControlAmount || 0);
    const mergeProjects = [...(ex.allocDetail?.projects || []), ...(r.allocDetail?.projects || [])];
    const mergeBills = [...(ex.allocDetail?.bills || []), ...(r.allocDetail?.bills || [])];
    ex.allocDetail = { projects: mergeProjects, bills: mergeBills };
    if (!ex.linkedBizBillId && r.linkedBizBillId) ex.linkedBizBillId = r.linkedBizBillId;
  }
  return [...map.values()];
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

  let bills = [...DATA.retail.bizBills]
    .filter((b) => isAllowedBizCustomer(b.customer))
    .sort((a, b) => b.id - a.id);
  if (fCust)   bills = bills.filter(b => b.customer.includes(fCust));
  if (fProj)   bills = bills.filter(b => b.project.includes(fProj));
  if (fType)   bills = bills.filter(b => b.billType === fType);
  if (fStatus) bills = bills.filter(b => b.status === fStatus);
  if (fName)   bills = bills.filter(b => b.name.includes(fName));
  if (fId)     bills = bills.filter(b => String(b.id).includes(fId));
  if (fPmsId)  bills = bills.filter(b => String(b.pmsBillId || '').includes(fPmsId));

  const rows = bills.map(b => {
    const isSynced = b.status === '已同步';
    const pendingAgg = getLinkedCostTotal(b.id);
    const ops = `<span class="toolbar" style="gap:4px">
      <a class="link" data-action="openBizBillDetail" data-bill-id="${b.id}" style="font-size:13px">详情</a>
      ${isSynced ? `<a class="link" data-action="bizBillReport" data-bill-id="${b.id}" style="font-size:13px">报表</a>` : ''}
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
      pendingAgg > 0 ? `<b>${formatMoney(pendingAgg)}</b>` : formatMoney(pendingAgg),
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
      <div class="toolbar" style="gap:8px">
        <button class="btn" data-action="refreshBizBillsList">刷新</button>
        <button class="btn btn-primary" data-action="syncFromPms">从 PMS 同步</button>
      </div>
    </div>

    <div class="card">
      <div class="card-body" style="padding-bottom:4px">
        <div class="filters">
          <div style="display:flex;flex-direction:column;gap:8px">

            <div class="toolbar">
              <div style="display:flex;align-items:center;gap:5px">
                <span class="page-subtitle" style="white-space:nowrap;flex-shrink:0">客户</span>
                <select class="select" id="bbf-cust" style="min-width:140px">
                  <option value="">全部</option>
                  ${ALLOWED_BIZ_CUSTOMERS.map((c) =>
                    `<option value="${escapeHtml(c)}"${fCust === c ? ' selected' : ''}>${escapeHtml(c)}</option>`
                  ).join('')}
                </select>
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
          ['操作','ID','PMS账单ID','客户','产品名称','业务账单名称','开始日期','结束日期','项目编号','中台负责人','报价总金额','待归集金额','未税补贴金额','账单类型','状态'],
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
  const diffAmt       = linkedTotal - excelTotal;  // >0 成本超出凭证；<0 成本不足凭证
  const isLocked      = b.status === '已同步';
  const matchBadge    = hasNoLink
    ? `<span class="pill pill-neutral" style="margin-left:8px">暂无成本</span>`
    : isMatch
      ? `<span class="pill pill-success" style="margin-left:8px">金额匹配</span>`
      : `<span class="pill pill-danger" style="margin-left:8px">金额不匹配</span>`;

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

      <!-- ⑤ 成本校验 -->
      <div class="card">
        <div class="card-head" style="font-weight:600">
          成本校验
          ${hasNoLink
            ? `<span class="pill pill-neutral" style="margin-left:8px">待关联</span>`
            : isMatch
              ? `<span class="pill pill-success" style="margin-left:8px">✓ 匹配</span>`
              : `<span class="pill pill-danger" style="margin-left:8px">⚠ 差额</span>`}
          <div style="flex:1"></div>
          ${!isLocked ? `<button class="btn btn-sm" data-action="openBillCostAdd" data-bill-id="${b.id}">新增成本单</button>` : ''}
        </div>
        <div class="card-body">

          <!-- 金额横幅：凭证 vs 已关联 vs 差额 -->
          <div class="cost-match-banner">
            <div class="cost-match-cell">
              <div class="cost-match-cell-label">① 凭证金额（Excel）</div>
              <div class="cost-match-cell-value">${formatMoney(excelTotal)}</div>
              <div class="cost-match-cell-sub">提交须与此一致</div>
            </div>
            <div class="cost-match-cell">
              <div class="cost-match-cell-label">② 已关联成本合计</div>
              <div class="cost-match-cell-value">${formatMoney(linkedTotal)}</div>
              <div class="cost-match-cell-sub">${linkedRecords.length} 条成本记录</div>
            </div>
            <div class="cost-match-cell">
              <div class="cost-match-cell-label">③ 差额状态</div>
              <div class="cost-match-cell-value" style="color:${hasNoLink ? 'var(--muted)' : isMatch ? 'var(--success)' : 'var(--danger)'}">
                ${hasNoLink ? '— 待关联'
                  : isMatch ? '✓ 无差异'
                  : diffAmt > 0 ? `成本超出 ${formatMoney(Math.abs(diffAmt))}`
                  : `成本不足 ${formatMoney(Math.abs(diffAmt))}`}
              </div>
              <div class="cost-match-cell-sub">
                ${hasNoLink ? '点击右上角「新增成本单」开始'
                  : isMatch ? '两端金额一致，可正常提交'
                  : diffAmt > 0 ? '成本 > 凭证，可修改已关联成本转出多余部分'
                  : '成本 < 凭证，新增成本单或修改已关联成本转入补足差额'}
              </div>
            </div>
          </div>

          <!-- 已关联成本记录列表 -->
          <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:6px">
            已关联成本记录${isLocked ? '（账单已提交，只读）' : '（未同步前均可修改或删除关联）'}
          </div>
          ${linkedRecords.length
            ? Table(
                ['成本记录', '月份', '客户 · 实体', '实际成本', '已分配成本', '本单关联', '操作'],
                linkedRecords.map(r => {
                  const ops = !isLocked
                    ? `<div style="display:flex;gap:5px;white-space:nowrap">
                        <a class="link" data-action="rtlBillModifyCost" data-record-id="${escapeHtml(r.id)}" data-bill-id="${b.id}">修改</a>
                        <a class="link" style="color:var(--danger)" data-action="rtlBillDeleteCost" data-record-id="${escapeHtml(r.id)}" data-bill-id="${b.id}">删除</a>
                      </div>`
                    : '—';
                  return [
                    `<span style="font-size:12px;color:var(--muted)">${escapeHtml(r.id)}</span>`,
                    escapeHtml(r.month),
                    `${escapeHtml(r.customer)}<br><span style="font-size:11px;color:var(--muted)">${escapeHtml(r.entity || '')}</span>`,
                    formatMoney(r.actual),
                    formatMoney(getRecordAllocatedCost(r)),
                    `<b style="color:var(--accent)">${formatMoney(r.claimed)}</b>`,
                    ops,
                  ];
                })
              )
            : `<div style="padding:8px 0;color:var(--muted);font-size:13px">
                暂未关联成本记录。点击右上角「新增成本单」，从成本管理或其他业务账单中选择并填写划拨金额。
              </div>`}

        </div>
      </div>

    </div>
  `;
}
