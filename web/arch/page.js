import { PageHead, callout } from '../shared/ui.js';

export function ArchPage() {
  const diagram = `
    <div class="card">
      <div class="card-head">系统通信架构图</div>
      <div class="card-body">
        <div style="overflow:auto">
          <svg viewBox="0 0 980 520" width="980" style="max-width:100%; display:block;">
            <defs>
              <marker id="arr" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                <path d="M0,0.5 L0,6.5 L7,3.5z" fill="#94a3b8"></path>
              </marker>
              <marker id="arrA" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                <path d="M0,0.5 L0,6.5 L7,3.5z" fill="#1677ff"></path>
              </marker>
            </defs>

            <rect x="20" y="40" width="170" height="210" rx="8" fill="#ffffff" stroke="#dbe3f0"/>
            <text x="105" y="28" text-anchor="middle" font-size="12" fill="#64748b" font-family="system-ui">到店营销平台</text>

            <rect x="20" y="290" width="170" height="200" rx="8" fill="#ffffff" stroke="#dbe3f0"/>
            <text x="105" y="278" text-anchor="middle" font-size="12" fill="#64748b" font-family="system-ui">即时零售平台</text>

            <rect x="235" y="120" width="190" height="120" rx="10" fill="#f8fbff" stroke="#1677ff" stroke-width="2"/>
            <text x="330" y="154" text-anchor="middle" font-size="18" font-weight="700" fill="#1677ff" font-family="system-ui">到店营销</text>
            <text x="330" y="176" text-anchor="middle" font-size="11" fill="#64748b" font-family="system-ui">活动 ↔ 账单归集 ↔ 月度成本</text>
            <text x="330" y="195" text-anchor="middle" font-size="11" fill="#64748b" font-family="system-ui">不可重叠；项目变更引用校验</text>

            <rect x="235" y="330" width="190" height="120" rx="10" fill="#fbfaff" stroke="#7c3aed" stroke-width="2"/>
            <text x="330" y="364" text-anchor="middle" font-size="18" font-weight="700" fill="#7c3aed" font-family="system-ui">即时零售</text>
            <text x="330" y="386" text-anchor="middle" font-size="11" fill="#64748b" font-family="system-ui">爬虫账单 → 按月/客户/实体生成成本</text>
            <text x="330" y="405" text-anchor="middle" font-size="11" fill="#64748b" font-family="system-ui">运营分配：自动拆分 + 明细可编辑</text>

            <rect x="485" y="210" width="215" height="170" rx="10" fill="#ffffff" stroke="#0f172a" stroke-width="2.2"/>
            <text x="592" y="245" text-anchor="middle" font-size="22" font-weight="800" fill="#0f172a" font-family="system-ui">PMS</text>
            <text x="592" y="267" text-anchor="middle" font-size="11" fill="#64748b" font-family="system-ui">项目报价 · 结算 · 开票</text>
            <text x="592" y="286" text-anchor="middle" font-size="11" fill="#64748b" font-family="system-ui">月度成本汇总 · 库存监控</text>
            <text x="592" y="305" text-anchor="middle" font-size="11" fill="#64748b" font-family="system-ui">共享项目池（唯一事实来源）</text>

            <rect x="740" y="130" width="220" height="80" rx="10" fill="#ffffff" stroke="#059669" />
            <text x="850" y="168" text-anchor="middle" font-size="16" font-weight="700" fill="#059669" font-family="system-ui">客户结算</text>
            <text x="850" y="190" text-anchor="middle" font-size="11" fill="#64748b" font-family="system-ui">账单汇总 · 结算 · 开票</text>

            <rect x="740" y="240" width="220" height="80" rx="10" fill="#ffffff" stroke="#d97706" />
            <text x="850" y="278" text-anchor="middle" font-size="16" font-weight="700" fill="#d97706" font-family="system-ui">库存监控</text>
            <text x="850" y="300" text-anchor="middle" font-size="11" fill="#64748b" font-family="system-ui">报价 - 实际成本 = 剩余库存</text>

            <rect x="740" y="350" width="220" height="80" rx="10" fill="#ffffff" stroke="#2563eb" />
            <text x="850" y="388" text-anchor="middle" font-size="16" font-weight="700" fill="#2563eb" font-family="system-ui">财务成本</text>
            <text x="850" y="410" text-anchor="middle" font-size="11" fill="#64748b" font-family="system-ui">按月/客户/项目汇总</text>

            <!-- Platform mini boxes -->
            <g font-family="system-ui" font-size="12" fill="#0f172a">
              <rect x="36" y="62" width="138" height="42" rx="8" fill="#ffffff" stroke="#dbe3f0"/><text x="105" y="88" text-anchor="middle">微信</text>
              <rect x="36" y="112" width="138" height="42" rx="8" fill="#ffffff" stroke="#dbe3f0"/><text x="105" y="138" text-anchor="middle">支付宝</text>
              <rect x="36" y="162" width="138" height="42" rx="8" fill="#ffffff" stroke="#dbe3f0"/><text x="105" y="188" text-anchor="middle">抖音</text>
            </g>
            <g font-family="system-ui" font-size="12" fill="#0f172a">
              <rect x="36" y="312" width="138" height="38" rx="8" fill="#ffffff" stroke="#dbe3f0"/><text x="105" y="336" text-anchor="middle">美团闪购</text>
              <rect x="36" y="358" width="138" height="38" rx="8" fill="#ffffff" stroke="#dbe3f0"/><text x="105" y="382" text-anchor="middle">淘宝闪购</text>
              <rect x="36" y="404" width="138" height="38" rx="8" fill="#ffffff" stroke="#dbe3f0"/><text x="105" y="428" text-anchor="middle">京东到家</text>
              <rect x="36" y="450" width="138" height="38" rx="8" fill="#ffffff" stroke="#dbe3f0"/><text x="105" y="474" text-anchor="middle">多点</text>
            </g>

            <!-- arrows -->
            <line x1="190" y1="84" x2="232" y2="150" stroke="#94a3b8" stroke-width="1.6" marker-end="url(#arr)"/>
            <line x1="190" y1="134" x2="232" y2="170" stroke="#94a3b8" stroke-width="1.6" marker-end="url(#arr)"/>
            <line x1="190" y1="184" x2="232" y2="190" stroke="#94a3b8" stroke-width="1.6" marker-end="url(#arr)"/>

            <line x1="190" y1="331" x2="232" y2="360" stroke="#94a3b8" stroke-width="1.6" marker-end="url(#arr)"/>
            <line x1="190" y1="377" x2="232" y2="382" stroke="#94a3b8" stroke-width="1.6" marker-end="url(#arr)"/>
            <line x1="190" y1="423" x2="232" y2="404" stroke="#94a3b8" stroke-width="1.6" marker-end="url(#arr)"/>
            <line x1="190" y1="469" x2="232" y2="426" stroke="#94a3b8" stroke-width="1.6" marker-end="url(#arr)"/>

            <line x1="425" y1="175" x2="485" y2="250" stroke="#1677ff" stroke-width="2" marker-end="url(#arrA)"/>
            <path d="M485,245 C455,240 450,210 425,185" fill="none" stroke="#1677ff" stroke-width="1.6" stroke-dasharray="4,3" marker-end="url(#arrA)"/>

            <line x1="425" y1="390" x2="485" y2="325" stroke="#7c3aed" stroke-width="2" marker-end="url(#arrA)"/>
            <path d="M485,332 C455,344 450,372 425,382" fill="none" stroke="#7c3aed" stroke-width="1.6" stroke-dasharray="4,3" marker-end="url(#arrA)"/>

            <line x1="700" y1="270" x2="740" y2="170" stroke="#94a3b8" stroke-width="1.6" marker-end="url(#arr)"/>
            <line x1="700" y1="295" x2="740" y2="280" stroke="#94a3b8" stroke-width="1.6" marker-end="url(#arr)"/>
            <line x1="700" y1="318" x2="740" y2="390" stroke="#94a3b8" stroke-width="1.6" marker-end="url(#arr)"/>
          </svg>
        </div>
      </div>
    </div>
  `;

  const principles = `
    <div class="two-col">
      <div class="card">
        <div class="card-head">In-Store Marketing — Aggregation Rules</div>
        <div class="card-body">
          ${callout('info', '', 'Bills are aggregated by activity. No overlap is allowed. Auto-run on the 1st of each month; operators can trigger manual aggregation when needed.')}
          <div style="height:10px"></div>
          ${callout('warning', 'Project-change validation', 'If an activity changes its linked project after bills have been aggregated, the system validates existing references to prevent inconsistencies.')}
        </div>
      </div>
      <div class="card">
        <div class="card-head">Instant Retail — Allocation Rules</div>
        <div class="card-body">
          ${callout('info', '', 'Bills have no activity id. Costs are generated by Month + Customer + Secondary Entity. Operators input project allocation amounts on the 1st of each month.')}
          <div style="height:10px"></div>
          ${callout('warning', 'Auto-split details', 'The system auto-splits stored bill details to match the allocation amount. If details are insufficient, operators can edit selected line items.')}
        </div>
      </div>
    </div>
  `;

  return `
    ${PageHead('系统通信架构', '三系统数据流向与关键业务规则')}
    ${diagram}
    <div style="height:12px"></div>
    ${principles}
  `;
}

