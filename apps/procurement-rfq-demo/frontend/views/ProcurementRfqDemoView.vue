<template>
  <div class="workbench">
    <!-- === 顶部工具栏 === -->
    <div class="wb-header">
      <div class="wb-header-left">
        <h1>📦 Buyer Workbench</h1>
        <span class="demo-badge">原型演示</span>
        <el-tag :type="statusLight.color">{{ statusLight.label }}</el-tag>
        <!-- audit-round04: Progress Bar -->
        <div v-if="state.progress" class="progress-bar-wrap">
          <el-progress :percentage="progressPercent" :stroke-width="8" :show-text="false" style="width:160px"></el-progress>
          <span class="progress-text">{{ progressDetail.completed_pns || 0 }}/{{ progressDetail.total_pns || 0 }} PN 完成</span>
        </div>
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
                    <el-table-column label="供应商" width="100"><template #default="{ row }"><el-tag :type="getSupplierSelectLabel(row.component_no).type" size="small">{{ getSupplierSelectLabel(row.component_no).text }}</el-tag></template></el-table-column>
                    <!-- audit-round05: 管理员重分派 Buyer 始终可见 -->
                    <el-table-column label="重分派" width="130" v-if="mockRole==='admin'"><template #default="{ row }"><el-select v-model="reassignMap[row.component_no]" size="small" placeholder="更换" style="width:90px" @change="(v: string) => handleReassignBuyer(row.component_no, v)"><el-option v-for="b in allBuyerIds" :key="b" :label="getBuyerName(b)" :value="b"></el-option></el-select></template></el-table-column>
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
                  <h4 class="sheet-section-title">PN 列表（含局部状态）</h4>
                  <el-table :data="filteredComponents" stripe size="small" highlight-current-row @row-click="(row: any) => handleSelectPn(row.component_no)">
                    <el-table-column prop="component_no" label="PN 编号" width="150"><template #default="{ row }"><el-link type="primary" :underline="false">{{ row.component_no }}</el-link></template></el-table-column>
                    <el-table-column prop="component_name" label="名称" min-width="140"></el-table-column>
                    <el-table-column prop="category" label="品类" width="90"><template #default="{ row }"><el-tag size="small">{{ row.category }}</el-tag></template></el-table-column>
                    <el-table-column prop="buyer_id" label="Buyer" width="80"><template #default="{ row }">{{ getBuyerName(row.buyer_id) }}</template></el-table-column>
                    <el-table-column label="供应商" width="90"><template #default="{ row }"><el-tag :type="getSupplierSelectLabel(row.component_no).type" size="small">{{ getSupplierSelectLabel(row.component_no).text }}</el-tag></template></el-table-column>
                    <el-table-column label="RFQ" width="80"><template #default="{ row }"><el-tag :type="getPnRfqLabel(row.component_no).type" size="small">{{ getPnRfqLabel(row.component_no).text }}</el-tag></template></el-table-column>
                    <el-table-column label="回传" width="90"><template #default="{ row }"><el-tag :type="getPnQuoteLabel(row.component_no).type" size="small">{{ getPnQuoteLabel(row.component_no).text }}</el-tag></template></el-table-column>
                    <el-table-column label="操作" width="70"><template #default="{ row }"><el-button size="small" type="primary" @click.stop="handleSelectPn(row.component_no)">进入</el-button></template></el-table-column>
                  </el-table>

                  <!-- PN Detail (drill-down) -->
                  <div v-if="activePn" style="margin-top:16px;border-top:2px solid #e4e7ed;padding-top:16px">
                    <h4 class="sheet-section-title">当前 PN：{{ activePn.component_no }} — {{ activePn.component_name }}</h4>

                    <!-- 参数确认区 audit-round05: 4状态机 -->
                    <el-collapse v-model="pnCollapseActive" style="margin-bottom:12px">
                      <el-collapse-item :title="constraintCollapseTitle" name="params">
                        <el-form :model="constraintForm" label-width="100px" size="small" class="constraint-form">
                          <el-row :gutter="12">
                            <el-col :span="8"><el-form-item label="加工方式"><el-input v-model="constraintForm.process_type" :disabled="!canEditRequirements"></el-input></el-form-item></el-col>
                            <el-col :span="8"><el-form-item label="表面处理"><el-input v-model="constraintForm.surface_treatment" :disabled="!canEditRequirements"></el-input></el-form-item></el-col>
                            <el-col :span="8"><el-form-item label="数量"><el-input-number v-model="constraintForm.quantity" :min="0" controls-position="right" style="width:100%" :disabled="!canEditRequirements"></el-input-number></el-form-item></el-col>
                          </el-row>
                          <el-row :gutter="12">
                            <el-col :span="8"><el-form-item label="交付要求"><el-input v-model="constraintForm.delivery_requirement" :disabled="!canEditRequirements"></el-input></el-form-item></el-col>
                            <el-col :span="8"><el-form-item label="贸易术语"><el-select v-model="constraintForm.target_incoterm" :disabled="!canEditRequirements"><el-option v-for="t in ['DDP','FOB','CIF','EXW']" :key="t" :label="t" :value="t"></el-option></el-select></el-form-item></el-col>
                            <el-col :span="8"><el-form-item label="币种"><el-select v-model="constraintForm.currency_mode" :disabled="!canEditRequirements"><el-option v-for="c in ['RMB','EUR','USD']" :key="c" :label="c" :value="c"></el-option></el-select></el-form-item></el-col>
                          </el-row>
                          <el-row :gutter="12">
                            <el-col :span="8"><el-form-item label="模具要求"><el-input v-model="constraintForm.mold_requirement" :disabled="!canEditRequirements"></el-input></el-form-item></el-col>
                            <el-col :span="8"><el-form-item label="包装"><el-input v-model="constraintForm.packing_requirement" :disabled="!canEditRequirements"></el-input></el-form-item></el-col>
                            <el-col :span="8"><el-form-item label="质量"><el-input v-model="constraintForm.quality_requirement" :disabled="!canEditRequirements"></el-input></el-form-item></el-col>
                          </el-row>
                          <el-row :gutter="12">
                            <el-col :span="16"><el-form-item label="特殊说明"><el-input v-model="constraintForm.special_note" type="textarea" :rows="2" :disabled="!canEditRequirements"></el-input></el-form-item></el-col>
                            <el-col :span="8"><el-form-item label="Cost Breakdown"><el-switch v-model="constraintForm.quotation_breakdown_required" :disabled="!canEditRequirements"></el-switch></el-form-item></el-col>
                          </el-row>
                          <el-button v-if="canEditRequirements" type="primary" size="small" @click="handleSaveConstraint">💾 保存约束</el-button>
                          <el-button v-if="canModifyRequirements" type="warning" size="small" @click="handleModifyConstraint">✏️ 修改约束</el-button>
                          <el-button v-if="showRecommendButton" size="small" @click="handleRecommendSuppliers">🔍 推荐供应商</el-button>
                        </el-form>
                      </el-collapse-item>
                    </el-collapse>

                    <!-- 供应商推荐 audit-round05: 选择态/展示态分离 -->
                    <div v-if="recommendations.length > 0" style="margin-bottom:12px">
                      <h4 class="sheet-section-title">候选供应商（规则推荐） — <el-tag :type="currentPnSupplierStatus === 'confirmed' ? 'success' : 'warning'" size="small">{{ currentPnSupplierStatus === 'confirmed' ? '✅ 已确认(展示态)' : '🔶 选择中' }}</el-tag></h4>
                      <el-table :data="recommendations" stripe size="small" @selection-change="handleSupplierSelectionChange">
                        <el-table-column type="selection" width="35" :selectable="() => currentPnSupplierStatus === 'selecting'"></el-table-column>
                        <el-table-column label="供应商" min-width="140">
                          <template #default="{ row }">
                            <el-link type="primary" :underline="false" @click="showSupplierDetail(row.supplier.id)">{{ row.supplier.name }}</el-link>
                          </template>
                        </el-table-column>
                        <el-table-column prop="score" label="评分" width="60"><template #default="{ row }"><el-tag :type="row.score>=70?'success':row.score>=50?'warning':'info'" size="small">{{ row.score }}</el-tag></template></el-table-column>
                        <el-table-column prop="supplier.country" label="国家" width="70"></el-table-column>
                        <el-table-column label="能力标签" min-width="140"><template #default="{ row }"><el-tag v-for="t in row.supplier.capability_tags" :key="t" size="small" type="success" class="tag-item">{{ t }}</el-tag></template></el-table-column>
                        <el-table-column label="推荐理由" min-width="160"><template #default="{ row }"><el-tag v-for="r in row.reasons" :key="r" size="small" type="info" class="tag-item">{{ r }}</el-tag></template></el-table-column>
                      </el-table>
                      <div style="margin-top:8px">
                        <el-button v-if="currentPnSupplierStatus === 'selecting'" type="primary" size="small" @click="handleConfirmSuppliers" :disabled="selectedSuppliers.length<2">🔒 确认供应商 ({{ selectedSuppliers.length }})</el-button>
                        <el-button v-if="canModifySuppliers" size="small" type="warning" @click="handleModifySuppliers">✏️ 修改供应商</el-button>
                        <el-button v-if="canAddSupplier" size="small" type="info" @click="handleAddSupplier">➕ 添加供应商</el-button>
                        <el-button v-if="canPrepareRfq" size="small" type="primary" @click="handlePrepareRFQ">📋 生成 RFQ 预览</el-button>
                        <el-button v-if="canSendRfq && currentPnRfqStatus === 'prepared'" size="small" type="warning" @click="handleSendRFQ">📤 发送 RFQ</el-button>
                        <el-button v-if="canSendRfq && currentPnRfqStatus === 'sent'" size="small" type="info" @click="handleViewSentRfq">📧 查看已发送 RFQ</el-button>
                        <el-button v-if="canSendRfq && currentPnRfqStatus === 'sent'" size="small" type="warning" @click="handleResendRFQ">📤 重新发送 RFQ</el-button>
                        <el-button v-if="canMockReply" size="small" type="success" @click="handleMockReply">📥 模拟{{ currentPnQuoteStatus === 'partial_replied' ? '全部' : '' }}回传</el-button>
                      </div>
                    </div>

                    <!-- 供应商回传状态 + 报价 audit-round05: 供应商名可点击 -->
                    <div v-if="supplierQuotesList.length > 0" style="margin-bottom:12px">
                      <h4 class="sheet-section-title">供应商回传状态 ({{ supplierQuotesList.length }} 家)</h4>
                      <el-table :data="supplierQuotesList" stripe size="small">
                        <el-table-column label="供应商" width="140">
                          <template #default="{ row }">
                            <el-link type="primary" :underline="false" @click="showSupplierDetail(row.supplier_id)">{{ row.supplier_name || row.supplier_id }}</el-link>
                          </template>
                        </el-table-column>
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

                    <!-- Supplier Detail Dialog (audit-round04) -->
                    <el-dialog v-model="supplierDetailVisible" :title="'供应商详情：' + (supplierDetail?.name || '')" width="580px">
                      <div v-if="!supplierDetail" class="empty-hint">暂无详情</div>
                      <div v-else>
                        <el-descriptions :column="2" border size="small">
                          <el-descriptions-item label="名称">{{ supplierDetail.name }}</el-descriptions-item>
                          <el-descriptions-item label="国家/地区">{{ supplierDetail.country }} {{ supplierDetail.city }}</el-descriptions-item>
                          <el-descriptions-item label="评分">{{ supplierDetail.score }}</el-descriptions-item>
                          <el-descriptions-item label="认证">{{ supplierDetail.certification || '-' }}</el-descriptions-item>
                          <el-descriptions-item label="能力标签" :span="2"><el-tag v-for="t in supplierDetail.capability_tags" :key="t" size="small" style="margin-right:4px">{{ t }}</el-tag></el-descriptions-item>
                        </el-descriptions>
                        <h5 style="margin:12px 0 6px">历史报价记录</h5>
                        <el-table :data="supplierQuoteHistory" stripe size="small" max-height="200">
                          <el-table-column prop="pn" label="PN" width="140"></el-table-column>
                          <el-table-column prop="unit_price" label="单价" width="80"></el-table-column>
                          <el-table-column prop="lead_time_days" label="交期(天)" width="80"></el-table-column>
                          <el-table-column prop="tooling_cost" label="模具费" width="90"><template #default="{ row }">{{ fmtInt(row.tooling_cost) }}</template></el-table-column>
                        </el-table>
                      </div>
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

            <!-- Sheet 3: Sourcing File audit-round05: 含条件 deficiency 诊断 -->
            <el-tab-pane label="📁 Sourcing File" name="sourcing_file" :disabled="!canEnterSourcing">
              <div class="sheet-content">
                <div v-if="!canEnterSourcing" class="empty-hint">
                  <p>所有 PN 必须完成全部条件后才能生成 Sourcing File</p>
                  <p style="font-size:12px;color:#909399">当前进度：{{ progressDetail.completed_pns || 0 }}/{{ progressDetail.total_pns || 0 }} PN 完成</p>
                </div>
                <!-- audit-round05: per-PN deficiency 诊断表 -->
                <div v-if="sourcingConditions.length > 0" style="margin-bottom:12px">
                  <h4 class="sheet-section-title">📋 各 PN 条件检查</h4>
                  <el-table :data="sourcingConditions" stripe size="small" border>
                    <el-table-column prop="component_id" label="PN" width="160"></el-table-column>
                    <el-table-column label="约束已保存" width="90">
                      <template #default="{ row }"><el-tag :type="row.constraint_saved ? 'success' : 'danger'" size="small">{{ row.constraint_saved ? '✅' : '❌' }}</el-tag></template>
                    </el-table-column>
                    <el-table-column label="供应商≥2" width="90">
                      <template #default="{ row }"><el-tag :type="row.suppliers_confirmed ? 'success' : 'danger'" size="small">{{ row.suppliers_confirmed ? '✅' : '❌' }}</el-tag></template>
                    </el-table-column>
                    <el-table-column label="RFQ已发" width="80">
                      <template #default="{ row }"><el-tag :type="row.rfq_sent ? 'success' : 'danger'" size="small">{{ row.rfq_sent ? '✅' : '❌' }}</el-tag></template>
                    </el-table-column>
                    <el-table-column label="全部回传" width="80">
                      <template #default="{ row }"><el-tag :type="row.all_replied ? 'success' : 'danger'" size="small">{{ row.all_replied ? '✅' : '❌' }}</el-tag></template>
                    </el-table-column>
                    <el-table-column label="总评" width="70">
                      <template #default="{ row }"><el-tag :type="row.all_met ? 'success' : 'info'" size="small">{{ row.all_met ? '✅' : '⏳' }}</el-tag></template>
                    </el-table-column>
                  </el-table>
                </div>
                <div v-else-if="state.components.length === 0" class="empty-hint">暂无 PN 数据</div>
                <div v-if="!sourcingPreview && canGenerateSourcing">
                  <el-alert title="条件满足，可以生成 Sourcing File" type="success" :closable="false" show-icon style="margin-bottom:12px"></el-alert>
                  <el-button type="primary" @click="handleGenerateSourcingFile" :loading="loading">生成 Sourcing File（演示）</el-button>
                </div>
                <div v-else-if="!canGenerateSourcing && state.components.length > 0">
                  <el-alert title="条件不满足：部分 PN 未完成全部 4 项条件" type="warning" :closable="false" show-icon style="margin-bottom:12px"></el-alert>
                  <el-button type="warning" size="small" @click="handleMockReplyAll" :loading="loading" style="margin-bottom:12px">⚡ 所有零件全部回传（Demo）</el-button>
                </div>
                <div v-if="sourcingPreview">
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
import { ElMessage, ElMessageBox } from 'element-plus'

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
  mail_logs: {} as Record<string, Record<string, any[]>>,
  // audit-round05: PN-level local states (field names match backend snapshot)
  progress: null as any,
  requirement_status: {} as Record<string, string>,
  supplier_selection_status: {} as Record<string, string>,
  rfq_status: {} as Record<string, string>,
  quote_collection_status: {} as Record<string, string>,
  confirmed_supplier_ids: {} as Record<string, string[]>,
  selected_supplier_ids: {} as Record<string, string[]>,
  pn_is_first_entry: {} as Record<string, boolean>,
  pn_rfq_sent_count: {} as Record<string, number>,
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

// audit-round04: new UI state
const supplierDetailVisible = ref(false)
const supplierDetail = ref<any>(null)
const supplierQuoteHistory = ref<any[]>([])
const reassignMap = reactive<Record<string, string>>({})

const allBuyerIds = ['buyer_zhang', 'buyer_li', 'buyer_wang', 'buyer_zhao', 'buyer_sun', 'buyer_pool']

const sourcingConditions = ref<any[]>([])

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

// audit-round05: PN-level permission selectors
const currentPnReqStatus = computed(() => state.requirement_status[state.active_component_id || ''] || 'first_entry_editing')
const currentPnSupplierStatus = computed(() => state.supplier_selection_status[state.active_component_id || ''] || 'not_started')
const currentPnRfqStatus = computed(() => state.rfq_status[state.active_component_id || ''] || 'not_prepared')
const currentPnQuoteStatus = computed(() => state.quote_collection_status[state.active_component_id || ''] || 'none_replied')
const currentPnIsFirstEntry = computed(() => currentPnReqStatus.value === 'first_entry_editing')

// audit-round05: 4状态约束折叠标题
const constraintCollapseTitle = computed(() => {
  const m: Record<string, string> = {
    first_entry_editing: '📝 首次录入 — 询价参数确认',
    saved_locked: '📝 询价参数（只读 ✓ 已保存）',
    manual_editing: '✏️ 修改中 — 询价参数确认',
    manual_saved_locked: '📝 询价参数（只读 ✓ 已保存）',
  }
  return m[currentPnReqStatus.value] || '📝 询价参数'
})

// Button permissions per-PN (role-aware)
const canEditRequirements = computed(() => {
  const cid = state.active_component_id; if (!cid) return false
  if (mockRole.value !== 'admin') {
    const comp = state.components.find((c: any) => c.component_no === cid)
    if (!comp || comp.buyer_id !== mockRole.value) return false
  }
  return currentPnReqStatus.value === 'first_entry_editing' || currentPnReqStatus.value === 'manual_editing'
})
const canModifyRequirements = computed(() => {
  const cid = state.active_component_id; if (!cid) return false
  if (mockRole.value !== 'admin') return false
  return currentPnReqStatus.value === 'saved_locked' || currentPnReqStatus.value === 'manual_saved_locked'
})
const showRecommendButton = computed(() => {
  const cid = state.active_component_id; if (!cid) return false
  return currentPnReqStatus.value === 'saved_locked' || currentPnReqStatus.value === 'manual_saved_locked'
    || currentPnReqStatus.value === 'first_entry_editing' || currentPnReqStatus.value === 'manual_editing'
})
const canConfirmSuppliers = computed(() => {
  const cid = state.active_component_id; if (!cid) return false
  return currentPnSupplierStatus.value === 'selecting'
})
const canModifySuppliers = computed(() => {
  const cid = state.active_component_id; if (!cid) return false
  if (currentPnSupplierStatus.value !== 'confirmed') return false
  if (mockRole.value === 'admin') return true
  const comp = state.components.find((c: any) => c.component_no === cid)
  return !!(comp && comp.buyer_id === mockRole.value)
})
const canAddSupplier = computed(() => {
  const cid = state.active_component_id; if (!cid) return false
  if (!['confirmed', 'selecting'].includes(currentPnSupplierStatus.value)) return false
  if (mockRole.value === 'admin') return true
  const comp = state.components.find((c: any) => c.component_no === cid)
  return !!(comp && comp.buyer_id === mockRole.value)
})
const canPrepareRfq = computed(() => {
  const cid = state.active_component_id; if (!cid) return false
  if (currentPnSupplierStatus.value !== 'confirmed') return false
  if (currentPnRfqStatus.value !== 'not_prepared') return false
  const hasConfirmed = (state.confirmed_supplier_ids[cid] || []).length >= 2
  return hasConfirmed
})
const canSendRfq = computed(() => {
  const cid = state.active_component_id; if (!cid) return false
  const hasConfirmed = (state.confirmed_supplier_ids[cid] || []).length >= 2
  if (!hasConfirmed) return false
  if (mockRole.value !== 'admin') {
    const comp = state.components.find((c: any) => c.component_no === cid)
    if (!comp || comp.buyer_id !== mockRole.value) return false
  }
  return currentPnRfqStatus.value === 'prepared' || currentPnRfqStatus.value === 'sent'
})
// audit-round06: mock reply 权限下放给 assigned buyer
const canMockReply = computed(() => {
  const cid = state.active_component_id; if (!cid) return false
  if (currentPnRfqStatus.value !== 'sent') return false
  if (currentPnQuoteStatus.value === 'all_replied') return false
  if (mockRole.value === 'admin') return true
  // assigned buyer 可对自己负责的 PN 执行模拟回传
  const comp = state.components.find((c: any) => c.component_no === cid)
  return !!(comp && comp.buyer_id === mockRole.value)
})
const canGenerateBenchmark = computed(() => {
  const cid = state.active_component_id; if (!cid) return false
  return currentPnQuoteStatus.value === 'all_replied'
})
const canEnterSourcing = computed(() => state.components.length > 0)
const canGenerateSourcing = computed(() => sourcingConditions.value.length > 0 && sourcingConditions.value.every((c: any) => c.all_met))

// 进度条
const progressPercent = computed(() => state.progress?.pct || 0)
const progressDetail = computed(() => state.progress || {})

// RFQ Modal
const rfqSent = computed(() => currentPnRfqStatus.value === 'sent')

// RFQ 按钮文本（区分首次/二次）
const rfqSendButtonText = computed(() => (state.pn_rfq_sent_count[state.active_component_id || ''] || 0) > 0 ? '📤 重新发送 RFQ' : '📤 发送 RFQ')

const supplierQuotesList = computed(() => {
  if (!state.active_component_id) return []
  const quotes = state.supplier_quotes[state.active_component_id] || {}
  return Object.values(quotes)
})

// 供应商三态标签
function getSupplierSelectLabel(cid: string) {
  const st = state.supplier_selection_status[cid]
  if (st === 'confirmed') return { text: '已确认', type: 'success' }
  if (st === 'selecting') return { text: '选择中', type: 'warning' }
  return { text: '待选择', type: 'info' }
}
function getPnRfqLabel(cid: string) {
  const st = state.rfq_status[cid]
  if (st === 'sent') return { text: '已发送', type: 'success' }
  if (st === 'prepared') return { text: '已备', type: 'warning' }
  return { text: '未备', type: 'info' }
}
function getPnQuoteLabel(cid: string) {
  const st = state.quote_collection_status[cid]
  if (st === 'all_replied') return { text: '全部回传', type: 'success' }
  if (st === 'partial_replied') return { text: '部分回传', type: 'warning' }
  return { text: '未回传', type: 'info' }
}

// audit-round05: sourcing conditions

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
    // audit-round05: 同步拉取 sourcing file 条件
    try { const sc = await apiGet('/sourcing-file/status'); sourcingConditions.value = sc.conditions || [] } catch (e) { /* ignore */ }
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
  try {
    await apiPut(`/component/${componentNo}/select`)
    await refreshState()
    activePn.value = state.components.find((c: any) => c.component_no === componentNo)

    // audit-round06: 按已保存状态恢复展示态，不再盲目清空
    const selStatus = state.supplier_selection_status[componentNo] || 'not_started'
    const rfqStatusVal = state.rfq_status[componentNo] || 'not_prepared'

    // 恢复约束表单
    try { const data = await apiGet(`/constraint-form/${componentNo}`); if (data) Object.assign(constraintForm, data) } catch (e) { /* ignore */ }

    // audit-round07: confirmed 状态走纯读取接口，不调 recommend（避免刷新推荐列表）
    recommendations.value = []
    selectedSuppliers.value = []
    if (selStatus === 'confirmed') {
      try {
        const displayData = await apiGet(`/supplier/confirmed-display/${componentNo}`)
        recommendations.value = displayData.suppliers || []
      } catch (e) { /* ignore */ }
    }

    // 恢复 RFQ preview
    if (rfqStatusVal === 'prepared' || rfqStatusVal === 'sent') {
      const preview = state.rfq_previews[componentNo]
      if (preview) {
        rfqPreview.value = preview
        rfqEmailPreview.value = preview.email_preview || ''
      }
    }

    // 恢复 benchmark / award（如果有）
    comparisonBase.value = null
    awardSummary.value = null
    // 从后端 state 中如果已有则恢复（通过 refreshState 已同步）
  } catch (e) { console.error(e) }
}

// === 约束 & 供应商 ===
async function handleSaveConstraint() {
  if (!state.active_component_id) return
  try {
    await apiPost(`/constraint-form/${state.active_component_id}`, { ...constraintForm })
    await refreshState()
    ElMessage.success('约束已保存')
  } catch (e: any) { ElMessage.error('保存失败') }
}

// audit-round05: 修改约束（从锁定态进入手动编辑）
async function handleModifyConstraint() {
  if (!state.active_component_id) return
  try {
    await apiPut(`/constraint-form/${state.active_component_id}/modify`)
    await refreshState()
    ElMessage.success('约束已解锁，请修改后保存')
  } catch (e: any) { ElMessage.error('修改失败: ' + (e?.response?.data?.message || e?.message || '')) }
}
async function handleRecommendSuppliers() {
  if (!state.active_component_id) { ElMessage.warning('请先选择 PN'); return }
  try {
    await handleSaveConstraint()
    const data = await apiGet(`/supplier/recommend/${state.active_component_id}`)
    recommendations.value = data.recommendations
    await refreshState()
  } catch (e: any) { ElMessage.error('推荐失败') }
}
function handleSupplierSelectionChange(sel: any[]) { selectedSuppliers.value = sel }
async function handleConfirmSuppliers() {
  if (!state.active_component_id || selectedSuppliers.value.length < 2) { ElMessage.warning('请至少选2家'); return }
  try { const ids = selectedSuppliers.value.map((s: any) => s.supplier.id); await apiPost('/supplier/select', { component_id: state.active_component_id, supplier_ids: ids }); await refreshState(); ElMessage.success(`已确认 ${ids.length} 家供应商`) }
  catch (e: any) { ElMessage.error('确认失败') }
}

// audit-round04: 修改已确认的供应商（回到选择中状态）
async function handleModifySuppliers() {
  if (!state.active_component_id) return
  try {
    await apiPut(`/component/${state.active_component_id}/supplier-modify`)
    await refreshState()
    // 重新加载推荐
    const data = await apiGet(`/supplier/recommend/${state.active_component_id}`)
    recommendations.value = data.recommendations
    selectedSuppliers.value = []
    ElMessage.success('供应商选择已解锁，可重新选择')
  } catch (e: any) { ElMessage.error('修改失败: ' + (e?.response?.data?.message || e?.message || '')) }
}

// audit-round04: 管理员重分派 Buyer
async function handleReassignBuyer(componentNo: string, newBuyerId: string) {
  if (mockRole.value !== 'admin') return
  try {
    await apiPut('/buyer/reassign', { component_no: componentNo, buyer_id: newBuyerId })
    await refreshState()
    ElMessage.success(`PN ${componentNo} Buyer 已更新为 ${getBuyerName(newBuyerId)}`)
  } catch (e: any) { ElMessage.error('重分派失败: ' + (e?.response?.data?.message || e?.message || '')) }
}

// audit-round04: 供应商详情
async function showSupplierDetail(supplierId: string) {
  const cid = state.active_component_id; if (!cid) return
  try {
    const data = await apiGet(`/supplier/${supplierId}/detail?component_id=${cid}`)
    supplierDetail.value = data.supplier || null
    supplierQuoteHistory.value = data.history || []
    supplierDetailVisible.value = true
  } catch (e) { supplierDetailVisible.value = true }
}

// === RFQ ===
async function handlePrepareRFQ() {
  const cid = state.active_component_id; if (!cid) { ElMessage.warning('请先选择 PN'); return }
  const sids = state.confirmed_supplier_ids[cid] || []
  if (sids.length < 2) { ElMessage.warning('请先确认供应商（>=2家）'); return }
  try {
    const data = await apiPost('/rfq/preview', { component_id: cid, supplier_ids: sids })
    rfqPreview.value = data.preview; rfqEmailPreview.value = data.email_preview
    await refreshState(); rfqModalVisible.value = true; rfqModalTab.value = 'mail_body'
  } catch (e: any) { ElMessage.error('生成RFQ失败: ' + (e?.response?.data?.message || e?.message || '')) }
}
async function handleSendRFQ() {
  const cid = state.active_component_id; if (!cid) return
  try {
    const sids = state.confirmed_supplier_ids[cid] || []
    if (sids.length === 0) { ElMessage.warning('请先确认供应商'); return }
    await apiPost('/rfq/send', { component_id: cid, supplier_ids: sids })
    await refreshState(); rfqModalVisible.value = false; ElMessage.success('RFQ 已发送（演示模式）')
  } catch (e: any) { ElMessage.error('发送失败: ' + (e?.response?.data?.message || e?.message || '')) }
}

// audit-round06: 查看已发送的RFQ（使用保存的 email_preview）
async function handleViewSentRfq() {
  const cid = state.active_component_id; if (!cid) return
  const preview = state.rfq_previews[cid]
  if (preview) {
    rfqPreview.value = preview
    // audit-round06: 直接使用 preview 中已持久化的 email_preview
    rfqEmailPreview.value = preview.email_preview || ''
    rfqModalVisible.value = true
    rfqModalTab.value = 'mail_body'
  } else {
    ElMessage.warning('暂无 RFQ 预览，请先生成')
  }
}

// audit-round05: 重新发送RFQ（sent状态下的再次发送）
async function handleResendRFQ() {
  const cid = state.active_component_id; if (!cid) return
  try {
    const sids = state.confirmed_supplier_ids[cid] || []
    if (sids.length === 0) { ElMessage.warning('请先确认供应商'); return }
    await apiPost('/rfq/send', { component_id: cid, supplier_ids: sids })
    await refreshState()
    ElMessage.success('RFQ 已重新发送（演示模式）')
  } catch (e: any) { ElMessage.error('重新发送失败: ' + (e?.response?.data?.message || e?.message || '')) }
}

// audit-round05: 添加供应商
async function handleAddSupplier() {
  ElMessage.info('添加供应商功能（demo 阶段：重新进入选择模式以调整名单）')
  if (!state.active_component_id) return
  try {
    await apiPut(`/component/${state.active_component_id}/supplier-modify`)
    await refreshState()
    const data = await apiGet(`/supplier/recommend/${state.active_component_id}`)
    recommendations.value = data.recommendations
    selectedSuppliers.value = []
  } catch (e: any) { ElMessage.error('操作失败') }
}
async function handleSendRFQFromModal() { rfqModalVisible.value = false; await handleSendRFQ() }

// === Mock 回传 (audit-round04: 区分部分/全部回传) ===
async function handleMockReply() {
  const cid = state.active_component_id; if (!cid) return
  loading.value = true
  try {
    const confirmSids = state.confirmed_supplier_ids[cid] || []
    const existingQuotes = state.supplier_quotes[cid] || {}
    const existingSids = Object.keys(existingQuotes).filter(sid => existingQuotes[sid])
    // 找出未回传的供应商，全部模拟回传
    const missingSids = confirmSids.filter((sid: string) => !existingSids.includes(sid))
    const allSids = missingSids.length > 0 ? [...existingSids, ...missingSids] : existingSids
    if (allSids.length === 0) { ElMessage.warning('无已确认供应商'); return }
    await apiPost('/supplier/mock-reply', { component_id: cid, supplier_ids: allSids })
    await refreshState()
    ElMessage.success(`模拟回传完成（${allSids.length}家）`)
  } catch (e: any) { ElMessage.error('回传失败: ' + (e?.response?.data?.message || e?.message || '')) }
  finally { loading.value = false }
}

// audit-round06: 一键全部回传（Demo 专用）
async function handleMockReplyAll() {
  loading.value = true
  try {
    await ElMessageBox.confirm(
      '该操作会将所有已发送 RFQ 的零件直接标记为全部回传，仅用于演示。是否继续？',
      '确认批量回传',
      { confirmButtonText: '继续', cancelButtonText: '取消', type: 'warning' }
    )
    const data = await apiPost('/demo/mock-reply-all')
    await refreshState()

    // audit-round07: 展示完整诊断信息（更新 + 跳过）
    let msg = data.message || `已将 ${data.total_pns_updated} 个 PN 更新为全部回传`
    if (data.skipped_pns && data.skipped_pns.length > 0) {
      const skipList = data.skipped_pns.map((s: any) => `  · ${s.component_id}: ${s.reason}`).join('\n')
      msg += '\n\n⚠ 跳过的 PN:\n' + skipList
      ElMessage.warning({ message: msg, duration: 8000, dangerouslyUseHTMLString: false })
    } else {
      ElMessage.success(msg)
    }
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error('批量回传失败: ' + (e?.response?.data?.message || e?.message || ''))
  }
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
    if (firstPn) {
      activePn.value = firstPn
      try { const fd = await apiGet(`/constraint-form/${firstPn.component_no}`); if (fd) Object.assign(constraintForm, fd) } catch (e) { /* ignore */ }
    }
    ElMessage.success(`Demo 初始化完成 | ${data.component_count} PN | ${progressDetail.completed_pns || 0}/${progressDetail.total_pns || 0} 已完成`)
  } catch (e: any) { ElMessage.error('初始化失败: ' + (e?.response?.data?.message || e?.message || '')) }
  finally { loading.value = false }
}

async function handleReset() {
  try {
    await apiPost('/state/reset')
    state.status = 'ebom_imported'; state.project = null; state.components = []; state.active_component_id = null
    rfqPreview.value = null; rfqEmailPreview.value = ''; awardSummary.value = null; comparisonBase.value = null; sourcingPreview.value = null
    recommendations.value = []; selectedSuppliers.value = []; activePn.value = null; selectedEbom.value = false; allBuyers.value = []
    sourcingConditions.value = []
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
.progress-bar-wrap { display: flex; align-items: center; gap: 8px; }
.progress-text { font-size: 11px; color: #909399; white-space: nowrap; }
</style>
