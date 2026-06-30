/**
 * Sourcing File 预览模块
 *
 * 职责（来自 audit-round03）：
 * - 真生成条件、真数据组织、假文件导出可接受
 * - sourcing file preview 应来自 benchmark 聚合结果
 * - 只在条件满足后开放生成动作
 * - 展示生成结果预览或假文件信息
 */
import demoState from '../../state/demo-state.js';
import { STATUS } from '../../state/state-constants.js';

/**
 * Sourcing File 状态
 */
const SOURCING_STATUS = Object.freeze({
  NOT_READY: 'not_ready',
  READY: 'ready',
  GENERATING: 'generating',
  GENERATED: 'generated',
});

/**
 * 检查是否可以生成 sourcing file
 * 条件：
 * 1. benchmark 已就绪
 * 2. 存在 comparison_base
 * 3. 存在 award_summary
 *
 * @returns {{ can_generate: boolean, reason: string }}
 */
function canGenerateSourcingFile() {
  const state = demoState.snapshot;

  if (!state.comparison_base) {
    return { can_generate: false, reason: '尚未生成比较底表 (benchmark)，请先在 supplier list 底部生成 benchmark' };
  }

  if (!state.award_summary) {
    return { can_generate: false, reason: '尚未生成 Award Summary，请先完成 Award 评审' };
  }

  const statusIdx = [STATUS.BENCHMARK_READY, STATUS.SOURCING_FILE_READY, STATUS.SOURCING_FILE_GENERATED]
    .indexOf(state.status);

  if (statusIdx === -1) {
    return { can_generate: false, reason: `当前状态 (${state.status}) 不支持生成 sourcing file，请先完成 benchmark` };
  }

  return { can_generate: true, reason: '条件满足，可以生成 sourcing file' };
}

/**
 * 生成 Sourcing File 预览数据
 * 真数据组织 + 假文件生成标记
 *
 * @returns {Object} sourcing file preview 结构
 */
function generateSourcingFilePreview() {
  const { can_generate } = canGenerateSourcingFile();
  if (!can_generate) {
    return null;
  }

  const state = demoState.snapshot;

  // 从 comparison_base 和 award_summary 聚合真数据
  const fileStructure = {
    generated_at: new Date().toISOString(),
    project: state.project ? {
      project_code: state.project.project_code,
      project_name: state.project.project_name,
    } : null,

    // Sheet 1: 供应商报价汇总 (from comparison_base)
    quote_summary: state.comparison_base ? {
      title: '供应商报价汇总',
      rows: state.comparison_base.comparison_rows.map(row => ({
        supplier_name: row.supplier_name,
        piece_price: row.piece_price,
        delivered_piece_price: row.delivered_piece_price,
        tooling_cost: row.tooling_cost,
        effective_unit_cost: row.effective_unit_cost,
        total_project_cost: row.total_project_cost,
        certification: row.certification,
      })),
    } : null,

    // Sheet 2: Award 推荐 (from award_summary)
    award_recommendation: state.award_summary ? {
      title: '定点推荐',
      conclusion: state.award_summary.recommendation?.conclusion || '-',
      details: state.award_summary.recommendation?.details || [],
      scores: state.award_summary.scores || {},
    } : null,

    // Sheet 3: 邮件往来记录 (from mail_logs)
    mail_records: buildMailRecordsSummary(state),

    // 文件元信息（假生成标记）
    file_meta: {
      filename: state.project
        ? `Sourcing_File_${state.project.project_code}_${new Date().toISOString().slice(0, 10)}.xlsx`
        : `Sourcing_File_${new Date().toISOString().slice(0, 10)}.xlsx`,
      file_size: '(demo 占位)',
      sheets: ['报价汇总', '定点推荐', '邮件记录'],
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
  SOURCING_STATUS,
  canGenerateSourcingFile,
  generateSourcingFilePreview,
};
