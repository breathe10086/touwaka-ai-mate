/**
 * 报价标准化模块
 *
 * 职责：
 * - 将供应商原始报价统一到基础币种（demo 默认 RMB）
 * - 区分原始值与标准化值
 * - 计算派生比较指标
 */
import { KEY_COMPARISON_FIELDS } from './quote-types.js';

/**
 * 基础币种（demo 阶段默认 RMB）
 */
const BASE_CURRENCY = 'RMB';

/**
 * @typedef {Object} NormalizedQuote
 * @property {string} supplier_id
 * @property {string} supplier_name
 * @property {Object<string, { original: number, normalized: number, currency: string, rate: number }>} fields
 * @property {Object<string, number>} derived - 派生指标
 */

/**
 * 标准化单个供应商报价
 * @param {SupplierQuote} quote
 * @returns {NormalizedQuote}
 */
function normalizeQuote(quote) {
  const rate = quote.x_rate_to_base || 1.0;
  const fields = {};

  // 对所有金额字段做归一化
  const amountFields = [
    'piece_price',
    'delivered_piece_price',
    'tooling_cost',
    'part_price_ddp_per_part',
    'total_project_cost',
    'ex_works_price',
    'transport_cost',
    'duties_cost',
    'packaging_cost',
    'raw_material_cost',
    'assembly_cost',
    'total_production_cost',
    'overhead_scrap_profit',
    'quick_saving_payment',
  ];

  for (const field of amountFields) {
    const original = Number(quote[field]) || 0;
    fields[field] = {
      original,
      normalized: original * rate,
      currency: quote.local_currency || BASE_CURRENCY,
      rate,
    };
  }

  // 非金额字段直接透传
  fields.quoted_volume = {
    original: Number(quote.quoted_volume) || 0,
    normalized: Number(quote.quoted_volume) || 0,
    currency: '',
    rate: 1.0,
  };

  // 派生指标
  const derived = {};
  const volume = Number(quote.quoted_volume) || 1;

  // 含模具费的总项目成本
  derived.total_with_tooling = fields.total_project_cost.normalized + fields.tooling_cost.normalized;

  // 单件综合成本（含模具摊销）
  derived.effective_unit_cost = volume > 0
    ? derived.total_with_tooling / volume
    : fields.piece_price.normalized;

  // DDP 总成本
  derived.total_ddp = fields.part_price_ddp_per_part.normalized * volume;

  // Quick saving 效益（如有）
  if (quote.quick_saving_rate && quote.quick_saving_term) {
    derived.quick_saving_annual = fields.piece_price.normalized * volume * (quote.quick_saving_rate / 100);
  } else {
    derived.quick_saving_annual = 0;
  }

  return {
    supplier_id: quote.supplier_id,
    supplier_name: quote.supplier_name,
    component_no: quote.component_no,
    component_name: quote.component_name,
    fields,
    derived,
    normalized_at: new Date().toISOString(),
  };
}

/**
 * 批量标准化
 * @param {SupplierQuote[]} quotes
 * @returns {NormalizedQuote[]}
 */
function normalizeQuotes(quotes) {
  return quotes.map(normalizeQuote);
}

/**
 * 获取标准化字段的比较值
 * @param {NormalizedQuote} nq
 * @param {string} fieldName
 * @returns {number}
 */
function getNormalizedValue(nq, fieldName) {
  if (nq.derived[fieldName] !== undefined) {
    return nq.derived[fieldName];
  }
  if (nq.fields[fieldName] !== undefined) {
    return nq.fields[fieldName].normalized;
  }
  return 0;
}

export {
  normalizeQuote,
  normalizeQuotes,
  getNormalizedValue,
  BASE_CURRENCY,
};
