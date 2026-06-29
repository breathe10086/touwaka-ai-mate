/**
 * Demo 数据加载器
 *
 * 职责：
 * - 加载 sample-ebom.json 和 mock-supplier-quotes.json
 * - 提供便捷的 demo 初始化 API
 */
import { parseEBOMJSON } from '../domain/ebom/parser.js';
import { assignBuyers } from '../domain/ebom/buyer-assignment.js';
import { normalizeQuote } from '../domain/quotation/normalizer.js';
import demoState from '../state/demo-state.js';
import { STATUS } from '../state/state-constants.js';

/**
 * 加载 sample EBOM 并初始化项目
 * @returns {{ project, components, errors }}
 */
async function loadSampleEBOM() {
  // 在 Node.js 中使用 fs 读取，在浏览器中使用 fetch
  let data;
  if (typeof process !== 'undefined' && process.versions?.node) {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(import.meta.dirname, 'sample-ebom.json');
    data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } else {
    const resp = await fetch('/api/apps/procurement-rfq-demo/demo-data/sample-ebom');
    data = await resp.json();
  }
  return parseEBOMJSON(data);
}

/**
 * 加载 mock supplier quotes
 * @param {string} componentNo
 * @returns {SupplierQuote[]}
 */
async function loadMockQuotes(componentNo) {
  let data;
  if (typeof process !== 'undefined' && process.versions?.node) {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(import.meta.dirname, 'mock-supplier-quotes.json');
    data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } else {
    const resp = await fetch('/api/apps/procurement-rfq-demo/demo-data/mock-supplier-quotes');
    data = await resp.json();
  }
  return data[componentNo]?.quotes || [];
}

/**
 * 快速初始化完整 demo（加载 EBOM + 分派 + 加载报价 + 标准化 + 对比 + award）
 * @returns {Object} demo 结果集
 */
async function quickInitDemo() {
  // Step 1: 加载 EBOM
  const { project, components, errors } = await loadSampleEBOM();
  if (errors.length > 0) {
    return { success: false, errors, stage: 'ebom_parse' };
  }

  demoState.set_project(project);
  demoState.set_components(components);
  demoState.transition(STATUS.COMPONENTS_ASSIGNED);

  // Step 2: 分派 Buyer
  const assignedComponents = assignBuyers(components);
  demoState.set_components(assignedComponents);

  // Step 3: 选择第一个 component 作为 active
  const firstComponent = assignedComponents[0];
  demoState.set_active_component(firstComponent.component_no);

  // Step 4: 加载 mock 报价
  const quotes = await loadMockQuotes(firstComponent.component_no);
  if (quotes.length === 0) {
    // 尝试下一个 component
    for (const comp of assignedComponents.slice(1)) {
      const q = await loadMockQuotes(comp.component_no);
      if (q.length > 0) {
        demoState.set_active_component(comp.component_no);
        quotes.push(...q);
        break;
      }
    }
    if (quotes.length === 0) {
      return { success: false, errors: ['无可用的 mock 报价数据'], stage: 'load_quotes' };
    }
  }

  // Step 5: 标准化报价
  quotes.forEach(quote => {
    demoState.set_supplier_quote(firstComponent.component_no, quote.supplier_id, quote);
    const normalized = normalizeQuote(quote);
    demoState.set_normalized_quote(firstComponent.component_no, quote.supplier_id, normalized);
  });

  demoState.transition(STATUS.RFQ_PREPARED);
  demoState.transition(STATUS.QUOTES_COMPARED);

  return {
    success: true,
    project,
    components: assignedComponents,
    active_component: firstComponent,
    quotes,
    errors: [],
  };
}

/**
 * 同步初始化（Node.js 环境）
 */
function quickInitDemoSync() {
  const fs = require('fs');
  const path = require('path');

  // Step 1: 加载 EBOM
  const ebomPath = path.join(__dirname, 'sample-ebom.json');
  const ebomData = JSON.parse(fs.readFileSync(ebomPath, 'utf-8'));
  const { project, components, errors } = parseEBOMJSON(ebomData);
  if (errors.length > 0) {
    return { success: false, errors, stage: 'ebom_parse' };
  }

  demoState.set_project(project);
  demoState.set_components(components);

  // Step 2: 分派 Buyer
  const assignedComponents = assignBuyers(components);
  demoState.set_components(assignedComponents);
  demoState.transition(STATUS.COMPONENTS_ASSIGNED);

  // Step 3: 选择第一个有 mock 数据的 component
  const quotesPath = path.join(__dirname, 'mock-supplier-quotes.json');
  const quotesData = JSON.parse(fs.readFileSync(quotesPath, 'utf-8'));

  let activeComponent = null;
  let quotes = [];
  for (const comp of assignedComponents) {
    const compQuotes = quotesData[comp.component_no]?.quotes;
    if (compQuotes && compQuotes.length >= 2) {
      activeComponent = comp;
      quotes = compQuotes;
      break;
    }
  }

  if (!activeComponent) {
    return { success: false, errors: ['未找到含 >=2 家供应商 mock 报价的 component'], stage: 'load_quotes' };
  }

  demoState.set_active_component(activeComponent.component_no);

  // Step 4: 标准化报价
  quotes.forEach(quote => {
    demoState.set_supplier_quote(activeComponent.component_no, quote.supplier_id, quote);
    const normalized = normalizeQuote(quote);
    demoState.set_normalized_quote(activeComponent.component_no, quote.supplier_id, normalized);
  });

  demoState.transition(STATUS.RFQ_PREPARED);
  demoState.transition(STATUS.QUOTES_COMPARED);

  return {
    success: true,
    project,
    components: assignedComponents,
    active_component: activeComponent,
    quotes,
    errors: [],
  };
}

export {
  loadSampleEBOM,
  loadMockQuotes,
  quickInitDemo,
  quickInitDemoSync,
};
