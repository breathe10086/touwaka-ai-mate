/**
 * 采购 RFQ Demo - 轻量状态容器
 *
 * 设计原则（来自 audit-round03）：
 * - 内存态存储，demo 阶段不做持久化
 * - 所有状态变化通过 transition() 方法走状态跳转校验
 * - 派生判断统一由 selector 函数推导，不维护冗余布尔变量
 * - 单一主工作台上下文：只允许一个当前 ebom / 一个当前 pn
 */
import { STATUS, STATUS_TRANSITIONS, STATUS_ORDER, STATUS_LIGHT } from './state-constants.js';

class DemoState {
  constructor() {
    this._state = {
      // 主状态
      status: STATUS.EBOM_IMPORTED,

      // 项目信息（EBOM）
      project: null,

      // 部件列表（pn list）
      components: [],

      // 约束表单（per component）
      constraint_forms: {},

      // 供应商候选列表（per component）
      supplier_candidates: {},

      // RFQ 预览数据（per component）
      rfq_previews: {},

      // 供应商报价（per component -> per supplier）
      supplier_quotes: {},

      // 标准化报价
      normalized_quotes: {},

      // Award 比较行
      award_comparison_rows: [],

      // Award 总结
      award_summary: null,

      // 比较底表（benchmark，在 supplier list 底部展示）
      comparison_base: null,

      // 当前选中 component（pn）
      active_component_id: null,

      // 当前选中 supplier
      active_supplier_id: null,

      // Buyer 视角（demo 用 ID 切换模拟登录）
      buyer_perspective: null,

      // 邮件日志（per component -> per supplier）
      mail_logs: {},

      // Sourcing File 预览数据
      sourcing_file_preview: null,

      // 元信息
      updated_at: new Date().toISOString(),
      updated_by: 'demo_user',
      notes: '',
    };
  }

  /**
   * 获取当前完整状态快照（只读）
   */
  get snapshot() {
    return JSON.parse(JSON.stringify(this._state));
  }

  /**
   * 获取主状态
   */
  get status() {
    return this._state.status;
  }

  /**
   * 获取状态灯信息
   */
  get status_light() {
    return STATUS_LIGHT[this._state.status] || { color: 'info', label: this._state.status };
  }

  /**
   * 状态跳转（带校验）
   * @param {string} targetStatus
   * @throws {Error} 若跳转不在允许路径中
   */
  transition(targetStatus) {
    const allowed = STATUS_TRANSITIONS[this._state.status] || [];
    if (!allowed.includes(targetStatus)) {
      throw new Error(
        `Invalid status transition: ${this._state.status} -> ${targetStatus}. Allowed: [${allowed.join(', ')}]`
      );
    }
    this._state.status = targetStatus;
    this._touch();
  }

  /**
   * 安全跳转：仅在当前序号小于目标序号时执行
   */
  safe_transition(targetStatus) {
    const currentIdx = STATUS_ORDER.indexOf(this._state.status);
    const targetIdx = STATUS_ORDER.indexOf(targetStatus);
    if (currentIdx >= 0 && targetIdx >= 0 && currentIdx < targetIdx) {
      this.transition(targetStatus);
    }
  }

  // ==================== 派生判断 (Selectors) ====================

  /**
   * 是否可以进入 buyer 分派阶段
   */
  can_assign_buyers() {
    return this._state.status === STATUS.EBOM_IMPORTED
      && this._state.project !== null
      && this._state.components.length > 0;
  }

  /**
   * 是否可以准备 RFQ
   */
  can_prepare_rfq() {
    return this._state.status === STATUS.BUYER_ASSIGNED
      && this._state.active_component_id !== null;
  }

  /**
   * 是否可以发送 RFQ（mock）
   */
  can_send_rfq() {
    return this._state.status === STATUS.RFQ_PREPARED
      && this._state.active_component_id !== null
      && (this._state.rfq_previews[this._state.active_component_id] !== undefined);
  }

  /**
   * 是否可以模拟回传
   */
  can_mock_reply() {
    return this._state.status === STATUS.RFQ_SENT
      && this._state.active_component_id !== null;
  }

  /**
   * 是否可以生成 benchmark
   */
  can_generate_benchmark() {
    if (this._state.status !== STATUS.SUPPLIER_FEEDBACK_IN_PROGRESS) return false;
    const cid = this._state.active_component_id;
    if (!cid) return false;
    const quotes = this._state.supplier_quotes[cid] || {};
    return Object.keys(quotes).length >= 2;
  }

  /**
   * 是否可以生成 sourcing file
   */
  can_generate_sourcing_file() {
    return this._state.status === STATUS.BENCHMARK_READY
      || this._state.status === STATUS.SOURCING_FILE_READY;
  }

  /**
   * 获取当前阶段可执行的操作描述
   */
  get_available_actions() {
    const actions = [];
    switch (this._state.status) {
      case STATUS.EBOM_IMPORTED:
        if (this._state.components.length > 0) actions.push('assign_buyers');
        actions.push('import_ebom');
        break;
      case STATUS.BUYER_ASSIGNED:
        actions.push('fill_constraint_form');
        actions.push('select_suppliers');
        actions.push('prepare_rfq');
        break;
      case STATUS.RFQ_PREPARED:
        actions.push('send_rfq');
        actions.push('preview_rfq');
        break;
      case STATUS.RFQ_SENT:
        actions.push('mock_supplier_reply');
        break;
      case STATUS.SUPPLIER_FEEDBACK_IN_PROGRESS:
        actions.push('generate_benchmark');
        actions.push('mock_more_replies');
        break;
      case STATUS.BENCHMARK_READY:
        actions.push('generate_sourcing_file');
        break;
      case STATUS.SOURCING_FILE_READY:
        actions.push('generate_sourcing_file');
        break;
      case STATUS.SOURCING_FILE_GENERATED:
        actions.push('reset_demo');
        break;
    }
    return actions;
  }

  // ==================== 数据操作 ====================

  set_project(project) {
    this._state.project = project;
    this._touch();
  }

  set_components(components) {
    this._state.components = components;
    this._touch();
  }

  set_active_component(component_id) {
    this._state.active_component_id = component_id;
    this._state.active_supplier_id = null; // 切换 pn 时清除 supplier 选中
    this._touch();
  }

  set_active_supplier(supplier_id) {
    this._state.active_supplier_id = supplier_id;
    this._touch();
  }

  set_constraint_form(component_id, form) {
    this._state.constraint_forms[component_id] = {
      ...form,
      updated_at: new Date().toISOString(),
    };
    this._touch();
  }

  get_constraint_form(component_id) {
    return this._state.constraint_forms[component_id] || null;
  }

  set_supplier_candidates(component_id, suppliers) {
    this._state.supplier_candidates[component_id] = suppliers;
    this._touch();
  }

  set_rfq_preview(component_id, preview) {
    this._state.rfq_previews[component_id] = preview;
    this._touch();
  }

  set_supplier_quote(component_id, supplier_id, quote) {
    if (!this._state.supplier_quotes[component_id]) {
      this._state.supplier_quotes[component_id] = {};
    }
    this._state.supplier_quotes[component_id][supplier_id] = {
      ...quote,
      updated_at: new Date().toISOString(),
    };
    this._touch();
  }

  set_normalized_quote(component_id, supplier_id, normalized) {
    if (!this._state.normalized_quotes[component_id]) {
      this._state.normalized_quotes[component_id] = {};
    }
    this._state.normalized_quotes[component_id][supplier_id] = normalized;
    this._touch();
  }

  set_award_comparison_rows(rows) {
    this._state.award_comparison_rows = rows;
    this._touch();
  }

  set_award_summary(summary) {
    this._state.award_summary = summary;
    this._touch();
  }

  set_comparison_base(base) {
    this._state.comparison_base = base;
    this._touch();
  }

  set_buyer_perspective(buyerId) {
    this._state.buyer_perspective = buyerId;
    this._touch();
  }

  get_buyer_perspective() {
    return this._state.buyer_perspective;
  }

  // ==================== 邮件日志 ====================

  /**
   * 添加邮件日志条目
   */
  add_mail_log(component_id, supplier_id, entry) {
    if (!this._state.mail_logs[component_id]) {
      this._state.mail_logs[component_id] = {};
    }
    if (!this._state.mail_logs[component_id][supplier_id]) {
      this._state.mail_logs[component_id][supplier_id] = [];
    }
    this._state.mail_logs[component_id][supplier_id].push({
      ...entry,
      timestamp: new Date().toISOString(),
    });
    this._touch();
  }

  /**
   * 获取邮件日志
   */
  get_mail_logs(component_id, supplier_id) {
    if (!component_id) return [];
    if (supplier_id) {
      return this._state.mail_logs[component_id]?.[supplier_id] || [];
    }
    return this._state.mail_logs[component_id] || {};
  }

  // ==================== Sourcing File ====================

  /**
   * 设置 Sourcing File 预览
   */
  set_sourcing_file_preview(preview) {
    this._state.sourcing_file_preview = preview;
    this._touch();
  }

  /**
   * 按 buyer 视角过滤 components
   */
  get_components_by_buyer(buyerId) {
    if (!buyerId) return this._state.components;
    return this._state.components.filter(c => c.assigned_buyer === buyerId);
  }

  /**
   * 重置状态到初始
   */
  reset() {
    this._state = new DemoState()._state;
  }

  // ==================== 内部方法 ====================

  _touch() {
    this._state.updated_at = new Date().toISOString();
  }
}

// 单例导出
const demoState = new DemoState();
export default demoState;
