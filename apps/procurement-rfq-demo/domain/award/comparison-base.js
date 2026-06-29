/**
 * 比较底表生成模块 (Comparison Base)
 *
 * 职责（audit-round02 P0）：
 * - 系统先整理出 meeting-ready 的比较底表
 * - 不作为最终 award 结论，而是评审前的准备材料
 * - 基于标准化报价生成横向比较数据
 *
 * 与 award/comparison.js 的关系：
 * - comparison-base：纯数据整理，不带评分权重
 * - award/comparison.js：加权评分 + 推荐结论
 */

/**
 * 标准化报价中的关键比较字段
 */
const COMPARISON_FIELDS = [
  { key: 'piece_price', label: '零件单价', format: 'currency' },
  { key: 'delivered_piece_price', label: '交付单价', format: 'currency' },
  { key: 'tooling_cost', label: '模具费', format: 'currency' },
  { key: 'part_price_ddp_per_part', label: 'DDP 单价', format: 'currency' },
  { key: 'quoted_volume', label: '报价数量', format: 'number' },
  { key: 'local_currency', label: '报价币种', format: 'string' },
  { key: 'x_rate_to_base', label: '汇率', format: 'number' },
  { key: 'total_project_cost', label: '项目总成本(RMB)', format: 'currency' },
  { key: 'raw_material_cost', label: '原材料成本', format: 'currency' },
  { key: 'total_production_cost', label: '生产成本', format: 'currency' },
  { key: 'ex_works_price', label: '出厂价', format: 'currency' },
  { key: 'transport_cost', label: '运费', format: 'currency' },
  { key: 'tooling_lead_time', label: '模具交期(天)', format: 'number' },
  { key: 'tooling_payment_terms', label: '模具付款条件', format: 'string' },
  { key: 'quick_saving_rate', label: '快速降本(%)', format: 'percent' },
  { key: 'quick_saving_term', label: '降本周期(月)', format: 'number' },
  { key: 'effective_unit_cost', label: '综合单价', format: 'currency' },
  { key: 'total_with_tooling', label: '含模具总成本', format: 'currency' },
  { key: 'price_per_ddp_with_tooling', label: 'DDP含模具单价', format: 'currency' },
];

/**
 * 生成比较底表
 * @param {Object} component - EBOM component
 * @param {Object[]} normalizedQuotes - 标准化报价列表
 * @param {Object} supplierProfiles - { supplier_id: supplierInfo }
 * @returns {Object} comparison base
 */
function generateComparisonBase(component, normalizedQuotes, supplierProfiles) {
  // 构建横向行
  const comparisonRows = normalizedQuotes.map(nq => {
    const profile = supplierProfiles[nq.supplier_id] || {};
    const row = {
      supplier_id: nq.supplier_id,
      supplier_name: profile.name || nq.supplier_id,
      country: profile.country || '',
      city: profile.city || '',
      certification: profile.certification || '',
      region: profile.region || '',
      capability_tags: profile.capability_tags || [],
    };

    // 填充比较字段
    for (const field of COMPARISON_FIELDS) {
      row[field.key] = nq[field.key] ?? null;
    }

    return row;
  });

  // 按综合单价升序（低→高）
  comparisonRows.sort((a, b) => {
    const aVal = a.effective_unit_cost ?? a.total_with_tooling ?? a.total_project_cost ?? Infinity;
    const bVal = b.effective_unit_cost ?? b.total_with_tooling ?? b.total_project_cost ?? Infinity;
    return aVal - bVal;
  });

  // 生成差异标注（每行相对于最优值的差异）
  const annotatedRows = comparisonRows.map((row, idx) => {
    const annotations = {};
    if (idx > 0 && comparisonRows.length > 1) {
      const best = comparisonRows[0];
      for (const field of COMPARISON_FIELDS) {
        if (field.format === 'currency' || field.format === 'number') {
          const bestVal = best[field.key];
          const curVal = row[field.key];
          if (bestVal != null && curVal != null && bestVal !== 0) {
            const diff = ((curVal - bestVal) / Math.abs(bestVal)) * 100;
            if (Math.abs(diff) > 1) {
              annotations[field.key] = {
                diff_pct: Math.round(diff * 10) / 10,
                direction: diff > 0 ? 'higher' : 'lower',
              };
            }
          }
        }
      }
    }
    return { ...row, annotations };
  });

  return {
    component_no: component.component_no,
    component_name: component.component_name,
    comparison_fields: COMPARISON_FIELDS,
    comparison_rows: annotatedRows,
    best_supplier_id: annotatedRows.length > 0 ? annotatedRows[0].supplier_id : null,
    generated_at: new Date().toISOString(),
  };
}

export {
  COMPARISON_FIELDS,
  generateComparisonBase,
};
