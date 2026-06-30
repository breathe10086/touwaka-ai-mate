/**
 * Mock 邮件服务
 *
 * 职责（来自 audit-round03）：
 * - UI 上保留"已发送 / 已回复 / 人工介入"状态
 * - 提供"模拟收到供应商回邮"能力
 * - 当 mock 返回格式异常时，把该 supplier 标记为 manual_intervention_required
 * - benchmark 只在所有必需 supplier 都进入可比较状态后出现
 *
 * 真假边界：
 * - 真状态流转、假邮件抓取可接受
 */
import { getSupplierById } from '../rfq/supplier-selection.js';

/**
 * 邮件状态枚举
 */
const MAIL_STATUS = Object.freeze({
  SENT: 'sent',
  REPLY_RECEIVED: 'reply_received',
  REPLY_PARSED: 'reply_parsed',
  REPLY_PARSE_FAILED: 'reply_parse_failed',
  MANUAL_INTERVENTION_REQUIRED: 'manual_intervention_required',
});

/**
 * 邮件类型枚举
 */
const MAIL_TYPE = Object.freeze({
  RFQ_SEND: 'rfq_send',
  SUPPLIER_REPLY: 'supplier_reply',
});

/**
 * 生成发送 RFQ 邮件的日志条目
 * @param {string} componentId
 * @param {string} supplierId
 * @returns {Object}
 */
function generateRfqSendLog(componentId, supplierId) {
  const supplier = getSupplierById(supplierId);
  return {
    type: MAIL_TYPE.RFQ_SEND,
    component_id: componentId,
    supplier_id: supplierId,
    supplier_name: supplier?.name || supplierId,
    subject: `RFQ: ${componentId} - 询价邀请`,
    body: `尊敬的 ${supplier?.name || supplierId}，\n\n请就以下部件进行报价...\n\n此致`,
    status: MAIL_STATUS.SENT,
    notes: 'RFQ 已发送（演示模式）',
  };
}

/**
 * Mock 供应商回邮数据
 * 按 supplier_id 返回不同的 mock 回邮模板
 */
const MOCK_REPLIES = {
  supplier_alpha: {
    subject: 'Re: RFQ - 报价回复',
    body: '请查收附件中的报价单。如有疑问，请与我们联系。',
    has_attachment: true,
    attachment_name: 'Alpha_Quote_V1.xlsx',
    parse_success: true,
  },
  supplier_beta: {
    subject: 'Re: RFQ - Beta报价',
    body: '附件为详细报价。模具费需另行确认。',
    has_attachment: true,
    attachment_name: 'Beta_Quotation_2026.xlsx',
    parse_success: true,
  },
  supplier_gamma: {
    subject: 'Re: RFQ - Angebot',
    body: 'Bitte finden Sie unser Angebot im Anhang.',
    has_attachment: true,
    attachment_name: 'Gamma_Angebot.pdf',
    parse_success: true,
  },
  supplier_delta: {
    subject: 'Re: RFQ - Delta报价回复',
    body: '附件为正式报价单，标准交期4周。量大可议。',
    has_attachment: true,
    attachment_name: 'Delta_Quote_2026Q3.xlsx',
    parse_success: true,
  },
  supplier_epsilon: {
    subject: 'Re: RFQ - Quote Submission',
    body: 'Please find our quotation attached. Lead time: 6 weeks.',
    has_attachment: true,
    attachment_name: 'Epsilon_Quote_Q3.xlsx',
    parse_success: true,
  },
  supplier_zeta: {
    subject: 'Re: RFQ - 报价回复',
    body: '附件为报价单，请确认数量是否有变动。',
    has_attachment: true,
    attachment_name: 'Zeta_Quote_202606.xlsx',
    parse_success: true,
  },
};

/**
 * 模拟供应商回邮
 * 返回邮件日志 + 如果解析成功则返回对应的 mock quote 数据
 *
 * @param {string} componentId
 * @param {string} supplierId
 * @returns {{ mail_log: Object, quote: Object|null, status: string }}
 */
function mockSupplierReply(componentId, supplierId) {
  const supplier = getSupplierById(supplierId);
  const mockReply = MOCK_REPLIES[supplierId];

  if (!mockReply) {
    return {
      mail_log: {
        type: MAIL_TYPE.SUPPLIER_REPLY,
        component_id: componentId,
        supplier_id: supplierId,
        supplier_name: supplier?.name || supplierId,
        subject: 'Re: RFQ - 自动回复',
        body: '（无 mock 数据）',
        status: MAIL_STATUS.MANUAL_INTERVENTION_REQUIRED,
        notes: '未找到该供应商的 mock 回邮模板',
      },
      quote: null,
      status: MAIL_STATUS.MANUAL_INTERVENTION_REQUIRED,
    };
  }

  const mailLogEntry = {
    type: MAIL_TYPE.SUPPLIER_REPLY,
    component_id: componentId,
    supplier_id: supplierId,
    supplier_name: supplier?.name || supplierId,
    subject: mockReply.subject,
    body: mockReply.body,
    status: mockReply.parse_success ? MAIL_STATUS.REPLY_RECEIVED : MAIL_STATUS.REPLY_PARSE_FAILED,
    has_attachment: mockReply.has_attachment,
    attachment_name: mockReply.attachment_name,
    notes: mockReply.parse_success ? '回邮已收到，附件解析成功' : mockReply.failure_reason,
  };

  // 如果解析成功，生成对应的 mock quote
  let quote = null;
  if (mockReply.parse_success) {
    quote = generateMockQuoteFromReply(componentId, supplierId, supplier);
    mailLogEntry.status = MAIL_STATUS.REPLY_PARSED;
  }

  return {
    mail_log: mailLogEntry,
    quote,
    status: mailLogEntry.status,
  };
}

/**
 * 批量 mock 回邮（对指定 component 的所有 selected suppliers 触发）
 *
 * @param {string} componentId
 * @param {string[]} supplierIds
 * @returns {{ results: Array, summary: Object }}
 */
function mockBatchReplies(componentId, supplierIds) {
  const results = [];
  let successCount = 0;
  let failCount = 0;
  const quotesMap = {};

  for (const sid of supplierIds) {
    const result = mockSupplierReply(componentId, sid);
    results.push(result);
    if (result.quote) {
      successCount++;
      quotesMap[sid] = result.quote;
    } else {
      failCount++;
    }
  }

  return {
    results,
    summary: {
      total: supplierIds.length,
      success: successCount,
      failed: failCount,
      all_ready: failCount === 0,
    },
    quotes: quotesMap,
  };
}

/**
 * 用供应商信息生成 mock quote
 */
function generateMockQuoteFromReply(componentId, supplierId, supplier) {
  const baseQuotes = {
    supplier_alpha: { unit_price: 12.50, currency: 'RMB', tooling_cost: 8000, lead_time_days: 28, payment_terms: 'Net 60', certification: 'TS16949' },
    supplier_beta: { unit_price: 11.20, currency: 'RMB', tooling_cost: 12000, lead_time_days: 35, payment_terms: 'Net 30', certification: 'TS16949' },
    supplier_gamma: { unit_price: 2.15, currency: 'EUR', tooling_cost: 1500, lead_time_days: 42, payment_terms: 'Net 45', certification: 'TS16949' },
    supplier_epsilon: { unit_price: 13.00, currency: 'RMB', tooling_cost: 7000, lead_time_days: 30, payment_terms: 'Net 60', certification: 'TS16949' },
    supplier_zeta: { unit_price: 9.80, currency: 'RMB', tooling_cost: 15000, lead_time_days: 40, payment_terms: 'Net 30', certification: 'TS16949' },
  };

  const base = baseQuotes[supplierId] || { unit_price: 10.00, currency: 'RMB', tooling_cost: 10000, lead_time_days: 30, payment_terms: 'Net 30', certification: '-' };

  return {
    supplier_id: supplierId,
    supplier_name: supplier?.name || supplierId,
    component_no: componentId,
    unit_price: base.unit_price,
    currency: base.currency,
    tooling_cost: base.tooling_cost,
    lead_time_days: base.lead_time_days,
    payment_terms: base.payment_terms,
    quantity: 10000,
    incoterm: 'DDP',
    quote_valid_until: '2026-09-30',
    certification: base.certification,
    source: 'mock_email_reply',
    notes: `从供应商 ${supplier?.name || supplierId} 回邮中自动解析`,
  };
}

export {
  MAIL_STATUS,
  MAIL_TYPE,
  generateRfqSendLog,
  mockSupplierReply,
  mockBatchReplies,
  MOCK_REPLIES,
};
