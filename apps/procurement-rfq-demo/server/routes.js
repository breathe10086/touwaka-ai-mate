import Router from '@koa/router';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { parseEBOMJSON } from '../domain/ebom/parser.js';
import { assignBuyers, generateAssignmentReport, getAllBuyers } from '../domain/ebom/buyer-assignment.js';
import {
  createEmptyConstraintForm,
  validateConstraintForm,
  prefillFromComponent,
} from '../domain/rfq/constraint-form.js';
import { recommendSuppliers, getSupplierById } from '../domain/rfq/supplier-selection.js';
import { generateRFQPreview, generateRFQEmailPreview } from '../domain/rfq/rfq-preview.js';
import { createEmptyQuote, KEY_COMPARISON_FIELDS, EXTENDED_FIELDS } from '../domain/quotation/quote-types.js';
import { normalizeQuote, normalizeQuotes } from '../domain/quotation/normalizer.js';
import { generateAwardSummary, SCORING_WEIGHTS } from '../domain/award/comparison.js';
import { generateComparisonBase } from '../domain/award/comparison-base.js';
import { generateQuoteReview } from '../domain/quotation/quote-review.js';
import { generateRfqSendLog, mockSupplierReply, mockBatchReplies } from '../domain/email/mock-email.js';
import { generateSourcingFilePreview } from '../domain/sourcing/sourcing-file.js';
import demoState from '../state/demo-state.js';
import { STATUS, STATUS_ORDER, PN_REQUIREMENT_STATUS, PN_SUPPLIER_SELECTION_STATUS, PN_RFQ_STATUS, PN_QUOTE_COLLECTION_STATUS } from '../state/state-constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function createRoutes(context) {
  const router = new Router();

  // ==================== 工具路由 ====================

  /**
   * GET /api/apps/procurement-rfq-demo/demo-data/:filename
   * 提供 demo 数据文件
   */
  router.get('/demo-data/:filename', async (ctx) => {
    try {
      const { filename } = ctx.params;
      const allowedFiles = ['sample-ebom.json', 'mock-supplier-quotes.json'];
      if (!allowedFiles.includes(filename)) {
        ctx.error('不允许的文件', 403);
        return;
      }
      const filePath = path.join(__dirname, '..', 'demo_data', filename);
      if (!fs.existsSync(filePath)) {
        ctx.error('文件不存在', 404);
        return;
      }
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      ctx.success(data);
    } catch (error) {
      ctx.error(error.message, 500);
    }
  });

  // ==================== State 路由 ====================

  /**
   * GET /state
   * 获取当前 demo 完整状态
   */
  router.get('/state', async (ctx) => {
    try {
      const snapshot = demoState.snapshot;
      snapshot.available_actions = demoState.get_available_actions();
      snapshot.progress = demoState.get_completion_progress();
      ctx.success(snapshot);
    } catch (error) {
      ctx.error(error.message, 500);
    }
  });

  /**
   * POST /state/reset
   * 重置 demo 状态
   */
  router.post('/state/reset', async (ctx) => {
    try {
      demoState.reset();
      ctx.success(null, '已重置');
    } catch (error) {
      ctx.error(error.message, 500);
    }
  });

  // ==================== EBOM 路由 ====================

  /**
   * POST /ebom/parse
   * 解析 EBOM JSON 数据
   * Body: { project: EBOMProject, rows: EBOMRawRow[] }
   */
  router.post('/ebom/parse', async (ctx) => {
    try {
      const input = ctx.request.body;
      const result = parseEBOMJSON(input);
      if (result.errors.length > 0) {
        ctx.error({ errors: result.errors }, 400, 'EBOM 解析存在错误');
        return;
      }
      demoState.set_project(result.project);
      demoState.set_components(result.components);
      ctx.success({
        project: result.project,
        components: result.components,
        component_count: result.components.length,
      });
    } catch (error) {
      ctx.error(error.message, 500);
    }
  });

  /**
   * POST /ebom/load-sample
   * 加载 sample EBOM
   */
  router.post('/ebom/load-sample', async (ctx) => {
    try {
      const filePath = path.join(__dirname, '..', 'demo_data', 'sample-ebom.json');
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const result = parseEBOMJSON(data);
      if (result.errors.length > 0) {
        ctx.error({ errors: result.errors }, 400, 'Sample EBOM 解析存在错误');
        return;
      }
      demoState.set_project(result.project);
      demoState.set_components(result.components);
      ctx.success({
        project: result.project,
        components: result.components,
        component_count: result.components.length,
      });
    } catch (error) {
      ctx.error(error.message, 500);
    }
  });

  // ==================== Buyer 分派路由 ====================

  /**
   * POST /buyer/assign
   * 为 components 分派 Buyer
   */
  router.post('/buyer/assign', async (ctx) => {
    try {
      const components = demoState.snapshot.components;
      if (components.length === 0) {
        ctx.error('请先导入 EBOM', 400);
        return;
      }
      const assigned = assignBuyers(components);
      demoState.set_components(assigned);
      demoState.safe_transition(STATUS.BUYER_ASSIGNED);

      const report = generateAssignmentReport(assigned);
      ctx.success({
        components: assigned,
        assignment_report: report,
        buyers: getAllBuyers(),
      });
    } catch (error) {
      ctx.error(error.message, 500);
    }
  });

  /**
   * GET /buyer/list
   * 获取可用 Buyer 列表
   */
  router.get('/buyer/list', async (ctx) => {
    ctx.success(getAllBuyers());
  });

  /**
   * PUT /buyer/perspective
   * 切换 Buyer 视角（demo 模拟登录）
   * Body: { buyer_id: string | null }
   */
  router.put('/buyer/perspective', async (ctx) => {
    try {
      const { buyer_id } = ctx.request.body;
      demoState.set_buyer_perspective(buyer_id || null);
      const filtered = demoState.get_components_by_buyer(buyer_id);
      ctx.success({
        buyer_id,
        visible_components: filtered,
        component_count: filtered.length,
      });
    } catch (error) {
      ctx.error(error.message, 500);
    }
  });

  /**
   * PUT /buyer/reassign
   * 管理员手动修改单个 PN 的 Buyer 分派（audit-round05 统一字段 component_no）
   * Body: { component_no: string, buyer_id: string }
   */
  router.put('/buyer/reassign', async (ctx) => {
    try {
      const { component_no, component_id, buyer_id } = ctx.request.body;
      // audit-round05: 兼容 component_id 旧调用，统一为 component_no
      const effectiveComponentNo = component_no || component_id;
      if (!effectiveComponentNo || !buyer_id) {
        ctx.error('请提供 component_no 和 buyer_id', 400);
        return;
      }
      const components = demoState.snapshot.components;
      const index = components.findIndex(c => c.component_no === effectiveComponentNo);
      if (index === -1) {
        ctx.error('未找到指定 PN', 404);
        return;
      }
      const allBuyers = getAllBuyers();
      if (!allBuyers.find(b => b.id === buyer_id)) {
        ctx.error('无效的 Buyer ID', 400);
        return;
      }
      components[index] = { ...components[index], buyer_id };
      demoState.set_components(components);
      ctx.success({
        component: components[index],
        message: `PN ${effectiveComponentNo} Buyer 已改为 ${buyer_id}`,
      });
    } catch (error) {
      ctx.error(error.message, 500);
    }
  });

  // ==================== Component 路由 ====================

  /**
   * PUT /component/:component_id/select
   * 选择当前操作的 component
   */
  router.put('/component/:component_id/select', async (ctx) => {
    try {
      const { component_id } = ctx.params;
      const comp = demoState.snapshot.components.find(c => c.component_no === component_id);
      if (!comp) {
        ctx.error('Component 不存在', 404);
        return;
      }
      demoState.set_active_component(component_id);
      ctx.success({ active_component: comp });
    } catch (error) {
      ctx.error(error.message, 500);
    }
  });

  // audit-round04: 解锁已确认的供应商选择
  router.put('/component/:component_id/supplier-modify', async (ctx) => {
    try {
      const { component_id } = ctx.params;
      demoState.reset_supplier_selection(component_id);
      ctx.success({ component_id, status: 'selecting' });
    } catch (error) {
      ctx.error(error.message, 500);
    }
  });

  // audit-round04: 供应商详情（含历史报价）
  router.get('/supplier/:id/detail', async (ctx) => {
    try {
      const { id } = ctx.params;
      const { component_id } = ctx.query;
      const supplier = getSupplierById(id);
      if (!supplier) {
        ctx.error('供应商不存在', 404);
        return;
      }

      // 从已加载的报价中提取历史数据
      const history = [];
      const quotesMap = demoState.snapshot.supplier_quotes || {};
      for (const [cid, sq] of Object.entries(quotesMap)) {
        if (sq[id]) {
          const q = sq[id];
          history.push({
            pn: cid,
            unit_price: q.unit_price,
            lead_time_days: q.lead_time_days,
            tooling_cost: q.tooling_cost,
            currency: q.currency || 'RMB',
          });
        }
      }

      ctx.success({ supplier, history });
    } catch (error) {
      ctx.error(error.message, 500);
    }
  });

  // ==================== 约束表单路由 ====================

  /**
   * GET /constraint-form/:component_id
   * 获取指定 component 的约束表单
   */
  router.get('/constraint-form/:component_id', async (ctx) => {
    try {
      const { component_id } = ctx.params;
      let form = demoState.get_constraint_form(component_id);

      if (!form) {
        // 尝试从 component 预填
        const comp = demoState.snapshot.components.find(c => c.component_no === component_id);
        if (comp) {
          form = prefillFromComponent(comp);
        } else {
          form = createEmptyConstraintForm(component_id);
        }
      }
      ctx.success(form);
    } catch (error) {
      ctx.error(error.message, 500);
    }
  });

  /**
   * POST /constraint-form/:component_id
   * 保存约束表单 + audit-round05 状态机自动推进
   */
  router.post('/constraint-form/:component_id', async (ctx) => {
    try {
      const { component_id } = ctx.params;
      const formData = ctx.request.body;
      formData.component_id = component_id;

      const validation = validateConstraintForm(formData);
      if (!validation.valid && formData.status === 'confirmed') {
        ctx.error({
          missing_fields: validation.missing_fields,
        }, 400, '约束表单不完整，请补全必填项');
        return;
      }

      demoState.set_constraint_form(component_id, formData);

      // audit-round05: 保存时按4状态机推进
      const currentReqStatus = demoState.get_requirement_status(component_id);
      if (currentReqStatus === PN_REQUIREMENT_STATUS.FIRST_ENTRY_EDITING) {
        demoState.set_requirement_status(component_id, PN_REQUIREMENT_STATUS.SAVED_LOCKED);
        demoState._state.pn_is_first_entry = demoState._state.pn_is_first_entry || {};
        demoState._state.pn_is_first_entry[component_id] = false;
      } else if (currentReqStatus === PN_REQUIREMENT_STATUS.MANUAL_EDITING) {
        demoState.set_requirement_status(component_id, PN_REQUIREMENT_STATUS.MANUAL_SAVED_LOCKED);
      }

      ctx.success({
        form: demoState.get_constraint_form(component_id),
        validation,
      });
    } catch (error) {
      ctx.error(error.message, 500);
    }
  });

  /**
   * PUT /constraint-form/:component_id/modify
   * audit-round05: 从锁定态进入手动编辑态
   */
  router.put('/constraint-form/:component_id/modify', async (ctx) => {
    try {
      const { component_id } = ctx.params;
      const current = demoState.get_requirement_status(component_id);
      if (current !== PN_REQUIREMENT_STATUS.SAVED_LOCKED
        && current !== PN_REQUIREMENT_STATUS.MANUAL_SAVED_LOCKED) {
        ctx.error('当前状态不允许修改约束', 400);
        return;
      }
      demoState.set_requirement_status(component_id, PN_REQUIREMENT_STATUS.MANUAL_EDITING);
      ctx.success({ component_id, requirement_status: PN_REQUIREMENT_STATUS.MANUAL_EDITING });
    } catch (error) {
      ctx.error(error.message, 500);
    }
  });

  // ==================== 供应商推荐路由 ====================

  /**
   * GET /supplier/recommend/:component_id
   * 为指定 component 推荐供应商
   * audit-round05: 推荐后自动设置 supplier_selection_status 为 selecting
   */
  router.get('/supplier/recommend/:component_id', async (ctx) => {
    try {
      const { component_id } = ctx.params;
      const comp = demoState.snapshot.components.find(c => c.component_no === component_id);
      if (!comp) {
        ctx.error('Component 不存在', 404);
        return;
      }
      const constraintForm = demoState.get_constraint_form(component_id);
      const recommendations = recommendSuppliers(comp, constraintForm);

      // audit-round07: 推荐接口改为纯读取，不再附带状态副作用
      // 仅在尚未启动选择时，自动进入 selecting（首次推荐）
      const currentSelStatus = demoState.get_supplier_selection_status(component_id);
      if (currentSelStatus === PN_SUPPLIER_SELECTION_STATUS.NOT_STARTED) {
        demoState.set_supplier_selection_status(component_id, PN_SUPPLIER_SELECTION_STATUS.SELECTING);
      }
      // 已 confirmed 的 PN 不再被推荐接口降级为 selecting

      ctx.success({
        component_id,
        recommendations,
        total_candidates: recommendations.length,
      });
    } catch (error) {
      ctx.error(error.message, 500);
    }
  });

  /**
   * GET /supplier/confirmed-display/:component_id
   * audit-round07: 纯读取已确认供应商的展示数据（无任何副作用）
   * 用于前端切换 PN 时恢复展示态，不走 recommend 路径
   */
  router.get('/supplier/confirmed-display/:component_id', async (ctx) => {
    try {
      const { component_id } = ctx.params;
      const confirmedIds = demoState.get_confirmed_supplier_ids(component_id);
      if (!confirmedIds || confirmedIds.length === 0) {
        ctx.success({ component_id, suppliers: [] });
        return;
      }
      const suppliers = confirmedIds
        .map(id => getSupplierById(id))
        .filter(Boolean)
        .map(s => ({
          supplier: s,
          score: 0,      // 已确认列表不展示评分
          reasons: ['已确认供应商（展示态）'],
        }));
      ctx.success({ component_id, suppliers });
    } catch (error) {
      ctx.error(error.message, 500);
    }
  });

  /**
   * POST /supplier/select
   * 选择供应商
   * Body: { component_id: string, supplier_ids: string[] }
   */
  router.post('/supplier/select', async (ctx) => {
    try {
      const { component_id, supplier_ids } = ctx.request.body;
      if (!component_id || !Array.isArray(supplier_ids) || supplier_ids.length < 2) {
        ctx.error('请选择至少 2 家供应商', 400);
        return;
      }

      const suppliers = supplier_ids.map(id => {
        const s = getSupplierById(id);
        return s || { id, name: id };
      });

      demoState.set_supplier_candidates(component_id, suppliers);

      // 确认供应商（audit-round04：PN 级状态）
      demoState.set_selected_supplier_ids(component_id, supplier_ids);
      demoState.set_confirmed_supplier_ids(component_id, supplier_ids);
      demoState.set_supplier_selection_status(component_id, PN_SUPPLIER_SELECTION_STATUS.CONFIRMED);

      ctx.success({
        component_id,
        selected_suppliers: suppliers,
        count: suppliers.length,
      });
    } catch (error) {
      ctx.error(error.message, 500);
    }
  });

  // ==================== RFQ 预览路由 ====================

  /**
   * POST /rfq/preview
   * 生成 RFQ 预览
   * Body: { component_id: string, supplier_ids: string[] }
   */
  router.post('/rfq/preview', async (ctx) => {
    try {
      const { component_id, supplier_ids } = ctx.request.body;
      const state = demoState.snapshot;

      const comp = state.components.find(c => c.component_no === component_id);
      if (!comp) {
        ctx.error('Component 不存在', 404);
        return;
      }

      const constraintForm = demoState.get_constraint_form(component_id);
      const supplierInfoMap = {};
      for (const sid of supplier_ids) {
        supplierInfoMap[sid] = getSupplierById(sid) || { id: sid, name: sid };
      }

      const preview = generateRFQPreview({
        project: state.project,
        component: comp,
        constraintForm,
        selectedSupplierIds: supplier_ids,
        supplierInfoMap,
      });

      const emailPreview = generateRFQEmailPreview(preview);

      // audit-round06: 持久存 email_preview 到 preview 对象中，供后续查看已发送RFQ复用
      preview.email_preview = emailPreview;
      demoState.set_rfq_preview(component_id, preview);
      // PN 级 RFQ 状态设为 prepared（audit-round04）
      demoState.set_rfq_status(component_id, PN_RFQ_STATUS.PREPARED);

      ctx.success({
        preview,
        email_preview: emailPreview,
      });
    } catch (error) {
      ctx.error(error.message, 500);
    }
  });

  // ==================== 报价路由 ====================

  /**
   * POST /quote/input
   * 录入供应商报价
   * Body: SupplierQuote
   */
  router.post('/quote/input', async (ctx) => {
    try {
      const quote = ctx.request.body;
      if (!quote.supplier_id || !quote.component_no) {
        ctx.error('缺少 supplier_id 或 component_no', 400);
        return;
      }

      demoState.set_supplier_quote(quote.component_no, quote.supplier_id, quote);

      // 自动标准化
      const normalized = normalizeQuote(quote);
      demoState.set_normalized_quote(quote.component_no, quote.supplier_id, normalized);

      ctx.success({
        quote,
        normalized,
      });
    } catch (error) {
      ctx.error(error.message, 500);
    }
  });

  /**
   * POST /quote/load-mock/:component_id
   * 加载 mock 供应商报价
   */
  router.post('/quote/load-mock/:component_id', async (ctx) => {
    try {
      const { component_id } = ctx.params;
      const filePath = path.join(__dirname, '..', 'demo_data', 'mock-supplier-quotes.json');
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      const compData = data[component_id];
      if (!compData || !compData.quotes || compData.quotes.length < 2) {
        ctx.error(`Component ${component_id} 的 mock 报价数据不足（需要至少2家供应商）`, 400);
        return;
      }

      const quotes = compData.quotes;
      quotes.forEach(quote => {
        demoState.set_supplier_quote(component_id, quote.supplier_id, quote);
        const normalized = normalizeQuote(quote);
        demoState.set_normalized_quote(component_id, quote.supplier_id, normalized);
      });

      // 更新状态：收到报价后进入 feedback in progress
      demoState.safe_transition(STATUS.SUPPLIER_FEEDBACK_IN_PROGRESS);

      ctx.success({
        component_id,
        quotes,
        quote_count: quotes.length,
      });
    } catch (error) {
      ctx.error(error.message, 500);
    }
  });

  /**
   * GET /quote/list/:component_id
   * 获取指定 component 的所有报价
   */
  router.get('/quote/list/:component_id', async (ctx) => {
    try {
      const { component_id } = ctx.params;
      const state = demoState.snapshot;
      const quotes = state.supplier_quotes[component_id] || {};
      const normalized = state.normalized_quotes[component_id] || {};
      ctx.success({
        component_id,
        quotes: Object.values(quotes),
        normalized_quotes: Object.values(normalized),
        count: Object.keys(quotes).length,
      });
    } catch (error) {
      ctx.error(error.message, 500);
    }
  });

  /**
   * GET /quote/review/:component_id
   * 生成报价审核摘要
   */
  router.get('/quote/review/:component_id', async (ctx) => {
    try {
      const { component_id } = ctx.params;
      const state = demoState.snapshot;
      const quotes = Object.values(state.supplier_quotes[component_id] || {});
      const normalizedQuotes = Object.values(state.normalized_quotes[component_id] || {});

      if (quotes.length < 2) {
        ctx.error('需要至少 2 家供应商报价才能审核', 400);
        return;
      }

      const review = generateQuoteReview(component_id, quotes, normalizedQuotes);
      ctx.success(review);
    } catch (error) {
      ctx.error(error.message, 500);
    }
  });

  // ==================== 比较底表路由 ====================

  /**
   * POST /comparison-base/generate/:component_id
   * 生成比较底表
   */
  router.post('/comparison-base/generate/:component_id', async (ctx) => {
    try {
      const { component_id } = ctx.params;
      const state = demoState.snapshot;

      const comp = state.components.find(c => c.component_no === component_id);
      if (!comp) {
        ctx.error('Component 不存在', 404);
        return;
      }

      const normalizedQuotes = Object.values(state.normalized_quotes[component_id] || {});
      if (normalizedQuotes.length < 2) {
        ctx.error('需要至少 2 家供应商的标准化报价', 400);
        return;
      }

      const supplierProfiles = {};
      for (const nq of normalizedQuotes) {
        supplierProfiles[nq.supplier_id] = getSupplierById(nq.supplier_id) || {};
      }

      const comparisonBase = generateComparisonBase(comp, normalizedQuotes, supplierProfiles);
      demoState.set_comparison_base(comparisonBase);

      ctx.success(comparisonBase);
    } catch (error) {
      ctx.error(error.message, 500);
    }
  });

  // ==================== Award 路由 ====================

  /**
   * POST /award/generate/:component_id
   * 生成 Award Summary
   */
  router.post('/award/generate/:component_id', async (ctx) => {
    try {
      const { component_id } = ctx.params;
      const state = demoState.snapshot;

      const comp = state.components.find(c => c.component_no === component_id);
      if (!comp) {
        ctx.error('Component 不存在', 404);
        return;
      }

      const normalizedQuotes = Object.values(state.normalized_quotes[component_id] || {});
      if (normalizedQuotes.length < 2) {
        ctx.error('需要至少 2 家供应商的标准化报价', 400);
        return;
      }

      const supplierProfiles = {};
      for (const nq of normalizedQuotes) {
        supplierProfiles[nq.supplier_id] = getSupplierById(nq.supplier_id) || {};
      }

      const awardSummary = generateAwardSummary({
        component: comp,
        normalizedQuotes,
        supplierProfiles,
      });

      demoState.set_award_comparison_rows(awardSummary.comparison_rows);
      demoState.set_award_summary(awardSummary);
      demoState.safe_transition(STATUS.BENCHMARK_READY);

      ctx.success(awardSummary);
    } catch (error) {
      ctx.error(error.message, 500);
    }
  });

  /**
   * GET /award/summary/:component_id
   * 获取 Award Summary
   */
  router.get('/award/summary/:component_id', async (ctx) => {
    try {
      const summary = demoState.snapshot.award_summary;
      if (!summary) {
        ctx.error('Award Summary 尚未生成', 404);
        return;
      }
      ctx.success(summary);
    } catch (error) {
      ctx.error(error.message, 500);
    }
  });

  /**
   * GET /award/scoring-weights
   * 获取评分权重配置
   */
  router.get('/award/scoring-weights', async (ctx) => {
    ctx.success(SCORING_WEIGHTS);
  });

  /**
   * GET /award/key-fields
   * 获取 cost breakdown 关键字段列表
   */
  router.get('/award/key-fields', async (ctx) => {
    ctx.success({
      key_comparison_fields: KEY_COMPARISON_FIELDS,
      extended_fields: EXTENDED_FIELDS,
    });
  });
  // ==================== Mock 邮件路由 ====================

  /**
   * POST /rfq/send
   * 模拟发送 RFQ 邮件
   * Body: { component_id: string, supplier_ids: string[] }
   */
  router.post('/rfq/send', async (ctx) => {
    try {
      const { component_id, supplier_ids } = ctx.request.body;
      if (!component_id || !Array.isArray(supplier_ids) || supplier_ids.length === 0) {
        ctx.error('请提供 component_id 和 supplier_ids', 400);
        return;
      }

      // 记录每家的发送日志
      const sendLogs = [];
      for (const sid of supplier_ids) {
        const logEntry = generateRfqSendLog(component_id, sid);
        demoState.add_mail_log(component_id, sid, logEntry);
        sendLogs.push(logEntry);
      }

      // PN 级 RFQ 状态设为 sent（不再是全局状态）
      demoState.set_rfq_status(component_id, PN_RFQ_STATUS.SENT);
      demoState.increment_rfq_sent_count(component_id);

      ctx.success({
        component_id,
        send_logs: sendLogs,
        supplier_count: supplier_ids.length,
        message: `RFQ 邮件已发送至 ${supplier_ids.length} 家供应商（演示模式）`,
      });
    } catch (error) {
      ctx.error(error.message, 500);
    }
  });

  /**
   * POST /supplier/mock-reply
   * 模拟供应商回邮
   * Body: { component_id: string, supplier_ids?: string[] }
   * 如果不传 supplier_ids，则自动对当前 component 的所有 selected suppliers 触发
   */
  router.post('/supplier/mock-reply', async (ctx) => {
    try {
      const { component_id, supplier_ids } = ctx.request.body;
      if (!component_id) {
        ctx.error('请提供 component_id', 400);
        return;
      }

      // 确定要 mock 回邮的供应商列表 - 使用 confirmed_supplier_ids
      const confirmedIds = demoState.get_confirmed_supplier_ids(component_id);
      let targetSupplierIds = supplier_ids;
      if (!targetSupplierIds || targetSupplierIds.length === 0) {
        targetSupplierIds = confirmedIds.length > 0 ? [...confirmedIds] : [];
      }

      if (targetSupplierIds.length === 0) {
        ctx.error('未找到可触发回邮的供应商，请先确认供应商', 400);
        return;
      }

      const result = mockBatchReplies(component_id, targetSupplierIds);

      // 记录邮件日志 + 加载解析成功的报价
      let loadedCount = 0;
      for (const r of result.results) {
        demoState.add_mail_log(component_id, r.mail_log.supplier_id, r.mail_log);
        if (r.quote) {
          demoState.set_supplier_quote(component_id, r.quote.supplier_id, r.quote);
          const normalized = normalizeQuote(r.quote);
          demoState.set_normalized_quote(component_id, r.quote.supplier_id, normalized);
          loadedCount++;
        }
      }

      // PN 级报价回传状态更新
      if (result.summary.success > 0) {
        const confirmedCount = confirmedIds.length;
        const quotedCount = Object.keys(demoState.snapshot.supplier_quotes[component_id] || {}).length;
        if (quotedCount >= confirmedCount && confirmedCount > 0) {
          demoState.set_quote_collection_status(component_id, PN_QUOTE_COLLECTION_STATUS.ALL_REPLIED);
        } else if (quotedCount > 0) {
          demoState.set_quote_collection_status(component_id, PN_QUOTE_COLLECTION_STATUS.PARTIAL_REPLIED);
        }
      }

      ctx.success({
        component_id,
        summary: result.summary,
        mail_logs: result.results.map(r => r.mail_log),
        quotes_loaded: loadedCount,
      });
    } catch (error) {
      ctx.error(error.message, 500);
    }
  });

  /**
   * GET /mail-logs/:component_id
   * 获取邮件日志
   */
  router.get('/mail-logs/:component_id', async (ctx) => {
    try {
      const { component_id } = ctx.params;
      const logs = demoState.get_mail_logs(component_id);
      ctx.success({ component_id, logs });
    } catch (error) {
      ctx.error(error.message, 500);
    }
  });

  // ==================== Sourcing File 路由 ====================

  /**
   * GET /sourcing-file/status
   * 检查 sourcing file 生成条件 - audit-round05 4条件聚合
   */
  router.get('/sourcing-file/status', async (ctx) => {
    try {
      const can_generate = demoState.can_generate_sourcing_file();
      const progress = demoState.get_completion_progress();
      const conditions = demoState.get_sourcing_file_conditions();
      ctx.success({ can_generate, progress, conditions });
    } catch (error) {
      ctx.error(error.message, 500);
    }
  });

  /**
   * POST /sourcing-file/generate
   * 生成 Sourcing File 预览
   */
  router.post('/sourcing-file/generate', async (ctx) => {
    try {
      if (!demoState.can_generate_sourcing_file()) {
        ctx.error('条件不满足：需要所有 PN 完成供应商回传', 400);
        return;
      }

      // 收集所有PN的确认supplierIDs用于sourcing file
      const allConfirmedIds = [];
      for (const comp of demoState.snapshot.components) {
        const ids = demoState.get_confirmed_supplier_ids(comp.component_no);
        allConfirmedIds.push(...ids);
      }

      const preview = generateSourcingFilePreview();

      demoState.set_sourcing_file_preview(preview);
      // audit-round07: 不再走旧全局状态跳转，PN 聚合条件已足够

      ctx.success({
        preview,
        message: 'Sourcing File 预览已生成（演示模式，未实际导出文件）',
      });
    } catch (error) {
      ctx.error(error.message, 500);
    }
  });
  // ==================== Demo 辅助路由 ====================

  /**
   * POST /demo/mock-reply-all
   * audit-round06: 一键全部回传（Demo 专用）
   * 遍历所有满足条件的 PN，批量补齐 mock reply
   */
  router.post('/demo/mock-reply-all', async (ctx) => {
    try {
      const allPnIds = demoState.snapshot.components.map(c => c.component_no);
      let totalReplied = 0;
      const updatedPns = [];
      const skippedPns = [];

      for (const cid of allPnIds) {
        const confirmedIds = demoState.get_confirmed_supplier_ids(cid);
        const rfqStatus = demoState.get_rfq_status(cid);
        const collStatus = demoState.get_quote_collection_status(cid);

        // 逐项诊断跳过原因
        if (confirmedIds.length === 0) {
          skippedPns.push({ component_id: cid, reason: '未确认供应商' });
          continue;
        }
        if (rfqStatus !== PN_RFQ_STATUS.SENT) {
          skippedPns.push({ component_id: cid, reason: `RFQ 未发送 (当前: ${rfqStatus})` });
          continue;
        }
        if (collStatus === PN_QUOTE_COLLECTION_STATUS.ALL_REPLIED) {
          skippedPns.push({ component_id: cid, reason: '已全部回传' });
          continue;
        }

        // 收集尚未回传的 supplier
        const existingQuotes = demoState.snapshot.supplier_quotes[cid] || {};
        const missingSids = confirmedIds.filter(sid => !existingQuotes[sid]);
        const targetSids = missingSids.length > 0 ? [...Object.keys(existingQuotes), ...missingSids] : Object.keys(existingQuotes);

        if (targetSids.length === 0) {
          skippedPns.push({ component_id: cid, reason: '无可用 supplier 数据' });
          continue;
        }

        const batchResult = mockBatchReplies(cid, targetSids);
        let pnLoaded = 0;
        for (const r of batchResult.results) {
          demoState.add_mail_log(cid, r.mail_log.supplier_id, r.mail_log);
          if (r.quote) {
            demoState.set_supplier_quote(cid, r.quote.supplier_id, r.quote);
            const normalized = normalizeQuote(r.quote);
            demoState.set_normalized_quote(cid, r.quote.supplier_id, normalized);
            pnLoaded++;
          }
        }

        if (pnLoaded > 0) {
          demoState.set_quote_collection_status(cid, PN_QUOTE_COLLECTION_STATUS.ALL_REPLIED);
          totalReplied++;
        }

        updatedPns.push({
          component_id: cid,
          suppliers_replied: pnLoaded,
          total_confirmed: confirmedIds.length,
        });
      }

      const summaryParts = [`已更新 ${totalReplied} 个 PN`];
      if (skippedPns.length > 0) {
        const byReason = new Map();
        for (const s of skippedPns) {
          byReason.set(s.reason, (byReason.get(s.reason) || 0) + 1);
        }
        const reasonSummary = [...byReason.entries()]
          .map(([r, c]) => `${c} 个${r}`).join('，');
        summaryParts.push(`跳过 ${skippedPns.length} 个 PN（${reasonSummary}）`);
      }

      ctx.success({
        total_pns_updated: totalReplied,
        updated_pns: updatedPns,
        skipped_pns: skippedPns,
        message: summaryParts.join('，') + '（Demo 模式）',
      });
    } catch (error) {
      ctx.error(error.message, 500);
    }
  });

  // ==================== 演示加速器 ====================

  /**
   * POST /demo/fast-forward-all
   * audit-round08: 演示加速器 — 自动补齐所有未完成 PN 到"全部回传"
   * 对每个 PN 依次执行：
   *   1. 未确认 supplier → 从推荐结果取前 2 家自动确认
   *   2. 未生成 RFQ → 自动 prefill constraint + 生成 RFQ 预览
   *   3. 未发送 RFQ → 自动发送
   *   4. 未全部回传 → 自动 mock 回传
   */
  router.post('/demo/fast-forward-all', async (ctx) => {
    try {
      const allPnIds = demoState.snapshot.components.map(c => c.component_no);
      let autoConfirmedCount = 0;
      let autoSentCount = 0;
      let autoRepliedCount = 0;
      let skippedCount = 0;
      const details = [];

      for (const cid of allPnIds) {
        const comp = demoState.snapshot.components.find(c => c.component_no === cid);
        if (!comp) continue;

        const pnActions = [];
        const confirmedIds = demoState.get_confirmed_supplier_ids(cid);
        const rfqStatus = demoState.get_rfq_status(cid);
        const collStatus = demoState.get_quote_collection_status(cid);
        const currentSelStatus = demoState.get_supplier_selection_status(cid);

        // Step 1: 未确认 supplier → 自动推荐 + 取前 2 家确认
        if (confirmedIds.length === 0 || currentSelStatus !== PN_SUPPLIER_SELECTION_STATUS.CONFIRMED) {
          const constraintForm = demoState.get_constraint_form(cid);
          const recommendations = recommendSuppliers(comp, constraintForm);
          const top2 = recommendations.slice(0, 2).map(r => r.supplier.id);
          if (top2.length >= 2) {
            demoState.set_confirmed_supplier_ids(cid, top2);
            demoState.set_supplier_selection_status(cid, PN_SUPPLIER_SELECTION_STATUS.CONFIRMED);
            autoConfirmedCount++;
            pnActions.push(`自动确认 ${top2.length} 家供应商`);
          }
        }

        // 重新获取最新的 confirmedIds
        const latestConfirmedIds = demoState.get_confirmed_supplier_ids(cid);
        if (latestConfirmedIds.length === 0) {
          skippedCount++;
          details.push({ component_id: cid, actions: pnActions.length ? pnActions : ['无可推荐供应商-跳过'] });
          continue;
        }

        // Step 2: 未生成/未发送 RFQ → 自动 prefill + 生成 + 发送
        if (rfqStatus !== PN_RFQ_STATUS.SENT && rfqStatus !== PN_RFQ_STATUS.PREPARED) {
          // 确保 constraint form 已保存（prefill from component）
          const existingForm = demoState.get_constraint_form(cid);
          if (!existingForm || Object.keys(existingForm).length === 0) {
            const form = createEmptyConstraintForm();
            prefillFromComponent(form, comp);
            demoState.set_constraint_form(cid, form);
            demoState.set_first_entry(cid, false);
            demoState.set_requirement_status(cid, PN_REQUIREMENT_STATUS.SAVED_LOCKED);
          }
          const constraintForm = demoState.get_constraint_form(cid);
          const supplierInfoMap = {};
          for (const sid of latestConfirmedIds) {
            supplierInfoMap[sid] = getSupplierById(sid) || { id: sid, name: sid };
          }
          const preview = generateRFQPreview({
            project: demoState.snapshot.project,
            component: comp,
            constraintForm,
            selectedSupplierIds: latestConfirmedIds,
            supplierInfoMap,
          });
          const emailPreview = generateRFQEmailPreview(preview);
          preview.email_preview = emailPreview;
          demoState.set_rfq_preview(cid, preview);
          demoState.set_rfq_status(cid, PN_RFQ_STATUS.PREPARED);
        }

        if (rfqStatus !== PN_RFQ_STATUS.SENT) {
          // Step 3: 发送 RFQ
          for (const sid of latestConfirmedIds) {
            const logEntry = generateRfqSendLog(cid, sid);
            demoState.add_mail_log(cid, sid, logEntry);
          }
          demoState.set_rfq_status(cid, PN_RFQ_STATUS.SENT);
          demoState.increment_rfq_sent_count(cid);
          autoSentCount++;
          pnActions.push(`自动发送 RFQ 至 ${latestConfirmedIds.length} 家`);
        }

        // Step 4: 未全部回传 → 自动 mock 回传
        if (collStatus !== PN_QUOTE_COLLECTION_STATUS.ALL_REPLIED) {
          const batchResult = mockBatchReplies(cid, latestConfirmedIds);
          let pnLoaded = 0;
          for (const r of batchResult.results) {
            demoState.add_mail_log(cid, r.mail_log.supplier_id, r.mail_log);
            if (r.quote) {
              demoState.set_supplier_quote(cid, r.quote.supplier_id, r.quote);
              const normalized = normalizeQuote(r.quote);
              demoState.set_normalized_quote(cid, r.quote.supplier_id, normalized);
              pnLoaded++;
            }
          }
          if (pnLoaded > 0) {
            demoState.set_quote_collection_status(cid, PN_QUOTE_COLLECTION_STATUS.ALL_REPLIED);
            autoRepliedCount++;
            pnActions.push(`自动回传 ${pnLoaded} 家报价`);
          }
        }

        details.push({ component_id: cid, actions: pnActions });
      }

      const summaryParts = [];
      if (autoConfirmedCount > 0) summaryParts.push(`自动确认 supplier: ${autoConfirmedCount} PN`);
      if (autoSentCount > 0) summaryParts.push(`自动发送 RFQ: ${autoSentCount} PN`);
      if (autoRepliedCount > 0) summaryParts.push(`自动回传: ${autoRepliedCount} PN`);
      if (skippedCount > 0) summaryParts.push(`跳过: ${skippedCount} PN`);

      ctx.success({
        auto_confirmed_supplier: autoConfirmedCount,
        auto_sent_rfq: autoSentCount,
        auto_replied: autoRepliedCount,
        skipped: skippedCount,
        details,
        message: summaryParts.join('，') + '（Demo 加速器）',
      });
    } catch (error) {
      ctx.error(error.message, 500);
    }
  });

  // ==================== 快速初始化路由 ====================

  /**
   * POST /quick-init
   * 一键初始化完整 demo 链路
   */
  router.post('/quick-init', async (ctx) => {
    try {
      // 加载 EBOM
      const ebomPath = path.join(__dirname, '..', 'demo_data', 'sample-ebom.json');
      const ebomData = JSON.parse(fs.readFileSync(ebomPath, 'utf-8'));
      const { project, components, errors } = parseEBOMJSON(ebomData);
      if (errors.length > 0) {
        ctx.error({ errors }, 400, 'EBOM 解析错误');
        return;
      }

      demoState.set_project(project);
      demoState.set_components(components);

      // 分派 Buyer
      const assigned = assignBuyers(components);
      demoState.set_components(assigned);
      demoState.transition(STATUS.BUYER_ASSIGNED);

      // 加载 mock 报价数据
      const quotesPath = path.join(__dirname, '..', 'demo_data', 'mock-supplier-quotes.json');
      const quotesData = JSON.parse(fs.readFileSync(quotesPath, 'utf-8'));

      // === 为所有 PN 初始化局部状态（audit-round04） ===
      let activeComponent = null;
      let awardSummary = null;
      let comparisonBase = null;
      let globalQuotes = [];

      for (const comp of assigned) {
        const cid = comp.component_no;
        const compQuotes = quotesData[cid]?.quotes;

        // quick-init 模式下所有 PN 均非首次录入，设为已保存锁定状态
        demoState.set_first_entry(cid, false);
        demoState.set_requirement_status(cid, PN_REQUIREMENT_STATUS.SAVED_LOCKED);

        if (compQuotes && compQuotes.length >= 2) {
          // 有 mock 数据的 PN：自动推进到全流程
          const supplierIds = compQuotes.map(q => q.supplier_id);

          // 设置供应商选择为已确认
          demoState.set_confirmed_supplier_ids(cid, supplierIds);
          demoState.set_supplier_selection_status(cid, PN_SUPPLIER_SELECTION_STATUS.CONFIRMED);

          // 设置 RFQ 状态为已发送
          demoState.set_rfq_status(cid, PN_RFQ_STATUS.SENT);
          demoState.increment_rfq_sent_count(cid);

          // 加载报价，设置回传状态为全部回传
          compQuotes.forEach(quote => {
            demoState.set_supplier_quote(cid, quote.supplier_id, quote);
            const normalized = normalizeQuote(quote);
            demoState.set_normalized_quote(cid, quote.supplier_id, normalized);
          });
          demoState.set_quote_collection_status(cid, PN_QUOTE_COLLECTION_STATUS.ALL_REPLIED);

          // 记录 mock 发送日志
          supplierIds.forEach(sid => {
            demoState.add_mail_log(cid, sid, generateRfqSendLog(cid, sid));
          });

          // 取第一个作为 active （用于展示初始 benchmark）
          if (!activeComponent) {
            activeComponent = comp;
            globalQuotes = compQuotes;
          }
        } else {
          // 无 mock 数据的 PN：停留在初始状态
          demoState.set_supplier_selection_status(cid, PN_SUPPLIER_SELECTION_STATUS.NOT_STARTED);
          demoState.set_rfq_status(cid, PN_RFQ_STATUS.NOT_PREPARED);
          demoState.set_quote_collection_status(cid, PN_QUOTE_COLLECTION_STATUS.NONE_REPLIED);
        }
      }

      if (!activeComponent) {
        ctx.error('未找到含 >=2 家供应商 mock 报价的 component', 400);
        return;
      }

      demoState.set_active_component(activeComponent.component_no);

      // 生成 Award Summary（第一个 PN）
      const normalizedQuotes = globalQuotes.map(q => normalizeQuote(q));
      const supplierProfiles = {};
      for (const q of globalQuotes) {
        supplierProfiles[q.supplier_id] = getSupplierById(q.supplier_id) || {};
      }

      awardSummary = generateAwardSummary({
        component: activeComponent,
        normalizedQuotes,
        supplierProfiles,
      });

      demoState.set_award_comparison_rows(awardSummary.comparison_rows);
      demoState.set_award_summary(awardSummary);

      // 全局状态顺序推进（与 PN 级状态保持一致）
      demoState.safe_transition(STATUS.RFQ_PREPARED);
      demoState.safe_transition(STATUS.RFQ_SENT);
      demoState.safe_transition(STATUS.SUPPLIER_FEEDBACK_IN_PROGRESS);
      demoState.safe_transition(STATUS.BENCHMARK_READY);

      // 同步生成比较底表
      comparisonBase = generateComparisonBase(activeComponent, normalizedQuotes, supplierProfiles);
      demoState.set_comparison_base(comparisonBase);

      // 返回数据
      ctx.success({
        project,
        components: assigned,
        component_count: assigned.length,
        active_component: activeComponent,
        progress: demoState.get_completion_progress(),
        award_summary: awardSummary,
        comparison_base: comparisonBase,
      });
    } catch (error) {
      ctx.error(error.message, 500);
    }
  });

  return router;
}
