<template>
  <div class="workbench">
    <!-- === 顶部工具栏 === -->
    <div class="wb-header">
      <div class="wb-header-left">
        <h1>📦 Buyer Workbench</h1>
        <span class="demo-badge">原型演示</span>
        <el-tag :type="statusLight.color">{{ statusLight.label }}</el-tag>
      </div>
      <div class="wb-header-right">
        <span class="role-label">角色：</span>
        <el-radio-group v-model="mockRole" size="small" @change="onRoleSwitch">
          <el-radio-button value="admin">管理员</el-radio-button>
          <el-radio-button value="buyer_zhang">张工</el-radio-button>
          <el-radio-button value="buyer_li">李工</el-radio-button>
        </el-radio-group>
        <el-button type="primary" size="small" @click="handleQuickInit" :loading="loading">⚡ 一键初始化 Demo</el-button>
        <el-button size="small" @click="handleReset">重置</el-button>
      </div>
    </div>

    <div class="wb-body">
      <!-- === 左侧：EBOM 列表 === -->
      <div class="wb-left">
        <div class="left-title">
          <span>EBOM 列表</span>
          <el-button v-if="mockRole === 'admin'" size="small" text type="primary" @click="handleLoadSampleEBOM" :disabled="!!state.project">+ 新增</el-button>
        </div>
        <div v-if="!state.project" class="left-empty">
          <p>暂无 EBOM</p>
          <el-button size="small" type="primary" @click="handleLoadSampleEBOM" :loading="loading">加载示例 EBOM</el-button>
        </div>
        <div v-else class="left-list">
          <div class="ebom-card" :class="{ active: selectedEbom }" @click="handleSelectEbom">
            <div class="ebom-code">{{ state.project.project_code }}</div>
            <div class="ebom-name">{{ state.project.project_name }}</div>
            <el-tag :type="statusLight.color" size="small">{{ statusLight.label }}</el-tag>
          </div>
        </div>
      </div>

      <!-- === 右侧：工作区 === -->
      <div class="wb-right">
        <div v-if="!selectedEbom" class="right-placeholder">
          <el-icon style="font-size:48px;color:#dcdfe6"><svg viewBox="0 0 24 24" width="48" height="48"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM5 19V5h14v14H5zM7 10h2v7H7zm4-3h2v10h-2zm4 6h2v4h-2z" fill="currentColor"></path></svg></el-icon>
          <p>选择左侧 EBOM 以开始工作</p>
        </div>
        <div v-else class="right-content">
          <div class="wb-context">
            <span class="ctx-label">{{ state.project.project_code }} — {{ state.project.project_name }}</span>
            <span class="ctx-meta">PN 数量: {{ state.components.length }} | {{ statusLight.label }}</span>
          </div>

          <el-tabs v-model="activeSheet" type="border-card" class="wb-sheets">
            <!-- Sheet 1: Buyer Assignment -->
            <el-tab-pane label="👤 Buyer 分派" name="buyer_assignment" :disabled="mockRole !== 'admin'">
              <div class="sheet-content">
                <div v-if="state.components.length === 0" class="empty-hint">暂无 PN 数据，请先加载 EBOM</div>
                <div v-else>
                  <el-alert v-if="!allBuyersAssigned" title="尚有 PN 未分派 Buyer" type="warning" :closable="false" show-icon style="margin-bottom:12px"></el-alert>
                  <el-alert v-else title="全部 PN 已分派 Buyer" type="success" :closable="false" show-icon style="margin-bottom:12px"></el-alert>
                  <el-table :data="state.components" stripe size="small" max-height="400">
                    <el-table-column prop="component_no" label="PN 编号" width="160"></el-table-column>
                    <el-table-column prop="component_name" label="PN 名称" min-width="180"></el-table-column>
                    <el-table-column prop="category" label="品类" width="120"><template #default="{ row }"><el-tag size="small" type="info">{{ row.category }}</el-tag></template></el-table-column>
                    <el-table-column label="当前 Buyer" width="120"><template #default="{ row }"><span v-if="row.buyer_id">{{ getBuyerName(row.buyer_id) }}</span><el-tag v-else type="danger" size="small">未分派</el-tag></template></el-table-column>
                  </el-table>
                  <div class="sheet-actions">
                    <el-button type="primary" size="small" @click="handleAssignBuyers" :disabled="allBuyersAssigned" :loading="loading">自动分派 Buyer</el-button>
                  </div>
                </div>
              </div>
            </el-tab-pane>

            <!-- Sheet 2: Supplier (核心工作区) -->
            <el-tab-pane label="🔧 Supplier 工作流" name="supplier">
              <div class="sheet-content">
                <div v-if="state.components.length === 0" class="empty-hint">暂无 PN，请先加载 EBOM 并在 Buyer 分派页完成分派</div>
                <div v-else-if="!allBuyersAssigned" class="empty-hint">请先在"Buyer 分派"页完成 PN 分派</div>
                <div v-else>
                  <!-- PN List -->
                  <h4 class="sheet-section-title">PN 列表</h4>
                  <el-table :data="filteredComponents" stripe size="small" highlight-current-row @row-click="(row) => handleSelectPn(row.component_no)">
                    <el-table-column prop="component_no" label="PN 编号" width="160"><template #default="{ row }"><el-link type="primary" :underline="false">{{ row.component_no }}</el-link></template></el-table-column>
                    <el-table-column prop="component_name" label="名称" min-width="180"></el-table-column>
                    <el-table-column prop="category" label="品类" width="100"><template #default="{ row }"><el-tag size="small">{{ row.category }}</el-tag></template></el-table-column>
                    <el-table-column prop="buyer_id" label="Buyer" width="90"><template #default="{ row }">{{ getBuyerName(row.buyer_id) }}</template></el-table-column>
                    <el-table-column label="操作" width="70"><template #default="{ row }"><el-button size="small" type="primary" @click.stop="handleSelectPn(row.component_no)">进入</el-button></template></el-table-column>
                  </el-table>

                  <!-- PN Detail (drill-down) -->
                  <div v-if="activePn" style="margin-top:16px;border-top:2px solid #e4e7ed;padding-top:16px">
                    <h4 class="sheet-section-title">当前 PN：{{ activePn.component_no }} — {{ activePn.component_name }}</h4>

                    <!-- 参数确认区 -->
                    <el-collapse v-model="pnCollapseActive" style="margin-bottom:12px">
                      <el-collapse-item title="📝 询价参数确认（系统预填 → 修改 → 确认）" name="params">
                        <el-form :model="constraintForm" label-width="100px" size="small" class="constraint-form">
                          <el-row :gutter="12">
                            <el-col :span="8"><el-form-item label="加工方式"><el-input v-model="constraintForm.process_type"></el-input></el-form-item></el-col>
                            <el-col :span="8"><el-form-item label="表面处理"><el-input v-model="constraintForm.surface_treatment"></el-input></el-form-item></el-col>
                            <el-col :span="8"><el-form-item label="数量"><el-input-number v-model="constraintForm.quantity" :min="0" controls-position="right" style="width:100%"></el-input-number></el-form-item></el-col>
                          </el-row>
                          <el-row :gutter="12">
                            <el-col :span="8"><el-form-item label="交付要求"><el-input v-model="constraintForm.delivery_requirement"></el-input></el-form-item></el-col>
                            <el-col :span="8"><el-form-item label="贸易术语"><el-select v-model="constraintForm.target_incoterm"><el-option v-for="t in ['DDP','FOB','CIF','EXW']" :key="t" :label="t" :value="t"></el-option></el-select></el-form-item></el-col>
                            <el-col :span="8"><el-form-item label="币种"><el-select v-model="constraintForm.currency_mode"><el-option v-for="c in ['RMB','EUR','USD']" :key="c" :label="c" :value="c"></el-option></el-select></el-form-item></el-col>
                          </el-row>
                          <el-row :gutter="12">
                            <el-col :span="8"><el-form-item label="模具要求"><el-input v-model="constraintForm.mold_requirement"></el-input></el-form-item></el-col>
                            <el-col :span="8"><el-form-item label="包装"><el-input v-model="constraintForm.packing_requirement"></el-input></el-form-item></el-col>
                            <el-col :span="8"><el-form-item label="质量"><el-input v-model="constraintForm.quality_requirement"></el-input></el-form-item></el-col>
                          </el-row>
                          <el-row :gutter="12">
                            <el-col :span="16"><el-form-item label="特殊说明"><el-input v-model="constraintForm.special_note" type="textarea" :rows="2"></el-input></el-form-item></el-col>
                            <el-col :span="8"><el-form-item label="Cost Breakdown"><el-switch v-model="constraintForm.quotation_breakdown_required"></el-switch></el-form-item></el-col>
                          </el-row>
                          <el-button type="primary" size="small" @click="handleSaveConstraint">保存约束</el-button>
                          <el-button size="small" @click="handleRecommendSuppliers">推荐供应商</el-button>
                        </el-form>
                      </el-collapse-item>
                    </el-collapse>

                    <!-- 供应商推荐 -->
                    <div v-if="recommendations.length > 0" style="margin-bottom:12px">
                      <h4 class="sheet-section-title">候选供应商（规则推荐）</h4>
                      <el-table :data="recommendations" stripe size="small" @selection-change="handleSupplierSelectionChange">
                        <el-table-column type="selection" width="35"></el-table-column>
                        <el-table-column prop="supplier.name" label="供应商" min-width="140"></el-table-column>
                        <el-table-column prop="score" label="评分" width="60"><template #default="{ row }"><el-tag :type="row.score>=70?'success':row.score>=50?'warning':'info'" size="small">{{ row.score }}</el-tag></template></el-table-column>
                        <el-table-column prop="supplier.country" label="国家" width="70"></el-table-column>
                        <el-table-column prop="supplier.city" label="城市" width="80"></el-table-column>
                        <el-table-column label="能力标签" min-width="140"><template #default="{ row }"><el-tag v-for="t in row.supplier.capability_tags" :key="t" size="small" type="success" class="tag-item">{{ t }}</el-tag></template></el-table-column>
                        <el-table-column label="推荐理由" min-width="200"><template #default="{ row }"><el-tag v-for="r in row.reasons" :key="r" size="small" type="info" class="tag-item">{{ r }}</el-tag></template></el-table-column>
                      </el-table>
                      <div style="margin-top:8px">
                        <el-button type="primary" size="small" @click="handleConfirmSuppliers" :disabled="selectedSuppliers.length<2">确认供应商 ({{ selectedSuppliers.length }})</el-button>
                        <el-button size="small" @click="handlePrepareRFQ" :disabled="selectedSuppliers.length<2">生成 RFQ 预览</el-button>
                        <el-button v-if="hasRfqPreview" size="small" type="warning" @click="handleSendRFQ" :disabled="rfqSent">📤 发送 RFQ</el-button>
                        <el-button v-if="rfqSent && !allReplied" size="small" type="success" @click="handleMockReply">📥 模拟回传</el-button>
                      </div>
                    </div>

                    <!-- 供应商回传状态 + 报价 -->
                    <div v-if="supplierQuotesList.length > 0" style="margin-bottom:12px">
                      <h4 class="sheet-section-title">供应商回传状态 ({{ supplierQuotesList.length }} 家)</h4>
                      <el-table :data="supplierQuotesList" stripe size="small">
                        <el-table-column prop="supplier_name" label="供应商" width="140"></el-table-column>
                        <el-table-column label="状态" width="120"><template #default="{ row }"><el-tag :type="getReplyStatusTag(row.supplier_id)" size="small">{{ getReplyStatusLabel(row.supplier_id) }}</el-tag></template></el-table-column>
                        <el-table-column prop="unit_price" label="单价" width="90"><template #default="{ row }">{{ row.unit_price }} {{ row.currency }}</template></el-table-column>
                        <el-table-column prop="tooling_cost" label="模具费" width="100"><template #default="{ row }">{{ fmtInt(row.tooling_cost) }}</template></el-table-column>
                        <el-table-column prop="lead_time_days" label="交期(天)" width="80"></el-table-column>
                        <el-table-column label="邮件"><template #default="{ row }"><el-button size="small" text type="primary" @click="showMailLog(row.supplier_id)">📧 查看</el-button></template></el-table-column>
                      </el-table>
                    </div>

                    <!-- Mail Log Dialog -->
                    <el-dialog v-model="mailLogVisible" title="邮件往来记录" width="600px">
                      <div v-if="currentMailLogs.length === 0" class="empty-hint">暂无邮件记录</div>
                      <el-timeline v-else>
                        <el-timeline-item v-for="(log, i) in currentMailLogs" :key="i" :timestamp="log.timestamp?.slice(0,19) || ''" :type="log.type === 'rfq_send' ? 'primary' : 'success'">
                          <p><strong>{{ log.type === 'rfq_send' ? '📤 发送 RFQ' : '📥 供应商回邮' }}</strong></p>
                          <p>{{ log.subject }}</p>
                          <p style="font-size:11px;color:#909399">{{ log.notes }}</p>
                        </el-timeline-item>
                      </el-timeline>
                    </el-dialog>

                    <!-- Benchmark（底表） -->
                    <div v-if="comparisonBase" style="margin-top:12px">
                      <h4 class="sheet-section-title">📊 Benchmark 比较底表</h4>
                      <el-table :data="comparisonBase.comparison_rows" stripe size="small" border>
                        <el-table-column prop="supplier_name" label="供应商" width="150" fixed></el-table-column>
                        <el-table-column prop="piece_price" label="单价" width="80"><template #default="{ row }">{{ fmt(row.piece_price) }}</template></el-table-column>
                        <el-table-column prop="delivered_piece_price" label="交付单价" width="90"><template #default="{ row }">{{ fmt(row.delivered_piece_price) }}</template></el-table-column>
                        <el-table-column prop="tooling_cost" label="模具费" width="90"><template #default="{ row }">{{ fmtInt(row.tooling_cost) }}</template></el-table-column>
                        <el-table-column prop="effective_unit_cost" label="综合单价" width="90"><template #default="{ row }"><strong>{{ fmt(row.effective_unit_cost) }}</strong><span v-if="getDiffTag(row,'effective_unit_cost')" :style="{color:getDiffTag(row,'effective_unit_cost').color,fontSize:'11px',marginLeft:'4px'}">{{ getDiffTag(row,'effective_unit_cost').text }}</span></template></el-table-column>
                        <el-table-column prop="total_project_cost" label="项目总成本" width="110"><template #default="{ row }">{{ fmtInt(row.total_project_cost) }}</template></el-table-column>
                        <el-table-column prop="certification" label="认证" width="90"></el-table-column>
                      </el-table>
                      <div style="margin-top:8px">
                        <el-button type="success" size="small" @click="handleGenerateAward" :loading="loading">生成 Award Summary</el-button>
                      </div>
                    </div>

                    <!-- Award Summary -->
                    <div v-if="awardSummary" style="margin-top:12px">
                      <h4 class="sheet-section-title">🏆 Award Summary</h4>
                      <el-alert :title="awardSummary.recommendation?.conclusion || '-'" type="success" :closable="false" show-icon>
                        <template #default><div v-for="(line,i) in awardSummary.recommendation?.details||[]" :key="i">{{ line }}</div></template>
                      </el-alert>
                    </div>
                  </div>
                </div>
              </div>
            </el-tab-pane>

            <!-- Sheet 3: Sourcing File -->
            <el-tab-pane label="📁 Sourcing File" name="sourcing_file" :disabled="!canEnterSourcing">
              <div class="sheet-content">
                <div v-if="!canEnterSourcing" class="empty-hint">请先完成 Benchmark 和 Award Summary 后进入</div>
                <div v-else-if="!sourcingPreview">
                  <el-alert title="条件满足，可以生成 Sourcing File" type="success" :closable="false" show-icon style="margin-bottom:12px"></el-alert>
                  <el-button type="primary" @click="handleGenerateSourcingFile" :loading="loading">生成 Sourcing File（演示）</el-button>
                </div>
                <div v-else>
                  <h4>Sourcing File 预览</h4>
                  <el-descriptions :column="2" border size="small">
                    <el-descriptions-item label="文件名">{{ sourcingPreview.file_meta?.filename }}</el-descriptions-item>
                    <el-descriptions-item label="大小">{{ sourcingPreview.file_meta?.file_size }}</el-descriptions-item>
                    <el-descriptions-item label="包含Sheet" :span="2">{{ sourcingPreview.file_meta?.sheets?.join('、') }}</el-descriptions-item>
                  </el-descriptions>
                  <el-alert type="info" :closable="false" show-icon style="margin-top:8px" :title="sourcingPreview.file_meta?.disclaimer"></el-alert>
                  <el-button style="margin-top:8px" type="success" size="small" @click="handleGenerateSourcingFile">重新生成</el-button>
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
      </div>
    </div>

    <!-- RFQ Preview Modal -->
    <el-dialog v-model="rfqModalVisible" title="RFQ 询价包预览" width="750px" destroy-on-close>
      <el-tabs v-if="rfqPreview" v-model="rfqModalTab" type="card">
        <el-tab-pane label="📧 邮件正文" name="mail_body">
          <el-input v-model="rfqEmailPreview" type="textarea" :rows="14" readonly></el-input>
          <div style="margin-top:8px"><el-tag v-for="s in (rfqPreview.suppliers||[])" :key="s.supplier_id" size="small" style="margin-right:4px">{{ s.supplier_name }}</el-tag></div>
        </el-tab-pane>
        <el-tab-pane label="📋 Cost Breakdown 模板" name="template">
          <el-table :data="rfqConstraintData" stripe size="small">
            <el-table-column prop="label" label="约束项" width="160"></el-table-column>
            <el-table-column prop="value" label="值"></el-table-column>
          </el-table>
          <p style="margin-top:8px;font-size:12px;color:#909399">附件：PRA.SCM.DIR.010.Cost Breakdown Form.xlsx（demo 阶段以预制示例承接）</p>
        </el-tab-pane>
        <el-tab-pane label="📎 其他附件" name="attachments">
          <el-table :data="modalAttachmentList" stripe size="small">
            <el-table-column prop="name" label="文件名" min-width="280"></el-table-column>
            <el-table-column prop="note" label="说明" width="200"></el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
      <template #footer>
        <el-button @click="rfqModalVisible = false">关闭</el-button>
        <el-button type="primary" @click="handleSendRFQFromModal" :disabled="rfqSent">📤 确认发送 RFQ</el-button>
      </template>
    </el-dialog>
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

// === 全局状态 ===
const loading = ref(false)
const mockRole = ref<'admin'|'buyer_zhang'|'buyer_li'>('admin')
const activeSheet = ref('supplier')
const selectedEbom = ref(false)
const activePn = ref<any>(null)
const pnCollapseActive = ref<string[]>(['params'])
const state = reactive({
  status: 'ebom_imported', project: null as any, components: [] as any[],
  active_component_id: null as string | null, available_actions: [] as string[],
  supplier_quotes: {} as Record<string, any>, normalized_quotes: {} as Record<string, any>,
  supplier_candidates: {} as Record<string, any>, rfq_previews: {} as Record<string, any>,
  constraint_forms: {} as Record<string, any>,
  buyer_perspective: null as string | null,
})
const constraintForm = reactive({ process_type:'',surface_treatment:'',quantity:0,target_incoterm:'DDP',currency_mode:'RMB', delivery_requirement:'',mold_requirement:'',packing_requirement:'',quality_requirement:'', special_note:'',quotation_breakdown_required:true, quantity_unit:'pcs',material_spec:'' })
const recommendations = ref<any[]>([])
const selectedSuppliers = ref<any[]>([])
const rfqPreview = ref<any>(null)
const rfqEmailPreview = ref('')
const awardSummary = ref<any>(null)
const comparisonBase = ref<any>(null)
const sourcingPreview = ref<any>(null)
const rfqModalVisible = ref(false)
const rfqModalTab = ref('mail_body')
const mailLogVisible = ref(false)
const currentMailLogs = ref<any[]>([])
const allBuyers = ref<any[]>([])

// === 计算属性 ===
const statusLight = computed(() => {
  const m: any = { ebom_imported:{color:'info',label:'待分派'}, buyer_assigned:{color:'',label:'Buyer已分派'}, rfq_prepared:{color:'warning',label:'RFQ已备'}, rfq_sent:{color:'',label:'RFQ已发'}, supplier_feedback_in_progress:{color:'warning',label:'等待回传'}, benchmark_ready:{color:'success',label:'Benchmark就绪'}, sourcing_file_ready:{color:'success',label:'可生成文件'}, sourcing_file_generated:{color:'success',label:'已完成'} }
  return m[state.status] || { color: 'info', label: state.status }
})
const allBuyersAssigned = computed(() => state.components.length > 0 && state.components.every((c: any) => c.buyer_id))
const filteredComponents = computed(() => {
  if (mockRole.value === 'admin') return state.components
  return state.components.filter((c: any) => c.buyer_id === mockRole.value)
})
const hasRfqPreview = computed(() => !!state.active_component_id && !!state.rfq_previews[state.active_component_id])
const rfqSent = computed(() => {
  const m: any = { ebom_imported:0,buyer_assigned:0,rfq_prepared:0 }
  return !!(m[state.status] === undefined || state.status === 'rfq_sent' || state.status === 'supplier_feedback_in_progress' || state.status === 'benchmark_ready' || state.status === 'sourcing_file_ready' || state.status === 'sourcing_file_generated')
})
const allReplied = computed(() => state.status === 'benchmark_ready' || state.status === 'sourcing_file_ready' || state.status === 'sourcing_file_generated')
const supplierQuotesList = computed(() => {
  if (!state.active_component_id) return []
  const quotes = state.supplier_quotes[state.active_component_id] || {}
  return Object.values(quotes)
})
const canEnterSourcing = computed(() => ['benchmark_ready','sourcing_file_ready','sourcing_file_generated'].includes(state.status))
const rfqConstraintData = computed(() => {
  if (!rfqPreview.value?.constraint_summary) return []
  return Object.entries(rfqPreview.value.constraint_summary).map(([k,v]) => ({ label: k, value: typeof v === 'boolean' ? (v ? '是' : '否') : (v || '-') }))
})
const modalAttachmentList = computed(() => {
  if (!rfqPreview.value) return []
  const comp = rfqPreview.value.quotation_background
  return [
    { name: 'PRA.SCM.DIR.010.Cost Breakdown Form.xlsx', note: '（demo 预制示例）' },
    { name: `${comp?.component_no || 'PN'}_RFQ_Summary.pdf`, note: '（demo 预制示例）' },
    { name: `${comp?.project_code || 'PRJ'}_Project_Context.pdf`, note: '（demo 预制示例）' },
  ]
})

// === 通用工具 ===
function getBuyerName(id: string | null) { const m: any = { buyer_zhang:'张工',buyer_li:'李工',buyer_wang:'王工',buyer_zhao:'赵工',buyer_sun:'孙工',buyer_pool:'采购池' }; return m[id||''] || id || '-' }
function fmt(v: any) { return v == null ? '-' : Number(v).toFixed(2) }
function fmtInt(v: any) { return v == null ? '-' : Number(v).toLocaleString() }
function getDiffTag(row: any, field: string) { if (!row.annotations?.[field]) return null; const a = row.annotations[field]; return a.direction === 'higher' ? { text: `+${a.diff_pct}%`, color: '#F56C6C' } : { text: `${a.diff_pct}%`, color: '#67C23A' } }
function getReplyStatusTag(sid: string) {
  const cid = state.active_component_id; if (!cid) return 'info'
  const logs = state.mail_logs?.[cid]?.[sid]; if (!logs || logs.length === 0) return 'warning'
  const last = logs[logs.length - 1]
  if (last.status === 'reply_parsed') return 'success'
  if (last.status === 'reply_parse_failed' || last.status === 'manual_intervention_required') return 'danger'
  return 'warning'
}
function getReplyStatusLabel(sid: string) {
  const cid = state.active_component_id; if (!cid) return '未知'
  const logs = state.mail_logs?.[cid]?.[sid]; if (!logs || logs.length === 0) return '未回复'
  const last = logs[logs.length - 1]
  if (last.status === 'reply_parsed') return '报价已解析'
  if (last.status === 'reply_parse_failed') return '待人工介入'
  if (last.status === 'manual_intervention_required') return '需人工'
  if (last.type === 'rfq_send') return '已发送RFQ'
  return last.status || '未知'
}

// === 数据刷新 ===
async function refreshState() {
  try {
    const data = await apiGet('/state')
    Object.assign(state, data)
    if (state.project) selectedEbom.value = true
  } catch (e) { console.error('Failed to load state:', e) }
}

// === EBOM 操作 ===
async function handleSelectEbom() { selectedEbom.value = true; activeSheet.value = 'supplier' }

async function handleLoadSampleEBOM() {
  loading.value = true
  try { await apiPost('/ebom/load-sample'); await refreshState(); selectedEbom.value = true; ElMessage.success('示例 EBOM 已加载') }
  catch (e: any) { ElMessage.error('加载失败: ' + (e?.response?.data?.message || e?.message || '')) }
  finally { loading.value = false }
}

// === Buyer 分派 ===
async function handleAssignBuyers() {
  loading.value = true
  try { const data = await apiPost('/buyer/assign'); await refreshState(); allBuyers.value = data.buyers || []; ElMessage.success('Buyer 分派完成') }
  catch (e: any) { ElMessage.error('分派失败') }
  finally { loading.value = false }
}

// === PN 钻取 ===
async function handleSelectPn(componentNo: string) {
  try { await apiPut(`/component/${componentNo}/select`); await refreshState(); activePn.value = state.components.find((c: any) => c.component_no === componentNo); recommendations.value = []; selectedSuppliers.value = []; try { const data = await apiGet(`/constraint-form/${componentNo}`); if (data) Object.assign(constraintForm, data) } catch (e) { /* ignore */ } }
  catch (e) { console.error(e) }
}

// === 约束 & 供应商 ===
async function handleSaveConstraint() {
  if (!state.active_component_id) return
  try { await apiPost(`/constraint-form/${state.active_component_id}`, { ...constraintForm }); ElMessage.success('约束已保存') }
  catch (e: any) { ElMessage.error('保存失败') }
}
async function handleRecommendSuppliers() {
  if (!state.active_component_id) { ElMessage.warning('请先选择 PN'); return }
  try { await handleSaveConstraint(); const data = await apiGet(`/supplier/recommend/${state.active_component_id}`); recommendations.value = data.recommendations }
  catch (e: any) { ElMessage.error('推荐失败') }
}
function handleSupplierSelectionChange(sel: any[]) { selectedSuppliers.value = sel }
async function handleConfirmSuppliers() {
  if (!state.active_component_id || selectedSuppliers.value.length < 2) { ElMessage.warning('请至少选2家'); return }
  try { const ids = selectedSuppliers.value.map((s: any) => s.supplier.id); await apiPost('/supplier/select', { component_id: state.active_component_id, supplier_ids: ids }); ElMessage.success(`已选择 ${ids.length} 家`) }
  catch (e: any) { ElMessage.error('确认失败') }
}

// === RFQ ===
async function handlePrepareRFQ() {
  if (!state.active_component_id || selectedSuppliers.value.length < 2) { ElMessage.warning('请至少选2家'); return }
  try { const ids = selectedSuppliers.value.map((s: any) => s.supplier.id); const data = await apiPost('/rfq/preview', { component_id: state.active_component_id, supplier_ids: ids }); rfqPreview.value = data.preview; rfqEmailPreview.value = data.email_preview; await refreshState(); rfqModalVisible.value = true; rfqModalTab.value = 'mail_body' }
  catch (e: any) { ElMessage.error('生成RFQ失败: ' + (e?.response?.data?.message || e?.message || '')) }
}
async function handleSendRFQ() {
  if (!state.active_component_id) return
  try {
    const candidates = state.supplier_candidates[state.active_component_id] || []
    const sids = candidates.map((c: any) => c.id || c.supplier_id)
    if (sids.length === 0) { ElMessage.warning('请先选择供应商'); return }
    await apiPost('/rfq/send', { component_id: state.active_component_id, supplier_ids: sids })
    await refreshState(); rfqModalVisible.value = false; ElMessage.success('RFQ 已发送（演示模式）')
  } catch (e: any) { ElMessage.error('发送失败: ' + (e?.response?.data?.message || e?.message || '')) }
}
async function handleSendRFQFromModal() { rfqModalVisible.value = false; await handleSendRFQ() }

// === Mock 回传 ===
async function handleMockReply() {
  if (!state.active_component_id) return
  loading.value = true
  try { await apiPost('/supplier/mock-reply', { component_id: state.active_component_id }); await refreshState(); ElMessage.success('模拟回传完成') }
  catch (e: any) { ElMessage.error('回传失败: ' + (e?.response?.data?.message || e?.message || '')) }
  finally { loading.value = false }
}

// === Benchmark & Award ===
async function handleGenerateComparisonBase() {
  if (!state.active_component_id) return
  loading.value = true
  try { const data = await apiPost(`/comparison-base/generate/${state.active_component_id}`); comparisonBase.value = data; await refreshState(); ElMessage.success('Benchmark 已生成') }
  catch (e: any) { ElMessage.error('生成失败') }
  finally { loading.value = false }
}
async function handleGenerateAward() {
  if (!state.active_component_id) { ElMessage.warning('请先选择 PN'); return }
  loading.value = true
  try { const data = await apiPost(`/award/generate/${state.active_component_id}`); awardSummary.value = data; await refreshState(); ElMessage.success('Award Summary 已生成') }
  catch (e: any) { ElMessage.error('生成失败: ' + (e?.response?.data?.message || e?.message || '')) }
  finally { loading.value = false }
}

// === Sourcing File ===
async function handleGenerateSourcingFile() {
  loading.value = true
  try { const data = await apiPost('/sourcing-file/generate'); sourcingPreview.value = data.preview; await refreshState(); ElMessage.success('Sourcing File 已生成（演示模式）') }
  catch (e: any) { ElMessage.error('生成失败: ' + (e?.response?.data?.message || e?.message || '')) }
  finally { loading.value = false }
}

// === 邮件日志 ===
async function showMailLog(supplierId: string) {
  if (!state.active_component_id) return
  try { const data = await apiGet(`/mail-logs/${state.active_component_id}`); currentMailLogs.value = data.logs?.[supplierId] || []; mailLogVisible.value = true }
  catch (e) { currentMailLogs.value = []; mailLogVisible.value = true }
}

// === 角色切换 ===
async function onRoleSwitch() {
  const bid = mockRole.value === 'admin' ? null : mockRole.value
  try { await apiPut('/buyer/perspective', { buyer_id: bid }); await refreshState() } catch (e) { /* ignore */ }
}

// === 快速初始化 & 重置 ===
async function handleQuickInit() {
  loading.value = true
  try {
    const data = await apiPost('/quick-init')
    await refreshState()
    awardSummary.value = data.award_summary || null
    comparisonBase.value = data.comparison_base || null
    selectedEbom.value = true
    activeSheet.value = 'supplier'
    const firstPn = state.components[0]
    if (firstPn) { activePn.value = firstPn; try { const fd = await apiGet(`/constraint-form/${firstPn.component_no}`); if (fd) Object.assign(constraintForm, fd) } catch (e) { /* ignore */ } }
    if (comparisonBase.value) { try { await apiGet('/sourcing-file/status') } catch (e) { /* ignore */ } }
    ElMessage.success('Demo 初始化完成')
  } catch (e: any) { ElMessage.error('初始化失败: ' + (e?.response?.data?.message || e?.message || '')) }
  finally { loading.value = false }
}

async function handleReset() {
  try {
    await apiPost('/state/reset')
    state.status = 'ebom_imported'; state.project = null; state.components = []; state.active_component_id = null
    rfqPreview.value = null; rfqEmailPreview.value = ''; awardSummary.value = null; comparisonBase.value = null; sourcingPreview.value = null
    recommendations.value = []; selectedSuppliers.value = []; activePn.value = null; selectedEbom.value = false; allBuyers.value = []
    ElMessage.success('已重置')
  } catch (e) { console.error('Reset failed:', e) }
}

onMounted(() => { refreshState() })
</script>

<style scoped>
.workbench { display: flex; flex-direction: column; height: calc(100vh - 80px); padding: 12px 16px; }
.wb-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-shrink: 0; }
.wb-header-left { display: flex; align-items: center; gap: 12px; }
.wb-header-left h1 { margin: 0; font-size: 18px; }
.demo-badge { background: #E6A23C; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
.wb-header-right { display: flex; align-items: center; gap: 8px; }
.role-label { font-size: 12px; color: #909399; }
.wb-body { display: flex; flex: 1; gap: 12px; overflow: hidden; min-height: 0; }
.wb-left { width: 240px; flex-shrink: 0; border: 1px solid #e4e7ed; border-radius: 6px; display: flex; flex-direction: column; overflow: hidden; }
.left-title { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; font-weight: 600; font-size: 13px; border-bottom: 1px solid #ebeef5; }
.left-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #909399; gap: 8px; font-size: 13px; }
.left-list { flex: 1; overflow-y: auto; padding: 8px; }
.ebom-card { padding: 10px 12px; border-radius: 6px; cursor: pointer; border: 1px solid #ebeef5; margin-bottom: 6px; transition: all .2s; }
.ebom-card:hover, .ebom-card.active { border-color: #409EFF; background: #ecf5ff; }
.ebom-code { font-weight: 600; font-size: 13px; margin-bottom: 2px; }
.ebom-name { font-size: 12px; color: #606266; margin-bottom: 6px; }
.wb-right { flex: 1; overflow: hidden; display: flex; flex-direction: column; min-width: 0; }
.right-placeholder { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #c0c4cc; gap: 12px; font-size: 14px; }
.right-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.wb-context { padding: 6px 12px; background: #f5f7fa; border-radius: 4px; margin-bottom: 8px; font-size: 12px; display: flex; justify-content: space-between; }
.ctx-label { font-weight: 600; }
.ctx-meta { color: #909399; }
.wb-sheets { flex: 1; overflow: hidden; }
.sheet-content { padding: 8px 0; overflow-y: auto; max-height: calc(100vh - 250px); }
.sheet-section-title { margin: 0 0 8px; font-size: 14px; }
.sheet-actions { margin-top: 10px; }
.empty-hint { text-align: center; color: #909399; padding: 40px 0; font-size: 13px; }
.constraint-form { max-width: 100%; }
.tag-item { margin-right: 4px; margin-bottom: 3px; }
</style>
