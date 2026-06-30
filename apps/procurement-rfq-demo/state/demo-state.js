/**
 * 采购 RFQ Demo - 轻量状态容器
 *
 * 设计原则（来自 audit-round03）：
 * - 内存态存储，demo 阶段不做持久化
 * - 所有状态变化通过 transition() 方法走状态跳转校验
 * - 派生判断统一由 selector 函数推导，不维护冗余布尔变量
 * - 单一主工作台上下文：只允许一个当前 ebom / 一个当前 pn
 */
import { STATUS, STATUS_TRANSITIONS, STATUS_ORDER, STATUS_LIGHT, PN_REQUIREMENT_STATUS, PN_SUPPLIER_SELECTION_STATUS, PN_RFQ_STATUS, PN_QUOTE_COLLECTION_STATUS } from './state-constants.js';

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

      // === PN 级局部状态（audit-round04） ===

      // 约束编辑状态 (per component)
      requirement_status: {},

      // 供应商选择状态 (per component)
      supplier_selection_status: {},

      // RFQ 包状态 (per component)
      rfq_status: {},

      // 报价回传状态 (per component)
      quote_collection_status: {},

      // 已选中的供应商ID列表 (per component)
      selected_supplier_ids: {},

      // 已确认的供应商ID列表 (per component)
      confirmed_supplier_ids: {},

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

  // ==================== 派生判断 (Selectors) - PN 级（audit-round04） ====================

  /**
   * 获取指定 PN 的约束编辑状态
   */
  get_requirement_status(component_id) {
    return this._state.requirement_status[component_id] || PN_REQUIREMENT_STATUS.FIRST_ENTRY_EDITING;
  }

  /**
   * 获取指定 PN 的供应商选择状态
   */
  get_supplier_selection_status(component_id) {
    return this._state.supplier_selection_status[component_id] || PN_SUPPLIER_SELECTION_STATUS.NOT_STARTED;
  }

  /**
   * 获取指定 PN 的 RFQ 状态
   */
  get_rfq_status(component_id) {
    return this._state.rfq_status[component_id] || PN_RFQ_STATUS.NOT_PREPARED;
  }

  /**
   * 获取指定 PN 的报价回传状态
   */
  get_quote_collection_status(component_id) {
    return this._state.quote_collection_status[component_id] || PN_QUOTE_COLLECTION_STATUS.NONE_REPLIED;
  }

  /**
   * 是否可以编辑约束（per PN + role）
   * audit-round05: 适配4状态机 - 只有 admin 且处于编辑态（first_entry_editing / manual_editing）时可编辑
   */
  can_edit_requirements(component_id, role) {
    if (role !== 'admin') return false;
    const status = this.get_requirement_status(component_id);
    return status === PN_REQUIREMENT_STATUS.FIRST_ENTRY_EDITING
      || status === PN_REQUIREMENT_STATUS.MANUAL_EDITING;
  }

  /**
   * 是否可以保存约束（从编辑态保存到锁定态）
   * audit-round05: 适配4状态机
   */
  can_save_requirements(component_id) {
    const status = this.get_requirement_status(component_id);
    return status === PN_REQUIREMENT_STATUS.FIRST_ENTRY_EDITING
      || status === PN_REQUIREMENT_STATUS.MANUAL_EDITING;
  }

  /**
   * 是否可以点击"修改约束"按钮（从锁定态进入手动编辑态）
   * audit-round05: admin 在 saved_locked 或 manual_saved_locked 状态均可点击
   */
  can_start_editing_requirements(component_id, role) {
    if (role !== 'admin') return false;
    const status = this.get_requirement_status(component_id);
    return status === PN_REQUIREMENT_STATUS.SAVED_LOCKED
      || status === PN_REQUIREMENT_STATUS.MANUAL_SAVED_LOCKED;
  }

  /**
   * 是否可以确认供应商（per PN + role: admin or assigned buyer）
   */
  can_confirm_suppliers(component_id, role) {
    if (role !== 'admin') {
      const comp = this._state.components.find(c => c.component_no === component_id);
      if (!comp || comp.buyer_id !== role) return false;
    }
    const status = this.get_supplier_selection_status(component_id);
    return status === PN_SUPPLIER_SELECTION_STATUS.SELECTING;
  }

  /**
   * 是否可以修改已确认的供应商（per PN + role: admin or assigned buyer）
   */
  can_modify_suppliers(component_id, role) {
    if (role !== 'admin') {
      const comp = this._state.components.find(c => c.component_no === component_id);
      if (!comp || comp.buyer_id !== role) return false;
    }
    return this.get_supplier_selection_status(component_id) === PN_SUPPLIER_SELECTION_STATUS.CONFIRMED;
  }

  /**
   * 是否可以添加供应商（per PN + role: admin or assigned buyer, 仅在 confirmed 时可用）
   * audit-round05: 新增 - 在已确认状态下可以追加供应商
   */
  can_add_supplier(component_id, role) {
    if (role !== 'admin') {
      const comp = this._state.components.find(c => c.component_no === component_id);
      if (!comp || comp.buyer_id !== role) return false;
    }
    const selStatus = this.get_supplier_selection_status(component_id);
    return selStatus === PN_SUPPLIER_SELECTION_STATUS.CONFIRMED
      || selStatus === PN_SUPPLIER_SELECTION_STATUS.SELECTING;
  }

  /**
   * 是否可以准备 RFQ（per PN + role: admin or assigned buyer）
   * audit-round05: 不再限制 admin only
   */
  can_prepare_rfq(component_id, role) {
    if (role !== 'admin') {
      const comp = this._state.components.find(c => c.component_no === component_id);
      if (!comp || comp.buyer_id !== role) return false;
    }
    const selStatus = this.get_supplier_selection_status(component_id);
    if (selStatus !== PN_SUPPLIER_SELECTION_STATUS.CONFIRMED) return false;
    const confirmedIds = this._state.confirmed_supplier_ids[component_id] || [];
    return confirmedIds.length >= 2;
  }

  /**
   * 是否可以发送 RFQ（per PN + role: admin or assigned buyer）
   * audit-round05: 不再限制 admin only，允许 PN 的 assigned buyer 发送
   */
  can_send_rfq(component_id, role) {
    if (role !== 'admin') {
      const comp = this._state.components.find(c => c.component_no === component_id);
      if (!comp || comp.buyer_id !== role) return false;
    }
    const rfqStatus = this.get_rfq_status(component_id);
    return rfqStatus === PN_RFQ_STATUS.PREPARED || rfqStatus === PN_RFQ_STATUS.SENT;
  }

  /**
   * 是否可以查看已发送的 RFQ（per PN）
   */
  can_view_sent_rfq(component_id) {
    return this.get_rfq_status(component_id) === PN_RFQ_STATUS.SENT;
  }

  /**
   * 是否可以模拟回传（per PN + role）
   * audit-round06: admin 可对任意 PN 执行，assigned buyer 可对自己负责的 PN 执行
   */
  can_mock_reply(component_id, role) {
    if (role !== 'admin') {
      // 非 admin 必须是该 PN 的 assigned buyer
      const comp = this._state.components.find(c => c.component_no === component_id);
      if (!comp || comp.buyer_id !== role) return false;
    }
    const rfqStatus = this.get_rfq_status(component_id);
    if (rfqStatus !== PN_RFQ_STATUS.SENT) return false;
    const collStatus = this.get_quote_collection_status(component_id);
    return collStatus !== PN_QUOTE_COLLECTION_STATUS.ALL_REPLIED;
  }

  /**
   * 是否可以生成 benchmark（per PN）
   */
  can_generate_benchmark(component_id) {
    const collStatus = this.get_quote_collection_status(component_id);
    return collStatus === PN_QUOTE_COLLECTION_STATUS.ALL_REPLIED;
  }

  /**
   * 是否可以生成 sourcing file（全局：所有 PN 满足 4 条件聚合）
   * audit-round05: 4条件 per PN
   *   1) 约束已保存（saved_locked / manual_saved_locked）
   *   2) 供应商已确认 >=2 家
   *   3) RFQ 已发送
   *   4) 报价全部回传（all_replied）
   */
  can_generate_sourcing_file() {
    const allPnIds = this._state.components.map(c => c.component_no);
    if (allPnIds.length === 0) return false;
    return allPnIds.every(cid => {
      // 条件1: 约束已保存
      const reqStatus = this.get_requirement_status(cid);
      if (reqStatus !== PN_REQUIREMENT_STATUS.SAVED_LOCKED
        && reqStatus !== PN_REQUIREMENT_STATUS.MANUAL_SAVED_LOCKED) {
        return false;
      }
      // 条件2: 供应商已确认 >=2
      const confirmedIds = this._state.confirmed_supplier_ids[cid] || [];
      if (confirmedIds.length < 2) return false;
      // 条件3: RFQ 已发送
      const rfqStatus = this.get_rfq_status(cid);
      if (rfqStatus !== PN_RFQ_STATUS.SENT) return false;
      // 条件4: 全部回传
      const collStatus = this.get_quote_collection_status(cid);
      if (collStatus !== PN_QUOTE_COLLECTION_STATUS.ALL_REPLIED) return false;
      return true;
    });
  }

  /**
   * 获取 sourcing file 条件详情（per PN 诊断用）
   * audit-round05: 返回每PN的4条件满足情况，前端用于展示 deficiency
   */
  get_sourcing_file_conditions() {
    const allPnIds = this._state.components.map(c => c.component_no);
    return allPnIds.map(cid => {
      const reqStatus = this.get_requirement_status(cid);
      const confirmedIds = this._state.confirmed_supplier_ids[cid] || [];
      const rfqStatus = this.get_rfq_status(cid);
      const collStatus = this.get_quote_collection_status(cid);
      return {
        component_id: cid,
        constraint_saved: reqStatus === PN_REQUIREMENT_STATUS.SAVED_LOCKED
          || reqStatus === PN_REQUIREMENT_STATUS.MANUAL_SAVED_LOCKED,
        suppliers_confirmed: confirmedIds.length >= 2,
        rfq_sent: rfqStatus === PN_RFQ_STATUS.SENT,
        all_replied: collStatus === PN_QUOTE_COLLECTION_STATUS.ALL_REPLIED,
        all_met: (
          (reqStatus === PN_REQUIREMENT_STATUS.SAVED_LOCKED
            || reqStatus === PN_REQUIREMENT_STATUS.MANUAL_SAVED_LOCKED)
          && confirmedIds.length >= 2
          && rfqStatus === PN_RFQ_STATUS.SENT
          && collStatus === PN_QUOTE_COLLECTION_STATUS.ALL_REPLIED
        ),
      };
    });
  }

  /**
   * 获取完成进度对象（用于前端展示）
   */
  get_completion_progress() {
    const allPnIds = this._state.components.map(c => c.component_no);
    const total = allPnIds.length;
    if (total === 0) return { pct: 0, completed_pns: 0, total_pns: 0 };
    const completed = allPnIds.filter(cid =>
      this.get_quote_collection_status(cid) === PN_QUOTE_COLLECTION_STATUS.ALL_REPLIED
    ).length;
    return { pct: Math.round((completed / total) * 100), completed_pns: completed, total_pns: total };
  }

  /**
   * 判断是否可以修改 buyer 分派（全局，必须在 buyer_assigned 之前阶段）
   */
  can_assign_buyers() {
    return this._state.components.length > 0
      && this._state.project !== null;
  }

  // ==================== PN 级状态操作 ====================

  set_requirement_status(component_id, status) {
    this._state.requirement_status[component_id] = status;
    this._touch();
  }

  set_supplier_selection_status(component_id, status) {
    this._state.supplier_selection_status[component_id] = status;
    this._touch();
  }

  set_rfq_status(component_id, status) {
    this._state.rfq_status[component_id] = status;
    this._touch();
  }

  set_quote_collection_status(component_id, status) {
    this._state.quote_collection_status[component_id] = status;
    this._touch();
  }

  set_selected_supplier_ids(component_id, ids) {
    this._state.selected_supplier_ids[component_id] = [...ids];
    this._touch();
  }

  get_selected_supplier_ids(component_id) {
    return this._state.selected_supplier_ids[component_id] || [];
  }

  set_confirmed_supplier_ids(component_id, ids) {
    this._state.confirmed_supplier_ids[component_id] = [...ids];
    this._touch();
  }

  get_confirmed_supplier_ids(component_id) {
    return this._state.confirmed_supplier_ids[component_id] || [];
  }

  /**
   * 判断指定 PN 是否需要进入首次编辑模式
   */
  is_first_entry(component_id) {
    const status = this.get_requirement_status(component_id);
    return status === PN_REQUIREMENT_STATUS.FIRST_ENTRY_EDITING;
  }

  /**
   * 设置 PN 的约束编辑状态
   * audit-round05 修正: isFirst=false 时设为 SAVED_LOCKED（已保存锁定），而非 MANUAL_EDITING
   */
  set_first_entry(component_id, isFirst) {
    this._state.pn_is_first_entry = this._state.pn_is_first_entry || {};
    this._state.pn_is_first_entry[component_id] = isFirst;
    if (isFirst) {
      this.set_requirement_status(component_id, PN_REQUIREMENT_STATUS.FIRST_ENTRY_EDITING);
    } else {
      this.set_requirement_status(component_id, PN_REQUIREMENT_STATUS.SAVED_LOCKED);
    }
    this._touch();
  }

  /**
   * 重置供应商选择状态（修改模式）
   */
  reset_supplier_selection(component_id) {
    this._state.supplier_selection_status[component_id] = PN_SUPPLIER_SELECTION_STATUS.SELECTING;
    this._state.confirmed_supplier_ids[component_id] = [];
    this._touch();
  }

  /**
   * 递增 PN 的 RFQ 发送次数
   */
  increment_rfq_sent_count(component_id) {
    this._state.pn_rfq_sent_count = this._state.pn_rfq_sent_count || {};
    this._state.pn_rfq_sent_count[component_id] = (this._state.pn_rfq_sent_count[component_id] || 0) + 1;
    this._touch();
  }

  // ==================== 全局状态操作（保留） ====================

  /**
   * 获取当前阶段可执行的操作描述（全局概览用）
   */
  get_available_actions() {
    const actions = [];
    const cid = this._state.active_component_id;
    if (!cid) return actions;

    const reqStatus = this.get_requirement_status(cid);
    const selStatus = this.get_supplier_selection_status(cid);
    const rfqStatus = this.get_rfq_status(cid);
    const collStatus = this.get_quote_collection_status(cid);

    if (reqStatus === PN_REQUIREMENT_STATUS.FIRST_ENTRY_EDITING) actions.push('fill_constraint_form');
    if (selStatus === PN_SUPPLIER_SELECTION_STATUS.NOT_STARTED) actions.push('recommend_suppliers');
    if (selStatus === PN_SUPPLIER_SELECTION_STATUS.SELECTING) actions.push('confirm_suppliers');
    if (selStatus === PN_SUPPLIER_SELECTION_STATUS.CONFIRMED && rfqStatus === PN_RFQ_STATUS.NOT_PREPARED) actions.push('prepare_rfq');
    if (rfqStatus === PN_RFQ_STATUS.PREPARED) actions.push('send_rfq');
    if (rfqStatus === PN_RFQ_STATUS.SENT && collStatus !== PN_QUOTE_COLLECTION_STATUS.ALL_REPLIED) actions.push('mock_reply');
    if (collStatus === PN_QUOTE_COLLECTION_STATUS.ALL_REPLIED) actions.push('generate_benchmark');
    if (this.can_generate_sourcing_file()) actions.push('generate_sourcing_file');

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
