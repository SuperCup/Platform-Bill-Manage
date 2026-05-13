import { $ } from './shared/dom.js';
import { escapeHtml, formatMoney } from './shared/format.js';
import { closeModal, openModal, toast, callout, Table } from './shared/ui.js';
import { getRoute, getSubTab, getQueryParams } from './shared/router.js';
import { DATA } from './shared/data.js';
import { RetailPage } from './retail/page.js';
import { BizBillDetailHtml, getLinkedCostRecords, getExcelTotal } from './retail/bills.js';
import {
  appendCostChangeAudit,
  isRecordFinanceLocked,
  runBillSyncReconciliation,
} from './retail/financeRules.js';

// ── Modal close handlers ────────────────────────────────────────────────────
$('#modal-close').addEventListener('click', closeModal);
$('#modal-backdrop').addEventListener('click', (e) => {
  if (e.target === $('#modal-backdrop')) closeModal();
});

// ── Drawer open / close ─────────────────────────────────────────────────────
function openDrawer({ title, bodyHtml, actionsHtml = '' }) {
  document.getElementById('drawer-title').textContent = title ?? '详情';
  document.getElementById('drawer-body').innerHTML = bodyHtml ?? '';
  document.getElementById('drawer-actions').innerHTML = actionsHtml;
  const bd = document.getElementById('drawer-backdrop');
  bd.classList.remove('hidden');
  bd.setAttribute('aria-hidden', 'false');
}
function closeDrawer() {
  const bd = document.getElementById('drawer-backdrop');
  bd.classList.add('hidden');
  bd.setAttribute('aria-hidden', 'true');
  document.getElementById('drawer-body').innerHTML = '';
}

document.getElementById('drawer-close').addEventListener('click', closeDrawer);
document.getElementById('drawer-backdrop').addEventListener('click', (e) => {
  if (e.target === document.getElementById('drawer-backdrop')) closeDrawer();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    closeDrawer();
  }
});

// ── Routing ─────────────────────────────────────────────────────────────────
const ROUTES = {
  '/retail': RetailPage,
};

const SYSTEM_SWITCH = [
  { path: '/retail', href: '#/retail', label: '到家运营管理' },
];

const PAGE_MENUS = {
  '/retail': [
    { tab: 'costMgmt',    label: '成本管理' },
    { tab: 'records',     label: '分配记录' },
    { tab: 'projectCost', label: '项目成本' },
    { tab: 'bills',       label: '业务账单' },
    { tab: 'reconcile',   label: '结算核对' },
  ],
};

function scopeFromPath() { return 'retail'; }
function defaultTabForPath() { return 'costMgmt'; }

function render() {
  const h = window.location.hash || '';
  if (h === '#/arch' || h.startsWith('#/arch?')) {
    window.location.hash = h.replace(/^#\/arch/, '#/retail');
    return;
  }

  const rawPath = getRoute();
  const path = ROUTES[rawPath] ? rawPath : '/retail';

  const qStr = h.includes('?') ? h.slice(h.indexOf('?') + 1) : '';
  const p = new URLSearchParams(qStr);
  if (path === '/retail' && p.get('retailTab') === 'import') {
    p.set('retailTab', 'costMgmt');
    window.location.hash = `#/retail?${p.toString()}`;
    return;
  }

  const page = $('#page');
  page.innerHTML = ROUTES[path]();

  const sysNav = $('#sidenav-systems');
  if (sysNav) {
    sysNav.innerHTML = SYSTEM_SWITCH.map(
      (n) => `<a href="${n.href}" class="${path === n.path ? 'active' : ''}">${escapeHtml(n.label)}</a>`
    ).join('');
  }

  const scope = scopeFromPath(path);
  const activeTab = getSubTab(scope, defaultTabForPath(path));
  const sidenavHost = $('#sidenav-pages');
  const items = PAGE_MENUS[path] || [];
  sidenavHost.innerHTML = items
    .map(({ tab, label }) => {
      const qs = `${scope}Tab=${encodeURIComponent(tab)}`;
      const href = `#${path}?${qs}`;
      const isActive = activeTab === tab;
      return `<a class="sidenav-item${isActive ? ' active' : ''}" href="${href}">${escapeHtml(label)}</a>`;
    })
    .join('');
}

window.addEventListener('hashchange', render);
render();

// ── Global click delegation ─────────────────────────────────────────────────
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  if (!action) return;

  // ── 业务账单 ──────────────────────────────────────────────────────────────
  if (action === 'openBizBillDetail') {
    const billId = el.dataset.billId || '';
    const b = DATA.retail.bizBills.find(x => String(x.id) === billId);
    const isSynced = b && b.status === '已同步';
    const isEditing = b && b.status === '编辑中';
    openDrawer({
      title: '详情',
      bodyHtml: BizBillDetailHtml(billId),
      actionsHtml: `
        ${isSynced ? `<button class="btn" data-action="viewBizBillSettlement" data-bill-id="${escapeHtml(billId)}">明镜结算单</button>` : ''}
        ${isSynced ? `<button class="btn" data-action="bizBillCancel" data-bill-id="${escapeHtml(billId)}">撤销</button>` : ''}
        <button class="btn btn-primary" data-action="bizBillAddNew" data-bill-id="${escapeHtml(billId)}">追加新业务账单</button>
        <button class="btn btn-primary" data-action="bizBillChangeNew" data-bill-id="${escapeHtml(billId)}">变更成新业务账单</button>
        ${isEditing ? `<button class="btn btn-primary" data-action="bizBillSubmit" data-bill-id="${escapeHtml(billId)}">提交</button>` : ''}
        <button class="btn" data-action="bizBillRefresh" data-bill-id="${escapeHtml(billId)}">刷新</button>
      `,
    });
    return;
  }

  if (action === 'editBizBill') {
    const billId = el.dataset.billId || '';
    openDrawer({
      title: '详情',
      bodyHtml: BizBillDetailHtml(billId),
      actionsHtml: `
        <button class="btn btn-primary" data-action="saveBizBillEdit" data-bill-id="${escapeHtml(billId)}">保存</button>
        <button class="btn" data-action="closeDrawerBtn">取消</button>
      `,
    });
    return;
  }

  if (action === 'closeDrawerBtn') { closeDrawer(); return; }

  if (action === 'bizBillAntiCounterfeit') {
    toast('防伪', `账单 ${el.dataset.billId} 防伪核验（mock）。`);
    return;
  }
  if (action === 'bizBillSubmit') {
    const billId = Number(el.dataset.billId || '');
    const bizBill = DATA.retail.bizBills.find(b => b.id === billId);
    if (!bizBill) { toast('提示', '未找到业务账单。'); return; }

    const linkedRecords = getLinkedCostRecords(billId);
    const linkedTotal   = linkedRecords.reduce((s, r) => s + (r.claimed || 0), 0);
    const excelTotal    = getExcelTotal(bizBill);

    if (linkedRecords.length === 0) {
      openModal({
        title: '提交校验失败',
        bodyHtml: `
          <div class="callout callout-warning">
            <div class="callout-title">未关联成本记录</div>
            尚未为本业务账单关联任何成本记录。请在「成本管理」页面，对对应平台的成本记录点击「关联账单」并选择本账单，完成关联后再提交。
          </div>`,
        footerHtml: `<button class="btn" id="modal-submit-fail-close">知道了</button>`,
      });
      $('#modal-submit-fail-close').addEventListener('click', closeModal);
      return;
    }

    if (excelTotal <= 0) {
      openModal({
        title: '提交校验失败',
        bodyHtml: `
          <div class="callout callout-warning">
            <div class="callout-title">未上传 Excel 文件</div>
            Excel 补贴金额为 0，无法完成校验。请先上传 Excel 文件并保存数据后再提交。
          </div>`,
        footerHtml: `<button class="btn" id="modal-submit-fail-close2">知道了</button>`,
      });
      $('#modal-submit-fail-close2').addEventListener('click', closeModal);
      return;
    }

    if (Math.abs(linkedTotal - excelTotal) >= 0.01) {
      const linkedRows = linkedRecords.map(r => [
        escapeHtml(r.id), escapeHtml(r.month), escapeHtml(r.platform),
        escapeHtml(r.customer), escapeHtml(r.entity),
        `<b>${escapeHtml(formatMoney(r.claimed))}</b>`,
      ]);
      openModal({
        title: '提交校验失败 — 金额不一致',
        bodyHtml: `
          <div class="callout callout-danger" style="margin-bottom:12px">
            <div class="callout-title">Excel 补贴合计与关联成本合计不一致</div>
            提交前请核对 Excel 补贴金额或成本关联情况，确保两端合计完全吻合。
          </div>
          <div style="display:flex;gap:24px;margin-bottom:12px;font-size:13px;flex-wrap:wrap">
            <div>
              <div class="page-subtitle">Excel 补贴合计</div>
              <div style="font-size:20px;font-weight:700">${escapeHtml(formatMoney(excelTotal))}</div>
            </div>
            <div>
              <div class="page-subtitle">关联成本合计</div>
              <div style="font-size:20px;font-weight:700">${escapeHtml(formatMoney(linkedTotal))}</div>
            </div>
            <div>
              <div class="page-subtitle">差异金额</div>
              <div style="font-size:20px;font-weight:700;color:var(--danger)">${escapeHtml(formatMoney(Math.abs(linkedTotal - excelTotal)))}</div>
            </div>
          </div>
          <div class="page-subtitle" style="margin-bottom:6px">已关联成本明细（${linkedRecords.length} 条）</div>
          ${Table(['成本记录ID','月份','平台','客户','二级实体','分配金额'], linkedRows)}`,
        footerHtml: `<button class="btn" id="modal-submit-fail-close3">关闭</button>`,
      });
      $('#modal-submit-fail-close3').addEventListener('click', closeModal);
      return;
    }

    // ── 校验④：超报价检查 ──────────────────────────────────────────────
    const qg = bizBill.quoteGroup || {};
    const remainingQuote = qg.remainingAmount ?? null;
    const overQuote = remainingQuote !== null && excelTotal > remainingQuote;

    if (overQuote) {
      openModal({
        title: '⚠️ 本次结算金额超出剩余报价',
        bodyHtml: `
          <div class="callout callout-danger" style="margin-bottom:12px">
            <div class="callout-title">超报价，需追加报价后方可提交</div>
            本次 Excel 补贴合计超出该报价组剩余可用金额。请销售人员联系客户追加报价，审批通过后再提交。
          </div>
          <div style="display:flex;gap:24px;flex-wrap:wrap;font-size:13px;margin-bottom:12px">
            <div>
              <div class="page-subtitle">Excel 补贴合计</div>
              <div style="font-size:20px;font-weight:700;color:var(--danger)">${escapeHtml(formatMoney(excelTotal))}</div>
            </div>
            <div>
              <div class="page-subtitle">报价组剩余可用</div>
              <div style="font-size:20px;font-weight:700">${escapeHtml(formatMoney(remainingQuote))}</div>
            </div>
            <div>
              <div class="page-subtitle">超出金额</div>
              <div style="font-size:20px;font-weight:700;color:var(--danger)">${escapeHtml(formatMoney(excelTotal - remainingQuote))}</div>
            </div>
          </div>
          <div style="font-size:12px;color:var(--muted)">如客户已口头同意但追加报价单尚未生成，可勾选下方强制提交，系统将记录本次超出金额并生成销售待处理通知。</div>
          <label style="display:flex;align-items:center;gap:6px;margin-top:10px;cursor:pointer;font-size:13px">
            <input type="checkbox" id="force-overquote-confirm" />
            我已知晓超报价风险，强制提交并通知销售跟进追加报价
          </label>`,
        footerHtml: `
          <button class="btn" id="modal-overquote-cancel">取消</button>
          <button class="btn btn-danger" id="modal-overquote-ok" data-bill-id="${billId}">确认提交（超报价）</button>`,
      });
      $('#modal-overquote-cancel').addEventListener('click', closeModal);
      $('#modal-overquote-ok').addEventListener('click', () => {
        const checked = document.getElementById('force-overquote-confirm')?.checked;
        if (!checked) {
          const warn = document.getElementById('modal-overquote-warn');
          if (!warn) {
            const w = document.createElement('div');
            w.id = 'modal-overquote-warn';
            w.style.cssText = 'color:var(--danger);font-size:12px;margin-top:6px';
            w.textContent = '请先勾选确认后再提交。';
            document.getElementById('modal-overquote-ok').parentNode.prepend(w);
          }
          return;
        }
        const bObj = DATA.retail.bizBills.find(b => b.id === Number(el.dataset.billId));
        if (bObj) {
          bObj.status = '已同步';
          bObj._overQuoteFlag = true;
          bObj._overQuoteAmount = excelTotal - remainingQuote;
          runBillSyncReconciliation(bObj);
          // 生成超报价待办
          if (!Array.isArray(DATA.retail.reconciliationTasks)) DATA.retail.reconciliationTasks = [];
          DATA.retail.reconciliationTasks.unshift({
            id: `RK-OQ-${Date.now()}`,
            billId: bObj.id,
            severity: 'high',
            title: '超报价提交 — 请销售跟进追加报价',
            detail: `账单 ${bObj.id} 提交时 Excel 补贴 ${formatMoney(excelTotal)} 超出报价组剩余 ${formatMoney(remainingQuote)}，超出 ${formatMoney(excelTotal - remainingQuote)}。请销售联系客户补签追加报价单后关闭此待办。`,
            status: '待处理',
            createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
            recordIds: [],
          });
        }
        toast('已提交（超报价）', `账单 ${el.dataset.billId} 已提交，超出报价 ${formatMoney(excelTotal - remainingQuote)}，已生成销售待办。`);
        closeModal();
        closeDrawer();
        render();
      });
      return;
    }

    // 校验全部通过，正常提交
    bizBill.status = '已同步';
    runBillSyncReconciliation(bizBill);
    toast('提交成功', `账单 ${billId} 已提交，Excel 补贴 ${formatMoney(excelTotal)} 与关联成本一致（mock）。`);
    closeDrawer();
    render();
    return;
  }
  if (action === 'bizBillDelete') {
    toast('删除', `账单 ${el.dataset.billId} 已删除（mock）。`);
    closeDrawer();
    return;
  }
  if (action === 'saveBizBillEdit') {
    toast('保存', `账单 ${el.dataset.billId} 已保存（mock）。`);
    closeDrawer();
    return;
  }
  if (action === 'createBizBill') {
    toast('创建', '新建业务账单（mock）。');
    return;
  }
  if (action === 'viewBizBillSettlement') {
    toast('明镜结算单', `账单 ${el.dataset.billId}：查看明镜结算单（mock）。`);
    return;
  }
  if (action === 'bizBillCancel') {
    const billId = el.dataset.billId || '';
    openModal({
      title: '撤销业务账单',
      bodyHtml: `<div style="padding:8px 0;font-size:13px">确定要撤销账单 <b>${escapeHtml(billId)}</b> 吗？撤销后状态将变为"编辑中"。</div>`,
      footerHtml: `
        <button class="btn" id="modal-cancel-no">取消</button>
        <button class="btn btn-danger" id="modal-cancel-yes" data-bill-id="${escapeHtml(billId)}">确认撤销</button>`,
    });
    $('#modal-cancel-no').addEventListener('click', closeModal);
    $('#modal-cancel-yes').addEventListener('click', () => {
      const bid = Number(billId);
      const bObj = DATA.retail.bizBills.find(b => b.id === bid);
      if (bObj) { bObj.status = '编辑中'; bObj.canceller = '操作人'; bObj.cancelTime = new Date().toLocaleString('zh-CN'); }
      closeModal(); closeDrawer(); render();
      toast('已撤销', `账单 ${billId} 已撤销。`);
    });
    return;
  }
  if (action === 'bizBillAddNew') {
    toast('追加', `已追加新业务账单（以账单 ${el.dataset.billId} 为源，mock）。`);
    return;
  }
  if (action === 'bizBillChangeNew') {
    toast('变更', `已变更成新业务账单（以账单 ${el.dataset.billId} 为源，mock）。`);
    return;
  }
  if (action === 'bizBillRefresh') {
    const billId = el.dataset.billId || '';
    document.getElementById('drawer-body').innerHTML = BizBillDetailHtml(billId);
    toast('已刷新', `账单 ${billId} 已刷新。`);
    return;
  }
  if (action === 'bizBillReportCustoms') {
    toast('报关', `账单 ${el.dataset.billId}：报关操作（mock）。`);
    return;
  }
  if (action === 'refreshBizBillExcel' || action === 'refreshBizBillVoucher') {
    const label = action === 'refreshBizBillExcel' ? 'Excel文件' : '其他凭证';
    toast('刷新', `${label} 已刷新（mock）。`);
    return;
  }
  if (action === 'filterBizBillsApply') {
    const cust   = document.getElementById('bbf-cust')?.value?.trim()   || '';
    const proj   = document.getElementById('bbf-proj')?.value?.trim()   || '';
    const type   = document.getElementById('bbf-type')?.value           || '';
    const status = document.getElementById('bbf-status')?.value         || '';
    const name   = document.getElementById('bbf-name')?.value?.trim()   || '';
    const id     = document.getElementById('bbf-id')?.value?.trim()     || '';
    const pmsId  = document.getElementById('bbf-pms-id')?.value?.trim() || '';
    const p = new URLSearchParams();
    p.set('retailTab', 'bills');
    if (cust)   p.set('bbCust',   cust);
    if (proj)   p.set('bbProj',   proj);
    if (type)   p.set('bbType',   type);
    if (status) p.set('bbStatus', status);
    if (name)   p.set('bbName',   name);
    if (id)     p.set('bbId',     id);
    if (pmsId)  p.set('bbPmsId',  pmsId);
    window.location.hash = `#/retail?${p.toString()}`;
    return;
  }
  if (action === 'resetBizBillsFilter') {
    window.location.hash = '#/retail?retailTab=bills';
    return;
  }
  if (action === 'saveBizBillExcel' || action === 'uploadBizBillExcel') {
    const label = action === 'saveBizBillExcel' ? '保存数据' : '上传Excel';
    toast(label, `账单 ${el.dataset.billId}：${label}（mock）。`);
    return;
  }
  if (action === 'addBizBillVerify') {
    toast('新增', `账单 ${el.dataset.billId}：新增验证记录（mock）。`);
    return;
  }
  if (action === 'registerBizBillVerify') {
    toast('驻场注册', `账单 ${el.dataset.billId}：驻场注册（mock）。`);
    return;
  }

  // ── 成本管理 ──────────────────────────────────────────────────────────────
  if (action === 'openRetailAllocDetail') {
    const rid = el.dataset.recordId || '';
    const rec = DATA.retail.costRecords.find((r) => r.id === rid);
    if (!rec) { toast('提示', '未找到成本记录。'); return; }
    const ad = rec.allocDetail || { projects: [], bills: [] };
    const projects = ad.projects || [];
    const bills = ad.bills || [];
    const n = Math.max(projects.length, bills.length, 1);
    const rows = Array.from({ length: n }).map((_, i) => {
      const p = projects[i];
      const b = bills[i];
      const projCell = p?.projectId
        ? `<a class="link" data-action="openProject" data-project="${escapeHtml(p.projectId)}">${escapeHtml(p.projectId)}</a>`
        : '—';
      return [
        escapeHtml(b?.billId || '—'),
        escapeHtml(b?.billNo || b?.billId || '—'),
        projCell,
        escapeHtml(p?.projectName || '—'),
        escapeHtml(formatMoney(typeof p?.amount === 'number' ? p.amount : b?.amount || 0)),
        escapeHtml(b?.remark || '—'),
      ];
    });
    openModal({
      title: `分配明细 · ${escapeHtml(rec.entity)} · ${escapeHtml(rec.month)}`,
      bodyHtml: Table(['业务账单ID','业务账单名称','项目编号','项目名称','金额','备注'], rows),
      footerHtml: `<button class="btn" id="modal-alloc-detail-close">关闭</button>`,
    });
    $('#modal-alloc-detail-close').addEventListener('click', closeModal);
    return;
  }

  if (action === 'openRetailAllocate') {
    const rid = el.dataset.recordId || '';
    const rec = DATA.retail.costRecords.find(r => r.id === rid);
    if (!rec) { toast('提示', '未找到成本记录。'); return; }

    if (isRecordFinanceLocked(rec)) {
      const fin = DATA.retail.currentFinanceOperatingMonth || '—';
      openModal({
        title: '该成本行已财务锁定',
        bodyHtml: `
          <div class="callout callout-warning">
            <div class="callout-title">不可回溯修改已推送月</div>
            记录 ${escapeHtml(rec.id)}（${escapeHtml(rec.month)}）已参与财务归集并锁定。请前往「结算核对」查看待办；若与最新结算结果不一致，仅在财务入账月 <b>${escapeHtml(fin)}</b> 通过「当期成本调整」做红冲/补记，并保留依据链。
          </div>
          <div style="height:10px"></div>
          <button class="btn btn-primary" id="modal-goto-reconcile">打开结算核对</button>`,
        footerHtml: `<button class="btn" id="modal-lock-close">关闭</button>`,
      });
      $('#modal-lock-close').addEventListener('click', closeModal);
      $('#modal-goto-reconcile')?.addEventListener('click', () => {
        closeModal();
        window.location.hash = '#/retail?retailTab=reconcile';
        render();
      });
      return;
    }

    // 可选业务账单：同平台 + 编辑中（可继续归集成本）
    const availBills = DATA.retail.bizBills.filter(b =>
      (b.platform || '') === rec.platform && b.status === '编辑中'
    );

    const billOptions = availBills.map(b => {
      const otherLinked = DATA.retail.costRecords
        .filter(r => r.linkedBizBillId === b.id && r.id !== rid)
        .reduce((s, r) => s + r.claimed, 0);
      const selected = rec.linkedBizBillId === b.id ? ' selected' : '';
      const label = `${b.id} · ${b.customer} · ${b.start}~${b.end} · 报价:${formatMoney(b.quoteAmount)} · 已关联:${formatMoney(otherLinked)}`;
      return `<option value="${b.id}"${selected}>${escapeHtml(label)}</option>`;
    }).join('');

    const pending = rec.actual - rec.claimed;
    const isReLink = !!rec.linkedBizBillId;

    openModal({
      title: `关联业务账单 · ${escapeHtml(rec.entity)} · ${escapeHtml(rec.month)}`,
      bodyHtml: `
        <div class="callout callout-info" style="margin-bottom:12px">
          <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:13px">
            <span>月份：<b>${escapeHtml(rec.month)}</b></span>
            <span>平台：<b>${escapeHtml(rec.platform)}</b></span>
            <span>二级实体：<b>${escapeHtml(rec.entity)}</b></span>
            <span>实际成本：<b>${escapeHtml(formatMoney(rec.actual))}</b></span>
            <span style="color:var(--warning)">待分配：<b>${escapeHtml(formatMoney(pending > 0 ? pending : 0))}</b></span>
            ${isReLink ? `<span style="color:var(--accent)">当前关联：账单 <b>${rec.linkedBizBillId}</b>（重新关联将覆盖）</span>` : ''}
          </div>
        </div>

        <div style="margin-bottom:12px">
          <div class="page-subtitle" style="margin-bottom:5px">选择关联业务账单 <span style="color:var(--danger)">*</span></div>
          ${availBills.length > 0
            ? `<select class="select" id="rtl-alloc-bizbill" style="width:100%;min-width:0">
                 <option value="">— 请选择 —</option>${billOptions}
               </select>`
            : `<div class="callout callout-warning" style="font-size:12px">当前平台（${escapeHtml(rec.platform)}）暂无可关联的业务账单（仅显示状态为「编辑中」且平台一致的账单）。</div>`}
        </div>

        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span class="page-subtitle" style="flex-shrink:0;white-space:nowrap">分配金额 <span style="color:var(--danger)">*</span></span>
          <input class="input" type="number" id="rtl-alloc-bizbill-amt"
            value="${escapeHtml(String(rec.actual))}"
            min="0" max="${escapeHtml(String(rec.actual))}" step="0.01" style="width:160px" />
          <span class="page-subtitle">（实际成本：${escapeHtml(formatMoney(rec.actual))}）</span>
        </div>
        <div id="rtl-bizbill-warn" style="color:var(--danger);font-size:12px;margin-top:8px;display:none"></div>`,
      footerHtml: `
        <button class="btn" id="modal-rtlalloc-cancel">取消</button>
        <button class="btn btn-primary" id="modal-rtlalloc-ok" data-record-id="${escapeHtml(rid)}"
          ${availBills.length === 0 ? 'disabled' : ''}>确认关联</button>`,
    });
    $('#modal-rtlalloc-cancel').addEventListener('click', closeModal);

    $('#modal-rtlalloc-ok')?.addEventListener('click', () => {
      const record = DATA.retail.costRecords.find(r => r.id === rid);
      if (!record) { closeModal(); return; }

      const selectedId = Number(document.getElementById('rtl-alloc-bizbill')?.value);
      const allocAmt   = Number(document.getElementById('rtl-alloc-bizbill-amt')?.value || 0);
      const warnEl     = document.getElementById('rtl-bizbill-warn');

      if (!selectedId) {
        warnEl.style.display = 'block';
        warnEl.textContent = '请选择关联业务账单。';
        return;
      }
      if (allocAmt <= 0 || allocAmt > record.actual) {
        warnEl.style.display = 'block';
        warnEl.textContent = `分配金额需在 0 ~ ${formatMoney(record.actual)} 之间。`;
        return;
      }

      const bizBill = DATA.retail.bizBills.find(b => b.id === selectedId);
      if (!bizBill) { toast('提示', '未找到所选业务账单。'); return; }

      // 更新成本记录关联
      record.claimed          = allocAmt;
      record.linkedBizBillId  = selectedId;

      appendCostChangeAudit({
        recordId: record.id,
        action: '关联业务账单',
        detail: `认领 ${formatMoney(allocAmt)} → 账单 ${selectedId}`,
      });

      toast('关联成功',
        `成本记录 ${record.id}（${formatMoney(allocAmt)}）已关联至业务账单 ${selectedId}（mock）。`
      );
      closeModal();
      render();
    });
    return;
  }

  if (action === 'openProject') {
    const pid = el.dataset.project || '';
    openModal({
      title: `项目 ${pid}`,
      bodyHtml: `
        ${callout('info', '', '这是项目详情的前端占位。实际系统中 PMS 是项目报价/结算/开票的唯一事实来源。')}
        <div style="height:10px"></div>
        <div class="toolbar" style="gap:10px;flex-wrap:wrap">
          <div><div class="page-subtitle">项目编号</div><input class="input" value="${escapeHtml(pid)}"/></div>
          <div><div class="page-subtitle">报价金额</div><input class="input" value="（mock）" /></div>
          <div><div class="page-subtitle">已归集成本</div><input class="input" value="（mock）" /></div>
        </div>`,
      footerHtml: `<button class="btn" id="modal-close2">关闭</button>`,
    });
    $('#modal-close2').addEventListener('click', closeModal);
    return;
  }

  if (action === 'openFinanceLockHelp') {
    const rid = el.dataset.recordId || '';
    const rec = DATA.retail.costRecords.find((r) => r.id === rid);
    if (!rec) { toast('提示', '未找到成本记录。'); return; }
    const fin = DATA.retail.currentFinanceOperatingMonth || '—';
    openModal({
      title: '财务锁定说明',
      bodyHtml: `
        <div class="callout callout-info">
          <div class="callout-title">记录 ${escapeHtml(rec.id)}</div>
          该成本行已参与财务月归集并锁定。若业务账单结算后发现归属错误，请在「结算核对」处理待办，并在入账月 ${escapeHtml(fin)} 做当期调整；系统保留关联与调整全链路日志。
        </div>`,
      footerHtml: `<button class="btn" id="modal-flock-close">关闭</button>`,
    });
    $('#modal-flock-close').addEventListener('click', closeModal);
    return;
  }

  if (action === 'reconcileTaskDone') {
    const tid = el.dataset.taskId || '';
    const t = (DATA.retail.reconciliationTasks || []).find((x) => x.id === tid);
    if (!t) { toast('提示', '未找到待办记录。'); return; }
    const fin = DATA.retail.currentFinanceOperatingMonth || '—';
    openModal({
      title: '标记已办 — 填写调整依据',
      bodyHtml: `
        <div class="callout callout-info" style="margin-bottom:12px">
          <div class="callout-title">待办：${escapeHtml(t.title)}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:4px">${escapeHtml(t.detail)}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px">
          <div>
            <div class="page-subtitle" style="margin-bottom:4px">调整说明 <span style="color:var(--danger)">*</span></div>
            <textarea id="rk-done-reason" class="input" style="min-height:64px;width:100%;resize:vertical" placeholder="说明本次调整的原因，例如：结算项目与成本归集项目不一致，已在当期财务成本中做红冲+补记。"></textarea>
          </div>
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            <div style="flex:1;min-width:160px">
              <div class="page-subtitle" style="margin-bottom:4px">依据单号（结算单 / 业务账单 ID）</div>
              <input class="input" id="rk-done-ref" style="width:100%" placeholder="如：12102 / ST-2604-001" />
            </div>
            <div style="flex:1;min-width:120px">
              <div class="page-subtitle" style="margin-bottom:4px">财务入账月</div>
              <input class="input" id="rk-done-fin-month" value="${escapeHtml(fin)}" style="width:100%" />
            </div>
          </div>
          <div>
            <div class="page-subtitle" style="margin-bottom:4px">是否涉及金额变动</div>
            <div style="display:flex;gap:16px;align-items:center">
              <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:13px">
                <input type="radio" name="rk-amt-type" value="none" checked /> 无金额变动
              </label>
              <label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:13px">
                <input type="radio" name="rk-amt-type" value="yes" /> 有金额变动
              </label>
            </div>
            <div id="rk-amt-fields" style="display:none;margin-top:8px;display:flex;gap:12px;flex-wrap:wrap">
              <div>
                <div class="page-subtitle" style="margin-bottom:4px">调整金额</div>
                <input class="input" type="number" id="rk-done-amt" placeholder="0.00" step="0.01" />
              </div>
              <div>
                <div class="page-subtitle" style="margin-bottom:4px">方向</div>
                <select class="select" id="rk-done-dir">
                  <option value="add">+ 增加成本</option>
                  <option value="sub">- 减少成本（红冲）</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        <div id="rk-done-err" style="color:var(--danger);font-size:12px;margin-top:8px;display:none"></div>`,
      footerHtml: `
        <button class="btn" id="modal-rk-cancel">取消</button>
        <button class="btn btn-primary" id="modal-rk-submit" data-task-id="${escapeHtml(tid)}">确认已办</button>`,
    });

    // 金额变动切换显示
    document.querySelectorAll('input[name="rk-amt-type"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const show = document.querySelector('input[name="rk-amt-type"]:checked')?.value === 'yes';
        const fields = document.getElementById('rk-amt-fields');
        if (fields) fields.style.display = show ? 'flex' : 'none';
      });
    });

    $('#modal-rk-cancel').addEventListener('click', closeModal);
    $('#modal-rk-submit').addEventListener('click', () => {
      const reason = document.getElementById('rk-done-reason')?.value?.trim();
      const errEl = document.getElementById('rk-done-err');
      if (!reason) {
        errEl.style.display = 'block';
        errEl.textContent = '请填写调整说明。';
        return;
      }
      const ref = document.getElementById('rk-done-ref')?.value?.trim() || '';
      const finMonth = document.getElementById('rk-done-fin-month')?.value?.trim() || fin;
      const amtType = document.querySelector('input[name="rk-amt-type"]:checked')?.value || 'none';
      const amt = amtType === 'yes' ? Number(document.getElementById('rk-done-amt')?.value || 0) : 0;
      const dir = document.getElementById('rk-done-dir')?.value || 'add';
      const amtDetail = amtType === 'yes' && amt > 0
        ? `；金额变动：${dir === 'add' ? '+' : '-'}${formatMoney(amt)}`
        : '';

      t.status = '已办';
      t.doneAt = new Date().toLocaleString('zh-CN', { hour12: false });
      t.doneReason = reason;
      t.doneRef = ref;

      appendCostChangeAudit({
        recordId: t.recordIds?.join('、') || tid,
        action: '待办已办（调整依据）',
        detail: `待办 ${tid}：${reason}${ref ? `；依据：${ref}` : ''}${amtDetail}`,
        operator: '当前用户',
      });
      if (!t.financePeriod) t.financePeriod = finMonth;

      toast('已办', `待办 ${tid} 已处理并留痕。`);
      closeModal();
      render();
    });
    return;
  }

  if (action === 'openAllocation') {
    window.location.hash = '#/retail?retailTab=allocation';
    toast('成本分配', `打开分配：${el.dataset.entity || ''}`);
    return;
  }

  if (action === 'saveDraft') { toast('已保存', '已保存草稿（mock）。'); return; }
  if (action === 'submitAggregate') { toast('已提交', '已提交分配并归集（mock）。'); return; }
  if (action === 'adjustAllocation') {
    const fin = DATA.retail.currentFinanceOperatingMonth || '—';
    openModal({
      title: '调整分配（财务口径）',
      bodyHtml: `
        <div class="callout callout-warning">
          <div class="callout-title">禁止跨月回溯已推送归集</div>
          若需更正历史月已入账成本，不可直接改财务历史表；请在财务入账月 ${escapeHtml(fin)} 发起「当期成本调整」，填写依据（结算单号 / 业务账单 ID / 错配说明），由财务在当期汇总中体现差额。
        </div>
        <div style="height:10px"></div>
        <div class="page-subtitle">记录：${escapeHtml(el.dataset.id || '—')}</div>`,
      footerHtml: `
        <button class="btn" id="modal-adj-close">关闭</button>
        <button class="btn btn-primary" id="modal-adj-goto">前往结算核对</button>`,
    });
    $('#modal-adj-close').addEventListener('click', closeModal);
    $('#modal-adj-goto')?.addEventListener('click', () => {
      closeModal();
      window.location.hash = '#/retail?retailTab=reconcile';
      render();
    });
    return;
  }

  if (action === 'filterRetailCost') {
    const month = document.getElementById('rtl-cost-month')?.value?.trim() || '';
    const cust  = document.getElementById('rtl-cost-cust')?.value?.trim()  || '';
    const p = new URLSearchParams();
    p.set('retailTab', 'costMgmt');
    const plat = getQueryParams().get('retailCostPlatform') || DATA.retail.costPlatforms[0];
    p.set('retailCostPlatform', plat);
    if (month) p.set('retailCostMonth', month);
    if (cust)  p.set('retailCostCust', cust);
    window.location.hash = `#/retail?${p.toString()}`;
    return;
  }

  if (action === 'resetRetailCost') {
    const plat = getQueryParams().get('retailCostPlatform') || DATA.retail.costPlatforms[0];
    window.location.hash = `#/retail?retailTab=costMgmt&retailCostPlatform=${encodeURIComponent(plat)}`;
    return;
  }

  // ── 成本管理：分配项目 ────────────────────────────────────────────────────
  if (action === 'allocCostToProject') {
    const rid = el.dataset.recordId || '';
    const rec = DATA.retail.costRecords.find(r => r.id === rid);
    if (!rec) { toast('提示', '未找到成本记录。'); return; }

    // 同平台的所有业务账单（不限状态，方便跨状态选取）
    const candidateBills = DATA.retail.bizBills.filter(b => (b.platform || '') === rec.platform);
    // 已选账单初始状态：读取已有 allocDetail.bills
    const existBills = rec.allocDetail?.bills || [];

    // 渲染账单行
    const billRows = candidateBills.map(b => {
      const exist  = existBills.find(eb => eb.billId === b.id);
      const checked = exist ? 'checked' : '';
      const defAmt  = exist?.amount ?? '';
      const shortName = (b.name || '').length > 32 ? (b.name || '').slice(0, 32) + '…' : (b.name || '');
      // 报价组已用 / 剩余
      const qg = b.quoteGroup || {};
      const remaining = qg.remainingAmount != null ? formatMoney(qg.remainingAmount) : '—';
      return `
        <tr>
          <td style="text-align:center">
            <input type="checkbox" class="ap-bill-chk" data-bill-id="${b.id}" ${checked} />
          </td>
          <td><b>${escapeHtml(String(b.id))}</b></td>
          <td style="font-size:12px" title="${escapeHtml(b.name || '')}">${escapeHtml(shortName)}</td>
          <td><a class="link" style="font-size:12px" data-action="openProject" data-project="${escapeHtml(b.project || '')}">${escapeHtml(b.project || '—')}</a></td>
          <td style="font-size:12px">${escapeHtml(b.customer || '')}</td>
          <td style="font-size:12px">${escapeHtml(b.start || '')}~${escapeHtml(b.end || '')}</td>
          <td style="font-size:12px;color:var(--muted)">${escapeHtml(remaining)}</td>
          <td>
            <input type="number" class="input ap-bill-amt" data-bill-id="${b.id}"
              style="width:100px;min-width:80px" min="0" step="0.01" placeholder="0.00"
              value="${escapeHtml(String(defAmt))}" ${checked ? '' : 'disabled'} />
          </td>
        </tr>`;
    }).join('');

    openModal({
      title: `分配至业务账单 · ${escapeHtml(rec.entity)} · ${escapeHtml(rec.month)}`,
      bodyHtml: `
        <div class="callout callout-info" style="margin-bottom:10px">
          <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:13px">
            <span>月份：<b>${escapeHtml(rec.month)}</b></span>
            <span>平台：<b>${escapeHtml(rec.platform)}</b></span>
            <span>客户：<b>${escapeHtml(rec.customer)}</b></span>
            <span>实际成本：<b>${escapeHtml(formatMoney(rec.actual))}</b></span>
          </div>
        </div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:8px">
          勾选业务账单并输入分配金额，系统将根据账单归属项目自动匹配归集项目。支持同时向多笔账单分配。
        </div>
        ${candidateBills.length ? `
          <div class="table-wrap" style="max-height:320px;overflow-y:auto">
            <table>
              <thead>
                <tr>
                  <th></th><th>账单ID</th><th>账单名称</th><th>归属项目</th>
                  <th>客户</th><th>账期</th><th>报价剩余</th><th>分配金额</th>
                </tr>
              </thead>
              <tbody id="ap-bill-tbody">${billRows}</tbody>
            </table>
          </div>
          <div style="margin-top:10px;display:flex;gap:20px;align-items:center;font-size:13px">
            <span>合计分配：<b id="ap-total-sum">¥0.00</b></span>
            <span style="color:var(--muted)">实际成本：<b>${escapeHtml(formatMoney(rec.actual))}</b></span>
            <span id="ap-diff-label" style="color:var(--warning)"></span>
          </div>` : `
          <div class="callout callout-warning" style="font-size:12px">
            当前平台（${escapeHtml(rec.platform)}）暂无可用业务账单。请先在「业务账单」中创建对应账单后再分配。
          </div>`}
        <div id="ap-err" style="color:var(--danger);font-size:12px;margin-top:8px;display:none"></div>`,
      footerHtml: `
        <button class="btn" id="modal-ap-cancel">取消</button>
        <button class="btn btn-primary" id="modal-ap-ok" ${!candidateBills.length ? 'disabled' : ''}>确认分配</button>`,
    });

    // ── 勾选联动：勾选时启用金额输入，取消时禁用并清零
    function refreshTotal() {
      let sum = 0;
      document.querySelectorAll('.ap-bill-chk:checked').forEach(chk => {
        const amt = Number(document.querySelector(`.ap-bill-amt[data-bill-id="${chk.dataset.billId}"]`)?.value || 0);
        sum += amt;
      });
      const sumEl  = document.getElementById('ap-total-sum');
      const diffEl = document.getElementById('ap-diff-label');
      if (sumEl) sumEl.textContent = formatMoney(sum);
      if (diffEl) {
        const diff = rec.actual - sum;
        diffEl.textContent = diff === 0 ? '✓ 金额一致' : diff > 0 ? `剩余未分配：${formatMoney(diff)}` : `超出：${formatMoney(-diff)}`;
        diffEl.style.color = diff === 0 ? 'var(--success)' : diff > 0 ? 'var(--warning)' : 'var(--danger)';
      }
    }

    document.querySelectorAll('.ap-bill-chk').forEach(chk => {
      chk.addEventListener('change', () => {
        const amtInput = document.querySelector(`.ap-bill-amt[data-bill-id="${chk.dataset.billId}"]`);
        if (amtInput) {
          amtInput.disabled = !chk.checked;
          if (!chk.checked) amtInput.value = '';
        }
        refreshTotal();
      });
    });
    document.querySelectorAll('.ap-bill-amt').forEach(inp => {
      inp.addEventListener('input', refreshTotal);
    });
    refreshTotal();

    $('#modal-ap-cancel').addEventListener('click', closeModal);
    $('#modal-ap-ok')?.addEventListener('click', () => {
      const errEl = document.getElementById('ap-err');
      errEl.style.display = 'none';

      // 收集已勾选的账单与金额
      const selections = [];
      document.querySelectorAll('.ap-bill-chk:checked').forEach(chk => {
        const bid = Number(chk.dataset.billId);
        const amt = Number(document.querySelector(`.ap-bill-amt[data-bill-id="${bid}"]`)?.value || 0);
        const bill = DATA.retail.bizBills.find(b => b.id === bid);
        if (bill) selections.push({ bill, amt });
      });

      if (!selections.length) {
        errEl.style.display = 'block'; errEl.textContent = '请至少勾选一笔业务账单。'; return;
      }
      const hasZero = selections.some(s => s.amt <= 0);
      if (hasZero) {
        errEl.style.display = 'block'; errEl.textContent = '已勾选账单的分配金额必须大于 0。'; return;
      }
      const totalSel = selections.reduce((s, x) => s + x.amt, 0);
      if (totalSel > rec.actual + 0.01) {
        errEl.style.display = 'block';
        errEl.textContent = `合计分配 ${formatMoney(totalSel)} 超出实际成本 ${formatMoney(rec.actual)}，请调整。`;
        return;
      }

      // ── 写回数据 ──
      if (!rec.allocDetail) rec.allocDetail = { projects: [], bills: [] };

      // 更新 allocDetail.bills
      rec.allocDetail.bills = selections.map(s => ({
        billId:  s.bill.id,
        billNo:  s.bill.name || String(s.bill.id),
        period:  rec.month,
        amount:  s.amt,
        remark:  `分配至账单 ${s.bill.id}`,
      }));

      // 按项目汇总 → 更新 allocDetail.projects（同一项目合并金额）
      const projAmtMap = new Map();
      for (const s of selections) {
        const pid  = s.bill.project || '';
        const pms  = DATA.pms?.projects?.find(p => p.id === pid);
        const pname= pms?.name || pid;
        if (!projAmtMap.has(pid)) projAmtMap.set(pid, { projectId: pid, projectName: pname, amount: 0 });
        projAmtMap.get(pid).amount += s.amt;
      }
      rec.allocDetail.projects = [...projAmtMap.values()];

      // 更新 claimed = 合计分配金额
      rec.claimed = totalSel;
      // linkedBizBillId = 首笔账单（向后兼容）
      rec.linkedBizBillId = selections[0].bill.id;

      const detail = selections
        .map(s => `${formatMoney(s.amt)} → 账单 ${s.bill.id}（项目 ${s.bill.project || '—'}）`)
        .join('；');
      appendCostChangeAudit({ recordId: rec.id, action: '分配至业务账单', detail });

      toast('分配成功', `${rec.id} 已向 ${selections.length} 笔账单分配，合计 ${formatMoney(totalSel)}。`);
      closeModal();
      render();
    });
    return;
  }

  // ── 项目成本追踪筛选 ────────────────────────────────────────────────────────
  if (action === 'filterProjectCost') {
    const proj  = document.getElementById('pc-proj')?.value?.trim()  || '';
    const cust  = document.getElementById('pc-cust')?.value?.trim()  || '';
    const month = document.getElementById('pc-month')?.value         || '';
    const p = new URLSearchParams();
    p.set('retailTab', 'projectCost');
    if (proj)  p.set('pcProj',  proj);
    if (cust)  p.set('pcCust',  cust);
    if (month) p.set('pcMonth', month);
    window.location.hash = `#/retail?${p.toString()}`;
    return;
  }
  if (action === 'resetProjectCost') {
    window.location.hash = '#/retail?retailTab=projectCost';
    return;
  }

  // ── 成本分配：「加载」按钮 ─────────────────────────────────────────────────
  if (action === 'loadAllocation') {
    const month    = document.getElementById('alloc-month')?.value    || '';
    const platform = document.getElementById('alloc-platform')?.value || '';
    const cust     = document.getElementById('alloc-cust')?.value     || '';
    const entity   = document.getElementById('alloc-entity')?.value   || '';
    if (!month || !platform || !cust || !entity) {
      toast('提示', '请先选择月份、平台、客户和二级实体。');
      return;
    }
    const p = new URLSearchParams();
    p.set('retailTab', 'allocation');
    p.set('allocMonth',    month);
    p.set('allocPlatform', platform);
    p.set('allocCust',     cust);
    p.set('allocEntity',   entity);
    window.location.hash = `#/retail?${p.toString()}`;
    return;
  }

  // ── 分配记录筛选 ───────────────────────────────────────────────────────────
  if (action === 'filterAllocationRecords') {
    const month    = document.getElementById('rec-month')?.value   || '';
    const platform = document.getElementById('rec-plat')?.value    || '';
    const status   = document.getElementById('rec-status')?.value  || '';
    const p = new URLSearchParams();
    p.set('retailTab', 'records');
    if (month)    p.set('recMonth',  month);
    if (platform) p.set('recPlat',   platform);
    if (status)   p.set('recStatus', status);
    window.location.hash = `#/retail?${p.toString()}`;
    return;
  }

  if (action === 'resetAllocationRecords') {
    window.location.hash = '#/retail?retailTab=records';
    return;
  }

  if (action === 'exportAllocationRecords') {
    toast('导出', '分配记录已导出（mock，实际由后端生成 CSV/Excel）。');
    return;
  }

});

