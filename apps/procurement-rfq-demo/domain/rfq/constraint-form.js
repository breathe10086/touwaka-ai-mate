/**
 * 约束表单定义
 *
 * 从新设计方案 frontend.md 4.1 节提取
 * Buyer 在发起 RFQ 前必须填写的报价前提条件
 */

/**
 * @typedef {Object} ConstraintForm
 * @property {string} component_id - 关联 component
 * @property {string} process_type - 加工方式
 * @property {string} material_spec - 材质规格
 * @property {string} surface_treatment - 表面处理
 * @property {number} quantity - 数量
 * @property {string} quantity_unit - 数量单位
 * @property {number} expected_supply_qty_monthly - 预计月供货量
 * @property {number} expected_supply_qty_yearly - 预计年供货量
 * @property {string} mold_requirement - 模具要求
 * @property {string} mold_owner - 模具归属
 * @property {string} tooling_requirement - 治具要求
 * @property {string} delivery_requirement - 交付要求
 * @property {string} packing_requirement - 包装要求
 * @property {string} quality_requirement - 质量要求
 * @property {string} inspection_requirement - 检验要求
 * @property {string} special_note - 特殊说明
 * @property {string} currency_mode - 币种模式
 * @property {string} target_incoterm - 目标贸易术语
 * @property {boolean} quotation_breakdown_required - 是否要求 cost breakdown
 * @property {boolean} tooling_cost_required - 是否要求模具费明细
 * @property {boolean} quick_saving_required - 是否要求 quick saving
 * @property {string} status - 草稿 / 已确认
 */

/**
 * 创建空白约束表单
 * @param {string} component_id
 * @returns {ConstraintForm}
 */
function createEmptyConstraintForm(component_id) {
  return {
    component_id,
    process_type: '',
    material_spec: '',
    surface_treatment: '',
    quantity: 0,
    quantity_unit: 'pcs',
    expected_supply_qty_monthly: 0,
    expected_supply_qty_yearly: 0,
    mold_requirement: '',
    mold_owner: '',
    tooling_requirement: '',
    delivery_requirement: '',
    packing_requirement: '',
    quality_requirement: '',
    inspection_requirement: '',
    special_note: '',
    currency_mode: 'RMB',
    target_incoterm: 'DDP',
    quotation_breakdown_required: true,
    tooling_cost_required: false,
    quick_saving_required: false,
    status: 'draft',
    updated_at: new Date().toISOString(),
  };
}

/**
 * 校验约束表单完整性
 * @param {ConstraintForm} form
 * @returns {{ valid: boolean, missing_fields: string[] }}
 */
function validateConstraintForm(form) {
  const required = [
    { field: 'process_type', label: '加工方式' },
    { field: 'quantity', label: '数量', check: v => v > 0 },
    { field: 'delivery_requirement', label: '交付要求' },
    { field: 'target_incoterm', label: '目标贸易术语' },
  ];

  const missing_fields = [];
  for (const { field, label, check } of required) {
    const val = form[field];
    if (check ? !check(val) : !val) {
      missing_fields.push(label);
    }
  }

  return {
    valid: missing_fields.length === 0,
    missing_fields,
  };
}

/**
 * 从 component 信息预填约束表单
 * @param {EBOMComponent} component
 * @returns {ConstraintForm}
 */
function prefillFromComponent(component) {
  const form = createEmptyConstraintForm(component.component_no);
  form.quantity = component.quantity || 0;
  form.quantity_unit = component.unit || 'pcs';
  if (component.material_spec) {
    form.material_spec = component.material_spec;
  }
  return form;
}

export {
  createEmptyConstraintForm,
  validateConstraintForm,
  prefillFromComponent,
};
