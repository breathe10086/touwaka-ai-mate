/**
 * EBOM 领域类型定义
 *
 * 字段来源于新设计方案中的术语约定：
 * - Part_No / Part_Name：成品信息
 * - Component_No / Component_Name / Quantity / category：待采购子零件
 */

/**
 * @typedef {Object} EBOMProject
 * @property {string} project_code - 项目编号
 * @property {string} project_name - 项目名称
 * @property {string} part_no - 成品编号
 * @property {string} part_name - 成品名称
 * @property {number} expected_supply_qty_monthly - 预计月供货量
 * @property {number} expected_supply_qty_yearly - 预计年供货量
 * @property {string} background_note - 用户背景说明
 */

/**
 * @typedef {Object} EBOMComponent
 * @property {string} component_no - 子零件编号
 * @property {string} component_name - 子零件名称
 * @property {number} quantity - 用量
 * @property {string} category - 品类分类
 * @property {string} [buyer_id] - 分派 Buyer ID
 * @property {string} [unit] - 单位
 * @property {string} [material_spec] - 材质规格
 */

/**
 * @typedef {Object} EBOMRawRow
 * @property {string} Part_No - 成品编号
 * @property {string} Part_Name - 成品名称
 * @property {string} Component_No - 子零件编号
 * @property {string} Component_Name - 子零件名称
 * @property {number|string} Quantity - 用量
 * @property {string} [category] - 品类
 * @property {string} [Unit] - 单位
 * @property {string} [material_spec] - 材质
 */

export default {};
