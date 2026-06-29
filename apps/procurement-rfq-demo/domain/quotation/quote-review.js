/**
 * 报价审核模块 (Quote Review)
 *
 * 职责（audit-round02 P0）：
 * - 展示已导入 supplier quote 列表
 * - 提取关键字段供 Buyer 审核
 * - 标准化口径对比
 * - 识别缺失项 / 异常项
 */

/**
 * 关键审核字段 —— 从完整 SupplierQuote 中提取
 */
const REVIEW_FIELDS = [
  { key: 'piece_price', label: '零件单价', type: 'number' },
  { key: 'delivered_piece_price', label: '交付单价', type: 'number' },
  { key: 'tooling_cost', label: '模具费', type: 'number' },
  { key: 'part_price_ddp_per_part', label: 'DDP 单价', type: 'number' },
  { key: 'quoted_volume', label: '报价数量', type: 'number' },
  { key: 'local_currency', label: '报价币种', type: 'string' },
  { key: 'x_rate_to_base', label: '汇率', type: 'number' },
  { key: 'total_project_cost', label: '项目总成本', type: 'number' },
  { key: 'tooling_lead_time', label: '模具交期(天)', type: 'number' },
  { key: 'tooling_payment_terms', label: '模具付款条件', type: 'string' },
  { key: 'quick_saving_rate', label: '快速降本比例(%)', type: 'number' },
  { key: 'quick_saving_term', label: '快速降本期(月)', type: 'number' },
  { key: 'quote_status', label: '报价状态', type: 'string' },
];

/**
 * 异常检测规则
 * 返回 { field, level: 'warning'|'error', message }
 */
function detectAnomalies(quote, allQuotes) {
  const anomalies = [];

  // 必填字段检查
  if (quote.piece_price == null || quote.piece_price <= 0) {
    anomalies.push({ field: 'piece_price', level: 'error', message: '零件单价缺失或为0' });
  }
  if (!quote.local_currency) {
    anomalies.push({ field: 'local_currency', level: 'error', message: '报价币种缺失' });
  }

  // 与其他供应商偏差过大的检查
  if (allQuotes && allQuotes.length >= 2) {
    const others = allQuotes.filter(q => q.supplier_id !== quote.supplier_id);
    if (others.length > 0 && quote.piece_price > 0) {
      const avgPrice = others.reduce((s, q) => s + (q.piece_price || 0), 0) / others.length;
      if (avgPrice > 0) {
        const deviation = Math.abs(quote.piece_price - avgPrice) / avgPrice;
        if (deviation > 0.5) {
          anomalies.push({
            field: 'piece_price',
            level: 'warning',
            message: `单价比同行均值偏差 ${(deviation * 100).toFixed(0)}%`,
          });
        }
      }
    }
    // 模具费偏差
    if (quote.tooling_cost > 0 && others.length > 0) {
      const avgTooling = others.reduce((s, q) => s + (q.tooling_cost || 0), 0) / others.length;
      if (avgTooling > 0 && Math.abs(quote.tooling_cost - avgTooling) / avgTooling > 0.4) {
        anomalies.push({
          field: 'tooling_cost',
          level: 'warning',
          message: `模具费与同行均值偏差较大`,
        });
      }
    }
  }

  // 报价状态
  if (quote.quote_status && quote.quote_status !== 'confirmed') {
    anomalies.push({
      field: 'quote_status',
      level: 'warning',
      message: `报价状态: ${quote.quote_status}`,
    });
  }

  return anomalies;
}

/**
 * 生成报价审核摘要
 * @param {string} component_id
 * @param {Object[]} quotes - 原始报价列表
 * @param {Object[]} normalizedQuotes - 标准化报价列表
 * @returns {Object} review summary
 */
function generateQuoteReview(component_id, quotes, normalizedQuotes) {
  const supplierReviews = quotes.map(quote => {
    const normalized = normalizedQuotes.find(n => n.supplier_id === quote.supplier_id);
    const anomalies = detectAnomalies(quote, quotes);

    // 提取审核字段
    const reviewFields = REVIEW_FIELDS.map(f => ({
      key: f.key,
      label: f.label,
      value: quote[f.key] ?? null,
      normalized_value: normalized ? normalized[f.key] ?? null : null,
      type: f.type,
    }));

    return {
      supplier_id: quote.supplier_id,
      supplier_name: quote.supplier_name,
      review_fields: reviewFields,
      anomalies,
      anomaly_count: anomalies.length,
      has_errors: anomalies.some(a => a.level === 'error'),
    };
  });

  return {
    component_id,
    supplier_reviews: supplierReviews,
    total_suppliers: supplierReviews.length,
    total_anomalies: supplierReviews.reduce((s, r) => s + r.anomaly_count, 0),
    generated_at: new Date().toISOString(),
  };
}

export {
  REVIEW_FIELDS,
  detectAnomalies,
  generateQuoteReview,
};
