<template>
  <div class="ocr-tool-page">
    <!-- 复制成功浮窗 -->
    <Teleport to="body">
      <div v-if="showToast" class="toast-overlay" @click="closeToast">
        <div class="toast-popup" @click.stop>
          <span class="toast-icon">✓</span>
          <span class="toast-message">复制成功</span>
          <button class="toast-close" @click="closeToast">×</button>
        </div>
      </div>
    </Teleport>

    <section class="hero">
      <div class="hero-text">
        <p class="eyebrow">OCR TOOL</p>
        <h1>把图片里的文字提出来</h1>
        <p class="subhead">仅支持图片，不保存原图。上传后自动识别，结果可复制。</p>
      </div>
      <div class="hero-orb" aria-hidden="true"></div>
    </section>

    <section class="workspace">
      <div class="panel upload-panel">
        <header>
          <h2>上传图片</h2>
          <p>支持 JPG / PNG / JPEG / WEBP</p>
        </header>

        <label class="dropzone" :class="{ filled: !!previewUrl }">
          <input type="file" accept="image/*" @change="handleFileChange" />
          <div v-if="!previewUrl" class="placeholder">
            <span class="icon">🖼️</span>
            <div>
              <strong>选择图片</strong>
              <p>或拖拽到此处</p>
            </div>
          </div>
          <img v-else :src="previewUrl" alt="preview" />
        </label>

        <div class="field">
          <label>输出格式</label>
          <select v-model="selectedPresetId" class="preset-select">
            <option v-for="preset in promptPresets" :key="preset.id" :value="preset.id">
              {{ preset.label }}
            </option>
          </select>
        </div>

        <div class="actions">
          <button class="btn primary" :disabled="isSubmitting || !previewUrl" @click="submit">
            {{ isSubmitting ? '提交中...' : '开始识别' }}
          </button>
          <button class="btn ghost" :disabled="!previewUrl && !taskId" @click="reset">
            重置
          </button>
        </div>
      </div>

      <div class="panel result-panel">
        <header>
          <h2>识别结果</h2>
          <p v-if="taskId">任务 ID: <span class="mono">{{ taskId }}</span></p>
        </header>

        <div class="status-bar">
          <span class="status" :class="statusClass">{{ statusLabel }}</span>
          <div class="copy-buttons">
            <button v-if="result" class="btn link" @click="copyAsExcel">复制为表格</button>
            <button v-if="result" class="btn link" @click="copyResult">复制文本</button>
          </div>
        </div>

        <div v-if="error" class="error-box">
          {{ error }}
        </div>

        <textarea
          class="result-box"
          :value="result"
          placeholder="识别结果会显示在这里..."
          readonly
        ></textarea>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount, onMounted } from 'vue'
import { analyzeOcrImage, getOcrStatus, getOcrPromptPresets, type OcrPromptPreset } from '@/api/ocr-tool'

const previewUrl = ref('')
const taskId = ref('')
const status = ref<'idle' | 'pending' | 'processing' | 'done' | 'error'>('idle')
const result = ref('')
const promptPresets = ref<OcrPromptPreset[]>([])
const selectedPresetId = ref('markdown')
const error = ref('')
const isSubmitting = ref(false)
const showToast = ref(false)

let pollTimer: number | null = null
let toastTimer: number | null = null

function showCopySuccess() {
  showToast.value = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    showToast.value = false
  }, 1500)
}

function closeToast() {
  showToast.value = false
  if (toastTimer) {
    clearTimeout(toastTimer)
    toastTimer = null
  }
}

const statusLabel = computed(() => {
  switch (status.value) {
    case 'pending': return '排队中'
    case 'processing': return '识别中'
    case 'done': return '已完成'
    case 'error': return '失败'
    default: return '等待上传'
  }
})

const statusClass = computed(() => {
  return {
    pending: status.value === 'pending',
    processing: status.value === 'processing',
    done: status.value === 'done',
    error: status.value === 'error',
  }
})

const MAX_IMAGE_SIZE = 1 * 1024 * 1024 // 1MB，避免超过nginx限制

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    ElMessage.error('请选择图片文件')
    return
  }

  // Check file size
  if (file.size > MAX_IMAGE_SIZE) {
    ElMessage.error('图片大小不能超过 1MB，请压缩后重试')
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    previewUrl.value = String(reader.result || '')
    result.value = ''
    error.value = ''
    status.value = 'idle'
    taskId.value = ''
  }
  reader.readAsDataURL(file)
}

async function submit() {
  if (!previewUrl.value) return
  isSubmitting.value = true
  error.value = ''
  result.value = ''

  // Get the prompt from selected preset
  const selectedPreset = promptPresets.value.find(p => p.id === selectedPresetId.value)
  const promptText = selectedPreset?.prompt || ''

  try {
    const res = await analyzeOcrImage(previewUrl.value, promptText)
    taskId.value = res.task_id
    status.value = res.status as typeof status.value
    startPolling()
  } catch (err: any) {
    error.value = err?.message || '提交失败'
    status.value = 'error'
  } finally {
    isSubmitting.value = false
  }
}

function startPolling() {
  stopPolling()
  pollTimer = window.setInterval(async () => {
    if (!taskId.value) return
    try {
      const res = await getOcrStatus(taskId.value)
      status.value = res.status as typeof status.value
      result.value = res.result || ''
      error.value = res.error || ''
      if (status.value === 'done' || status.value === 'error') {
        stopPolling()
      }
    } catch (err: any) {
      error.value = err?.message || '状态查询失败'
      status.value = 'error'
      stopPolling()
    }
  }, 2000)
}

function stopPolling() {
  if (pollTimer) {
    window.clearInterval(pollTimer)
    pollTimer = null
  }
}

function reset() {
  previewUrl.value = ''
  taskId.value = ''
  status.value = 'idle'
  result.value = ''
  error.value = ''
  selectedPresetId.value = 'markdown'
  stopPolling()
}

async function copyResult() {
  try {
    await navigator.clipboard.writeText(result.value)
  } catch {
    // 复制可能成功但抛出异常，忽略错误
  }
  showCopySuccess()
}

async function copyAsExcel() {
  try {
    // Convert CSV to tab-separated for Excel
    const tabSeparated = result.value.replace(/,/g, '\t')
    await navigator.clipboard.writeText(tabSeparated)
  } catch {
    // 复制可能成功但抛出异常，忽略错误
  }
  showCopySuccess()
}

onBeforeUnmount(() => stopPolling())

onMounted(async () => {
  try {
    const res = await getOcrPromptPresets()
    promptPresets.value = res.presets || []
    selectedPresetId.value = res.defaultId || 'markdown'
  } catch (err) {
    console.error('Failed to load prompt presets:', err)
  }
})
</script>

<style scoped>
.ocr-tool-page {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
  font-family: "Space Grotesk", "Noto Sans SC", sans-serif;
  color: #1b1f2a;
}

.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 28px;
  border-radius: 20px;
  background: radial-gradient(120% 120% at 0% 0%, #fff7e6 0%, #f7f1ff 35%, #eef6ff 100%);
  position: relative;
  overflow: hidden;
}

.hero-text h1 {
  margin: 6px 0 12px;
  font-size: 32px;
  letter-spacing: -0.5px;
}

.eyebrow {
  font-size: 12px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: #7d6a5a;
}

.subhead {
  margin: 0;
  color: #4b566b;
}

.hero-orb {
  width: 140px;
  height: 140px;
  border-radius: 50%;
  background: conic-gradient(from 180deg, #ffcf6f, #f3a6ff, #6fd3ff, #ffcf6f);
  filter: blur(0.2px);
  opacity: 0.8;
}

.workspace {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-top: 20px;
  min-height: 600px;
}

.panel {
  background: #ffffff;
  border-radius: 18px;
  padding: 20px;
  box-shadow: 0 10px 30px rgba(18, 24, 38, 0.08);
  animation: fadeIn 0.4s ease;
  display: flex;
  flex-direction: column;
}

.panel header h2 {
  margin: 0;
  font-size: 18px;
}

.panel header p {
  margin: 6px 0 0;
  color: #68738b;
  font-size: 13px;
}

.dropzone {
  margin-top: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed #cdd7ef;
  border-radius: 16px;
  min-height: 350px;
  background: #f7f9ff;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

.dropzone input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.dropzone img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #fff;
}

.placeholder {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #4b566b;
}

.placeholder .icon {
  font-size: 28px;
}

.field {
  margin-top: 16px;
}

.field label {
  display: block;
  font-size: 13px;
  color: #5a647a;
  margin-bottom: 6px;
}

.field textarea {
  width: 100%;
  border-radius: 12px;
  border: 1px solid #d9e1f7;
  padding: 10px 12px;
  font-family: inherit;
  resize: vertical;
  background: #fbfcff;
}

.preset-select {
  width: 100%;
  border-radius: 12px;
  border: 1px solid #d9e1f7;
  padding: 10px 12px;
  font-family: inherit;
  font-size: 14px;
  background: #fbfcff;
  cursor: pointer;
}

.preset-select:focus {
  outline: none;
  border-color: #1f6bff;
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}

.btn {
  border: none;
  border-radius: 999px;
  padding: 10px 18px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}

.btn.primary {
  background: #1f6bff;
  color: #fff;
}

.btn.ghost {
  background: #eef3ff;
  color: #3055b5;
}

.btn.link {
  background: transparent;
  color: #1f6bff;
  padding: 0;
}

.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 16px 0 8px;
  flex-shrink: 0;
}

.copy-buttons {
  display: flex;
  gap: 12px;
}

.status {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  background: #eef3ff;
  color: #3055b5;
}

.status.done {
  background: #e6f8ef;
  color: #1d7a4a;
}

.status.error {
  background: #ffe9e9;
  color: #c43f3f;
}

.result-box {
  width: 100%;
  flex: 1;
  min-height: 350px;
  border-radius: 14px;
  border: 1px solid #e3e7f5;
  padding: 12px;
  font-family: "IBM Plex Mono", "SFMono-Regular", monospace;
  background: #fdfdff;
  resize: none;
}

.error-box {
  background: #fff2f2;
  color: #b83232;
  padding: 10px 12px;
  border-radius: 10px;
  margin-bottom: 10px;
  flex-shrink: 0;
}

.mono {
  font-family: "IBM Plex Mono", "SFMono-Regular", monospace;
}

/* 复制成功浮窗样式 */
.toast-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.toast-popup {
  background: #ffffff;
  border-radius: 12px;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  animation: toastIn 0.2s ease;
}

.toast-icon {
  color: #22c55e;
  font-size: 18px;
  font-weight: bold;
}

.toast-message {
  color: #1b1f2a;
  font-size: 15px;
  font-weight: 500;
}

.toast-close {
  background: none;
  border: none;
  color: #9ca3af;
  font-size: 20px;
  cursor: pointer;
  padding: 0 0 0 12px;
  line-height: 1;
}

.toast-close:hover {
  color: #6b7280;
}

@keyframes toastIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 720px) {
  .hero {
    flex-direction: column;
    align-items: flex-start;
  }
  .hero-orb {
    align-self: center;
  }
  .workspace {
    grid-template-columns: 1fr;
    min-height: auto;
  }
  .dropzone {
    min-height: 220px;
  }
  .result-box {
    min-height: 220px;
  }
}
</style>
