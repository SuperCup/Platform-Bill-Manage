import { getSubTab } from '../shared/router.js';
import { PmsInventoryPage } from './inventory.js';

export function PmsPage() {
  const tabKey = getSubTab('pms', 'inventory');
  const body = tabKey === 'inventory' ? PmsInventoryPage() : PmsInventoryPage();
  return `<div id="subpage">${body}</div>`;
}
