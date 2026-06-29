/**
 * 供应商报价结构定义
 *
 * 从 Cost Breakdown Form 模板关键字段映射而来
 * 内部统一按"单 supplier、单 component、单轮报价一条记录"建模
 * Excel 横向列块只在视图层转换
 */

/**
 * @typedef {Object} SupplierQuote
 * @property {string} supplier_id - 供应商 ID
 * @property {string} supplier_name - 供应商名称
 * @property {string} component_no - 部件编号
 * @property {string} component_name - 部件名称
 * @property {number} piece_price - 单价（原始币种）
 * @property {number} delivered_piece_price - 交付单价（原始币种）
 * @property {number} tooling_cost - 模具费（原始币种）
 * @property {number} part_price_ddp_per_part - DDP 单价
 * @property {number} quoted_volume - 报价数量口径
 * @property {string} local_currency - 本币
 * @property {number} x_rate_to_base - 对基础币种汇率
 * @property {number} total_project_cost - 项目总成本
 * @property {string} [quote_status] - 报价状态
 * @property {string} [quote_date] - 报价日期
 * @property {number} [ex_works_price] - 出厂价
 * @property {number} [transport_cost] - 运输费
 * @property {number} [duties_cost] - 关税
 * @property {number} [packaging_cost] - 包装费
 * @property {number} [raw_material_cost] - 原材料成本
 * @property {number} [assembly_cost] - 装配成本
 * @property {number} [total_production_cost] - 总生产成本
 * @property {number} [overhead_scrap_profit] - 管理/损耗/利润
 * @property {number} [quick_saving_rate] - Quick saving 比率
 * @property {number} [quick_saving_term] - Quick saving 期限
 * @property {number} [quick_saving_payment] - Quick saving 支付
 * @property {string} [amortization_included] - 摊销是否含在单价中 (Y/N)
 * @property {number} [tooling_lead_time] - 模具交期（天）
 * @property {string} [tooling_payment_terms] - 模具付款条款
 */

/**
 * 创建空白供应商报价
 * @param {string} supplier_id
 * @param {string} supplier_name
 * @param {string} component_no
 * @param {string} component_name
 * @returns {SupplierQuote}
 */
function createEmptyQuote(supplier_id, supplier_name, component_no, component_name) {
  return {
    supplier_id,
    supplier_name,
    component_no,
    component_name,
    piece_price: 0,
    delivered_piece_price: 0,
    tooling_cost: 0,
    part_price_ddp_per_part: 0,
    quoted_volume: 0,
    local_currency: 'RMB',
    x_rate_to_base: 1.0,
    total_project_cost: 0,
    quote_status: 'draft',
    quote_date: new Date().toISOString().split('T')[0],
    ex_works_price: 0,
    transport_cost: 0,
    duties_cost: 0,
    packaging_cost: 0,
    raw_material_cost: 0,
    assembly_cost: 0,
    total_production_cost: 0,
    overhead_scrap_profit: 0,
    quick_saving_rate: 0,
    quick_saving_term: 0,
    quick_saving_payment: 0,
    amortization_included: 'N',
    tooling_lead_time: 0,
    tooling_payment_terms: '',
  };
}

/**
 * 关键字段列表（P1 级别的核心比较字段）
 */
const KEY_COMPARISON_FIELDS = [
  'piece_price',
  'delivered_piece_price',
  'tooling_cost',
  'part_price_ddp_per_part',
  'quoted_volume',
  'local_currency',
  'x_rate_to_base',
  'total_project_cost',
];

/**
 * 扩展字段列表（P2 级别，后续再纳入核心卡片）
 */
const EXTENDED_FIELDS = [
  'ex_works_price',
  'transport_cost',
  'duties_cost',
  'packaging_cost',
  'raw_material_cost',
  'assembly_cost',
  'total_production_cost',
  'overhead_scrap_profit',
  'quick_saving_rate',
  'quick_saving_term',
  'quick_saving_payment',
];

export {
  createEmptyQuote,
  KEY_COMPARISON_FIELDS,
  EXTENDED_FIELDS,
};
