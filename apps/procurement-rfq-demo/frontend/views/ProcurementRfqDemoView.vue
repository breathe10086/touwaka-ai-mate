<template>
  <div class="rfq-demo">
    <div class="demo-header">
      <div class="header-left">
        <h1>📦 采购询价 Demo</h1>
        <span class="demo-badge">原型演示</span>
      </div>
      <div class="header-right">
        <span class="status-label">当前阶段：</span>
        <el-tag :type="statusTagType">{{ statusLabel }}</el-tag>
        <el-button type="primary" size="small" @click="handleQuickInit" :loading="loading">⚡ 一键初始化 Demo</el-button>
        <el-button size="small" @click="handleReset">重置</el-button>
      </div>
    </div>
    <div class="demo-progress">
      <el-steps :active="currentStep" align-center>
        <el-step title="EBOM 导入" description="项目与部件初始化" />
        <el-step title="Buyer 分派" description="按品类分派采购" />
        <el-step title="约束与供应商" description="约束确认与供应商选择" />
        <el-step title="RFQ 询价包" description="RFQ 包预览" />
        <el-step title="报价审核" description="报价标准化审核" />
        <el-step title="比较 & Award" description="比较底表与定点评审" />
      </el-steps>
    </div>
    <el-tabs v-model="activeTab" type="border-card" class="demo-tabs">
      <!-- Tab 1: EBOM -->
      <el-tab-pane label="📋 EBOM 导入" name="ebom">
        <div class="tab-content">
          <el-alert v-if="!state.project" title="尚未导入 EBOM" description="点击下方按钮加载示例 EBOM" type="info" show-icon :closable="false" />
          <div v-if="state.project" class="section">
            <h3>项目信息</h3>
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="项目编号">{{ state.project.project_code }}</el-descriptions-item>
              <el-descriptions-item label="项目名称">{{ state.project.project_name }}</el-descriptions-item>
              <el-descriptions-item label="成品编号">{{ state.project.part_no }}</el-descriptions-item>
              <el-descriptions-item label="成品名称">{{ state.project.part_name }}</el-descriptions-item>
              <el-descriptions-item label="月供货量">{{ state.project.expected_supply_qty_monthly }}</el-descriptions-item>
              <el-descriptions-item label="年供货量">{{ state.project.expected_supply_qty_yearly }}</el-descriptions-item>
              <el-descriptions-item label="背景说明" :span="2">{{ state.project.background_note }}</el-descriptions-item>
            </el-descriptions>
          </div>
          <div v-if="state.components.length > 0" class="section">
            <h3>部件列表 ({{ state.components.length }} 项)</h3>
            <el-table :data="state.components" stripe size="small" max-height="400">
              <el-table-column prop="component_no" label="部件编号" width="160" />
              <el-table-column prop="component_name" label="部件名称" min-width="180" />
              <el-table-column prop="quantity" label="用量" width="80" />
              <el-table-column prop="unit" label="单位" width="60" />
              <el-table-column prop="category" label="品类" width="120"><template #default="{ row }"><el-tag size="small">{{ row.category }}</el-tag></template></el-table-column>
              <el-table-column prop="buyer_id" label="Buyer" width="100"><template #default="{ row }"><span v-if="row.buyer_id">{{ getBuyerName(row.buyer_id) }}</span><el-tag v-else size="small" type="info">未分派</el-tag></template></el-table-column>
              <el-table-column prop="material_spec" label="材质规格" min-width="150" />
            </el-table>
          </div>
          <div class="section actions">
            <el-button type="primary" @click="handleLoadSampleEBOM" :loading="loading" :disabled="!!state.project">加载示例 EBOM</el-button>
            <el-button @click="handleAssignBuyers" :disabled="state.components.length === 0 || hasBuyerAssigned">自动分派 Buyer</el-button>
          </div>
        </div>
      </el-tab-pane>

      <!-- Tab 2: Buyer Workbench -->
      <el-tab-pane label="👤 Buyer 工作台" name="buyer">
        <div class="tab-content">
          <div v-if="!state.components.length || !hasBuyerAssigned" class="empty-hint">请先在"EBOM 导入"页加载 EBOM 并完成 Buyer 分派</div>
          <div v-else>
            <div class="section">
              <el-form inline size="small">
                <el-form-item label="切换 Buyer 视角">
                  <el-select v-model="selectedBuyerId" @change="handleSwitchBuyer" clearable placeholder="全部 Buyer">
                    <el-option v-for="b in allBuyers" :key="b.id" :label="b.name + ' (' + b.id + ')'" :value="b.id" />
                  </el-select>
                </el-form-item>
              </el-form>
              <el-alert v-if="selectedBuyerId" :title="'当前视角: ' + getBuyerName(selectedBuyerId)" type="warning" :closable="false" show-icon style="margin-top:8px">
                仅显示 {{ getBuyerName(selectedBuyerId) }} 负责的部件 ({{ visibleComponents.length }} 项)
              </el-alert>
            </div>
            <div class="section">
              <h3>{{ selectedBuyerId ? getBuyerName(selectedBuyerId) + ' 负责的' : '全部' }}部件</h3>
              <el-table :data="visibleComponents" stripe size="small" @row-click="(row: any) => handleSelectComponent(row.component_no)" highlight-current-row>
                <el-table-column prop="component_no" label="部件编号" width="160"><template #default="{ row }"><el-link type="primary">{{ row.component_no }}</el-link></template></el-table-column>
                <el-table-column prop="component_name" label="部件名称" min-width="180" />
                <el-table-column prop="quantity" label="用量" width="80" />
                <el-table-column prop="category" label="品类" width="120"><template #default="{ row }"><el-tag size="small">{{ row.category }}</el-tag></template></el-table-column>
                <el-table-column prop="buyer_id" label="Buyer" width="100"><template #default="{ row }">{{ getBuyerName(row.buyer_id) }}</template></el-table-column>
                <el-table-column label="操作" width="80"><template #default="{ row }"><el-button size="small" type="primary" @click.stop="handleSelectComponent(row.component_no)">进入</el-button></template></el-table-column>
              </el-table>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- Tab 3: Constraint & Supplier -->
      <el-tab-pane label="📝 约束确认 & 供应商选择" name="constraint">
        <div class="tab-content">
          <div v-if="!state.active_component_id" class="empty-hint">请先在"Buyer 工作台"选择一个部件</div>
          <div v-else>
            <h4>当前部件：{{ activeComp?.component_no }} - {{ activeComp?.component_name }}</h4>
            <div class="section">
              <h4>报价约束表单 <el-tag size="small" type="info">系统预填 → 修改 → 确认</el-tag></h4>
              <el-form :model="constraintForm" label-width="120px" size="small" class="constraint-form">
                <el-row :gutter="16">
                  <el-col :span="8"><el-form-item label="加工方式"><el-input v-model="constraintForm.process_type" placeholder="如 CNC 加工" /></el-form-item></el-col>
                  <el-col :span="8"><el-form-item label="表面处理"><el-input v-model="constraintForm.surface_treatment" placeholder="如阳极氧化" /></el-form-item></el-col>
                  <el-col :span="8"><el-form-item label="数量"><el-input-number v-model="constraintForm.quantity" :min="0" /></el-form-item></el-col>
                </el-row>
                <el-row :gutter="16">
                  <el-col :span="8"><el-form-item label="交付要求"><el-input v-model="constraintForm.delivery_requirement" placeholder="如 4周内交付" /></el-form-item></el-col>
                  <el-col :span="8"><el-form-item label="贸易术语"><el-select v-model="constraintForm.target_incoterm"><el-option label="DDP" value="DDP" /><el-option label="FOB" value="FOB" /><el-option label="CIF" value="CIF" /><el-option label="EXW" value="EXW" /></el-select></el-form-item></el-col>
                  <el-col :span="8"><el-form-item label="币种"><el-select v-model="constraintForm.currency_mode"><el-option label="RMB" value="RMB" /><el-option label="EUR" value="EUR" /><el-option label="USD" value="USD" /></el-select></el-form-item></el-col>
                </el-row>
                <el-row :gutter="16">
                  <el-col :span="8"><el-form-item label="模具要求"><el-input v-model="constraintForm.mold_requirement" /></el-form-item></el-col>
                  <el-col :span="8"><el-form-item label="包装要求"><el-input v-model="constraintForm.packing_requirement" /></el-form-item></el-col>
                  <el-col :span="8"><el-form-item label="质量要求"><el-input v-model="constraintForm.quality_requirement" /></el-form-item></el-col>
                </el-row>
                <el-row :gutter="16">
                  <el-col :span="16"><el-form-item label="特殊说明"><el-input v-model="constraintForm.special_note" type="textarea" :rows="2" /></el-form-item></el-col>
                  <el-col :span="8"><el-form-item label="要求 Cost Breakdown"><el-switch v-model="constraintForm.quotation_breakdown_required" /></el-form-item></el-col>
                </el-row>
                <el-form-item>
                  <el-button type="primary" size="small" @click="handleSaveConstraint">保存约束</el-button>
                  <el-button size="small" @click="handleRecommendSuppliers">推荐供应商</el-button>
                </el-form-item>
              </el-form>
            </div>
            <div v-if="recommendations.length > 0" class="section">
              <h4>候选供应商 (规则推荐)</h4>
              <el-table :data="recommendations" stripe size="small" @selection-change="handleSupplierSelectionChange">
                <el-table-column type="selection" width="40" />
                <el-table-column prop="supplier.name" label="供应商" min-width="160" />
                <el-table-column prop="score" label="推荐分" width="80"><template #default="{ row }"><el-tag :type="row.score >= 70 ? 'success' : row.score >= 50 ? 'warning' : 'info'" size="small">{{ row.score }}</el-tag></template></el-table-column>
                <el-table-column prop="supplier.certification" label="认证" width="90" />
                <el-table-column prop="supplier.country" label="国家" width="80" />
                <el-table-column prop="supplier.city" label="城市" width="100" />
                <el-table-column label="能力标签" min-width="150"><template #default="{ row }"><el-tag v-for="t in row.supplier.capability_tags" :key="t" size="small" type="success" class="reason-tag">{{ t }}</el-tag></template></el-table-column>
                <el-table-column label="推荐理由" min-width="250"><template #default="{ row }"><el-tag v-for="r in row.reasons" :key="r" size="small" type="info" class="reason-tag">{{ r }}</el-tag></template></el-table-column>
              </el-table>
              <div style="margin-top:10px">
                <el-button type="primary" size="small" @click="handleConfirmSuppliers" :disabled="selectedSuppliers.length < 2">确认供应商 ({{ selectedSuppliers.length }})</el-button>
                <el-button size="small" @click="handleGenerateRFQPreview" :disabled="selectedSuppliers.length < 2">生成 RFQ 预览</el-button>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- Tab 4: RFQ Package Preview -->
      <el-tab-pane label="📨 RFQ 询价包预览" name="rfq">
        <div class="tab-content">
          <div v-if="!rfqPreview" class="empty-hint">请先在"约束确认 & 供应商选择"页完成供应商选择，然后生成 RFQ 预览</div>
          <div v-else>
            <h3>RFQ 询价包预览</h3>
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="项目">{{ rfqPreview.quotation_background.project_name }}</el-descriptions-item>
              <el-descriptions-item label="部件">{{ rfqPreview.quotation_background.component_no }} - {{ rfqPreview.quotation_background.component_name }}</el-descriptions-item>
              <el-descriptions-item label="数量">{{ rfqPreview.quotation_background.quantity }} {{ rfqPreview.quotation_background.quantity_unit }}</el-descriptions-item>
              <el-descriptions-item label="贸易术语">{{ rfqPreview.quotation_background.target_incoterm }}</el-descriptions-item>
              <el-descriptions-item label="币种">{{ rfqPreview.quotation_background.currency_mode }}</el-descriptions-item>
              <el-descriptions-item label="生成时间">{{ rfqPreview.generated_at }}</el-descriptions-item>
            </el-descriptions>
            <h4 style="margin-top:16px">邮件元信息</h4>
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="建议邮件主题">{{ rfqEmailSubject }}</el-descriptions-item>
              <el-descriptions-item :span="1"><template #label>收件供应商 ({{ rfqPreview.suppliers.length }} 家)</template><el-tag v-for="s in rfqPreview.suppliers" :key="s.supplier_id" size="small" style="margin-right:6px">{{ s.supplier_name }}</el-tag></el-descriptions-item>
            </el-descriptions>
            <h4 style="margin-top:16px">附件清单</h4>
            <el-table :data="attachmentList" stripe size="small">
              <el-table-column prop="name" label="附件名" min-width="300" />
              <el-table-column prop="type" label="类型" width="120" />
              <el-table-column prop="note" label="说明" min-width="200"><template #default="{ row }"><span v-if="row.note === 'placeholder'" style="color:#999;font-style:italic">（demo 阶段以预制示例承接）</span><span v-else>{{ row.note }}</span></template></el-table-column>
            </el-table>
            <h4 style="margin-top:16px">询价约束条件</h4>
            <el-table :data="constraintTableData" stripe size="small"><el-table-column prop="label" label="约束项" width="200" /><el-table-column prop="value" label="值" /></el-table>
            <h4 style="margin-top:16px">询价邮件预览</h4>
            <el-input v-model="rfqEmailPreview" type="textarea" :rows="12" readonly />
            <div class="section actions">
              <el-button type="primary" size="small" @click="handleSendEmail">📤 发送邮件（演示）</el-button>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- Tab 5: Quote Review -->
      <el-tab-pane label="📊 报价审核" name="quote-review">
        <div class="tab-content">
          <div v-if="!state.active_component_id" class="empty-hint">请先在"Buyer 工作台"选择一个部件并加载报价数据</div>
          <div v-else-if="!quoteReview" class="empty-hint">
            尚未加载供应商报价数据<br />
            <el-button type="primary" style="margin-top:12px" @click="handleLoadMockQuotesAndReview" :loading="loading">加载 Mock 报价数据</el-button>
            <span style="margin-left:8px;color:#999;font-size:12px">已加载 {{ quoteCount }} 家报价</span>
          </div>
          <div v-else>
            <h3>报价审核 - {{ quoteReview.component_id }}</h3>
            <p style="color:#999;font-size:12px">共 {{ quoteReview.total_suppliers }} 家供应商，{{ quoteReview.total_anomalies }} 项需关注</p>
            <div v-for="rev in quoteReview.supplier_reviews" :key="rev.supplier_id" class="section">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                <h4 style="margin:0">{{ rev.supplier_name }}</h4>
                <el-tag v-if="rev.has_errors" type="danger" size="small">有异常</el-tag>
                <el-tag v-else-if="rev.anomaly_count > 0" type="warning" size="small">{{ rev.anomaly_count }} 项关注</el-tag>
                <el-tag v-else type="success" size="small">正常</el-tag>
              </div>
              <el-table :data="rev.review_fields" stripe size="small">
                <el-table-column prop="label" label="字段" width="160" />
                <el-table-column label="原值" width="160"><template #default="{ row }">{{ formatFieldValue(row.value, row.type) }}</template></el-table-column>
                <el-table-column label="标准化值" width="160"><template #default="{ row }"><span v-if="row.normalized_value != null" :style="{ color: row.value !== row.normalized_value ? '#409EFF' : '' }">{{ formatFieldValue(row.normalized_value, row.type) }}</span><span v-else style="color:#ccc">-</span></template></el-table-column>
                <el-table-column label="说明"><template #default="{ row }"><span v-if="row.type === 'number' && row.value !== row.normalized_value && row.normalized_value != null" style="color:#409EFF">← 已标准化（汇率转换）</span></template></el-table-column>
              </el-table>
              <div v-if="rev.anomalies.length > 0" style="margin-top:8px">
                <el-tag v-for="a in rev.anomalies" :key="a.field" :type="a.level === 'error' ? 'danger' : 'warning'" size="small" style="margin-right:6px">{{ a.field }}: {{ a.message }}</el-tag>
              </div>
            </div>
            <div class="section actions" style="margin-top:16px">
              <el-button type="primary" @click="handleGenerateComparisonBase" :loading="loading">生成比较底表</el-button>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- Tab 6: Comparison Base & Award Summary -->
      <el-tab-pane label="🏆 比较底表 & Award" name="award">
        <div class="tab-content">
          <div v-if="!comparisonBase && !awardSummary" class="empty-hint">请先完成报价审核，然后生成比较底表与 Award Summary</div>
          <div v-if="comparisonBase" class="section">
            <h3>比较底表 - {{ comparisonBase.component_no }} {{ comparisonBase.component_name }}</h3>
            <p style="color:#999;font-size:12px">Meeting-ready 横向比较材料，供采购评审使用</p>
            <el-table :data="comparisonBase.comparison_rows" stripe size="small" border>
              <el-table-column prop="supplier_name" label="供应商" width="180" fixed />
              <el-table-column prop="piece_price" label="单价" width="100"><template #default="{ row }">{{ fmt(row.piece_price) }}</template></el-table-column>
              <el-table-column prop="delivered_piece_price" label="交付单价" width="100"><template #default="{ row }">{{ fmt(row.delivered_piece_price) }}</template></el-table-column>
              <el-table-column prop="tooling_cost" label="模具费" width="110"><template #default="{ row }">{{ fmtInt(row.tooling_cost) }}</template></el-table-column>
              <el-table-column prop="effective_unit_cost" label="综合单价" width="100"><template #default="{ row }"><strong>{{ fmt(row.effective_unit_cost) }}</strong><span v-if="getDiffTag(row, 'effective_unit_cost')" :style="{ color: getDiffTag(row, 'effective_unit_cost').color, fontSize:'11px', marginLeft:'4px' }">{{ getDiffTag(row, 'effective_unit_cost').text }}</span></template></el-table-column>
              <el-table-column prop="total_with_tooling" label="含模具总成本" width="140"><template #default="{ row }">{{ fmtInt(row.total_with_tooling) }}</template></el-table-column>
              <el-table-column prop="total_project_cost" label="项目总成本" width="130"><template #default="{ row }">{{ fmtInt(row.total_project_cost) }}</template></el-table-column>
              <el-table-column prop="tooling_lead_time" label="模具交期(天)" width="110" />
              <el-table-column prop="certification" label="认证" width="100" />
              <el-table-column prop="city" label="所在城市" width="100" />
            </el-table>
            <div style="margin-top:12px"><el-button type="success" @click="handleGenerateAwardFromBase" :loading="loading">生成 Award Summary</el-button></div>
          </div>
          <div v-if="awardSummary" class="section" style="margin-top:24px">
            <h3>Award Summary - {{ awardSummary.component_no }} {{ awardSummary.component_name }}</h3>
            <el-alert :title="awardSummary.recommendation.conclusion" type="success" :closable="false" show-icon style="margin-bottom:16px">
              <template #default><div v-for="(line, i) in awardSummary.recommendation.details" :key="i" style="margin-top:4px">{{ line }}</div></template>
            </el-alert>
            <h4>供应商横向比较</h4>
            <el-table :data="awardSummary.comparison_rows" stripe size="small" border>
              <el-table-column prop="supplier_name" label="供应商" width="180" fixed />
              <el-table-column prop="piece_price" label="单价" width="100"><template #default="{ row }">{{ fmt(row.piece_price) }}</template></el-table-column>
              <el-table-column prop="delivered_piece_price" label="交付单价" width="100"><template #default="{ row }">{{ fmt(row.delivered_piece_price) }}</template></el-table-column>
              <el-table-column prop="tooling_cost" label="模具费" width="110"><template #default="{ row }">{{ fmtInt(row.tooling_cost) }}</template></el-table-column>
              <el-table-column prop="part_price_ddp_per_part" label="DDP单价" width="100"><template #default="{ row }">{{ fmt(row.part_price_ddp_per_part) }}</template></el-table-column>
              <el-table-column prop="quoted_volume" label="报价量" width="80" />
              <el-table-column prop="local_currency" label="币种" width="70" />
              <el-table-column prop="x_rate_to_base" label="汇率" width="70" />
              <el-table-column prop="total_project_cost" label="项目总成本" width="130"><template #default="{ row }">{{ fmtInt(row.total_project_cost) }}</template></el-table-column>
              <el-table-column prop="effective_unit_cost" label="综合单价" width="100"><template #default="{ row }">{{ fmt(row.effective_unit_cost) }}</template></el-table-column>
              <el-table-column prop="total_with_tooling" label="含模具总成本" width="140"><template #default="{ row }">{{ fmtInt(row.total_with_tooling) }}</template></el-table-column>
              <el-table-column label="评分" width="80"><template #default="{ row }"><el-tag :type="getScoreType(row.supplier_id)" size="small">{{ getScore(row.supplier_id) }}</el-tag></template></el-table-column>
            </el-table>
            <h4 style="margin-top:16px">评分维度详情</h4>
            <el-table :data="scoreDetailRows" stripe size="small">
              <el-table-column prop="name" label="供应商" width="180" />
              <el-table-column prop="total_cost" label="总成本 (40%)" width="120" />
              <el-table-column prop="unit_price" label="单价 (25%)" width="120" />
              <el-table-column prop="tooling_burden" label="模具费 (15%)" width="120" />
              <el-table-column prop="supplier_quality" label="资质 (10%)" width="120" />
              <el-table-column prop="delivery_terms" label="交付 (10%)" width="120" />
              <el-table-column prop="total" label="综合分" width="100"><template #default="{ row }"><strong>{{ row.total }}</strong></template></el-table-column>
            </el-table>
            <div class="section" style="margin-top:16px"><h4>说明</h4><ul><li v-for="note in awardSummary.notes" :key="note">{{ note }}</li></ul></div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import apiClient from '@/api/client'
import { ElMessage } from 'element-plus'

const BASE = '/apps/procurement-rfq-demo'

async function apiGet(path: string) { const res = await apiClient.get(BASE + path); return (res.data as any).data }
async function apiPost(path: string, body?: any) { const res = await apiClient.post(BASE + path, body); return (res.data as any).data }
async function apiPut(path: string, body?: any) { const res = await apiClient.put(BASE + path, body); return (res.data as any).data }

const loading = ref(false)
const activeTab = ref('ebom')
const state = reactive({
  status: 'project_initialized', project: null as any, components: [] as any[],
  active_component_id: null as string | null, available_actions: [] as string[],
  supplier_quotes: {} as Record<string, any>, normalized_quotes: {} as Record<string, any>,
  supplier_candidates: {} as Record<string, any>, rfq_previews: {} as Record<string, any>,
  constraint_forms: {} as Record<string, any>, active_component: null as any,
  buyer_perspective: null as string | null,
})
const constraintForm = reactive({
  process_type: '', material_spec: '', surface_treatment: '', quantity: 0, quantity_unit: 'pcs',
  delivery_requirement: '', target_incoterm: 'DDP', currency_mode: 'RMB',
  mold_requirement: '', packing_requirement: '', quality_requirement: '',
  special_note: '', quotation_breakdown_required: true,
})
const recommendations = ref<any[]>([])
const selectedSuppliers = ref<any[]>([])
const rfqPreview = ref<any>(null)
const rfqEmailPreview = ref('')
const awardSummary = ref<any>(null)
const comparisonBase = ref<any>(null)
const quoteReview = ref<any>(null)
const selectedBuyerId = ref<string | null>(null)
const allBuyers = ref<any[]>([])

const statusLabel = computed(() => ({ project_initialized:'项目已初始化', components_assigned:'部件已分派', rfq_prepared:'RFQ已准备', quotes_compared:'报价已对比', award_reviewed:'Award已评审' } as any)[state.status] || state.status)
const statusTagType = computed(() => ({ project_initialized:'info', components_assigned:'warning', rfq_prepared:'warning', quotes_compared:'', award_reviewed:'success' } as any)[state.status] || 'info')
const currentStep = computed(() => ({ project_initialized:0, components_assigned:1, rfq_prepared:3, quotes_compared:4, award_reviewed:5 } as any)[state.status] || 0)
const hasBuyerAssigned = computed(() => state.components.length > 0 && state.components.every((c: any) => c.buyer_id))
const activeComp = computed(() => state.components.find((c: any) => c.component_no === state.active_component_id))
const visibleComponents = computed(() => selectedBuyerId.value ? state.components.filter((c: any) => c.buyer_id === selectedBuyerId.value) : state.components)
const constraintTableData = computed(() => !rfqPreview.value ? [] : Object.entries(rfqPreview.value.constraint_summary).map(([k,v]) => ({ label: k, value: typeof v === 'boolean' ? (v ? '是' : '否') : (v || '-') })))
const rfqEmailSubject = computed(() => !rfqPreview.value ? '' : `RFQ: ${rfqPreview.value.quotation_background.component_no} ${rfqPreview.value.quotation_background.component_name} - ${rfqPreview.value.quotation_background.project_name}`)
const attachmentList = computed(() => !rfqPreview.value ? [] : [
  { name: 'PRA.SCM.DIR.010.Cost Breakdown Form.xlsx', type: '报价模板', note: 'placeholder' },
  { name: `${rfqPreview.value.quotation_background.component_no}_RFQ_Summary.pdf`, type: '询价摘要', note: 'placeholder' },
  { name: `${rfqPreview.value.quotation_background.project_code}_Project_Context.pdf`, type: '项目背景', note: 'placeholder' },
])
const quoteCount = computed(() => { if (!state.active_component_id || !state.supplier_quotes) return 0; const q = state.supplier_quotes[state.active_component_id]; return q ? Object.keys(q).length : 0 })
const scoreDetailRows = computed(() => !awardSummary.value ? [] : awardSummary.value.comparison_rows.map((row: any) => { const d = awardSummary.value.scores[row.supplier_id]?.dimension_scores || {}; return { name: row.supplier_name, total_cost: d.total_cost?.toFixed(1) || '-', unit_price: d.unit_price?.toFixed(1) || '-', tooling_burden: d.tooling_burden?.toFixed(1) || '-', supplier_quality: d.supplier_quality?.toFixed(1) || '-', delivery_terms: d.delivery_terms?.toFixed(1) || '-', total: awardSummary.value.scores[row.supplier_id]?.total_score?.toFixed(1) || '-' } }))

async function refreshState() {
  try {
    const data = await apiGet('/state')
    state.status = data.status; state.project = data.project; state.components = data.components || []
    state.active_component_id = data.active_component_id; state.available_actions = data.available_actions || []
    state.supplier_quotes = data.supplier_quotes || {}; state.normalized_quotes = data.normalized_quotes || {}
    state.supplier_candidates = data.supplier_candidates || {}; state.rfq_previews = data.rfq_previews || {}
    state.constraint_forms = data.constraint_forms || {}; state.active_component = data.active_component || null
    state.buyer_perspective = data.buyer_perspective || null
  } catch (e) { console.error('Failed to load state:', e) }
}

async function handleLoadSampleEBOM() {
  loading.value = true
  try { await apiPost('/ebom/load-sample'); await refreshState(); activeTab.value = 'ebom'; ElMessage.success('示例 EBOM 已加载') }
  catch (e: any) { console.error(e); ElMessage.error('加载失败: ' + (e?.response?.data?.message || e?.message || '')) }
  finally { loading.value = false }
}

async function handleAssignBuyers() {
  loading.value = true
  try { const data = await apiPost('/buyer/assign'); await refreshState(); allBuyers.value = data.buyers || []; ElMessage.success('Buyer 分派完成') }
  catch (e: any) { console.error(e); ElMessage.error('分派失败') }
  finally { loading.value = false }
}

async function handleQuickInit() {
  loading.value = true
  try { const data = await apiPost('/quick-init'); await refreshState(); awardSummary.value = data.award_summary || null; comparisonBase.value = data.comparison_base || null; quoteReview.value = data.quote_review || null; activeTab.value = 'award'; ElMessage.success('Demo 初始化完成') }
  catch (e: any) { console.error(e); ElMessage.error('初始化失败: ' + (e?.response?.data?.message || e?.message || '')) }
  finally { loading.value = false }
}

function handleSendEmail() { ElMessage.success('📤 邮件已发送！（演示模式，未实际发送）') }

async function handleReset() {
  try { await apiPost('/state/reset'); state.project = null; state.components = []; state.active_component_id = null; state.status = 'project_initialized'; rfqPreview.value = null; rfqEmailPreview.value = ''; awardSummary.value = null; comparisonBase.value = null; quoteReview.value = null; recommendations.value = []; selectedSuppliers.value = []; selectedBuyerId.value = null; allBuyers.value = []; ElMessage.success('已重置') }
  catch (e) { console.error('Reset failed:', e) }
}

async function handleSelectComponent(componentNo: string) {
  try { await apiPut(`/component/${componentNo}/select`); await refreshState(); recommendations.value = []; selectedSuppliers.value = []; activeTab.value = 'constraint'; try { const data = await apiGet(`/constraint-form/${componentNo}`); if (data) Object.assign(constraintForm, data) } catch (e) { /* ignore */ } }
  catch (e) { console.error('Select component failed:', e) }
}

async function handleSwitchBuyer(buyerId: string | null) {
  try { await apiPut('/buyer/perspective', { buyer_id: buyerId || null }); await refreshState() }
  catch (e) { console.error('Switch buyer failed:', e) }
}

async function handleSaveConstraint() {
  if (!state.active_component_id) return
  try { await apiPost(`/constraint-form/${state.active_component_id}`, { ...constraintForm }); ElMessage.success('约束表单已保存') }
  catch (e: any) { console.error(e); ElMessage.error('保存失败') }
}

async function handleRecommendSuppliers() {
  if (!state.active_component_id) { ElMessage.warning('请先选择一个部件'); return }
  try { await handleSaveConstraint(); const data = await apiGet(`/supplier/recommend/${state.active_component_id}`); recommendations.value = data.recommendations }
  catch (e: any) { console.error(e); ElMessage.error('推荐供应商失败: ' + (e?.response?.data?.message || e?.message || '')) }
}

function handleSupplierSelectionChange(selection: any[]) { selectedSuppliers.value = selection }

async function handleConfirmSuppliers() {
  if (!state.active_component_id) { ElMessage.warning('请先选择一个部件'); return }
  if (selectedSuppliers.value.length < 2) { ElMessage.warning('请至少选择 2 家供应商'); return }
  try { const ids = selectedSuppliers.value.map((s: any) => s.supplier.id); await apiPost('/supplier/select', { component_id: state.active_component_id, supplier_ids: ids }); ElMessage.success(`已选择 ${ids.length} 家供应商`) }
  catch (e: any) { console.error(e); ElMessage.error('确认供应商失败: ' + (e?.response?.data?.message || e?.message || '')) }
}

async function handleGenerateRFQPreview() {
  if (!state.active_component_id) { ElMessage.warning('请先选择一个部件'); return }
  if (selectedSuppliers.value.length < 2) { ElMessage.warning('请至少选择 2 家供应商'); return }
  try { const ids = selectedSuppliers.value.map((s: any) => s.supplier.id); const data = await apiPost('/rfq/preview', { component_id: state.active_component_id, supplier_ids: ids }); rfqPreview.value = data.preview; rfqEmailPreview.value = data.email_preview; await refreshState(); activeTab.value = 'rfq'; ElMessage.success('RFQ 预览已生成') }
  catch (e: any) { console.error(e); ElMessage.error('生成 RFQ 预览失败: ' + (e?.response?.data?.message || e?.message || '未知错误')) }
}

async function handleLoadMockQuotes() {
  if (!state.active_component_id) { ElMessage.warning('请先选择一个部件'); return }
  loading.value = true
  try { await apiPost(`/quote/load-mock/${state.active_component_id}`); await refreshState(); ElMessage.success('Mock 报价已加载') }
  catch (e: any) { console.error(e); ElMessage.warning((e?.response?.data?.message || e?.message) || '当前部件无可用的 mock 报价') }
  finally { loading.value = false }
}

async function handleLoadMockQuotesAndReview() { await handleLoadMockQuotes(); if (quoteCount.value >= 2) await handleLoadQuoteReview() }

async function handleLoadQuoteReview() {
  if (!state.active_component_id) return
  try { const data = await apiGet(`/quote/review/${state.active_component_id}`); quoteReview.value = data; activeTab.value = 'quote-review' }
  catch (e: any) { console.error(e); ElMessage.error('报价审核失败: ' + (e?.response?.data?.message || e?.message || '')) }
}

async function handleGenerateComparisonBase() {
  if (!state.active_component_id) return
  loading.value = true
  try { const data = await apiPost(`/comparison-base/generate/${state.active_component_id}`); comparisonBase.value = data; activeTab.value = 'award'; ElMessage.success('比较底表已生成') }
  catch (e: any) { console.error(e); ElMessage.error('生成比较底表失败: ' + (e?.response?.data?.message || e?.message || '')) }
  finally { loading.value = false }
}

async function handleGenerateAward() {
  if (!state.active_component_id) { ElMessage.warning('请先选择一个部件'); return }
  if (quoteCount.value < 2) { ElMessage.warning('请先加载至少 2 家报价'); return }
  loading.value = true
  try { const data = await apiPost(`/award/generate/${state.active_component_id}`); awardSummary.value = data; await refreshState(); activeTab.value = 'award'; ElMessage.success('Award Summary 已生成') }
  catch (e: any) { console.error(e); ElMessage.error('生成 Award 失败: ' + (e?.response?.data?.message || e?.message || '')) }
  finally { loading.value = false }
}

async function handleGenerateAwardFromBase() {
  if (!state.active_component_id) return
  loading.value = true
  try { const data = await apiPost(`/award/generate/${state.active_component_id}`); awardSummary.value = data; await refreshState(); ElMessage.success('Award Summary 已生成') }
  catch (e: any) { console.error(e); ElMessage.error('生成失败: ' + (e?.response?.data?.message || e?.message || '')) }
  finally { loading.value = false }
}

function getBuyerName(buyerId: string | null) { const m: any = { buyer_zhang:'张工', buyer_li:'李工', buyer_wang:'王工', buyer_zhao:'赵工', buyer_sun:'孙工', buyer_pool:'采购池' }; return m[buyerId||''] || buyerId || '-' }
function getScore(supplierId: string) { return awardSummary.value?.scores[supplierId]?.total_score?.toFixed(1) || '-' }
function getScoreType(supplierId: string) { const s = parseFloat(getScore(supplierId)); return isNaN(s) ? 'info' : s >= 70 ? 'success' : s >= 50 ? 'warning' : 'info' }
function fmt(val: any) { return val == null ? '-' : Number(val).toFixed(2) }
function fmtInt(val: any) { return val == null ? '-' : Number(val).toLocaleString() }
function formatFieldValue(val: any, type: string) { if (val == null) return '-'; if (type === 'number') return typeof val === 'number' ? val.toFixed(2) : val; return String(val) }
function getDiffTag(row: any, field: string) { if (!row.annotations || !row.annotations[field]) return null; const a = row.annotations[field]; if (a.direction === 'higher') return { text: `+${a.diff_pct}%`, color: '#F56C6C' }; return { text: `${a.diff_pct}%`, color: '#67C23A' } }

onMounted(() => { refreshState() })
</script>

<style scoped>
.rfq-demo { padding: 16px; }
.demo-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.header-left { display: flex; align-items: center; gap: 12px; }
.header-left h1 { margin: 0; font-size: 20px; }
.demo-badge { background: #E6A23C; color: white; padding: 2px 10px; border-radius: 4px; font-size: 12px; }
.header-right { display: flex; align-items: center; gap: 8px; }
.status-label { font-size: 13px; color: #909399; }
.demo-progress { margin-bottom: 16px; }
.demo-tabs { min-height: 500px; }
.tab-content { padding: 8px 0; }
.section { margin-bottom: 16px; }
.section h3 { margin: 0 0 8px; font-size: 16px; }
.section h4 { margin: 8px 0; font-size: 14px; }
.empty-hint { text-align: center; color: #909399; padding: 40px 0; }
.actions { padding-top: 8px; }
.reason-tag { margin-right: 4px; margin-bottom: 4px; }
.constraint-form { max-width: 100%; }
</style>
