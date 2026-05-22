<template>
  <div class="ocr-tool-page">
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
          <label>提示词（可选）</label>
          <textarea
            v-model="prompt"
            rows="3"
            placeholder="例如：请识别图片中的所有文字，保持原有排版。"
          ></textarea>
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
          <button v-if="result" class="btn link" @click="copyResult">复制文本</button>
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
import { ref, computed, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import { analyzeOcrImage, getOcrStatus } from '@/api/ocr-tool'

const previewUrl = ref('')
const prompt = ref('')
const taskId = ref('')
const status = ref<'idle' | 'pending' | 'processing' | 'done' | 'error'>('idle')
const result = ref('')
const error = ref('')
const isSubmitting = ref(false)

let pollTimer: number | null = null

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

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    ElMessage.error('请选择图片文件')
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

  try {
    const res = await analyzeOcrImage(previewUrl.value, prompt.value.trim() || undefined)
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
  prompt.value = ''
  taskId.value = ''
  status.value = 'idle'
  result.value = ''
  error.value = ''
  stopPolling()
}

async function copyResult() {
  try {
    await navigator.clipboard.writeText(result.value)
    ElMessage.success('已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}

onBeforeUnmount(() => stopPolling())
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
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.panel {
  background: #ffffff;
  border-radius: 18px;
  padding: 20px;
  box-shadow: 0 10px 30px rgba(18, 24, 38, 0.08);
  animation: fadeIn 0.4s ease;
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
  min-height: 220px;
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
  min-height: 320px;
  border-radius: 14px;
  border: 1px solid #e3e7f5;
  padding: 12px;
  font-family: "IBM Plex Mono", "SFMono-Regular", monospace;
  background: #fdfdff;
}

.error-box {
  background: #fff2f2;
  color: #b83232;
  padding: 10px 12px;
  border-radius: 10px;
  margin-bottom: 10px;
}

.mono {
  font-family: "IBM Plex Mono", "SFMono-Regular", monospace;
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
}
</style>
