import logger from '../../../lib/logger.js';
import { callLLMWithRetry } from '../../../lib/simple-llm-client.js';
import {
  getProcessingCount,
  getNextPendingTaskIds,
  markProcessing,
  completeTask,
  failTask,
  pruneTasks,
  getTask,
} from '../../../lib/ocr-tool-store.js';

function buildMessages(prompt, imageDataUrl) {
  const content = [
    { type: 'image_url', image_url: { url: imageDataUrl } },
    { type: 'text', text: prompt },
  ];

  return [
    { role: 'system', content: 'You are an OCR assistant. Extract all visible text.' },
    { role: 'user', content },
  ];
}

async function processTask(taskId, app, context) {
  const task = getTask(taskId);
  if (!task) return { taskId, skipped: true, reason: 'missing' };

  if (!task.image_data_url) {
    failTask(taskId, 'missing_image_data');
    return { taskId, skipped: true, reason: 'missing_image_data' };
  }

  const config = typeof app?.config === 'string'
    ? JSON.parse(app.config || '{}')
    : (app?.config || {});

  const modelId = config.vlm_model_id;
  if (!modelId) {
    failTask(taskId, 'vlm_model_id_not_configured');
    return { taskId, skipped: true, reason: 'no_model' };
  }

  const modelConfig = await context.db.getModelConfig(modelId);
  if (!modelConfig) {
    failTask(taskId, 'model_not_found');
    return { taskId, skipped: true, reason: 'model_not_found' };
  }

  const prompt = task.prompt || config.vlm_prompt || '请识别图片中的所有文字内容。';
  const messages = buildMessages(prompt, task.image_data_url);

  try {
    const response = await callLLMWithRetry(modelConfig, messages, {
      temperature: config.vlm_temperature ?? 0.2,
      max_tokens: config.vlm_max_output_tokens || 4096,
      timeout: config.vlm_timeout_ms || 120000,
    });

    completeTask(taskId, response.content || '');
    return { taskId, success: true };
  } catch (err) {
    logger.error(`[ocr-tool tick] Task ${taskId} failed: ${err.message}`);
    failTask(taskId, err.message);
    return { taskId, success: false, error: err.message };
  }
}

export async function tick(context) {
  const { app } = context;

  if (!app) {
    return { skipped: true, reason: 'no_app' };
  }

  pruneTasks();

  const config = typeof app.config === 'string'
    ? JSON.parse(app.config || '{}')
    : (app.config || {});

  const maxConcurrent = Math.max(1, Number(config.max_concurrent_tasks) || 2);
  const processingCount = getProcessingCount();
  const slots = Math.max(0, maxConcurrent - processingCount);

  if (slots <= 0) {
    return { skipped: true, reason: 'no_slots' };
  }

  const taskIds = getNextPendingTaskIds(slots);
  if (taskIds.length === 0) {
    return { skipped: true, reason: 'no_pending' };
  }

  for (const taskId of taskIds) {
    markProcessing(taskId);
  }

  const results = await Promise.all(taskIds.map(taskId => processTask(taskId, app, context)));
  return { success: true, processed: results.length, results };
}

export default { tick };
