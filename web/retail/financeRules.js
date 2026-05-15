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

/** 成本归属月对应的财务入账截止日（YYYY-MM-DD） */
export function getFinanceEntryDeadline(month) {
  return DATA.retail.financeDeadlines?.[month] || null;
}

/** 是否已过该成本记录的入账截止时间（含已锁定） */
export function isPastFinanceEntryDeadline(record) {
  if (isRecordFinanceLocked(record)) return true;
  const deadline = getFinanceEntryDeadline(record?.month);
  if (!deadline) return false;
  const today = new Date('2026-05-15T12:00:00');
  const end = new Date(`${deadline}T23:59:59`);
  return today > end;
}

/** 成本记录已分配成本（归集项目维度；无项目时取已认领合计） */
export function getRecordAllocatedCost(record) {
  const projects = record?.allocDetail?.projects || [];
  if (projects.length) {
    return projects.reduce((s, p) => s + (p.amount || 0), 0);
  }
  return record?.claimed || 0;
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

