/**
 * 供应商选择与推荐模块
 *
 * demo 阶段：
 * - 使用预置的 mock 供应商池
 * - 按 category + quantity_range + process_type 做规则筛选
 * - 输出推荐列表（含推荐理由）
 */
import { SUPPLIER_RECOMMENDATION_DIMENSIONS } from '../../state/state-constants.js';

/**
 * Mock 供应商池
 * 字段贴近真实模板中的关键字段
 */
const SUPPLIER_POOL = [
  {
    id: 'supplier_alpha',
    name: 'Alpha Precision Ltd.',
    categories: ['electronics', 'mechanical'],
    process_types: ['cnc_machining', 'injection_molding'],
    quantity_range: { min: 100, max: 100000 },
    certification: 'TS16949',
    country: 'China',
    city: 'Suzhou',
    historical_win_rate: 0.65,
    historical_quote_count: 12,
    last_quote_at: '2025-12-15',
    avg_price_level: 'medium',
  },
  {
    id: 'supplier_beta',
    name: 'Beta Components Co.',
    categories: ['electronics', 'fasteners'],
    process_types: ['stamping', 'assembly'],
    quantity_range: { min: 500, max: 500000 },
    certification: 'TS16949',
    country: 'China',
    city: 'Dongguan',
    historical_win_rate: 0.45,
    historical_quote_count: 8,
    last_quote_at: '2025-11-20',
    avg_price_level: 'low',
  },
  {
    id: 'supplier_gamma',
    name: 'Gamma Industrial GmbH',
    categories: ['mechanical', 'raw_material'],
    process_types: ['cnc_machining', 'forging'],
    quantity_range: { min: 50, max: 50000 },
    certification: 'TS16949',
    country: 'Germany',
    city: 'Stuttgart',
    historical_win_rate: 0.70,
    historical_quote_count: 15,
    last_quote_at: '2026-01-10',
    avg_price_level: 'high',
  },
  {
    id: 'supplier_delta',
    name: 'Delta Manufacturing',
    categories: ['mechanical', 'packaging'],
    process_types: ['injection_molding', 'extrusion'],
    quantity_range: { min: 1000, max: 200000 },
    certification: 'ISO9001',
    country: 'China',
    city: 'Ningbo',
    historical_win_rate: 0.55,
    historical_quote_count: 20,
    last_quote_at: '2026-02-28',
    avg_price_level: 'low',
  },
  {
    id: 'supplier_epsilon',
    name: 'Epsilon Tech Solutions',
    categories: ['electronics'],
    process_types: ['pcb_assembly', 'smd'],
    quantity_range: { min: 100, max: 100000 },
    certification: 'TS16949',
    country: 'China',
    city: 'Shenzhen',
    historical_win_rate: 0.60,
    historical_quote_count: 18,
    last_quote_at: '2026-03-05',
    avg_price_level: 'medium',
  },
  {
    id: 'supplier_zeta',
    name: 'Zeta Parts Supply',
    categories: ['fasteners', 'raw_material'],
    process_types: ['stamping', 'cold_heading'],
    quantity_range: { min: 5000, max: 1000000 },
    certification: 'TS16949',
    country: 'China',
    city: 'Wenzhou',
    historical_win_rate: 0.50,
    historical_quote_count: 25,
    last_quote_at: '2026-01-22',
    avg_price_level: 'low',
  },
];

/**
 * 为指定 component 推荐供应商
 * @param {EBOMComponent} component
 * @param {ConstraintForm} constraintForm
 * @returns {Array<{ supplier: Object, score: number, reasons: string[] }>}
 */
function recommendSuppliers(component, constraintForm) {
  const category = (component.category || 'default').toLowerCase();
  const quantity = constraintForm?.quantity || component.quantity || 0;
  const processType = (constraintForm?.process_type || '').toLowerCase();

  const results = SUPPLIER_POOL.map(supplier => {
    const reasons = [];
    let score = 0;

    // 品类匹配（权重 40）
    if (supplier.categories.includes(category)) {
      score += 40;
      reasons.push(`品类匹配: ${category}`);
    }

    // 数量区间匹配（权重 25）
    if (quantity >= supplier.quantity_range.min && quantity <= supplier.quantity_range.max) {
      score += 25;
      reasons.push(`数量区间匹配 (${supplier.quantity_range.min}-${supplier.quantity_range.max})`);
    } else if (quantity > 0) {
      score += 5;
      reasons.push(`数量偏离推荐区间`);
    }

    // 工艺匹配（权重 20）
    if (processType && supplier.process_types.some(pt => pt.toLowerCase().includes(processType))) {
      score += 20;
      reasons.push(`工艺匹配: ${processType}`);
    } else if (processType) {
      reasons.push(`工艺不完全匹配`);
    }

    // 历史表现（权重 15）
    score += supplier.historical_win_rate * 15;
    if (supplier.historical_win_rate >= 0.6) {
      reasons.push(`历史中标率高 (${(supplier.historical_win_rate * 100).toFixed(0)}%)`);
    }
    reasons.push(`历史报价 ${supplier.historical_quote_count} 次`);

    return { supplier, score: Math.round(score), reasons };
  });

  // 按分数排序，返回 top N
  return results
    .filter(r => r.score > 20)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

/**
 * 获取所有供应商
 * @returns {Object[]}
 */
function getAllSuppliers() {
  return SUPPLIER_POOL;
}

/**
 * 按 ID 获取供应商
 * @param {string} supplierId
 * @returns {Object|null}
 */
function getSupplierById(supplierId) {
  return SUPPLIER_POOL.find(s => s.id === supplierId) || null;
}

export {
  recommendSuppliers,
  getAllSuppliers,
  getSupplierById,
  SUPPLIER_POOL,
};
