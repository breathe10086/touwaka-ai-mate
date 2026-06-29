/**
 * Award Comparison - 横向比较与推荐模块
 *
 * 职责：
 * - 将多个供应商的标准化报价转换为横向比较行
 * - 生成 award summary 视图
 * - 基于加权规则输出推荐结论（demo 阶段不限依赖 LLM）
 *
 * 核心原则：
 * - 所有横向表格都从标准化结果临时生成，不反向污染主对象结构
 * - 推荐逻辑必须可解释（"为什么推荐 / 为什么比较结论如此"）
 */

/**
 * @typedef {Object} AwardComparisonRow
 * @property {string} supplier_id
 * @property {string} supplier_name
 * @property {number} piece_price - 单价（标准化）
 * @property {number} delivered_piece_price - 交付单价
 * @property {number} tooling_cost - 模具费
 * @property {number} part_price_ddp_per_part - DDP 单价
 * @property {number} quoted_volume - 报价数量
 * @property {string} local_currency - 本币
 * @property {number} x_rate_to_base - 汇率
 * @property {number} total_project_cost - 项目总成本
 * @property {number} effective_unit_cost - 单件综合成本
 * @property {number} total_with_tooling - 含模具总成本
 * @property {number} total_ddp - DDP 总成本
 */

/**
 * @typedef {Object} AwardSummary
 * @property {string} component_no
 * @property {string} component_name
 * @property {AwardComparisonRow[]} comparison_rows
 * @property {Object} recommendation
 * @property {Object} rankings
 * @property {string[]} notes
 */

// 评分维度与权重
const SCORING_WEIGHTS = {
  total_cost: 0.40,       // 总成本（含模具）
  unit_price: 0.25,       // 单价
  tooling_burden: 0.15,   // 模具费负担
  supplier_quality: 0.10, // 供应商资质
  delivery_terms: 0.10,   // 交付条件
};

/**
 * 生成横向比较行
 * @param {NormalizedQuote[]} normalizedQuotes
 * @returns {AwardComparisonRow[]}
 */
function buildComparisonRows(normalizedQuotes) {
  return normalizedQuotes.map(nq => {
    const f = nq.fields;
    const d = nq.derived;

    return {
      supplier_id: nq.supplier_id,
      supplier_name: nq.supplier_name,
      piece_price: f.piece_price?.normalized || 0,
      delivered_piece_price: f.delivered_piece_price?.normalized || 0,
      tooling_cost: f.tooling_cost?.normalized || 0,
      part_price_ddp_per_part: f.part_price_ddp_per_part?.normalized || 0,
      quoted_volume: f.quoted_volume?.original || 0,
      local_currency: f.piece_price?.currency || 'RMB',
      x_rate_to_base: f.piece_price?.rate || 1.0,
      total_project_cost: f.total_project_cost?.normalized || 0,
      effective_unit_cost: d.effective_unit_cost || 0,
      total_with_tooling: d.total_with_tooling || 0,
      total_ddp: d.total_ddp || 0,
    };
  });
}

/**
 * 计算供应商评分
 * @param {AwardComparisonRow[]} rows
 * @param {Object<string, Object>} supplierProfiles - supplier id -> profile (含 certification 等)
 * @returns {Object<string, { total_score: number, dimension_scores: Object }>}
 */
function calculateScores(rows, supplierProfiles = {}) {
  if (rows.length === 0) return {};

  // 找出各维度的最佳值用于归一化
  const best = {
    total_cost: Math.min(...rows.map(r => r.total_with_tooling || Infinity)),
    unit_price: Math.min(...rows.map(r => r.piece_price || Infinity)),
    tooling_burden: Math.min(...rows.map(r => r.tooling_cost || Infinity)),
  };

  const scores = {};
  for (const row of rows) {
    const profile = supplierProfiles[row.supplier_id] || {};

    // 成本维度：值越小分数越高
    const costScore = best.total_cost > 0
      ? Math.min(1, best.total_cost / Math.max(row.total_with_tooling, 0.01))
      : 0;
    const unitScore = best.unit_price > 0
      ? Math.min(1, best.unit_price / Math.max(row.piece_price, 0.01))
      : 0;
    const toolingScore = best.tooling_burden > 0
      ? Math.min(1, best.tooling_burden / Math.max(row.tooling_cost, 0.01))
      : (row.tooling_cost === 0 ? 1 : 0);

    // 供应商资质维度：有 TS16949 加分
    const qualityScore = profile.certification === 'TS16949' ? 1.0 : 0.6;

    // 交付条件维度：默认平分（demo 阶段简化）
    const deliveryScore = 0.8;

    const dimensionScores = {
      total_cost: costScore * 100,
      unit_price: unitScore * 100,
      tooling_burden: toolingScore * 100,
      supplier_quality: qualityScore * 100,
      delivery_terms: deliveryScore * 100,
    };

    const totalScore =
      costScore * SCORING_WEIGHTS.total_cost * 100 +
      unitScore * SCORING_WEIGHTS.unit_price * 100 +
      toolingScore * SCORING_WEIGHTS.tooling_burden * 100 +
      qualityScore * SCORING_WEIGHTS.supplier_quality * 100 +
      deliveryScore * SCORING_WEIGHTS.delivery_terms * 100;

    scores[row.supplier_id] = {
      total_score: Math.round(totalScore * 100) / 100,
      dimension_scores: dimensionScores,
    };
  }

  return scores;
}

/**
 * 生成推荐结论
 * @param {AwardComparisonRow[]} rows
 * @param {Object<string, Object>} scores
 * @param {Object<string, Object>} supplierProfiles
 * @returns {Object} recommendation
 */
function generateRecommendation(rows, scores, supplierProfiles = {}) {
  if (rows.length === 0) {
    return { conclusion: '无数据', details: [] };
  }

  // 按总评分排序
  const ranked = rows.map(row => ({
    ...row,
    score: scores[row.supplier_id]?.total_score || 0,
    dimension_scores: scores[row.supplier_id]?.dimension_scores || {},
  })).sort((a, b) => b.score - a.score);

  const winner = ranked[0];

  // 各维度最佳
  const cheapest = rows.reduce((best, r) =>
    r.piece_price < best.piece_price ? r : best, rows[0]);
  const lowestTooling = rows.reduce((best, r) =>
    r.tooling_cost < best.tooling_cost ? r : best, rows[0]);
  const bestTotal = rows.reduce((best, r) =>
    r.total_with_tooling < best.total_with_tooling ? r : best, rows[0]);
  const bestDDP = rows.reduce((best, r) =>
    r.part_price_ddp_per_part > 0 && r.part_price_ddp_per_part < best.part_price_ddp_per_part ? r : best,
    rows.find(r => r.part_price_ddp_per_part > 0) || rows[0]);

  const details = [];
  details.push(`🏆 综合推荐: ${winner.supplier_name}（评分 ${winner.score.toFixed(1)}）`);

  const reasons = [];
  if (winner.supplier_id === cheapest.supplier_id) {
    reasons.push('单价最低');
  }
  if (winner.supplier_id === lowestTooling.supplier_id) {
    reasons.push('模具费最低');
  }
  if (winner.supplier_id === bestTotal.supplier_id) {
    reasons.push('总项目成本最低');
  }
  if (reasons.length > 0) {
    details.push(`推荐理由: ${reasons.join('、')}`);
  }

  details.push(`\n📊 各维度最佳:`);
  details.push(`  - 单价最低: ${cheapest.supplier_name} (${cheapest.piece_price.toFixed(2)})`);
  details.push(`  - 模具费最低: ${lowestTooling.supplier_name} (${lowestTooling.tooling_cost.toFixed(2)})`);
  details.push(`  - 总成本最低: ${bestTotal.supplier_name} (${bestTotal.total_with_tooling.toFixed(2)})`);
  if (bestDDP.part_price_ddp_per_part > 0) {
    details.push(`  - DDP 最优: ${bestDDP.supplier_name} (${bestDDP.part_price_ddp_per_part.toFixed(2)})`);
  }

  // 风险提示
  const priceGap = rows.length >= 2
    ? ((ranked[0].piece_price - ranked[ranked.length - 1].piece_price) / Math.max(ranked[0].piece_price, 0.01) * 100)
    : 0;
  if (Math.abs(priceGap) > 30) {
    details.push(`\n⚠️ 注意: 供应商间价差较大 (${Math.abs(priceGap).toFixed(1)}%)，建议核实报价口径一致性`);
  }

  return {
    winner,
    ranked,
    cheapest,
    lowest_tooling: lowestTooling,
    best_total: bestTotal,
    best_ddp: bestDDP,
    conclusion: details[0],
    details,
    price_gap_percent: Math.round(priceGap * 10) / 10,
  };
}

/**
 * 生成完整的 Award Summary
 * @param {Object} params
 * @param {EBOMComponent} params.component
 * @param {NormalizedQuote[]} params.normalizedQuotes
 * @param {Object<string, Object>} params.supplierProfiles
 * @returns {AwardSummary}
 */
function generateAwardSummary({ component, normalizedQuotes, supplierProfiles = {} }) {
  const comparisonRows = buildComparisonRows(normalizedQuotes);
  const scores = calculateScores(comparisonRows, supplierProfiles);
  const recommendation = generateRecommendation(comparisonRows, scores, supplierProfiles);

  // 排名
  const rankings = {};
  const sorted = [...comparisonRows].sort((a, b) => b.effective_unit_cost - a.effective_unit_cost);
  sorted.forEach((row, i) => {
    rankings[row.supplier_id] = i + 1;
  });

  return {
    component_no: component?.component_no || '',
    component_name: component?.component_name || '',
    comparison_rows: comparisonRows,
    scores,
    recommendation,
    rankings,
    notes: [
      '本报告基于 demo 阶段 mock 数据生成',
      '评分权重: 总成本40% / 单价25% / 模具费15% / 供应商资质10% / 交付10%',
      '金额已统一折算为基础币种',
    ],
    generated_at: new Date().toISOString(),
  };
}

export {
  buildComparisonRows,
  calculateScores,
  generateRecommendation,
  generateAwardSummary,
  SCORING_WEIGHTS,
};
