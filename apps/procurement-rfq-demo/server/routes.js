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
import demoState from '../state/demo-state.js';
import { STATUS, STATUS_ORDER } from '../state/state-constants.js';

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
      const currentIdx = STATUS_ORDER.indexOf(demoState.status);
      const targetIdx = STATUS_ORDER.indexOf(STATUS.COMPONENTS_ASSIGNED);
      if (currentIdx < targetIdx) {
        demoState.transition(STATUS.COMPONENTS_ASSIGNED);
      }

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
   * 保存约束表单
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
      ctx.success({
        form: demoState.get_constraint_form(component_id),
        validation,
      });
    } catch (error) {
      ctx.error(error.message, 500);
    }
  });

  // ==================== 供应商推荐路由 ====================

  /**
   * GET /supplier/recommend/:component_id
   * 为指定 component 推荐供应商
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

      demoState.set_rfq_preview(component_id, preview);
      // 仅当当前状态尚未到达 RFQ_PREPARED 时才跳转（避免重复生成时状态倒退报错）
      const currentIdx = STATUS_ORDER.indexOf(demoState.status);
      const targetIdx = STATUS_ORDER.indexOf(STATUS.RFQ_PREPARED);
      if (currentIdx < targetIdx) {
        demoState.transition(STATUS.RFQ_PREPARED);
      }

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

      // 更新状态
      if (demoState.status === STATUS.RFQ_PREPARED) {
        demoState.transition(STATUS.QUOTES_COMPARED);
      }

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
      const awardCurrentIdx = STATUS_ORDER.indexOf(demoState.status);
      const awardTargetIdx = STATUS_ORDER.indexOf(STATUS.AWARD_REVIEWED);
      if (awardCurrentIdx < awardTargetIdx) {
        demoState.transition(STATUS.AWARD_REVIEWED);
      }

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
      demoState.transition(STATUS.COMPONENTS_ASSIGNED);

      // 找第一个有 mock 报价数据（>=2 家）的 component
      const quotesPath = path.join(__dirname, '..', 'demo_data', 'mock-supplier-quotes.json');
      const quotesData = JSON.parse(fs.readFileSync(quotesPath, 'utf-8'));

      let activeComponent = null;
      let quotes = [];
      for (const comp of assigned) {
        const compQuotes = quotesData[comp.component_no]?.quotes;
        if (compQuotes && compQuotes.length >= 2) {
          activeComponent = comp;
          quotes = compQuotes;
          break;
        }
      }

      if (!activeComponent) {
        ctx.error('未找到含 >=2 家供应商 mock 报价的 component', 400);
        return;
      }

      demoState.set_active_component(activeComponent.component_no);

      // 加载报价
      quotes.forEach(quote => {
        demoState.set_supplier_quote(activeComponent.component_no, quote.supplier_id, quote);
        const normalized = normalizeQuote(quote);
        demoState.set_normalized_quote(activeComponent.component_no, quote.supplier_id, normalized);
      });

      demoState.transition(STATUS.RFQ_PREPARED);
      demoState.transition(STATUS.QUOTES_COMPARED);

      // 生成 Award Summary
      const normalizedQuotes = quotes.map(q => normalizeQuote(q));
      const supplierProfiles = {};
      for (const q of quotes) {
        supplierProfiles[q.supplier_id] = getSupplierById(q.supplier_id) || {};
      }

      const awardSummary = generateAwardSummary({
        component: activeComponent,
        normalizedQuotes,
        supplierProfiles,
      });

      demoState.set_award_comparison_rows(awardSummary.comparison_rows);
      demoState.set_award_summary(awardSummary);
      demoState.transition(STATUS.AWARD_REVIEWED);

      // 同步生成比较底表
      const comparisonBase = generateComparisonBase(activeComponent, normalizedQuotes, supplierProfiles);
      demoState.set_comparison_base(comparisonBase);

      // 同步生成报价审核
      const quoteReview = generateQuoteReview(activeComponent.component_no, quotes, normalizedQuotes);

      ctx.success({
        project,
        components: assigned,
        component_count: assigned.length,
        active_component: activeComponent,
        quotes,
        quote_count: quotes.length,
        award_summary: awardSummary,
        comparison_base: comparisonBase,
        quote_review: quoteReview,
      });
    } catch (error) {
      ctx.error(error.message, 500);
    }
  });

  return router;
}
