/**
 * EBOM 解析器
 *
 * 职责：
 * - 解析 CSV / JSON 格式的 EBOM 数据
 * - 拆解出 project 和 component 列表
 * - 做基本的校验（必填字段、数据类型）
 * - 返回解析结果和错误清单
 *
 * demo 阶段支持固定列的 CSV / JSON 导入
 */

/**
 * 必填字段定义
 */
const REQUIRED_FIELDS = ['Component_No', 'Component_Name', 'Quantity'];

/**
 * 字段映射：CSV 列名 -> 内部 snake_case 字段名
 */
const FIELD_MAP = {
  'Part_No': 'part_no',
  'Part_Name': 'part_name',
  'Component_No': 'component_no',
  'Component_Name': 'component_name',
  'Quantity': 'quantity',
  'category': 'category',
  'Unit': 'unit',
  'material_spec': 'material_spec',
};

/**
 * 解析 EBOM JSON 数据
 * @param {Object} input - { project: EBOMProject, rows: EBOMRawRow[] }
 * @returns {{ project: EBOMProject, components: EBOMComponent[], errors: string[] }}
 */
function parseEBOMJSON(input) {
  const errors = [];
  const components = [];

  if (!input.project || !input.project.project_code) {
    errors.push('缺少项目基础信息 (project_code)');
    return { project: null, components: [], errors };
  }

  const project = {
    project_code: input.project.project_code,
    project_name: input.project.project_name || '',
    part_no: input.project.part_no || '',
    part_name: input.project.part_name || '',
    expected_supply_qty_monthly: Number(input.project.expected_supply_qty_monthly) || 0,
    expected_supply_qty_yearly: Number(input.project.expected_supply_qty_yearly) || 0,
    background_note: input.project.background_note || '',
  };

  if (!Array.isArray(input.rows) || input.rows.length === 0) {
    errors.push('EBOM 行数据为空');
    return { project, components: [], errors };
  }

  input.rows.forEach((row, index) => {
    const rowErrors = [];

    // 校验必填字段
    for (const field of REQUIRED_FIELDS) {
      if (!row[field] && row[field] !== 0) {
        rowErrors.push(`第 ${index + 1} 行缺少必填字段: ${field}`);
      }
    }

    const quantity = Number(row.Quantity);
    if (isNaN(quantity) || quantity <= 0) {
      rowErrors.push(`第 ${index + 1} 行 Quantity 无效: ${row.Quantity}`);
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      return;
    }

    const component = {
      component_no: String(row.Component_No).trim(),
      component_name: String(row.Component_Name).trim(),
      quantity,
      category: (row.category || row.Category || 'default').trim().toLowerCase(),
      unit: (row.Unit || row.unit || 'pcs').trim(),
      material_spec: (row.material_spec || row['material_spec'] || '').trim(),
      buyer_id: null,
    };

    // 去重检查
    const dup = components.find(c => c.component_no === component.component_no);
    if (dup) {
      errors.push(`第 ${index + 1} 行 Component_No 重复: ${component.component_no}`);
      return;
    }

    components.push(component);
  });

  return { project, components, errors };
}

/**
 * 解析 EBOM CSV 文本
 * @param {string} csvText - CSV 文本内容
 * @returns {{ project: EBOMProject, components: EBOMComponent[], errors: string[] }}
 */
function parseEBOMCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    return { project: null, components: [], errors: ['CSV 数据为空或只有表头'] };
  }

  // 第一行为表头
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    rows.push(row);
  }

  // 构造 JSON 输入格式
  const input = {
    project: {
      project_code: 'EBOM_IMPORT_' + Date.now(),
      project_name: '导入项目',
      part_no: rows[0]?.Part_No || '',
      part_name: rows[0]?.Part_Name || '',
      expected_supply_qty_monthly: 0,
      expected_supply_qty_yearly: 0,
      background_note: '',
    },
    rows,
  };

  return parseEBOMJSON(input);
}

/**
 * 统计 component 品类分布
 * @param {EBOMComponent[]} components
 * @returns {Object<string, number>}
 */
function summarizeCategories(components) {
  const summary = {};
  components.forEach(c => {
    const cat = c.category || 'uncategorized';
    summary[cat] = (summary[cat] || 0) + 1;
  });
  return summary;
}

export {
  parseEBOMJSON,
  parseEBOMCSV,
  summarizeCategories,
  REQUIRED_FIELDS,
};
