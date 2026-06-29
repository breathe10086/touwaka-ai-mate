<template>
  <div class="rfq-demo">
    <!-- Header -->
    <div class="demo-header">
      <div class="header-left">
        <h1>📦 采购询价 Demo</h1>
        <span class="demo-badge">原型演示</span>
      </div>
      <div class="header-right">
        <span class="status-label">当前阶段：</span>
        <el-tag :type="statusTagType">{{ statusLabel }}</el-tag>
        <el-button type="primary" size="small" @click="handleQuickInit" :loading="loading">
          ⚡ 一键初始化 Demo
        </el-button>
        <el-button size="small" @click="handleReset">重置</el-button>
      </div>
    </div>

    <!-- Progress -->
    <div class="demo-progress">
      <el-steps :active="currentStep" align-center>
        <el-step title="EBOM 导入" description="项目与部件初始化" />
        <el-step title="Buyer 分派" description="按品类分派采购" />
        <el-step title="RFQ 准备" description="约束表单与供应商选择" />
        <el-step title="报价比较" description="供应商报价结构化对比" />
        <el-step title="Award 评审" description="横向比较与定点推荐" />
      </el-steps>
    </div>

    <!-- Tab Views -->
    <el-tabs v-model="activeTab" type="border-card" class="demo-tabs">
      <!-- Tab 1: EBOM Import / Project Overview -->
      <el-tab-pane label="📋 EBOM 导入" name="ebom">
        <div class="tab-content">
          <el-alert
            v-if="!state.project"
            title="尚未导入 EBOM"
            description="点击下方按钮加载示例 EBOM，或通过 API 上传自定义 EBOM 数据"
            type="info"
            show-icon
            :closable="false"
          />

          <div v-if="state.project" class="section">
            <h3>项目信息</h3>
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="项目编号">{{ state.project.project_code }}</el-descriptions-item>
              <el-descriptions-item label="项目名称">{{ state.project.project_name }}</el-descriptions-item>
              <el-descriptions-item label="成品编号">{{ state.project.part_no }}</el-descriptions-item>
              <el-descriptions-item label="成品名称">{{ state.project.part_name }}</el-descriptions-item>
              <el-descriptions-item label="月预计供货量">{{ state.project.expected_supply_qty_monthly }}</el-descriptions-item>
              <el-descriptions-item label="年预计供货量">{{ state.project.expected_supply_qty_yearly }}</el-descriptions-item>
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
              <el-table-column prop="category" label="品类" width="120">
                <template #default="{ row }">
                  <el-tag size="small">{{ row.category }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="buyer_id" label="分派 Buyer" width="140">
                <template #default="{ row }">
                  <span v-if="row.buyer_id">{{ getBuyerName(row.buyer_id) }}</span>
                  <el-tag v-else size="small" type="info">未分派</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="material_spec" label="材质规格" min-width="150" />
            </el-table>
          </div>

          <div class="section actions">
            <el-button type="primary" @click="handleLoadSampleEBOM" :loading="loading" :disabled="!!state.project">
              加载示例 EBOM
            </el-button>
            <el-button @click="handleAssignBuyers" :disabled="state.components.length === 0 || hasBuyerAssigned">
              自动分派 Buyer
            </el-button>
          </div>
        </div>
      </el-tab-pane>

      <!-- Tab 2: Buyer Workbench -->
      <el-tab-pane label="👤 Buyer 工作台" name="buyer">
        <div class="tab-content">
          <div v-if="!state.components.length" class="empty-hint">请先导入 EBOM 并完成 Buyer 分派</div>

          <div v-else class="workbench-layout">
            <!-- 左侧：部件选择 -->
            <div class="wb-left">
              <h4>选择操作部件</h4>
              <el-menu class="component-menu" @select="handleSelectComponent">
                <el-menu-item
                  v-for="comp in state.components"
                  :key="comp.component_no"
                  :index="comp.component_no"
                  :class="{ 'is-active': state.active_component_id === comp.component_no }"
                >
                  <span class="comp-no">{{ comp.component_no }}</span>
                  <span class="comp-name">{{ comp.component_name }}</span>
                </el-menu-item>
              </el-menu>
            </div>

            <!-- 右侧：操作区 -->
            <div class="wb-right" v-if="activeComp">
              <h4>{{ activeComp.component_no }} - {{ activeComp.component_name }}</h4>

              <!-- 约束表单 -->
              <div class="section">
                <h4>报价约束表单</h4>
                <el-form :model="constraintForm" label-width="130px" size="small" class="constraint-form">
                  <el-row :gutter="16">
                    <el-col :span="8">
                      <el-form-item label="加工方式">
                        <el-input v-model="constraintForm.process_type" placeholder="如 CNC 加工" />
                      </el-form-item>
                    </el-col>
                    <el-col :span="8">
                      <el-form-item label="表面处理">
                        <el-input v-model="constraintForm.surface_treatment" placeholder="如阳极氧化" />
                      </el-form-item>
                    </el-col>
                    <el-col :span="8">
                      <el-form-item label="数量">
                        <el-input-number v-model="constraintForm.quantity" :min="0" />
                      </el-form-item>
                    </el-col>
                  </el-row>
                  <el-row :gutter="16">
                    <el-col :span="8">
                      <el-form-item label="交付要求">
                        <el-input v-model="constraintForm.delivery_requirement" placeholder="如 4周内交付" />
                      </el-form-item>
                    </el-col>
                    <el-col :span="8">
                      <el-form-item label="贸易术语">
                        <el-select v-model="constraintForm.target_incoterm">
                          <el-option label="DDP" value="DDP" />
                          <el-option label="FOB" value="FOB" />
                          <el-option label="CIF" value="CIF" />
                          <el-option label="EXW" value="EXW" />
                        </el-select>
                      </el-form-item>
                    </el-col>
                    <el-col :span="8">
                      <el-form-item label="币种">
                        <el-select v-model="constraintForm.currency_mode">
                          <el-option label="RMB" value="RMB" />
                          <el-option label="EUR" value="EUR" />
                          <el-option label="USD" value="USD" />
                        </el-select>
                      </el-form-item>
                    </el-col>
                  </el-row>
                  <el-row :gutter="16">
                    <el-col :span="8">
                      <el-form-item label="模具要求">
                        <el-input v-model="constraintForm.mold_requirement" />
                      </el-form-item>
                    </el-col>
                    <el-col :span="8">
                      <el-form-item label="包装要求">
                        <el-input v-model="constraintForm.packing_requirement" />
                      </el-form-item>
                    </el-col>
                    <el-col :span="8">
                      <el-form-item label="质量要求">
                        <el-input v-model="constraintForm.quality_requirement" />
                      </el-form-item>
                    </el-col>
                  </el-row>
                  <el-row :gutter="16">
                    <el-col :span="16">
                      <el-form-item label="特殊说明">
                        <el-input v-model="constraintForm.special_note" type="textarea" :rows="2" />
                      </el-form-item>
                    </el-col>
                    <el-col :span="8">
                      <el-form-item label="要求 Cost Breakdown">
                        <el-switch v-model="constraintForm.quotation_breakdown_required" />
                      </el-form-item>
                    </el-col>
                  </el-row>
                  <el-form-item>
                    <el-button type="primary" size="small" @click="handleSaveConstraint">保存约束表单</el-button>
                    <el-button size="small" @click="handleRecommendSuppliers">推荐供应商</el-button>
                  </el-form-item>
                </el-form>
              </div>

              <!-- 供应商推荐 -->
              <div v-if="recommendations.length > 0" class="section">
                <h4>候选供应商</h4>
                <el-table :data="recommendations" stripe size="small" @selection-change="handleSupplierSelectionChange">
                  <el-table-column type="selection" width="40" />
                  <el-table-column prop="supplier.name" label="供应商" min-width="160" />
                  <el-table-column prop="score" label="推荐分" width="80">
                    <template #default="{ row }">
                      <el-tag :type="row.score >= 70 ? 'success' : row.score >= 50 ? 'warning' : 'info'" size="small">
                        {{ row.score }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="supplier.certification" label="认证" width="90" />
                  <el-table-column prop="supplier.country" label="国家" width="80" />
                  <el-table-column prop="supplier.city" label="城市" width="100" />
                  <el-table-column prop="supplier.historical_win_rate" label="中标率" width="80">
                    <template #default="{ row }">
                      {{ (row.supplier.historical_win_rate * 100).toFixed(0) }}%
                    </template>
                  </el-table-column>
                  <el-table-column label="推荐理由" min-width="250">
                    <template #default="{ row }">
                      <el-tag v-for="r in row.reasons" :key="r" size="small" type="info" class="reason-tag">
                        {{ r }}
                      </el-tag>
                    </template>
                  </el-table-column>
                </el-table>
                <div style="margin-top: 10px">
                  <el-button type="primary" size="small" @click="handleConfirmSuppliers" :disabled="selectedSuppliers.length < 2">
                    确认供应商 ({{ selectedSuppliers.length }})
                  </el-button>
                  <el-button size="small" @click="handleGenerateRFQPreview" :disabled="selectedSuppliers.length < 2">
                    生成 RFQ 预览
                  </el-button>
                </div>
              </div>
            </div>

            <div v-else class="wb-right">
              <div class="empty-hint">请从左侧列表选择一个部件</div>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- Tab 3: RFQ Preview -->
      <el-tab-pane label="📨 RFQ 预览" name="rfq">
        <div class="tab-content">
          <div v-if="!rfqPreview" class="empty-hint">请先在 Buyer 工作台完成约束表单和供应商选择，然后生成 RFQ 预览</div>

          <div v-else class="section">
            <h3>RFQ 询价预览</h3>
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="项目">{{ rfqPreview.quotation_background.project_name }}</el-descriptions-item>
              <el-descriptions-item label="部件">{{ rfqPreview.quotation_background.component_no }} - {{ rfqPreview.quotation_background.component_name }}</el-descriptions-item>
              <el-descriptions-item label="数量">{{ rfqPreview.quotation_background.quantity }} {{ rfqPreview.quotation_background.quantity_unit }}</el-descriptions-item>
              <el-descriptions-item label="贸易术语">{{ rfqPreview.quotation_background.target_incoterm }}</el-descriptions-item>
              <el-descriptions-item label="币种">{{ rfqPreview.quotation_background.currency_mode }}</el-descriptions-item>
              <el-descriptions-item label="生成时间">{{ rfqPreview.generated_at }}</el-descriptions-item>
            </el-descriptions>

            <h4 style="margin-top: 16px">约束条件</h4>
            <el-table :data="constraintTableData" stripe size="small">
              <el-table-column prop="label" label="约束项" width="200" />
              <el-table-column prop="value" label="值" />
            </el-table>

            <h4 style="margin-top: 16px">目标供应商 ({{ rfqPreview.suppliers.length }} 家)</h4>
            <el-table :data="rfqPreview.suppliers" stripe size="small">
              <el-table-column prop="supplier_name" label="供应商" min-width="180" />
              <el-table-column prop="certification" label="认证" width="100" />
              <el-table-column prop="country" label="国家" width="80" />
              <el-table-column prop="city" label="城市" width="120" />
            </el-table>

            <h4 style="margin-top: 16px">询价邮件预览</h4>
            <el-input v-model="rfqEmailPreview" type="textarea" :rows="12" readonly />
          </div>
        </div>
      </el-tab-pane>

      <!-- Tab 4: Award Comparison -->
      <el-tab-pane label="🏆 Award 比较" name="award">
        <div class="tab-content">
          <div v-if="!awardSummary" class="empty-hint">
            请先加载供应商报价数据，然后生成 Award Summary
            <br />
            <el-button type="primary" style="margin-top: 12px" @click="handleLoadMockQuotes" :disabled="!state.active_component_id" :loading="loading">
              加载 Mock 报价数据
            </el-button>
            <el-button type="success" style="margin-top: 12px" @click="handleGenerateAward" :disabled="quoteCount < 2">
              生成 Award Summary
            </el-button>
          </div>

          <div v-else>
            <h3>Award Summary - {{ awardSummary.component_no }} {{ awardSummary.component_name }}</h3>

            <!-- 推荐结论 -->
            <el-alert
              :title="awardSummary.recommendation.conclusion"
              type="success"
              :closable="false"
              show-icon
              style="margin-bottom: 16px"
            >
              <template #default>
                <div v-for="(line, i) in awardSummary.recommendation.details" :key="i" style="margin-top: 4px">
                  {{ line }}
                </div>
              </template>
            </el-alert>

            <!-- 横向比较表 -->
            <h4>供应商横向比较</h4>
            <el-table :data="awardSummary.comparison_rows" stripe size="small" border>
              <el-table-column prop="supplier_name" label="供应商" width="180" fixed />
              <el-table-column prop="piece_price" label="单价" width="100">
                <template #default="{ row }">
                  {{ row.piece_price.toFixed(2) }}
                </template>
              </el-table-column>
              <el-table-column prop="delivered_piece_price" label="交付单价" width="100">
                <template #default="{ row }">
                  {{ row.delivered_piece_price.toFixed(2) }}
                </template>
              </el-table-column>
              <el-table-column prop="tooling_cost" label="模具费" width="110">
                <template #default="{ row }">
                  {{ row.tooling_cost.toLocaleString() }}
                </template>
              </el-table-column>
              <el-table-column prop="part_price_ddp_per_part" label="DDP单价" width="100">
                <template #default="{ row }">
                  {{ row.part_price_ddp_per_part.toFixed(2) }}
                </template>
              </el-table-column>
              <el-table-column prop="quoted_volume" label="报价量" width="80" />
              <el-table-column prop="local_currency" label="币种" width="70" />
              <el-table-column prop="x_rate_to_base" label="汇率" width="70" />
              <el-table-column prop="total_project_cost" label="项目总成本" width="130">
                <template #default="{ row }">
                  {{ row.total_project_cost.toLocaleString() }}
                </template>
              </el-table-column>
              <el-table-column prop="effective_unit_cost" label="综合单价" width="100">
                <template #default="{ row }">
                  {{ row.effective_unit_cost.toFixed(2) }}
                </template>
              </el-table-column>
              <el-table-column prop="total_with_tooling" label="含模具总成本" width="140">
                <template #default="{ row }">
                  {{ row.total_with_tooling.toLocaleString() }}
                </template>
              </el-table-column>
              <el-table-column label="评分" width="80">
                <template #default="{ row }">
                  <el-tag :type="getScoreType(row.supplier_id)" size="small">
                    {{ getScore(row.supplier_id) }}
                  </el-tag>
                </template>
              </el-table-column>
            </el-table>

            <!-- 评分维度详情 -->
            <h4 style="margin-top: 16px">评分维度详情</h4>
            <el-table :data="scoreDetailRows" stripe size="small">
              <el-table-column prop="name" label="供应商" width="180" />
              <el-table-column prop="total_cost" label="总成本 (40%)" width="120" />
              <el-table-column prop="unit_price" label="单价 (25%)" width="120" />
              <el-table-column prop="tooling_burden" label="模具费 (15%)" width="120" />
              <el-table-column prop="supplier_quality" label="资质 (10%)" width="120" />
              <el-table-column prop="delivery_terms" label="交付 (10%)" width="120" />
              <el-table-column prop="total" label="综合分" width="100">
                <template #default="{ row }">
                  <strong>{{ row.total }}</strong>
                </template>
              </el-table-column>
            </el-table>

            <!-- 备注 -->
            <div class="section" style="margin-top: 16px">
              <h4>说明</h4>
              <ul>
                <li v-for="note in awardSummary.notes" :key="note">{{ note }}</li>
              </ul>
            </div>
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

// 封装请求：apiClient.baseURL 已是 /api，响应数据在 response.data.data
async function apiGet(path: string) {
  const res = await apiClient.get(BASE + path)
  return (res.data as any).data
}
async function apiPost(path: string, body?: any) {
  const res = await apiClient.post(BASE + path, body)
  return (res.data as any).data
}
async function apiPut(path: string, body?: any) {
  const res = await apiClient.put(BASE + path, body)
  return (res.data as any).data
}

// State
const loading = ref(false)
const activeTab = ref('ebom')
const state = reactive({
  status: 'project_initialized',
  project: null,
  components: [],
  active_component_id: null,
  available_actions: [],
})
const constraintForm = reactive({
  process_type: '',
  material_spec: '',
  surface_treatment: '',
  quantity: 0,
  quantity_unit: 'pcs',
  delivery_requirement: '',
  target_incoterm: 'DDP',
  currency_mode: 'RMB',
  mold_requirement: '',
  packing_requirement: '',
  quality_requirement: '',
  special_note: '',
  quotation_breakdown_required: true,
})
const recommendations = ref([])
const selectedSuppliers = ref([])
const rfqPreview = ref(null)
const rfqEmailPreview = ref('')
const awardSummary = ref(null)

// Computed
const statusLabel = computed(() => {
  const labels = {
    project_initialized: '项目已初始化',
    components_assigned: '部件已分派',
    rfq_prepared: 'RFQ 已准备',
    quotes_compared: '报价已对比',
    award_reviewed: 'Award 已评审',
  }
  return labels[state.status] || state.status
})

const statusTagType = computed(() => {
  const types = {
    project_initialized: 'info',
    components_assigned: 'warning',
    rfq_prepared: 'warning',
    quotes_compared: 'primary',
    award_reviewed: 'success',
  }
  return types[state.status] || 'info'
})

const currentStep = computed(() => {
  const steps = {
    project_initialized: 0,
    components_assigned: 1,
    rfq_prepared: 2,
    quotes_compared: 3,
    award_reviewed: 4,
  }
  return steps[state.status] || 0
})

const hasBuyerAssigned = computed(() =>
  state.components.length > 0 && state.components.every(c => c.buyer_id)
)

const activeComp = computed(() =>
  state.components.find(c => c.component_no === state.active_component_id)
)

const constraintTableData = computed(() => {
  if (!rfqPreview.value) return []
  const cs = rfqPreview.value.constraint_summary
  return Object.entries(cs).map(([key, val]) => ({
    label: key,
    value: typeof val === 'boolean' ? (val ? '是' : '否') : (val || '-'),
  }))
})

const quoteCount = computed(() => {
  // 简单判断是否已有报价数据
  return awardSummary.value ? awardSummary.value.comparison_rows.length : 0
})

const scoreDetailRows = computed(() => {
  if (!awardSummary.value) return []
  return awardSummary.value.comparison_rows.map(row => {
    const dims = awardSummary.value.scores[row.supplier_id]?.dimension_scores || {}
    return {
      name: row.supplier_name,
      total_cost: dims.total_cost?.toFixed(1) || '-',
      unit_price: dims.unit_price?.toFixed(1) || '-',
      tooling_burden: dims.tooling_burden?.toFixed(1) || '-',
      supplier_quality: dims.supplier_quality?.toFixed(1) || '-',
      delivery_terms: dims.delivery_terms?.toFixed(1) || '-',
      total: awardSummary.value.scores[row.supplier_id]?.total_score?.toFixed(1) || '-',
    }
  })
})

// Methods
async function refreshState() {
  try {
    const data = await apiGet('/state')
    Object.assign(state, data)
  } catch (e) {
    console.error('Failed to load state:', e)
  }
}

async function handleLoadSampleEBOM() {
  loading.value = true
  try {
    await apiPost('/ebom/load-sample')
    await refreshState()
    activeTab.value = 'ebom'
    ElMessage.success('示例 EBOM 已加载')
  } catch (e: any) {
    console.error('Load sample EBOM failed:', e)
    ElMessage.error('加载失败: ' + (e?.response?.data?.message || e?.message || ''))
  } finally {
    loading.value = false
  }
}

async function handleAssignBuyers() {
  loading.value = true
  try {
    await apiPost('/buyer/assign')
    await refreshState()
    ElMessage.success('Buyer 分派完成')
  } catch (e: any) {
    console.error('Assign buyers failed:', e)
    ElMessage.error('分派失败')
  } finally {
    loading.value = false
  }
}

async function handleQuickInit() {
  loading.value = true
  try {
    const data = await apiPost('/quick-init')
    await refreshState()
    awardSummary.value = data.award_summary
    activeTab.value = 'award'
    ElMessage.success('Demo 初始化完成')
  } catch (e: any) {
    console.error('Quick init failed:', e)
    ElMessage.error('初始化失败: ' + (e?.response?.data?.message || e?.message || ''))
  } finally {
    loading.value = false
  }
}

async function handleReset() {
  try {
    await apiPost('/state/reset')
    state.project = null
    state.components = []
    state.active_component_id = null
    state.status = 'project_initialized'
    rfqPreview.value = null
    awardSummary.value = null
    recommendations.value = []
    selectedSuppliers.value = []
    ElMessage.success('已重置')
  } catch (e) {
    console.error('Reset failed:', e)
  }
}

async function handleSelectComponent(componentNo: string) {
  try {
    await apiPut(`/component/${componentNo}/select`)
    await refreshState()
    // 加载约束表单
    try {
      const data = await apiGet(`/constraint-form/${componentNo}`)
      if (data) Object.assign(constraintForm, data)
    } catch (e) { /* ignore */ }
  } catch (e) {
    console.error('Select component failed:', e)
  }
}

async function handleSaveConstraint() {
  if (!state.active_component_id) return
  try {
    const payload = { ...constraintForm }
    await apiPost(`/constraint-form/${state.active_component_id}`, payload)
    ElMessage.success('约束表单已保存')
  } catch (e: any) {
    console.error('Save constraint failed:', e)
    ElMessage.error('保存失败')
  }
}

async function handleRecommendSuppliers() {
  if (!state.active_component_id) {
    ElMessage.warning('请先在左侧列表中选择一个部件')
    return
  }
  try {
    // 先保存约束表单
    await handleSaveConstraint()
    const data = await apiGet(`/supplier/recommend/${state.active_component_id}`)
    recommendations.value = data.recommendations
  } catch (e: any) {
    console.error('Recommend suppliers failed:', e)
    ElMessage.error('推荐供应商失败: ' + (e?.response?.data?.message || e?.message || ''))
  }
}

function handleSupplierSelectionChange(selection: any[]) {
  selectedSuppliers.value = selection
}

async function handleConfirmSuppliers() {
  if (!state.active_component_id) {
    ElMessage.warning('请先在左侧列表中选择一个部件')
    return
  }
  if (selectedSuppliers.value.length < 2) {
    ElMessage.warning('请至少选择 2 家供应商')
    return
  }
  try {
    const supplierIds = selectedSuppliers.value.map((s: any) => s.supplier.id)
    await apiPost('/supplier/select', {
      component_id: state.active_component_id,
      supplier_ids: supplierIds,
    })
    ElMessage.success(`已选择 ${supplierIds.length} 家供应商`)
  } catch (e: any) {
    console.error('Confirm suppliers failed:', e)
    ElMessage.error('确认供应商失败: ' + (e?.response?.data?.message || e?.message || ''))
  }
}

async function handleGenerateRFQPreview() {
  if (!state.active_component_id) {
    ElMessage.warning('请先在左侧列表中选择一个部件')
    return
  }
  if (selectedSuppliers.value.length < 2) {
    ElMessage.warning('请至少选择 2 家供应商')
    return
  }
  try {
    const supplierIds = selectedSuppliers.value.map((s: any) => s.supplier.id)
    const data = await apiPost('/rfq/preview', {
      component_id: state.active_component_id,
      supplier_ids: supplierIds,
    })
    rfqPreview.value = data.preview
    rfqEmailPreview.value = data.email_preview
    await refreshState()
    activeTab.value = 'rfq'
    ElMessage.success('RFQ 预览已生成')
  } catch (e: any) {
    console.error('Generate RFQ preview failed:', e)
    const msg = e?.response?.data?.message || e?.message || '未知错误'
    ElMessage.error('生成 RFQ 预览失败: ' + msg)
  }
}

async function handleLoadMockQuotes() {
  if (!state.active_component_id) return
  loading.value = true
  try {
    await apiPost(`/quote/load-mock/${state.active_component_id}`)
    await refreshState()
    ElMessage.success('Mock 报价已加载')
  } catch (e: any) {
    console.error('Load mock quotes failed:', e)
    ElMessage.warning('当前部件无可用的 mock 报价，请尝试其他部件')
  } finally {
    loading.value = false
  }
}

async function handleGenerateAward() {
  if (!state.active_component_id) return
  loading.value = true
  try {
    const data = await apiPost(`/award/generate/${state.active_component_id}`)
    awardSummary.value = data
    await refreshState()
    activeTab.value = 'award'
    ElMessage.success('Award Summary 已生成')
  } catch (e) {
    console.error('Generate award failed:', e)
  } finally {
    loading.value = false
  }
}

function getBuyerName(buyerId) {
  const names = {
    buyer_zhang: '张工', buyer_li: '李工', buyer_wang: '王工',
    buyer_zhao: '赵工', buyer_sun: '孙工', buyer_pool: '采购池',
  }
  return names[buyerId] || buyerId
}

function getScore(supplierId) {
  return awardSummary.value?.scores[supplierId]?.total_score?.toFixed(1) || '-'
}

function getScoreType(supplierId) {
  const score = parseFloat(getScore(supplierId))
  if (isNaN(score)) return 'info'
  if (score >= 70) return 'success'
  if (score >= 50) return 'warning'
  return 'info'
}

// Lifecycle
onMounted(() => {
  refreshState()
})
</script>

<style scoped>
.rfq-demo {
  padding: 16px;
  max-width: 1400px;
  margin: 0 auto;
}

.demo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 8px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-left h1 {
  margin: 0;
  font-size: 20px;
}

.demo-badge {
  background: #e6a23c;
  color: #fff;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-label {
  color: #666;
  font-size: 13px;
}

.demo-progress {
  margin-bottom: 16px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
}

.demo-tabs {
  min-height: 500px;
}

.tab-content {
  padding: 16px 0;
}

.section {
  margin-bottom: 20px;
}

.section h3, .section h4 {
  margin-bottom: 12px;
  color: #303133;
}

.actions {
  margin-top: 16px;
}

.empty-hint {
  text-align: center;
  color: #999;
  padding: 40px;
  font-size: 14px;
}

.workbench-layout {
  display: flex;
  gap: 16px;
}

.wb-left {
  width: 280px;
  flex-shrink: 0;
}

.wb-left h4 {
  padding: 8px 12px;
  margin: 0;
  background: #f5f7fa;
  border-radius: 4px 4px 0 0;
}

.component-menu {
  border: 1px solid #e4e7ed;
  border-top: 0;
  max-height: 500px;
  overflow-y: auto;
}

.component-menu .el-menu-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  height: auto;
  padding: 8px 12px;
}

.comp-no {
  font-weight: 600;
  font-size: 13px;
}

.comp-name {
  font-size: 12px;
  color: #999;
}

.wb-right {
  flex: 1;
  min-width: 0;
}

.constraint-form {
  background: #fafafa;
  padding: 16px;
  border-radius: 8px;
}

.reason-tag {
  margin: 2px;
}

.el-message {
  /* hack for global message import */
}
</style>
