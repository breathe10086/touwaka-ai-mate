import logger from '../../../lib/logger.js';

export const availableOutputs = [
  { key: 'ocr_task_id', label: 'OCR任务ID', type: 'string' },
];

export default {
  availableOutputs,
  async process(context) {
    const { record, files, services } = context;
    const file = files[0];

    if (!file || !file.attachment) {
      logger.error(`[invoice-ocr-submit] Record ${record.id}: No file`);
      return { success: false, error: '未找到文件' };
    }

    const fileName = file.attachment.file_name;
    const filePath = file.attachment.file_path;

    logger.info(`[invoice-ocr-submit] Record ${record.id}: ${fileName}`);

    try {
      const fs = await import('fs/promises');
      const buffer = await fs.readFile(filePath);
      const base64 = buffer.toString('base64');

      logger.info(`[invoice-ocr-submit] Record ${record.id}: 提交markitdown OCR (${(buffer.length / 1024).toFixed(1)}KB)`);

      const mcpResult = await services.callMcp('markitdown', 'submit_conversion_task', {
        content: base64,
        filename: fileName,
      });

      if (!mcpResult || !mcpResult.task_id) {
        logger.error(`[invoice-ocr-submit] Record ${record.id}: markitdown 未返回task_id: ${JSON.stringify(mcpResult)}`);
        return { success: false, error: 'OCR提交失败：未获取任务ID' };
      }

      logger.info(`[invoice-ocr-submit] Record ${record.id}: task_id=${mcpResult.task_id}`);
      return {
        success: true,
        data: {
          _ocr_task_id: mcpResult.task_id,
        },
      };
    } catch (e) {
      logger.error(`[invoice-ocr-submit] Record ${record.id}: 提交异常 - ${e.message}`);
      return { success: false, error: `OCR提交异常: ${e.message}` };
    }
  },
};
