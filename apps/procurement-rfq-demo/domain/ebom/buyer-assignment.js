/**
 * Buyer 分派模块
 *
 * 职责：
 * - 根据 component.category 自动匹配 Buyer
 * - 基于静态规则表（demo 阶段）
 * - 支持手动覆盖
 */
import { BUYER_ASSIGNMENT_RULES } from '../../state/state-constants.js';

/**
 * Buyer 信息池
 */
const BUYER_POOL = {
  buyer_zhang: { id: 'buyer_zhang', name: '张工', categories: ['electronics'] },
  buyer_li: { id: 'buyer_li', name: '李工', categories: ['mechanical'] },
  buyer_wang: { id: 'buyer_wang', name: '王工', categories: ['fasteners'] },
  buyer_zhao: { id: 'buyer_zhao', name: '赵工', categories: ['packaging'] },
  buyer_sun: { id: 'buyer_sun', name: '孙工', categories: ['raw_material'] },
  buyer_pool: { id: 'buyer_pool', name: '采购池（待分配）', categories: [] },
};

/**
 * 为单个 component 分派 Buyer
 * @param {EBOMComponent} component
 * @returns {string} buyer_id
 */
function assignBuyerToComponent(component) {
  const category = (component.category || 'default').toLowerCase();
  return BUYER_ASSIGNMENT_RULES[category] || BUYER_ASSIGNMENT_RULES.default;
}

/**
 * 为所有 components 批量分派 Buyer
 * @param {EBOMComponent[]} components
 * @returns {EBOMComponent[]} 已分派的 components（含 buyer_id）
 */
function assignBuyers(components) {
  return components.map(c => ({
    ...c,
    buyer_id: assignBuyerToComponent(c),
  }));
}

/**
 * 获取某 Buyer 负责的所有 components
 * @param {EBOMComponent[]} components
 * @param {string} buyer_id
 * @returns {EBOMComponent[]}
 */
function getBuyerComponents(components, buyer_id) {
  return components.filter(c => c.buyer_id === buyer_id);
}

/**
 * 获取 Buyer 信息
 * @param {string} buyer_id
 * @returns {Object|null}
 */
function getBuyerInfo(buyer_id) {
  return BUYER_POOL[buyer_id] || null;
}

/**
 * 获取所有可用 Buyer 列表
 * @returns {Object[]}
 */
function getAllBuyers() {
  return Object.values(BUYER_POOL);
}

/**
 * 生成分派汇总报告
 * @param {EBOMComponent[]} components
 * @returns {Object<string, { buyer_name: string, component_count: number, components: EBOMComponent[] }>}
 */
function generateAssignmentReport(components) {
  const report = {};
  components.forEach(c => {
    const bid = c.buyer_id;
    if (!report[bid]) {
      const info = getBuyerInfo(bid);
      report[bid] = {
        buyer_name: info?.name || bid,
        component_count: 0,
        components: [],
      };
    }
    report[bid].component_count++;
    report[bid].components.push(c);
  });
  return report;
}

export {
  assignBuyerToComponent,
  assignBuyers,
  getBuyerComponents,
  getBuyerInfo,
  getAllBuyers,
  generateAssignmentReport,
  BUYER_POOL,
};
