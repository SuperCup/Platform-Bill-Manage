import { $ } from './shared/dom.js';
import { escapeHtml, formatMoney } from './shared/format.js';
import { closeModal, openModal, toast, callout, Table } from './shared/ui.js';
import { getRoute, getSubTab, getQueryParams } from './shared/router.js';
import { DATA } from './shared/data.js';
import { RetailPage, mergeRetailCostQuery } from './retail/page.js';
import {
  BizBillDetailHtml,
  getLinkedCostRecords,
  getLinkedCostTotal,
  getExcelTotal,
  getCostSourcesForBillAdd,
  getBillSourcesForCostAdd,
  costTransferableMax,
  billIdEq,
  customerMatches,
  ALLOWED_BIZ_CUSTOMERS,
} from './retail/bills.js';
import {
  appendCostChangeAudit,
  isRecordFinanceLocked,
  isPastFinanceEntryDeadline,
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

// ── 人工转入成本：弹窗登记 / 编辑 / 凭证（内存 DataURL，刷新丢失）────────────
const RTL_MC_MAX_FILE_BYTES = 2 * 1024 * 1024;
const RTL_MC_MAX_FILES = 5;
const RTL_MANUAL_COST_TYPES = ['平台账单', '风控账单', '其他'];

function manualCostMonthSource(plat, extraMonth) {
  const s = new Set(DATA.retail.costRecords.map((r) => r.month));
  for (const e of DATA.retail.manualTransferCosts || []) {
    if (e.platform === plat && e.month) s.add(e.month);
  }
  if (extraMonth) s.add(extraMonth);
  const mq = getQueryParams().get('rtlManualMonth')?.trim();
  if (mq) s.add(mq);
  return [...s].sort().reverse();
}

function readNewManualVoucherFiles(fileInput) {
  const files = fileInput?.files ? [...fileInput.files] : [];
  if (files.length > RTL_MC_MAX_FILES) {
    return Promise.reject(new Error(`单次最多选择 ${RTL_MC_MAX_FILES} 个凭证文件。`));
  }
  return Promise.all(
    files.map(
      (f) =>
        new Promise((resolve, reject) => {
          if (f.size > RTL_MC_MAX_FILE_BYTES) {
            reject(new Error(`「${f.name}」超过 2MB 单文件上限，请压缩或拆分后上传。`));
            return;
          }
          const r = new FileReader();
          r.onload = () =>
            resolve({
              name: f.name,
              mime: f.type || 'application/octet-stream',
              size: f.size,
              dataUrl: String(r.result || ''),
              uploadedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
            });
          r.onerror = () => reject(new Error(`读取「${f.name}」失败。`));
          r.readAsDataURL(f);
        })
    )
  );
}

function manualTypesOptionsHtml(selected) {
  return RTL_MANUAL_COST_TYPES.map(
    (t) => `<option value="${escapeHtml(t)}"${t === selected ? ' selected' : ''}>${escapeHtml(t)}</option>`
  ).join('');
}

function projectOptionsHtml(selectedId) {
  return (DATA.pms?.projects || [])
    .map((proj) => {
      const label = `${proj.id} · ${proj.name}`;
      const sel = proj.id === selectedId ? ' selected' : '';
      return `<option value="${escapeHtml(proj.id)}"${sel}>${escapeHtml(label)}</option>`;
    })
    .join('');
}

function manualCustomerOptionsHtml(selected) {
  return ALLOWED_BIZ_CUSTOMERS.map(
    (c) => `<option value="${escapeHtml(c)}"${c === selected ? ' selected' : ''}>${escapeHtml(c)}</option>`
  ).join('');
}

function manualEntityDatalistHtml(plat, customer) {
  const entities = [
    ...new Set(
      DATA.retail.costRecords
        .filter((r) => r.platform === plat && customerMatches(r.customer, customer))
        .map((r) => r.entity)
        .filter(Boolean)
    ),
  ];
  return entities.map((e) => `<option value="${escapeHtml(e)}">`).join('');
}

function buildRtlManualCostModalBody({ plat, entry, months }) {
  const isEdit = !!entry;
  const monthVal = entry?.month || months[0] || getQueryParams().get('rtlManualMonth')?.trim() || '';
  const amtVal = entry != null && entry.amount != null ? String(entry.amount) : '';
  const costType = entry?.costType || '平台账单';
  const projectId = entry?.projectId || '';
  const customer = entry?.customer || ALLOWED_BIZ_CUSTOMERS[0] || '';
  const entity = entry?.entity || '';
  const remark = entry?.remark ?? '';
  const vouchers = entry?.vouchers || [];

  const monthControl =
    months.length > 0
      ? `<select class="select" id="rtl-mc-month" style="width:100%">
          ${months
            .map(
              (m) =>
                `<option value="${escapeHtml(m)}"${m === monthVal ? ' selected' : ''}>${escapeHtml(m)}</option>`
            )
            .join('')}
        </select>`
      : `<input class="input" id="rtl-mc-month" placeholder="YYYY-MM，例如 2026-05" value="${escapeHtml(monthVal)}" style="width:100%" />`;

  const existingVoucherHtml =
    isEdit && vouchers.length
      ? `<div class="page-subtitle" style="margin:10px 0 6px">已有凭证（取消勾选表示删除）</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:4px">
          ${vouchers
            .map(
              (v, i) => `
            <label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer;font-size:13px;line-height:1.4">
              <input type="checkbox" class="rtl-mc-keep-v" data-idx="${i}" checked style="margin-top:3px;flex-shrink:0" />
              <span>${escapeHtml(v.name)} <span style="color:var(--muted);font-size:12px">(${v.dataUrl ? '可预览' : '演示数据无文件体'})</span></span>
            </label>`
            )
            .join('')}
        </div>`
      : '';

  const fileLabel = isEdit ? '新增凭证（可选）' : '账单凭证';
  const fileHint = isEdit
    ? '保存时须至少保留一条已有凭证，或上传至少一份新凭证（可与保留项并存）。'
    : '须上传至少一份与本次转入相关的账单或截图。';

  return `
    <div class="callout callout-info" style="margin-bottom:12px;font-size:13px">
      <div class="callout-title">凭证与留痕</div>
      登记与修改均写入本条记录的「编辑日志」，并追加一条成本审计（costChangeAudit）。凭证文件以 DataURL 暂存在浏览器内存，刷新页面即丢失。
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div style="grid-column:1/-1">
        <div class="page-subtitle" style="margin-bottom:4px">平台</div>
        <input class="input" readonly value="${escapeHtml(plat)}" style="width:100%;background:#f1f5f9;color:var(--muted)" />
      </div>
      <div style="grid-column:1/-1">
        <div class="page-subtitle" style="margin-bottom:4px">归属月 <span style="color:var(--danger)">*</span></div>
        ${monthControl}
      </div>
      <div>
        <div class="page-subtitle" style="margin-bottom:4px">客户名称 <span style="color:var(--danger)">*</span></div>
        <select class="select" id="rtl-mc-customer" style="width:100%">${manualCustomerOptionsHtml(customer)}</select>
      </div>
      <div>
        <div class="page-subtitle" style="margin-bottom:4px">二级实体 <span style="color:var(--danger)">*</span></div>
        <input class="input" id="rtl-mc-entity" list="rtl-mc-entity-list" value="${escapeHtml(entity)}" placeholder="与自动化成本二级实体一致" style="width:100%" />
        <datalist id="rtl-mc-entity-list">${manualEntityDatalistHtml(plat, customer)}</datalist>
      </div>
      <div>
        <div class="page-subtitle" style="margin-bottom:4px">成本金额（元） <span style="color:var(--danger)">*</span></div>
        <input class="input" id="rtl-mc-amt" type="number" min="0" step="0.01" value="${escapeHtml(amtVal)}" style="width:100%" />
      </div>
      <div>
        <div class="page-subtitle" style="margin-bottom:4px">成本类型 <span style="color:var(--danger)">*</span></div>
        <select class="select" id="rtl-mc-type" style="width:100%">${manualTypesOptionsHtml(costType)}</select>
      </div>
      <div style="grid-column:1/-1">
        <div class="page-subtitle" style="margin-bottom:4px">关联项目 <span style="color:var(--danger)">*</span></div>
        <select class="select" id="rtl-mc-project" style="width:100%">
          <option value="">— 请选择 —</option>
          ${projectOptionsHtml(projectId)}
        </select>
      </div>
      <div style="grid-column:1/-1">
        <div class="page-subtitle" style="margin-bottom:4px">备注</div>
        <textarea class="input" id="rtl-mc-remark" rows="2" style="width:100%;resize:vertical;min-height:56px;line-height:1.45" placeholder="选填：内部说明、单号、对接人等">${escapeHtml(remark)}</textarea>
      </div>
    </div>
    ${existingVoucherHtml}
    <div style="margin-top:12px">
      <div class="page-subtitle" style="margin-bottom:4px">${fileLabel}${isEdit ? '' : ' <span style="color:var(--danger)">*</span>'}</div>
      <input type="file" id="rtl-mc-files" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp,application/pdf" />
      <div style="font-size:12px;color:var(--muted);margin-top:6px;line-height:1.45">
        最多 ${RTL_MC_MAX_FILES} 个文件，单文件不超过 2MB。${fileHint}
      </div>
    </div>
    <div id="rtl-mc-err" style="display:none;color:var(--danger);font-size:13px;margin-top:10px"></div>
  `;
}

function summarizeRtlManualEdit(before, after, prevVoucherLen, keptLen, newFileLen) {
  const parts = [];
  if (before.month !== after.month) parts.push(`归属月 ${before.month} → ${after.month}`);
  if (Number(before.amount) !== Number(after.amount)) {
    parts.push(`金额 ${formatMoney(Number(before.amount))} → ${formatMoney(Number(after.amount))}`);
  }
  if (before.costType !== after.costType) parts.push(`成本类型 ${before.costType} → ${after.costType}`);
  if (before.projectId !== after.projectId) parts.push(`关联项目 ${before.projectId} → ${after.projectId}`);
  if (before.customer !== after.customer) parts.push(`客户 ${before.customer} → ${after.customer}`);
  if (before.entity !== after.entity) parts.push(`二级实体 ${before.entity} → ${after.entity}`);
  if ((before.remark || '') !== (after.remark || '')) {
    parts.push(`备注「${before.remark || '（空）'}」→「${after.remark || '（空）'}」`);
  }
  if (keptLen !== prevVoucherLen || newFileLen > 0) {
    parts.push(`凭证 ${prevVoucherLen} 份 → 保存后 ${keptLen + newFileLen} 份${newFileLen ? `（本次新增 ${newFileLen} 份）` : ''}`);
  }
  return parts.join('；');
}

function openRtlManualCostModalFromClick(hostEl) {
  const recordId = (hostEl.dataset.manualId || '').trim();
  const platFromUrl = getQueryParams().get('retailCostPlatform') || DATA.retail.costPlatforms[0];
  const entry = recordId ? DATA.retail.manualTransferCosts.find((m) => m.id === recordId) : null;
  if (recordId && !entry) {
    toast('提示', '未找到该人工转入记录。');
    return;
  }
  const plat = entry?.platform ?? platFromUrl;
  const months = manualCostMonthSource(plat, entry?.month);
  const isEdit = !!entry;

  openModal({
    title: isEdit ? `编辑人工转入 · ${entry.id}` : '登记人工转入成本',
    bodyHtml: buildRtlManualCostModalBody({ plat, entry, months }),
    footerHtml: `
      <button type="button" class="btn" id="rtl-mc-cancel">取消</button>
      <button type="button" class="btn btn-primary" id="rtl-mc-submit">${isEdit ? '保存修改' : '确认登记'}</button>`,
  });

  const showMcErr = (msg) => {
    const el = document.getElementById('rtl-mc-err');
    if (el) {
      el.style.display = 'block';
      el.textContent = msg;
    }
  };

  document.getElementById('rtl-mc-cancel')?.addEventListener('click', closeModal);

  document.getElementById('rtl-mc-submit')?.addEventListener('click', async () => {
    const elErr = document.getElementById('rtl-mc-err');
    if (elErr) {
      elErr.style.display = 'none';
      elErr.textContent = '';
    }

    const monthEl = document.getElementById('rtl-mc-month');
    const month = (monthEl?.tagName === 'SELECT' ? monthEl.value : monthEl?.value)?.trim() || '';
    const amt = Number(document.getElementById('rtl-mc-amt')?.value || 0);
    const costType = document.getElementById('rtl-mc-type')?.value || '';
    const projectId = document.getElementById('rtl-mc-project')?.value?.trim() || '';
    const remark = document.getElementById('rtl-mc-remark')?.value?.trim() || '';
    const customer = document.getElementById('rtl-mc-customer')?.value?.trim() || '';
    const entity = document.getElementById('rtl-mc-entity')?.value?.trim() || '';

    if (!/^\d{4}-\d{2}$/.test(month)) {
      showMcErr('归属月须为 YYYY-MM 格式。');
      return;
    }
    if (!RTL_MANUAL_COST_TYPES.includes(costType)) {
      showMcErr('请选择成本类型。');
      return;
    }
    if (!projectId) {
      showMcErr('请选择关联项目。');
      return;
    }
    if (!ALLOWED_BIZ_CUSTOMERS.includes(customer)) {
      showMcErr('请选择客户名称。');
      return;
    }
    if (!entity) {
      showMcErr('请填写二级实体。');
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      showMcErr('请输入大于 0 的成本金额。');
      return;
    }

    let newVouchers;
    try {
      newVouchers = await readNewManualVoucherFiles(document.getElementById('rtl-mc-files'));
    } catch (err) {
      showMcErr(err?.message || String(err));
      return;
    }

    if (!Array.isArray(DATA.retail.manualTransferCosts)) DATA.retail.manualTransferCosts = [];

    if (isEdit) {
      const prevList = entry.vouchers || [];
      const kept = [];
      document.querySelectorAll('.rtl-mc-keep-v:checked').forEach((cb) => {
        const i = Number(cb.dataset.idx);
        if (!Number.isFinite(i)) return;
        const v = prevList[i];
        if (v) kept.push({ ...v });
      });
      const merged = [...kept, ...newVouchers];
      if (merged.length === 0) {
        showMcErr('请至少保留一条已有凭证，或上传新的账单凭证。');
        return;
      }

      const before = {
        month: entry.month,
        amount: entry.amount,
        costType: entry.costType,
        projectId: entry.projectId,
        customer: entry.customer || '',
        entity: entry.entity || '',
        remark: entry.remark || '',
      };
      const after = { month, amount: amt, costType, projectId, customer, entity, remark };
      const summary = summarizeRtlManualEdit(
        before,
        after,
        prevList.length,
        kept.length,
        newVouchers.length
      );
      if (!summary) {
        showMcErr('未检测到任何修改，无需保存。');
        return;
      }

      const nowStr = new Date().toLocaleString('zh-CN', { hour12: false });
      entry.month = month;
      entry.amount = amt;
      entry.costType = costType;
      entry.projectId = projectId;
      entry.customer = customer;
      entry.entity = entity;
      entry.remark = remark;
      entry.vouchers = merged;
      entry.updatedAt = nowStr;
      if (!Array.isArray(entry.editLogs)) entry.editLogs = [];
      entry.editLogs.push({
        time: new Date().toLocaleString('zh-CN', { hour12: false }),
        operator: '当前用户',
        summary,
      });

      appendCostChangeAudit({
        recordId: entry.id,
        action: '人工转入成本-编辑',
        detail: summary,
      });
      toast('已保存', `已更新 ${entry.id}，并写入编辑日志。`);
      closeModal();
      window.location.hash = mergeRetailCostQuery({ retailCostView: 'manual', rtlManualPage: '' });
      render();
      return;
    }

    if (newVouchers.length === 0) {
      showMcErr('请上传至少一份账单凭证。');
      return;
    }

    const id = `MAN-${Date.now()}`;
    const nowStr = new Date().toLocaleString('zh-CN', { hour12: false });
    DATA.retail.manualTransferCosts.unshift({
      id,
      platform: plat,
      month,
      customer,
      entity,
      amount: amt,
      costType,
      projectId,
      remark,
      vouchers: newVouchers,
      editLogs: [],
      operator: '当前用户',
      createdAt: nowStr,
      updatedAt: nowStr,
    });
    appendCostChangeAudit({
      recordId: id,
      action: '人工转入成本',
      detail: `${plat} · ${customer} · ${entity} · ${month} · ${formatMoney(amt)} · ${costType} → ${projectId}；凭证 ${newVouchers.length} 个`,
    });
    toast('已登记', `已在 ${plat} 登记 ${month} 人工转入成本 ${formatMoney(amt)}。`);
    closeModal();
    window.location.hash = mergeRetailCostQuery({ retailCostView: 'manual', rtlManualPage: '' });
    render();
  });
}

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
    { tab: 'projectCost', label: '项目成本' },
    { tab: 'bills',       label: '业务账单' },
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
  if (path === '/retail' && ['records', 'reconcile'].includes(p.get('retailTab') || '')) {
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
            尚未为本业务账单关联任何成本记录。请在「成本管理」页面，在对应成本行的「业务账单」列点击「选择业务账单」并选择本账单，完成关联后再提交。
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
        }
        toast('已提交（超报价）', `账单 ${el.dataset.billId} 已提交，超出报价 ${formatMoney(excelTotal - remainingQuote)}，已记录超报价标记，请销售跟进追加报价。`);
        closeModal();
        closeDrawer();
        render();
      });
      return;
    }

    // 校验全部通过，正常提交
    bizBill.status = '已同步';
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
  if (action === 'syncFromPms' || action === 'createBizBill') {
    toast('PMS 同步', '已从 PMS 拉取最新业务账单（mock）。本系统不支持单独创建账单，请通过 PMS 维护后同步。');
    render();
    return;
  }
  if (action === 'refreshBizBillsList') {
    render();
    toast('已刷新', '业务账单列表已更新。');
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
  if (action === 'bizBillReportCustoms' || action === 'bizBillReport') {
    toast('报表', `账单 ${el.dataset.billId}：导出报表（mock）。`);
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
            记录 ${escapeHtml(rec.id)}（${escapeHtml(rec.month)}）已参与财务归集并锁定。若与最新结算结果不一致，仅在财务入账月 <b>${escapeHtml(fin)}</b> 通过「当期成本调整」做红冲/补记，并保留依据链。
          </div>`,
        footerHtml: `<button class="btn" id="modal-lock-close">关闭</button>`,
      });
      $('#modal-lock-close').addEventListener('click', closeModal);
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

  // ── 业务账单详情：新增成本单（两种来源：成本管理 / 其他业务账单） ──────────────
  if (action === 'openBillCostAdd') {
    const billId = Number(el.dataset.billId || '');
    const bizBill = DATA.retail.bizBills.find(b => b.id === billId);
    if (!bizBill) { toast('提示', '未找到业务账单。'); return; }
    if (bizBill.status === '已同步') { toast('提示', '账单已提交，不可修改关联。'); return; }

    const costSrcRecords = getCostSourcesForBillAdd(bizBill, billId);

    const costRowsHtml = costSrcRecords.length > 0 ? costSrcRecords.map((r) => {
      const maxAmt = costTransferableMax(r, billId);
      const linkedOther = billIdEq(r.linkedBizBillId, billId)
        ? `本单已关联 ${formatMoney(r.claimed)}，可追加`
        : r.linkedBizBillId
          ? `已关联账单 ${r.linkedBizBillId}（${formatMoney(r.claimed)}）`
          : '未关联';
      return `<tr>
        <td style="padding:6px 8px;font-size:12px;color:var(--muted)">${escapeHtml(r.id)}</td>
        <td style="padding:6px 8px">${escapeHtml(r.month)}</td>
        <td style="padding:6px 8px">${escapeHtml(r.platform)}</td>
        <td style="padding:6px 8px">${escapeHtml(r.customer)}<br><span style="font-size:11px;color:var(--muted)">${escapeHtml(r.entity || '')}</span></td>
        <td style="padding:6px 8px;text-align:right">${escapeHtml(formatMoney(r.actual))}</td>
        <td style="padding:6px 8px;font-size:12px;color:var(--muted)">${escapeHtml(linkedOther)}</td>
        <td style="padding:6px 8px;text-align:right;font-weight:600;color:var(--success)">${escapeHtml(formatMoney(maxAmt))}</td>
        <td style="padding:6px 8px">
          <input type="number" class="input bca-cost-amt" data-rec-id="${escapeHtml(r.id)}"
            min="0" max="${maxAmt}" step="0.01" style="width:110px" placeholder="划拨金额" />
        </td>
      </tr>`;
    }).join('') : `<tr><td colspan="8" style="padding:12px;color:var(--muted)">该客户（${escapeHtml(bizBill.customer)}）下暂无可选成本单；可试账单 <b>12075</b>、<b>12110</b>（康师傅方便面）</td></tr>`;

    const billSrcBills = getBillSourcesForCostAdd(bizBill, billId).map((b) => ({
      bill: b,
      costTotal: getLinkedCostTotal(b.id),
    }));

    const billRowsHtml = billSrcBills.length > 0 ? billSrcBills.map(({ bill: sb, costTotal }) => {
      const shortName = sb.name.length > 40 ? sb.name.slice(0, 40) + '…' : sb.name;
      return `<tr>
        <td style="padding:6px 8px;font-size:12px;color:var(--muted)">${sb.id}</td>
        <td style="padding:6px 8px" title="${escapeHtml(sb.name)}">${escapeHtml(shortName)}</td>
        <td style="padding:6px 8px">${escapeHtml(sb.start)} ~ ${escapeHtml(sb.end)}</td>
        <td style="padding:6px 8px;text-align:right;font-weight:600;color:var(--success)">${escapeHtml(formatMoney(costTotal))}</td>
        <td style="padding:6px 8px">
          <input type="number" class="input bca-bill-amt" data-src-bill-id="${sb.id}"
            min="0" max="${costTotal}" step="0.01" style="width:110px" placeholder="划拨金额" />
        </td>
      </tr>`;
    }).join('') : `<tr><td colspan="5" style="padding:12px;color:var(--muted)">该客户下暂无符合条件的其他业务账单</td></tr>`;

    const tabStyle = (active) => `padding:8px 14px;cursor:pointer;font-size:13px;border:none;background:none;border-bottom:2px solid ${active ? 'var(--accent)' : 'transparent'};color:${active ? 'var(--accent)' : 'var(--muted)'};font-weight:${active ? '600' : '400'};`;

    openModal({
      title: `新增成本单 · 账单 ${billId}（${escapeHtml(bizBill.customer)}）· 可选成本 ${costSrcRecords.length} 条 / 账单 ${billSrcBills.length} 张`,
      bodyHtml: `
        <div style="display:flex;border-bottom:1px solid var(--border);margin-bottom:12px">
          <button type="button" class="bca-tab" data-bca-tab="cost" style="${tabStyle(true)}">从成本管理选择</button>
          <button type="button" class="bca-tab" data-bca-tab="bill" style="${tabStyle(false)}">从业务账单选择</button>
        </div>
        <div id="bca-panel-cost">
          <div class="callout callout-info" style="margin-bottom:10px;font-size:13px">
            <div class="callout-title">从成本管理选择</div>
            列出当前客户下可划拨的成本单（未财务锁定）。填写「划拨金额」后确认，成本单将关联到本账单。
          </div>
          <div class="table-wrap" style="max-height:300px;overflow-y:auto">
            <table>
              <thead><tr><th>记录</th><th>月份</th><th>平台</th><th>客户·实体</th><th>实际成本</th><th>当前关联</th><th>可划拨</th><th>划拨金额</th></tr></thead>
              <tbody>${costRowsHtml}</tbody>
            </table>
          </div>
        </div>
        <div id="bca-panel-bill" style="display:none">
          <div class="callout callout-info" style="margin-bottom:10px;font-size:13px">
            <div class="callout-title">从业务账单选择</div>
            列出同客户（${escapeHtml(bizBill.customer)}）、未同步且有关联成本的其他业务账单。填写划拨金额后，系统将从对应账单的关联成本中转移至本账单。
          </div>
          <div class="table-wrap" style="max-height:300px;overflow-y:auto">
            <table>
              <thead><tr><th>账单ID</th><th>账单名称</th><th>账期</th><th>可划拨金额</th><th>划拨金额</th></tr></thead>
              <tbody>${billRowsHtml}</tbody>
            </table>
          </div>
        </div>
        <div id="bca-err" style="display:none;color:var(--danger);font-size:13px;margin-top:10px"></div>`,
      footerHtml: `
        <button class="btn" id="bca-cancel">取消</button>
        <button class="btn btn-primary" id="bca-ok">确认新增</button>`,
    });

    // tab 切换
    document.querySelectorAll('.bca-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.bcaTab;
        document.getElementById('bca-panel-cost').style.display = tab === 'cost' ? '' : 'none';
        document.getElementById('bca-panel-bill').style.display = tab === 'bill' ? '' : 'none';
        document.querySelectorAll('.bca-tab').forEach(b => {
          const a = b.dataset.bcaTab === tab;
          b.style.borderBottom = `2px solid ${a ? 'var(--accent)' : 'transparent'}`;
          b.style.color = a ? 'var(--accent)' : 'var(--muted)';
          b.style.fontWeight = a ? '600' : '400';
        });
      });
    });

    document.getElementById('bca-cancel')?.addEventListener('click', closeModal);

    document.getElementById('bca-ok')?.addEventListener('click', () => {
      const errEl = document.getElementById('bca-err');
      if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
      const showErr = (msg) => { if (errEl) { errEl.style.display = 'block'; errEl.textContent = msg; } };

      // 判断当前激活 tab
      const costPanelVisible = document.getElementById('bca-panel-cost')?.style.display !== 'none';

      if (costPanelVisible) {
        // 从成本管理新增
        const toLink = [];
        for (const inp of document.querySelectorAll('.bca-cost-amt')) {
          const val = inp.value.trim();
          if (!val) continue;
          const amt = Number(val);
          const recId = inp.dataset.recId;
          const rec = DATA.retail.costRecords.find(r => r.id === recId);
          if (!rec) continue;
          if (!Number.isFinite(amt) || amt <= 0) { showErr(`记录 ${recId} 划拨金额须大于 0。`); return; }
          const maxAmt = costTransferableMax(rec, billId);
          if (amt > maxAmt + 0.01) {
            showErr(`记录 ${recId} 划拨金额不可超过可划拨上限 ${formatMoney(maxAmt)}。`);
            return;
          }
          toLink.push({ rec, amt });
        }
        if (toLink.length === 0) { showErr('请至少填写一条成本记录的划拨金额。'); return; }
        for (const { rec, amt } of toLink) {
          if (billIdEq(rec.linkedBizBillId, billId)) {
            rec.claimed = (rec.claimed || 0) + amt;
          } else {
            rec.claimed = amt;
            rec.linkedBizBillId = billId;
          }
          appendCostChangeAudit({ recordId: rec.id, action: '新增成本关联', detail: `从成本管理划拨 ${formatMoney(amt)} → 账单 ${billId}` });
        }
        toast('新增成功', `已从成本管理划拨 ${toLink.length} 条记录至账单 ${billId}。`);
      } else {
        // 从业务账单新增
        const toTransfer = [];
        for (const inp of document.querySelectorAll('.bca-bill-amt')) {
          const val = inp.value.trim();
          if (!val) continue;
          const amt = Number(val);
          const srcBillId = Number(inp.dataset.srcBillId);
          const srcBill = DATA.retail.bizBills.find(b => b.id === srcBillId);
          if (!srcBill) continue;
          if (!Number.isFinite(amt) || amt <= 0) { showErr(`账单 ${srcBillId} 划拨金额须大于 0。`); return; }
          const srcTotal = getLinkedCostTotal(srcBillId);
          if (amt > srcTotal) { showErr(`账单 ${srcBillId} 划拨金额（${formatMoney(amt)}）超过可划拨合计（${formatMoney(srcTotal)}）。`); return; }
          toTransfer.push({ srcBillId, amt });
        }
        if (toTransfer.length === 0) { showErr('请至少填写一张业务账单的划拨金额。'); return; }
        for (const { srcBillId, amt } of toTransfer) {
          // 从源账单关联的成本记录中按顺序减掉 amt，并将首条整体或拆分转给当前账单
          let remaining = amt;
          const srcRecords = getLinkedCostRecords(srcBillId).filter(r => !isRecordFinanceLocked(r));
          for (const r of srcRecords) {
            if (remaining <= 0) break;
            const take = Math.min(r.claimed, remaining);
            r.claimed -= take;
            remaining -= take;
            appendCostChangeAudit({ recordId: r.id, action: '跨账单成本转移（源）', detail: `从账单 ${srcBillId} 转出 ${formatMoney(take)} → 账单 ${billId}` });
            if (r.claimed <= 0.001) { r.claimed = 0; r.linkedBizBillId = billId; }
          }
          // 若已有同来源的已清零记录，将其链接到当前账单
          const freed = srcRecords.find(r => r.linkedBizBillId === billId && r.claimed > 0);
          if (!freed) {
            // 找一条已清零的同来源记录改链
            const zeroed = srcRecords.find(r => r.claimed === 0 && r.linkedBizBillId === billId);
            if (!zeroed) {
              // 创建一个标记：用首条已转出的记录
              const first = srcRecords[0];
              if (first && first.claimed === 0) { first.claimed = amt; first.linkedBizBillId = billId; }
            }
          }
          appendCostChangeAudit({ recordId: `BILL-${srcBillId}`, action: '跨账单成本转移（目标）', detail: `接收来自账单 ${srcBillId} 的 ${formatMoney(amt)} → 账单 ${billId}` });
        }
        toast('划拨成功', `已从 ${toTransfer.length} 张业务账单划拨成本至账单 ${billId}。`);
      }
      closeModal();
      document.getElementById('drawer-body').innerHTML = BizBillDetailHtml(String(billId));
      render();
    });
    return;
  }

  // ── 业务账单详情：引导式差额调整（转入 / 转出） ─────────────────────────────
  if (action === 'openBillCostAdjust') {
    const billId = Number(el.dataset.billId || '');
    const bizBill = DATA.retail.bizBills.find(b => b.id === billId);
    if (!bizBill || bizBill.status === '已同步') { toast('提示', '账单已提交或未找到，不可调整。'); return; }

    const linked = getLinkedCostRecords(billId);
    const ltotal = linked.reduce((s, r) => s + r.claimed, 0);
    const etotal = getExcelTotal(bizBill);
    const dAmt = ltotal - etotal; // >0 excess, <0 shortage
    if (Math.abs(dAmt) < 0.01) { toast('提示', '当前金额已匹配，无需调整。'); return; }

    const isExcess = dAmt > 0;
    const diffLabel = formatMoney(Math.abs(dAmt));

    if (isExcess) {
      // 转出：减少已关联成本记录的认领金额
      const adjustable = linked.filter(r => !isRecordFinanceLocked(r));
      const rowsHtml = adjustable.map(r => `<tr>
        <td style="padding:6px 10px;font-size:12px;color:var(--muted)">${escapeHtml(r.id)}</td>
        <td style="padding:6px 10px">${escapeHtml(r.month)}</td>
        <td style="padding:6px 10px">${escapeHtml(r.customer)}<br><span style="font-size:11px;color:var(--muted)">${escapeHtml(r.entity || '')}</span></td>
        <td style="padding:6px 10px;text-align:right"><b>${escapeHtml(formatMoney(r.claimed))}</b></td>
        <td style="padding:6px 10px">
          <input type="number" class="input adj-out-input" data-rec-id="${escapeHtml(r.id)}"
            min="0" max="${r.claimed}" step="0.01" style="width:120px" placeholder="释放金额" />
        </td>
      </tr>`).join('');
      const lockedNote = linked.filter(r => isRecordFinanceLocked(r)).length > 0
        ? `<div class="callout callout-info" style="margin-top:10px;font-size:12px">
            <div class="callout-title">已锁定记录不可调整</div>
            部分成本记录已财务锁定，请在财务入账月（${escapeHtml(DATA.retail.currentFinanceOperatingMonth || '—')}）做当期调整分录。
           </div>`
        : '';
      openModal({
        title: `调整差额（转出）· 账单 ${billId}`,
        bodyHtml: `
          <div class="callout callout-warning" style="margin-bottom:12px;font-size:13px">
            <div class="callout-title">成本超出 ${diffLabel}，需要释放</div>
            已关联成本 <b>${formatMoney(ltotal)}</b>，凭证要求 <b>${formatMoney(etotal)}</b>。
            需将 <b>${diffLabel}</b> 从已关联的成本记录中释放（减少认领金额），释放后该部分变为"未关联"，可重新分配给其他账单。
          </div>
          <div class="table-wrap" style="max-height:280px;overflow-y:auto">
            <table>
              <thead><tr><th>记录</th><th>月份</th><th>客户·实体</th><th>当前认领</th><th>释放金额</th></tr></thead>
              <tbody>${rowsHtml || '<tr><td colspan="5" style="padding:12px;color:var(--muted)">无可调整记录（已全部锁定）</td></tr>'}</tbody>
            </table>
          </div>
          <div style="margin-top:10px;font-size:13px">释放合计：<b id="adj-out-sum">${formatMoney(0)}</b> / 需释放 <b>${diffLabel}</b></div>
          ${lockedNote}
          <div id="adj-out-err" style="display:none;color:var(--danger);font-size:13px;margin-top:8px"></div>`,
        footerHtml: `
          <button class="btn" id="adj-out-cancel">取消</button>
          <button class="btn btn-warning" id="adj-out-ok">确认释放</button>`,
      });
      document.querySelectorAll('.adj-out-input').forEach(inp => {
        inp.addEventListener('input', () => {
          const s = [...document.querySelectorAll('.adj-out-input')].reduce((acc, i) => acc + (Number(i.value) || 0), 0);
          const sumEl = document.getElementById('adj-out-sum');
          if (sumEl) sumEl.textContent = formatMoney(s);
        });
      });
      document.getElementById('adj-out-cancel')?.addEventListener('click', closeModal);
      document.getElementById('adj-out-ok')?.addEventListener('click', () => {
        const errEl = document.getElementById('adj-out-err');
        if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
        const toAdjust = [];
        let sum = 0;
        for (const inp of document.querySelectorAll('.adj-out-input')) {
          const val = inp.value.trim();
          if (!val) continue;
          const amt = Number(val);
          const recId = inp.dataset.recId;
          const rec = DATA.retail.costRecords.find(r => r.id === recId);
          if (!rec) continue;
          if (!Number.isFinite(amt) || amt <= 0) {
            if (errEl) { errEl.style.display = 'block'; errEl.textContent = `记录 ${recId} 释放金额须大于 0。`; }
            return;
          }
          if (amt > rec.claimed) {
            if (errEl) { errEl.style.display = 'block'; errEl.textContent = `记录 ${recId} 释放金额不可超过当前认领额 ${formatMoney(rec.claimed)}。`; }
            return;
          }
          sum += amt;
          toAdjust.push({ rec, amt });
        }
        if (toAdjust.length === 0) {
          if (errEl) { errEl.style.display = 'block'; errEl.textContent = '请至少填写一条成本记录的释放金额。'; }
          return;
        }
        if (Math.abs(sum - Math.abs(dAmt)) > 0.01) {
          if (errEl) { errEl.style.display = 'block'; errEl.textContent = `释放合计 ${formatMoney(sum)} 与需释放 ${diffLabel} 不符，请核对。`; }
          return;
        }
        for (const { rec, amt } of toAdjust) {
          const newClaimed = rec.claimed - amt;
          appendCostChangeAudit({ recordId: rec.id, action: '成本转出', detail: `从账单 ${billId} 释放 ${formatMoney(amt)}，认领 ${formatMoney(rec.claimed)} → ${formatMoney(newClaimed)}` });
          rec.claimed = newClaimed;
          if (rec.claimed <= 0.001) { rec.claimed = 0; rec.linkedBizBillId = null; }
        }
        toast('已释放', `已从 ${toAdjust.length} 条成本记录共释放 ${formatMoney(sum)}。`);
        closeModal();
        document.getElementById('drawer-body').innerHTML = BizBillDetailHtml(String(billId));
        render();
      });
    } else {
      // 转入：从可用成本单中补入认领金额
      const needed = Math.abs(dAmt);
      const available = DATA.retail.costRecords.filter(r =>
        r.platform === bizBill.platform && !isRecordFinanceLocked(r) && r.linkedBizBillId !== billId && r.actual > 0
      );
      const rowsHtml = available.map(r => {
        const isFree = !r.linkedBizBillId;
        const tagHtml = isFree
          ? `<span class="pill pill-success" style="font-size:11px">未关联</span>`
          : `<span class="pill pill-neutral" style="font-size:11px">关联账单 ${r.linkedBizBillId}</span>`;
        return `<tr>
          <td style="padding:6px 10px;font-size:12px;color:var(--muted)">${escapeHtml(r.id)}</td>
          <td style="padding:6px 10px">${escapeHtml(r.month)}</td>
          <td style="padding:6px 10px">${escapeHtml(r.customer)}<br><span style="font-size:11px;color:var(--muted)">${escapeHtml(r.entity || '')}</span></td>
          <td style="padding:6px 10px;text-align:right">${escapeHtml(formatMoney(r.actual))}</td>
          <td style="padding:6px 10px">${tagHtml}</td>
          <td style="padding:6px 10px">
            <input type="number" class="input adj-in-input" data-rec-id="${escapeHtml(r.id)}"
              min="0" max="${r.actual}" step="0.01" style="width:120px" placeholder="转入金额" />
          </td>
        </tr>`;
      }).join('');
      openModal({
        title: `调整差额（转入）· 账单 ${billId}`,
        bodyHtml: `
          <div class="callout callout-warning" style="margin-bottom:12px;font-size:13px">
            <div class="callout-title">成本不足 ${diffLabel}，需要补入</div>
            凭证要求 <b>${formatMoney(etotal)}</b>，当前关联成本 <b>${formatMoney(ltotal)}</b>。
            需从下方成本单再认领 <b>${diffLabel}</b>。填写「转入金额」后，所选成本单对应金额将认领并关联到本账单。<br>
            <span style="color:var(--muted)">未关联的成本单直接认领；已关联其他账单的成本单须与对方账单协商后借调。</span>
          </div>
          <div class="table-wrap" style="max-height:300px;overflow-y:auto">
            <table>
              <thead><tr><th>记录</th><th>月份</th><th>客户·实体</th><th>实际成本</th><th>状态</th><th>转入金额</th></tr></thead>
              <tbody>${rowsHtml || '<tr><td colspan="6" style="padding:12px;color:var(--muted)">当前平台无其他可用成本单</td></tr>'}</tbody>
            </table>
          </div>
          <div style="margin-top:10px;font-size:13px">转入合计：<b id="adj-in-sum">${formatMoney(0)}</b> / 需补入 <b>${diffLabel}</b></div>
          <div id="adj-in-err" style="display:none;color:var(--danger);font-size:13px;margin-top:8px"></div>`,
        footerHtml: `
          <button class="btn" id="adj-in-cancel">取消</button>
          <button class="btn btn-primary" id="adj-in-ok">确认转入</button>`,
      });
      document.querySelectorAll('.adj-in-input').forEach(inp => {
        inp.addEventListener('input', () => {
          const s = [...document.querySelectorAll('.adj-in-input')].reduce((acc, i) => acc + (Number(i.value) || 0), 0);
          const sumEl = document.getElementById('adj-in-sum');
          if (sumEl) sumEl.textContent = formatMoney(s);
        });
      });
      document.getElementById('adj-in-cancel')?.addEventListener('click', closeModal);
      document.getElementById('adj-in-ok')?.addEventListener('click', () => {
        const errEl = document.getElementById('adj-in-err');
        if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
        const toAdjust = [];
        let sum = 0;
        for (const inp of document.querySelectorAll('.adj-in-input')) {
          const val = inp.value.trim();
          if (!val) continue;
          const amt = Number(val);
          const recId = inp.dataset.recId;
          const rec = DATA.retail.costRecords.find(r => r.id === recId);
          if (!rec) continue;
          if (!Number.isFinite(amt) || amt <= 0) {
            if (errEl) { errEl.style.display = 'block'; errEl.textContent = `记录 ${recId} 转入金额须大于 0。`; }
            return;
          }
          if (amt > rec.actual) {
            if (errEl) { errEl.style.display = 'block'; errEl.textContent = `记录 ${recId} 转入金额不可超过实际成本 ${formatMoney(rec.actual)}。`; }
            return;
          }
          sum += amt;
          toAdjust.push({ rec, amt });
        }
        if (toAdjust.length === 0) {
          if (errEl) { errEl.style.display = 'block'; errEl.textContent = '请至少填写一条成本记录的转入金额。'; }
          return;
        }
        if (Math.abs(sum - needed) > 0.01) {
          if (errEl) { errEl.style.display = 'block'; errEl.textContent = `转入合计 ${formatMoney(sum)} 与需补入 ${diffLabel} 不符，请核对。`; }
          return;
        }
        for (const { rec, amt } of toAdjust) {
          appendCostChangeAudit({ recordId: rec.id, action: '成本转入', detail: `转入账单 ${billId}：认领 ${formatMoney(amt)}${rec.linkedBizBillId ? `（从账单 ${rec.linkedBizBillId} 借调）` : ''}` });
          rec.claimed = amt;
          rec.linkedBizBillId = billId;
        }
        toast('已转入', `已从 ${toAdjust.length} 条成本记录共转入 ${formatMoney(sum)}。`);
        closeModal();
        document.getElementById('drawer-body').innerHTML = BizBillDetailHtml(String(billId));
        render();
      });
    }
    return;
  }

  // ── 业务账单详情：删除成本关联 ───────────────────────────────────────────────
  if (action === 'rtlBillDeleteCost' || action === 'rtlBillUnlinkCost') {
    const recId = el.dataset.recordId || '';
    const billId = Number(el.dataset.billId || '');
    const rec = DATA.retail.costRecords.find(r => r.id === recId);
    if (!rec) { toast('提示', '未找到成本记录。'); return; }
    const bizBill = DATA.retail.bizBills.find(b => b.id === billId);
    if (bizBill?.status === '已同步') { toast('提示', '账单已提交，不可删除关联。'); return; }
    if (isPastFinanceEntryDeadline(rec)) {
      const fin = rec.pushedToFinanceMonth || rec.month || '—';
      openModal({
        title: '无法删除成本关联',
        bodyHtml: `<div class="callout callout-warning" style="font-size:13px;line-height:1.7">
          已过该成本入账时间（归属月 <b>${escapeHtml(rec.month || '—')}</b>${rec.pushedToFinanceMonth ? `，已推送财务月 <b>${escapeHtml(fin)}</b>` : ''}），无法直接删除。<br><br>
          请通过「修改」将本单关联金额<strong>转出</strong>到可承接成本的业务账单；转出完成后系统将自动解除本条成本记录与本账单的关联。
        </div>`,
        footerHtml: `<button class="btn btn-primary" id="del-cost-blocked-ok">知道了</button>`,
      });
      document.getElementById('del-cost-blocked-ok')?.addEventListener('click', closeModal);
      return;
    }
    openModal({
      title: '删除成本关联',
      bodyHtml: `<div style="font-size:13px;line-height:1.6;padding:4px 0">
        确定删除成本记录 <b>${escapeHtml(recId)}</b>（本单关联额 ${escapeHtml(formatMoney(rec.claimed))}）与账单 <b>${billId}</b> 的关联吗？<br>
        删除后该成本记录变为「未关联」状态，关联金额归零，可重新分配给其他账单。
      </div>`,
      footerHtml: `
        <button class="btn" id="del-cost-cancel">取消</button>
        <button class="btn btn-danger" id="del-cost-ok">确认删除</button>`,
    });
    $('#del-cost-cancel').addEventListener('click', closeModal);
    document.getElementById('del-cost-ok')?.addEventListener('click', () => {
      appendCostChangeAudit({ recordId: recId, action: '删除成本关联', detail: `从账单 ${billId} 删除，关联额 ${formatMoney(rec.claimed)} 归零` });
      rec.claimed = 0;
      rec.linkedBizBillId = null;
      toast('已删除', `成本记录 ${recId} 已从账单 ${billId} 删除关联。`);
      closeModal();
      document.getElementById('drawer-body').innerHTML = BizBillDetailHtml(String(billId));
      render();
    });
    return;
  }

  // ── 业务账单详情：修改成本关联（转入 / 转出） ───────────────────────────────
  if (action === 'rtlBillModifyCost' || action === 'rtlBillAdjustClaimed') {
    const recId = el.dataset.recordId || '';
    const billId = Number(el.dataset.billId || '');
    const rec = DATA.retail.costRecords.find(r => r.id === recId);
    if (!rec) { toast('提示', '未找到成本记录。'); return; }
    const bizBill = DATA.retail.bizBills.find(b => b.id === billId);
    if (bizBill?.status === '已同步') { toast('提示', '账单已提交，不可修改。'); return; }

    const freeAmt = Math.max(0, (rec.actual || 0) - (rec.claimed || 0));
    const borrowBills = getBillSourcesForCostAdd(bizBill, billId).map((b) => ({
      bill: b,
      costTotal: getLinkedCostTotal(b.id),
    }));
    const tabStyle = (active) => `padding:8px 14px;cursor:pointer;font-size:13px;border:none;background:none;border-bottom:2px solid ${active ? 'var(--accent)' : 'transparent'};color:${active ? 'var(--accent)' : 'var(--muted)'};font-weight:${active ? '600' : '400'};`;

    const borrowRowsHtml = borrowBills.length > 0
      ? borrowBills.map(({ bill: sb, costTotal }) => {
          const shortName = (sb.name || '').length > 36 ? sb.name.slice(0, 36) + '…' : (sb.name || '');
          return `<tr>
            <td style="padding:6px 8px;font-size:12px;color:var(--muted)">${sb.id}</td>
            <td style="padding:6px 8px" title="${escapeHtml(sb.name || '')}">${escapeHtml(shortName)}</td>
            <td style="padding:6px 8px;text-align:right;font-weight:600;color:var(--success)">${escapeHtml(formatMoney(costTotal))}</td>
            <td style="padding:6px 8px">
              <input type="number" class="input bm-in-borrow-amt" data-src-bill-id="${sb.id}"
                min="0" max="${costTotal}" step="0.01" style="width:110px" placeholder="划拨金额" />
            </td>
          </tr>`;
        }).join('')
      : `<tr><td colspan="4" style="padding:12px;color:var(--muted)">同客户下暂无其他未同步且有关联成本的业务账单</td></tr>`;

    const targetBills = DATA.retail.bizBills.filter(
      (b) => customerMatches(b.customer, bizBill.customer) && !billIdEq(b.id, billId) && b.status !== '已同步'
    );
    const targetOpts = targetBills.length > 0
      ? targetBills.map(b => `<option value="${b.id}">${escapeHtml(b.id + ' · ' + b.name.slice(0, 30))}</option>`).join('')
      : `<option value="">— 暂无可选目标账单 —</option>`;

    openModal({
      title: `修改成本关联 · ${escapeHtml(recId)}`,
      bodyHtml: `
        <div class="callout callout-info" style="margin-bottom:12px;font-size:13px">
          成本记录 <b>${escapeHtml(recId)}</b>&nbsp;·&nbsp;月份：<b>${escapeHtml(rec.month)}</b>&nbsp;·&nbsp;
          实际成本：<b>${escapeHtml(formatMoney(rec.actual))}</b>&nbsp;·&nbsp;
          本单关联：<b>${escapeHtml(formatMoney(rec.claimed))}</b>&nbsp;·&nbsp;
          本单可追加余量：<b style="color:${freeAmt > 0 ? 'var(--success)' : 'var(--muted)'}">${escapeHtml(formatMoney(freeAmt))}</b>
        </div>
        <div style="display:flex;border-bottom:1px solid var(--border);margin-bottom:14px">
          <button type="button" class="bm-tab" data-bm-tab="in" style="${tabStyle(true)}">转入金额</button>
          <button type="button" class="bm-tab" data-bm-tab="out" style="${tabStyle(false)}">转出金额</button>
        </div>

        <div id="bm-panel-in">
          <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:8px">方式一 · 本成本单未分配余量</div>
          <div style="font-size:13px;color:var(--muted);margin-bottom:8px;line-height:1.6">
            从本条成本单尚未认领的部分转入（实际成本 − 当前已关联合计），增加本账单对本成本单的关联额。
          </div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px">
            <span class="page-subtitle">转入金额</span>
            <input class="input" id="bm-in-self" type="number" min="0" max="${freeAmt}" step="0.01"
              placeholder="0.00" style="width:140px" ${freeAmt <= 0 ? 'disabled' : ''} />
            <span class="page-subtitle" style="color:var(--muted)">元（上限 ${escapeHtml(formatMoney(freeAmt))}）</span>
          </div>

          <div style="font-size:12px;font-weight:600;color:var(--muted);margin-bottom:8px">方式二 · 从其他业务账单划拨</div>
          <div style="font-size:13px;color:var(--muted);margin-bottom:8px;line-height:1.6">
            从同客户、未同步且已关联成本的其他业务账单中划拨；减少对方账单关联额，并增加到本账单对 <b>${escapeHtml(recId)}</b> 的关联额。
          </div>
          <div class="table-wrap" style="max-height:220px;overflow-y:auto;margin-bottom:8px">
            <table>
              <thead><tr><th>账单ID</th><th>账单名称</th><th>可划拨</th><th>划拨金额</th></tr></thead>
              <tbody>${borrowRowsHtml}</tbody>
            </table>
          </div>
          <div style="font-size:13px">划拨合计：<b id="bm-in-borrow-sum">${formatMoney(0)}</b></div>
          ${freeAmt <= 0 && !borrowBills.length ? `<div class="callout callout-warning" style="margin-top:10px;font-size:12px">暂无可用转入来源。</div>` : ''}
        </div>

        <div id="bm-panel-out" style="display:none">
          <div style="font-size:13px;color:var(--muted);margin-bottom:10px;line-height:1.6">
            将本账单当前关联的部分金额转出，选择目标账单后确认。转出后该金额将从本账单释放，目标账单可通过「新增成本单」接收。
          </div>
          <div style="display:flex;flex-direction:column;gap:10px">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              <span class="page-subtitle" style="white-space:nowrap">目标账单</span>
              <select class="select" id="bm-out-target" style="flex:1;min-width:200px">
                <option value="">— 请选择 —</option>${targetOpts}
              </select>
            </div>
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              <span class="page-subtitle">转出金额</span>
              <input class="input" id="bm-out-amt" type="number" min="0" max="${rec.claimed}" step="0.01"
                placeholder="0.00" style="width:160px" />
              <span class="page-subtitle" style="color:var(--muted)">元（上限本单关联额 ${escapeHtml(formatMoney(rec.claimed))}）</span>
            </div>
          </div>
        </div>
        <div id="bm-err" style="display:none;color:var(--danger);font-size:13px;margin-top:10px"></div>`,
      footerHtml: `
        <button class="btn" id="bm-cancel">取消</button>
        <button class="btn btn-primary" id="bm-ok">确认</button>`,
    });

    // tab 切换
    document.querySelectorAll('.bm-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.bmTab;
        document.getElementById('bm-panel-in').style.display = tab === 'in' ? '' : 'none';
        document.getElementById('bm-panel-out').style.display = tab === 'out' ? '' : 'none';
        document.querySelectorAll('.bm-tab').forEach(b => {
          const a = b.dataset.bmTab === tab;
          b.style.borderBottom = `2px solid ${a ? 'var(--accent)' : 'transparent'}`;
          b.style.color = a ? 'var(--accent)' : 'var(--muted)';
          b.style.fontWeight = a ? '600' : '400';
        });
      });
    });

    const updateBorrowSum = () => {
      let sum = 0;
      document.querySelectorAll('.bm-in-borrow-amt').forEach((inp) => {
        const v = Number(inp.value || 0);
        if (Number.isFinite(v) && v > 0) sum += v;
      });
      const el = document.getElementById('bm-in-borrow-sum');
      if (el) el.textContent = formatMoney(sum);
    };
    document.querySelectorAll('.bm-in-borrow-amt').forEach((inp) => {
      inp.addEventListener('input', updateBorrowSum);
    });
    updateBorrowSum();

    document.getElementById('bm-cancel')?.addEventListener('click', closeModal);
    document.getElementById('bm-ok')?.addEventListener('click', () => {
      const errEl = document.getElementById('bm-err');
      if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
      const showErr = (msg) => { if (errEl) { errEl.style.display = 'block'; errEl.textContent = msg; } };
      const inPanelVisible = document.getElementById('bm-panel-in')?.style.display !== 'none';

      if (inPanelVisible) {
        const selfAmt = Number(document.getElementById('bm-in-self')?.value || 0);
        const toBorrow = [];
        for (const inp of document.querySelectorAll('.bm-in-borrow-amt')) {
          const val = inp.value.trim();
          if (!val) continue;
          const amt = Number(val);
          const srcBillId = Number(inp.dataset.srcBillId);
          if (!Number.isFinite(amt) || amt <= 0) { showErr(`账单 ${srcBillId} 划拨金额须大于 0。`); return; }
          const srcTotal = getLinkedCostTotal(srcBillId);
          if (amt > srcTotal) { showErr(`账单 ${srcBillId} 划拨金额（${formatMoney(amt)}）超过可划拨合计（${formatMoney(srcTotal)}）。`); return; }
          toBorrow.push({ srcBillId, amt });
        }
        const borrowTotal = toBorrow.reduce((s, x) => s + x.amt, 0);
        if ((!Number.isFinite(selfAmt) || selfAmt <= 0) && borrowTotal <= 0) {
          showErr('请填写本成本单转入金额和/或至少一张其他账单的划拨金额。');
          return;
        }
        if (selfAmt > 0 && selfAmt > freeAmt) {
          showErr(`本成本单转入（${formatMoney(selfAmt)}）不可超过可追加余量（${formatMoney(freeAmt)}）。`);
          return;
        }
        const prevClaimed = rec.claimed;
        let added = 0;
        if (selfAmt > 0) {
          rec.claimed += selfAmt;
          added += selfAmt;
          appendCostChangeAudit({ recordId: recId, action: '修改成本关联-转入(本单余量)', detail: `账单 ${billId}：本单关联额 ${formatMoney(prevClaimed)} → ${formatMoney(rec.claimed)}` });
        }
        for (const { srcBillId, amt } of toBorrow) {
          let remaining = amt;
          const srcRecords = getLinkedCostRecords(srcBillId).filter(r => !isRecordFinanceLocked(r));
          for (const r of srcRecords) {
            if (remaining <= 0) break;
            const take = Math.min(r.claimed, remaining);
            r.claimed -= take;
            remaining -= take;
            appendCostChangeAudit({ recordId: r.id, action: '修改成本关联-转入(跨账单源)', detail: `从账单 ${srcBillId} 转出 ${formatMoney(take)} → 账单 ${billId} · ${recId}` });
            if (r.claimed <= 0.001) { r.claimed = 0; r.linkedBizBillId = null; }
          }
          rec.claimed += amt;
          added += amt;
          appendCostChangeAudit({ recordId: recId, action: '修改成本关联-转入(跨账单)', detail: `从账单 ${srcBillId} 接收 ${formatMoney(amt)} → 账单 ${billId}` });
        }
        rec.linkedBizBillId = billId;
        toast('已转入', `成本记录 ${recId} 已向账单 ${billId} 转入合计 ${formatMoney(added)}。`);
      } else {
        // 转出
        const targetBillId = Number(document.getElementById('bm-out-target')?.value || 0);
        const amt = Number(document.getElementById('bm-out-amt')?.value || 0);
        if (!targetBillId) { showErr('请选择目标账单。'); return; }
        if (!Number.isFinite(amt) || amt <= 0) { showErr('请输入大于 0 的转出金额。'); return; }
        if (amt > rec.claimed) { showErr(`转出金额（${formatMoney(amt)}）不可超过本单关联额（${formatMoney(rec.claimed)}）。`); return; }
        const prevClaimed = rec.claimed;
        rec.claimed -= amt;
        if (rec.claimed <= 0.001) { rec.claimed = 0; rec.linkedBizBillId = null; }
        appendCostChangeAudit({ recordId: recId, action: '修改成本关联-转出', detail: `账单 ${billId} → 目标账单 ${targetBillId}：转出 ${formatMoney(amt)}，本单关联额 ${formatMoney(prevClaimed)} → ${formatMoney(rec.claimed)}` });
        toast('已转出', `已从账单 ${billId} 向账单 ${targetBillId} 转出 ${formatMoney(amt)}，对方可通过「新增成本单」接收。`);
      }
      closeModal();
      document.getElementById('drawer-body').innerHTML = BizBillDetailHtml(String(billId));
      render();
    });
    // Keep old action name as alias — handled by the same block above
    if (action === 'rtlBillAdjustClaimed') {
      // already handled above, just return
    }
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
          该成本行已参与财务月归集并锁定。若业务账单结算后发现归属错误，请在入账月 ${escapeHtml(fin)} 做当期成本调整；系统保留关联与调整全链路日志。
        </div>`,
      footerHtml: `<button class="btn" id="modal-flock-close">关闭</button>`,
    });
    $('#modal-flock-close').addEventListener('click', closeModal);
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
      footerHtml: `<button class="btn" id="modal-adj-close">关闭</button>`,
    });
    $('#modal-adj-close').addEventListener('click', closeModal);
    return;
  }

  if (action === 'filterRetailCost') {
    const month = document.getElementById('rtl-cost-month')?.value?.trim() || '';
    const cust  = document.getElementById('rtl-cost-cust')?.value?.trim()  || '';
    window.location.hash = mergeRetailCostQuery({
      retailCostMonth: month || '',
      retailCostCust: cust || '',
      rtlAutoPage: '',
    });
    return;
  }

  if (action === 'resetRetailCost') {
    window.location.hash = mergeRetailCostQuery({
      retailCostMonth: '',
      retailCostCust: '',
      rtlAutoPage: '',
    });
    return;
  }

  if (action === 'filterRtlManualMonth') {
    const mm = document.getElementById('rtl-manual-month-filter')?.value?.trim() || '';
    window.location.hash = mergeRetailCostQuery({
      rtlManualMonth: mm || '',
      rtlManualPage: '',
    });
    return;
  }

  if (action === 'resetRtlManualMonth') {
    window.location.hash = mergeRetailCostQuery({
      rtlManualMonth: '',
      rtlManualPage: '',
    });
    return;
  }

  if (action === 'openRtlManualCostModal') {
    openRtlManualCostModalFromClick(el);
    return;
  }

  if (action === 'viewRtlManualVouchers') {
    const mid = el.dataset.manualId || '';
    const entry = DATA.retail.manualTransferCosts.find((m) => m.id === mid);
    if (!entry) {
      toast('提示', '未找到该人工转入记录。');
      return;
    }
    const list = entry.vouchers || [];
    const body =
      list.length === 0
        ? `<div style="color:var(--muted);font-size:13px">暂无凭证。</div>`
        : `<ul style="margin:0;padding-left:18px;line-height:1.7;font-size:13px">
            ${list
              .map((v, i) => {
                const canPreview = v.dataUrl && String(v.dataUrl).startsWith('data:');
                const open = canPreview
                  ? `<button type="button" class="link" style="font:inherit;padding:0;border:0;background:none;cursor:pointer;color:var(--accent);text-decoration:underline" data-action="openRtlManualVoucherPreview" data-manual-id="${escapeHtml(mid)}" data-voucher-idx="${i}">新窗口打开</button>`
                  : `<span style="color:var(--muted)">（演示数据，无文件体）</span>`;
                const sz = v.size != null ? `${Math.round(v.size / 1024)} KB` : '—';
                return `<li><b>${escapeHtml(v.name)}</b> · ${escapeHtml(v.mime || '—')} · ${escapeHtml(sz)} · ${escapeHtml(v.uploadedAt || '—')}<br>${open}</li>`;
              })
              .join('')}
          </ul>`;
    openDrawer({
      title: `账单凭证 · ${entry.id}`,
      bodyHtml: `<div class="page-subtitle" style="margin-bottom:10px">${escapeHtml(entry.platform)} · ${escapeHtml(entry.month)} · ${escapeHtml(formatMoney(entry.amount))}</div>${body}`,
    });
    return;
  }

  if (action === 'openRtlManualVoucherPreview') {
    const mid = el.dataset.manualId || '';
    const idx = Number(el.dataset.voucherIdx);
    const ent = DATA.retail.manualTransferCosts.find((m) => m.id === mid);
    const v = ent?.vouchers?.[idx];
    if (v?.dataUrl && String(v.dataUrl).startsWith('data:')) {
      window.open(v.dataUrl, '_blank', 'noopener');
    } else {
      toast('提示', '该凭证无本地预览数据。');
    }
    return;
  }

  if (action === 'viewRtlManualEditLogs') {
    const mid = el.dataset.manualId || '';
    const entry = DATA.retail.manualTransferCosts.find((m) => m.id === mid);
    if (!entry) {
      toast('提示', '未找到该人工转入记录。');
      return;
    }
    const logs = [...(entry.editLogs || [])].reverse();
    const body =
      logs.length === 0
        ? `<div style="color:var(--muted);font-size:13px">尚无编辑记录（登记后修改会在此留痕）。</div>`
        : `<ol style="margin:0;padding-left:18px;line-height:1.65;font-size:13px;display:flex;flex-direction:column;gap:12px">
            ${logs
              .map(
                (L) =>
                  `<li><div style="font-weight:600">${escapeHtml(L.time)} · ${escapeHtml(L.operator || '—')}</div><div style="margin-top:4px;color:var(--text)">${escapeHtml(L.summary)}</div></li>`
              )
              .join('')}
          </ol>`;
    openDrawer({
      title: `编辑日志 · ${entry.id}`,
      bodyHtml: `
        <div style="font-size:12px;color:var(--muted);margin-bottom:12px">
          登记：${escapeHtml(entry.createdAt || '—')} · 更新：${escapeHtml(entry.updatedAt || entry.createdAt || '—')} · ${escapeHtml(entry.operator || '—')}（以下为倒序：最近修改在上）
        </div>
        ${body}`,
    });
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
    const curPlat = getQueryParams().get('pcPlatform') || DATA.retail.costPlatforms[0];
    p.set('pcPlatform', curPlat);
    if (proj)  p.set('pcProj',  proj);
    if (cust)  p.set('pcCust',  cust);
    if (month) p.set('pcMonth', month);
    window.location.hash = `#/retail?${p.toString()}`;
    return;
  }
  if (action === 'resetProjectCost') {
    const curPlat = getQueryParams().get('pcPlatform') || DATA.retail.costPlatforms[0];
    window.location.hash = `#/retail?retailTab=projectCost&pcPlatform=${encodeURIComponent(curPlat)}`;
    return;
  }

  if (action === 'openProjectLog') {
    const pid      = el.dataset.projectId || '';
    const platform = el.dataset.platform  || '';
    const recordIds = DATA.retail.costRecords
      .filter(r => r.platform === platform &&
        (r.allocDetail?.projects || []).some(p => p.projectId === pid))
      .map(r => r.id);
    const audits = (DATA.retail.costChangeAudit || [])
      .filter(a => recordIds.includes(a.recordId));
    const rows = audits.map(a => [
      escapeHtml(a.time),
      escapeHtml(a.operator || '—'),
      escapeHtml(a.recordId),
      escapeHtml(a.action),
      escapeHtml(a.financePeriod || '—'),
      `<span style="font-size:12px">${escapeHtml(a.detail || '—')}</span>`,
    ]);
    openDrawer({
      title: `日志 · ${pid}`,
      bodyHtml: rows.length
        ? Table(['时间', '操作人', '成本记录', '动作', '财务归属月', '明细'], rows)
        : `<div style="padding:12px;color:var(--muted)">暂无操作日志</div>`,
    });
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

});

