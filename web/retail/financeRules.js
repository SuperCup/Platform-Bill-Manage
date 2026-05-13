import { DATA } from '../shared/data.js';

/** 成本记录上归集主项目（首条 projects） */
export function getPrimaryProjectId(record) {
  const list = record?.allocDetail?.projects || [];
  return list[0]?.projectId || '';
}

/** 已推送财务的历史口径，禁止在来源月直接改关联/金额 */
export function isRecordFinanceLocked(record) {
  return record?.financeLineStatus === 'locked';
}

export function currentFinanceOperatingMonth() {
  return DATA.retail.currentFinanceOperatingMonth || '2026-05';
}

export function appendCostChangeAudit({ recordId, action, detail, operator = '当前用户' }) {
  if (!DATA.retail.costChangeAudit) DATA.retail.costChangeAudit = [];
  DATA.retail.costChangeAudit.unshift({
    id: `AUD-${Date.now()}`,
    time: new Date().toLocaleString('zh-CN', { hour12: false }),
    operator,
    recordId,
    action,
    financePeriod: currentFinanceOperatingMonth(),
    detail,
  });
}

/**
 * 业务账单「已同步」后：对照结算项目 vs 成本归集项目，生成待办（避免结算后无人调整成本侧）。
 */
export function runBillSyncReconciliation(bill) {
  if (!bill) return;
  if (!Array.isArray(DATA.retail.reconciliationTasks)) DATA.retail.reconciliationTasks = [];
  const linked = DATA.retail.costRecords.filter((r) => r.linkedBizBillId === bill.id);
  if (!linked.length) return;

  const settleProj = bill.project || '';
  const mismatches = [];
  const missingProj = [];
  for (const r of linked) {
    const p = getPrimaryProjectId(r);
    if (!p) missingProj.push(r.id);
    else if (settleProj && p !== settleProj) mismatches.push({ recordId: r.id, costProject: p });
  }

  const ts = new Date().toLocaleString('zh-CN', { hour12: false });
  const fin = currentFinanceOperatingMonth();

  if (mismatches.length) {
    DATA.retail.reconciliationTasks.unshift({
      id: `RK-${Date.now()}-P`,
      billId: bill.id,
      severity: 'high',
      title: '结算项目与成本归集项目不一致（账单同步触发）',
      detail: `账单项目 ${settleProj}；成本归集不一致：${mismatches.map((m) => `${m.recordId}→${m.costProject}`).join('；')}。请在财务入账月 ${fin} 通过「当期调整」处理，禁止回溯修改已推送历史月。`,
      status: '待处理',
      createdAt: ts,
      recordIds: mismatches.map((m) => m.recordId),
    });
  }
  if (missingProj.length) {
    DATA.retail.reconciliationTasks.unshift({
      id: `RK-${Date.now()}-M`,
      billId: bill.id,
      severity: 'medium',
      title: '已关联成本未配置归集项目',
      detail: `记录 ${missingProj.join('、')} 缺少归集项目。请补全 allocDetail.projects 或解除关联后重新归集。`,
      status: '待处理',
      createdAt: ts,
      recordIds: missingProj,
    });
  }
}
