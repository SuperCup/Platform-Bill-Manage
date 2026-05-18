import { getSubTab, getQueryParams } from '../shared/router.js';
import { MarketingChangeRecordsPage } from './change-records.js';
import { MarketingProjectDetailPage } from './project-detail.js';

export function MarketingPage() {
  const tabKey = getSubTab('marketing', 'changeRecords');
  const q = getQueryParams();
  const hasProject = !!(q.get('mktProject') || '').trim();

  let body = '';
  if (tabKey === 'projectDetail' || (hasProject && tabKey !== 'changeRecords')) {
    body = MarketingProjectDetailPage();
  } else if (tabKey === 'changeRecords') {
    body = MarketingChangeRecordsPage();
  } else {
    body = MarketingChangeRecordsPage();
  }
  return `<div id="subpage">${body}</div>`;
}
