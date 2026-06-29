/**
 * 供应商选择与推荐模块
 *
 * 规则型推荐（首版不依赖历史数据），基于：
 * - category（品类）
 * - process_type（工艺）
 * - quantity_range（数量区间）
 * - region（所属区域）
 * - supplier_capability_tag（供应商能力标签）
 */
import { SUPPLIER_RECOMMENDATION_DIMENSIONS } from '../../state/state-constants.js';

/**
 * Mock 供应商池
 */
const SUPPLIER_POOL = [
  {
    id: 'supplier_alpha',
    name: 'Alpha Precision Ltd.',
    categories: ['electronics', 'mechanical'],
    process_types: ['cnc_machining', 'injection_molding'],
    quantity_range: { min: 100, max: 100000 },
    region: 'east_china',
    capability_tags: ['high_precision', 'ts16949'],
    certification: 'TS16949',
    country: 'China',
    city: 'Suzhou',
    avg_price_level: 'medium',
  },
  {
    id: 'supplier_beta',
    name: 'Beta Components Co.',
    categories: ['electronics', 'fasteners'],
    process_types: ['stamping', 'assembly'],
    quantity_range: { min: 500, max: 500000 },
    region: 'south_china',
    capability_tags: ['high_volume', 'ts16949'],
    certification: 'TS16949',
    country: 'China',
    city: 'Dongguan',
    avg_price_level: 'low',
  },
  {
    id: 'supplier_gamma',
    name: 'Gamma Industrial GmbH',
    categories: ['mechanical', 'raw_material'],
    process_types: ['cnc_machining', 'forging'],
    quantity_range: { min: 50, max: 50000 },
    region: 'europe',
    capability_tags: ['high_precision', 'ts16949', 'europe_sourcing'],
    certification: 'TS16949',
    country: 'Germany',
    city: 'Stuttgart',
    avg_price_level: 'high',
  },
  {
    id: 'supplier_delta',
    name: 'Delta Manufacturing',
    categories: ['mechanical', 'packaging'],
    process_types: ['injection_molding', 'extrusion'],
    quantity_range: { min: 1000, max: 200000 },
    region: 'east_china',
    capability_tags: ['high_volume', 'iso9001'],
    certification: 'ISO9001',
    country: 'China',
    city: 'Ningbo',
    avg_price_level: 'low',
  },
  {
    id: 'supplier_epsilon',
    name: 'Epsilon Tech Solutions',
    categories: ['electronics'],
    process_types: ['pcb_assembly', 'smd'],
    quantity_range: { min: 100, max: 100000 },
    region: 'south_china',
    capability_tags: ['pcb_specialist', 'ts16949'],
    certification: 'TS16949',
    country: 'China',
    city: 'Shenzhen',
    avg_price_level: 'medium',
  },
  {
    id: 'supplier_zeta',
    name: 'Zeta Parts Supply',
    categories: ['fasteners', 'raw_material'],
    process_types: ['stamping', 'cold_heading'],
    quantity_range: { min: 5000, max: 1000000 },
    region: 'east_china',
    capability_tags: ['high_volume', 'ts16949', 'low_cost'],
    certification: 'TS16949',
    country: 'China',
    city: 'Wenzhou',
    avg_price_level: 'low',
  },
];

/**
 * 区域中文映射
 */
const REGION_LABELS = {
  east_china: '华东',
  south_china: '华南',
  north_china: '华北',
  europe: '欧洲',
  southeast_asia: '东南亚',
};

/**
 * 能力标签中文映射
 */
const CAPABILITY_LABELS = {
  high_precision: '高精度',
  high_volume: '大批量',
  ts16949: 'TS16949认证',
  iso9001: 'ISO9001',
  pcb_specialist: 'PCB专长',
  europe_sourcing: '欧洲采购',
  low_cost: '低成本',
};

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

    // 品类匹配（权重 35）
    if (supplier.categories.includes(category)) {
      score += 35;
      reasons.push(`品类匹配: ${category}`);
    }

    // 数量区间匹配（权重 20）
    if (quantity >= supplier.quantity_range.min && quantity <= supplier.quantity_range.max) {
      score += 20;
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

    // 区域匹配（权重 15）—— 优先国内供应商，欧洲作备选
    if (supplier.region === 'east_china' || supplier.region === 'south_china') {
      score += 15;
      reasons.push(`区域优势: ${REGION_LABELS[supplier.region] || supplier.region}`);
    } else if (supplier.region !== 'europe') {
      score += 8;
      reasons.push(`区域: ${REGION_LABELS[supplier.region] || supplier.region}`);
    }

    // 能力标签匹配（权重 10）
    const matchedTags = supplier.capability_tags.filter(tag =>
      CAPABILITY_LABELS[tag]
    );
    if (matchedTags.length > 0) {
      score += Math.min(matchedTags.length * 3, 10);
      reasons.push(`能力标签: ${matchedTags.map(t => CAPABILITY_LABELS[t]).join('、')}`);
    }

    return { supplier, score: Math.round(score), reasons };
  });

  // 按分数排序，返回 top N（去掉历史数据下限，仅要求品类匹配）
  return results
    .filter(r => r.score >= 15)
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
  REGION_LABELS,
  CAPABILITY_LABELS,
};
