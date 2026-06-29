/**
 * 采购 RFQ Demo - 状态常量与状态控制
 *
 * 设计原则（来自 audit-round01）：
 * - 压缩为 5 个主阶段，不做细碎状态
 * - 状态常量集中定义，状态跳转关系集中定义
 * - 页面不直接持有"派生状态真值"，统一由 selector 推导
 * - 同一语义只保留一个来源，不允许多个布尔变量并存
 */

/**
 * 主状态枚举（5 个阶段）
 */
const STATUS = Object.freeze({
  PROJECT_INITIALIZED: 'project_initialized',   // 项目已初始化
  COMPONENTS_ASSIGNED: 'components_assigned',    // 部件已分派
  RFQ_PREPARED: 'rfq_prepared',                 // RFQ 已准备
  QUOTES_COMPARED: 'quotes_compared',            // 报价已对比
  AWARD_REVIEWED: 'award_reviewed',              // Award 已评审
});

/**
 * 状态跳转图（单向主链路）
 */
const STATUS_TRANSITIONS = Object.freeze({
  [STATUS.PROJECT_INITIALIZED]: [STATUS.COMPONENTS_ASSIGNED],
  [STATUS.COMPONENTS_ASSIGNED]: [STATUS.RFQ_PREPARED],
  [STATUS.RFQ_PREPARED]: [STATUS.QUOTES_COMPARED],
  [STATUS.QUOTES_COMPARED]: [STATUS.AWARD_REVIEWED],
});

/**
 * 状态顺序（用于判断是否已到达某阶段）
 */
const STATUS_ORDER = Object.freeze([
  STATUS.PROJECT_INITIALIZED,
  STATUS.COMPONENTS_ASSIGNED,
  STATUS.RFQ_PREPARED,
  STATUS.QUOTES_COMPARED,
  STATUS.AWARD_REVIEWED,
]);

/**
 * Buyer 分派规则：category -> buyer 静态映射表
 * demo 阶段先用静态规则，后续可扩展为动态配置
 */
const BUYER_ASSIGNMENT_RULES = Object.freeze({
  electronics: 'buyer_zhang',
  mechanical: 'buyer_li',
  fasteners: 'buyer_wang',
  packaging: 'buyer_zhao',
  raw_material: 'buyer_sun',
  default: 'buyer_pool',
});

/**
 * 供应商推荐规则维度
 * demo 阶段按 category + quantity_range + process_type 做规则筛选
 */
const SUPPLIER_RECOMMENDATION_DIMENSIONS = [
  'category',
  'quantity_range',
  'process_type',
];

export {
  STATUS,
  STATUS_TRANSITIONS,
  STATUS_ORDER,
  BUYER_ASSIGNMENT_RULES,
  SUPPLIER_RECOMMENDATION_DIMENSIONS,
};
