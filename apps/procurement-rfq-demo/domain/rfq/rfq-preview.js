/**
 * RFQ 预览组织模块
 *
 * 职责：
 * - 基于 project + component + constraint_form + selected_suppliers 生成 RFQ 预览上下文
 * - 预览不生成真实 Excel，而是返回结构化的预览数据
 * - 后续可扩展为真实 Excel 生成
 */

/**
 * 生成 RFQ 预览数据
 * @param {Object} params
 * @param {EBOMProject} params.project
 * @param {EBOMComponent} params.component
 * @param {ConstraintForm} params.constraintForm
 * @param {string[]} params.selectedSupplierIds
 * @param {Object<string, Object>} params.supplierInfoMap - supplier id -> supplier info
 * @returns {Object} RFQ 预览数据
 */
function generateRFQPreview({ project, component, constraintForm, selectedSupplierIds, supplierInfoMap }) {
  const suppliers = selectedSupplierIds.map(id => {
    const info = supplierInfoMap[id] || { id, name: id };
    return {
      supplier_id: id,
      supplier_name: info.name || id,
      certification: info.certification || '',
      country: info.country || '',
      city: info.city || '',
    };
  });

  const preview = {
    // 询价背景
    quotation_background: {
      project_code: project?.project_code || '',
      project_name: project?.project_name || '',
      part_no: project?.part_no || '',
      part_name: project?.part_name || '',
      component_no: component?.component_no || '',
      component_name: component?.component_name || '',
      quantity: constraintForm?.quantity || component?.quantity || 0,
      quantity_unit: constraintForm?.quantity_unit || 'pcs',
      expected_monthly: constraintForm?.expected_supply_qty_monthly || 0,
      expected_yearly: constraintForm?.expected_supply_qty_yearly || 0,
      currency_mode: constraintForm?.currency_mode || 'RMB',
      target_incoterm: constraintForm?.target_incoterm || 'DDP',
      background_note: project?.background_note || '',
    },

    // 约束条件摘要
    constraint_summary: {
      process_type: constraintForm?.process_type || '',
      material_spec: constraintForm?.material_spec || '',
      surface_treatment: constraintForm?.surface_treatment || '',
      mold_requirement: constraintForm?.mold_requirement || '',
      delivery_requirement: constraintForm?.delivery_requirement || '',
      packing_requirement: constraintForm?.packing_requirement || '',
      quality_requirement: constraintForm?.quality_requirement || '',
      special_note: constraintForm?.special_note || '',
      quotation_breakdown_required: constraintForm?.quotation_breakdown_required !== false,
      tooling_cost_required: constraintForm?.tooling_cost_required || false,
    },

    // 供应商列表
    suppliers,

    // 生成时间
    generated_at: new Date().toISOString(),
  };

  return preview;
}

/**
 * 生成 RFQ 邮件正文预览（纯文本说明）
 * @param {Object} preview - generateRFQPreview 的结果
 * @returns {string}
 */
function generateRFQEmailPreview(preview) {
  const bg = preview.quotation_background;
  const cs = preview.constraint_summary;

  let text = '';
  text += `询价项目: ${bg.project_name} (${bg.project_code})\n`;
  text += `成品编号: ${bg.part_no} / ${bg.part_name}\n`;
  text += `待询价部件: ${bg.component_no} - ${bg.component_name}\n`;
  text += `数量: ${bg.quantity} ${bg.quantity_unit}\n`;
  text += `贸易术语: ${bg.target_incoterm}\n\n`;

  text += `关键约束:\n`;
  if (cs.process_type) text += `  - 加工方式: ${cs.process_type}\n`;
  if (cs.material_spec) text += `  - 材质: ${cs.material_spec}\n`;
  if (cs.surface_treatment) text += `  - 表面处理: ${cs.surface_treatment}\n`;
  if (cs.delivery_requirement) text += `  - 交付要求: ${cs.delivery_requirement}\n`;
  if (cs.special_note) text += `  - 备注: ${cs.special_note}\n`;
  text += '\n';

  text += `候选供应商 (${preview.suppliers.length} 家):\n`;
  preview.suppliers.forEach((s, i) => {
    text += `  ${i + 1}. ${s.supplier_name} (${s.certification}, ${s.city}, ${s.country})\n`;
  });

  return text;
}

export {
  generateRFQPreview,
  generateRFQEmailPreview,
};
