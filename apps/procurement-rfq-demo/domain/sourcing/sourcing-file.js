/**
 * Sourcing File 预览模块
 *
 * audit-round06 重构：
 * - 生成条件统一收口到 demoState.can_generate_sourcing_file()
 * - 不再依赖旧的 comparison_base / award_summary 全局状态
 * - 预览数据从所有 PN 的 mock 报价 + mail_logs 聚合，而非单一全局 comparison_base
 */
import demoState from '../../state/demo-state.js';

/**
 * 生成 Sourcing File 预览数据
 * 从所有 PN 的报价数据和邮件日志聚合，生成 3-sheet 结构
 *
 * @returns {Object} sourcing file preview 结构
 */
function generateSourcingFilePreview() {
  const state = demoState.snapshot;

  // Sheet 1: 所有 PN 供应商报价汇总
  const quoteRows = [];
  for (const comp of state.components) {
    const cid = comp.component_no;
    const quotes = state.supplier_quotes[cid] || {};
    for (const [sid, q] of Object.entries(quotes)) {
      quoteRows.push({
        component_no: cid,
        component_name: comp.component_name,
        supplier_id: sid,
        supplier_name: q.supplier_name || sid,
        unit_price: q.unit_price,
        currency: q.currency,
        tooling_cost: q.tooling_cost,
        lead_time_days: q.lead_time_days,
        moq: q.moq,
      });
    }
  }

  // Sheet 2: PN 状态概览
  const pnStatusRows = [];
  for (const comp of state.components) {
    const cid = comp.component_no;
    const confirmedIds = state.confirmed_supplier_ids[cid] || [];
    pnStatusRows.push({
      component_no: cid,
      component_name: comp.component_name,
      buyer: comp.buyer_id || '-',
      confirmed_suppliers: confirmedIds.length,
      rfq_status: state.rfq_status?.[cid] || 'not_prepared',
      quote_status: state.quote_collection_status?.[cid] || 'none_replied',
    });
  }

  // Sheet 3: 邮件往来记录 (from mail_logs)
  const mailRecords = buildMailRecordsSummary(state);

  const fileStructure = {
    generated_at: new Date().toISOString(),
    project: state.project ? {
      project_code: state.project.project_code,
      project_name: state.project.project_name,
    } : null,

    quote_summary: {
      title: '所有 PN 供应商报价汇总',
      rows: quoteRows,
    },

    pn_status: {
      title: 'PN 状态概览',
      rows: pnStatusRows,
    },

    mail_records: mailRecords,

    file_meta: {
      filename: state.project
        ? `Sourcing_File_${state.project.project_code}_${new Date().toISOString().slice(0, 10)}.xlsx`
        : `Sourcing_File_${new Date().toISOString().slice(0, 10)}.xlsx`,
      file_size: '(demo 占位)',
      sheets: ['报价汇总', 'PN 状态', '邮件记录'],
      is_demo_generated: true,
      disclaimer: '此文件为 demo 演示版本，数据为真实组织但文件生成为模拟。',
    },
  };

  return fileStructure;
}

/**
 * 从 mail_logs 中提取邮件往来摘要
 */
function buildMailRecordsSummary(state) {
  const cid = state.active_component_id;
  if (!cid) return [];

  const logs = state.mail_logs[cid] || {};
  const records = [];

  for (const [supplierId, entries] of Object.entries(logs)) {
    entries.forEach(entry => {
      records.push({
        supplier_id: supplierId,
        supplier_name: entry.supplier_name || supplierId,
        type: entry.type,
        subject: entry.subject,
        status: entry.status,
        timestamp: entry.timestamp,
        has_attachment: entry.has_attachment || false,
      });
    });
  }

  return records.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

export {
  generateSourcingFilePreview,
};
