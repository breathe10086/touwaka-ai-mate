/**
 * 采购 RFQ Demo - 状态常量与状态控制
 *
 * 设计原则（来自 audit-round03）：
 * - 压缩为 8 个主阶段，对应单页 buyer workbench 工作流
 * - 状态常量集中定义，状态跳转关系集中定义
 * - status_light 只服务于列表与显著状态显示
 * - 复杂派生状态统一通过 selector / computed 推导
 * - 同一语义只保留一个来源，不允许多个布尔变量并存
 */

/**
 * 主状态枚举（8 个阶段）
 */
const STATUS = Object.freeze({
  EBOM_IMPORTED: 'ebom_imported',                           // EBOM 已导入
  BUYER_ASSIGNED: 'buyer_assigned',                          // Buyer 已分派
  RFQ_PREPARED: 'rfq_prepared',                             // RFQ 已准备
  RFQ_SENT: 'rfq_sent',                                     // RFQ 已发送
  SUPPLIER_FEEDBACK_IN_PROGRESS: 'supplier_feedback_in_progress', // 供应商反馈中
  BENCHMARK_READY: 'benchmark_ready',                       // Benchmark 已就绪
  SOURCING_FILE_READY: 'sourcing_file_ready',               // Sourcing File 条件满足
  SOURCING_FILE_GENERATED: 'sourcing_file_generated',       // Sourcing File 已生成
});

/**
 * 状态跳转图（单向主链路）
 */
const STATUS_TRANSITIONS = Object.freeze({
  [STATUS.EBOM_IMPORTED]: [STATUS.BUYER_ASSIGNED],
  [STATUS.BUYER_ASSIGNED]: [STATUS.RFQ_PREPARED],
  [STATUS.RFQ_PREPARED]: [STATUS.RFQ_SENT],
  [STATUS.RFQ_SENT]: [STATUS.SUPPLIER_FEEDBACK_IN_PROGRESS],
  [STATUS.SUPPLIER_FEEDBACK_IN_PROGRESS]: [STATUS.BENCHMARK_READY],
  [STATUS.BENCHMARK_READY]: [STATUS.SOURCING_FILE_READY],
  [STATUS.SOURCING_FILE_READY]: [STATUS.SOURCING_FILE_GENERATED],
});

/**
 * 状态顺序（用于判断是否已到达某阶段）
 */
const STATUS_ORDER = Object.freeze([
  STATUS.EBOM_IMPORTED,
  STATUS.BUYER_ASSIGNED,
  STATUS.RFQ_PREPARED,
  STATUS.RFQ_SENT,
  STATUS.SUPPLIER_FEEDBACK_IN_PROGRESS,
  STATUS.BENCHMARK_READY,
  STATUS.SOURCING_FILE_READY,
  STATUS.SOURCING_FILE_GENERATED,
]);

/**
 * 状态灯映射（用于左侧列表显著状态显示）
 */
const STATUS_LIGHT = Object.freeze({
  [STATUS.EBOM_IMPORTED]: { color: 'info', label: '待分派' },
  [STATUS.BUYER_ASSIGNED]: { color: '', label: 'Buyer已分派' },
  [STATUS.RFQ_PREPARED]: { color: 'warning', label: 'RFQ已备' },
  [STATUS.RFQ_SENT]: { color: '', label: 'RFQ已发' },
  [STATUS.SUPPLIER_FEEDBACK_IN_PROGRESS]: { color: 'warning', label: '等待回传' },
  [STATUS.BENCHMARK_READY]: { color: 'success', label: 'Benchmark就绪' },
  [STATUS.SOURCING_FILE_READY]: { color: 'success', label: '可生成文件' },
  [STATUS.SOURCING_FILE_GENERATED]: { color: 'success', label: '已完成' },
});

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
  STATUS_LIGHT,
  BUYER_ASSIGNMENT_RULES,
  SUPPLIER_RECOMMENDATION_DIMENSIONS,
};
