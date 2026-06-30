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

// ==================== PN 级局部状态（audit-round04） ====================

/**
 * 约束编辑状态（per PN）
 *
 * 4 状态机（audit-round05 修正）：
 *   first_entry_editing → (保存) → saved_locked
 *   saved_locked → (点击"修改约束") → manual_editing
 *   manual_editing → (保存) → manual_saved_locked
 *   manual_saved_locked → (点击"修改约束") → manual_editing
 */
const PN_REQUIREMENT_STATUS = Object.freeze({
  FIRST_ENTRY_EDITING: 'first_entry_editing',       // 首次进入，可编辑
  SAVED_LOCKED: 'saved_locked',                      // 首次保存后锁定，只读
  MANUAL_EDITING: 'manual_editing',                  // 点"修改约束"后进入编辑
  MANUAL_SAVED_LOCKED: 'manual_saved_locked',        // 手动修改后保存，只读
});

/**
 * 供应商选择状态（per PN）
 */
const PN_SUPPLIER_SELECTION_STATUS = Object.freeze({
  NOT_STARTED: 'not_started',           // 未开始推荐
  SELECTING: 'selecting',               // 正在选择（勾选框可见）
  CONFIRMED: 'confirmed',               // 已确认（勾选框消失，显示"修改供应商"）
});

/**
 * RFQ 包状态（per PN）
 */
const PN_RFQ_STATUS = Object.freeze({
  NOT_PREPARED: 'not_prepared',         // 未生成 RFQ 预览
  PREPARED: 'prepared',                  // 已生成预览，可发送
  SENT: 'sent',                          // 已发送，可查看
});

/**
 * 报价回传状态（per PN）
 */
const PN_QUOTE_COLLECTION_STATUS = Object.freeze({
  NONE_REPLIED: 'none_replied',         // 尚无回传
  PARTIAL_REPLIED: 'partial_replied',   // 部分回传
  ALL_REPLIED: 'all_replied',           // 全部回传
});

export {
  STATUS,
  STATUS_TRANSITIONS,
  STATUS_ORDER,
  STATUS_LIGHT,
  BUYER_ASSIGNMENT_RULES,
  SUPPLIER_RECOMMENDATION_DIMENSIONS,
  PN_REQUIREMENT_STATUS,
  PN_SUPPLIER_SELECTION_STATUS,
  PN_RFQ_STATUS,
  PN_QUOTE_COLLECTION_STATUS,
};
