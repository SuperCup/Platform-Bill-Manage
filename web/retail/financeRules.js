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

