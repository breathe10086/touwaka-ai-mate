# procurement-rfq-demo

采购询价独立演示原型。

## 目标

验证采购 RFQ 主链路：
`EBOM 导入 → 部件拆分 → Buyer 分派 → 约束表单 → RFQ 预览 → 供应商报价对比 → Award 评审`

## 状态

**v0.1.0** — Demo 原型阶段，非正式系统模块。

## 目录结构

```
procurement-rfq-demo/
├── manifest.json              # App 元数据
├── README.md                  # 本文件
├── demo_data/                 # 演示样例数据
│   ├── sample-ebom.json       # 示例 EBOM
│   ├── mock-supplier-quotes.json  # Mock 供应商报价
│   └── loader.js              # 数据加载器
├── domain/                    # 领域逻辑（纯 JS）
│   ├── ebom/                  # EBOM 解析与 Buyer 分派
│   │   ├── types.js
│   │   ├── parser.js
│   │   └── buyer-assignment.js
│   ├── rfq/                   # 约束表单、供应商选择、RFQ 预览
│   │   ├── constraint-form.js
│   │   ├── supplier-selection.js
│   │   └── rfq-preview.js
│   ├── quotation/             # 供应商报价结构化与标准化
│   │   ├── quote-types.js
│   │   └── normalizer.js
│   └── award/                 # 横向比较与推荐
│       └── comparison.js
├── state/                     # 轻量状态管理
│   ├── state-constants.js     # 状态常量、Buyer 规则
│   └── demo-state.js          # 状态容器（单例）
├── server/
│   └── routes.js              # API 路由
└── frontend/
    └── views/
        └── ProcurementRfqDemoView.vue  # 主视图
```

## Demo 范围

### 已实现 (P0)
- EBOM JSON 解析与 component 拆分
- 按 category 自动分派 Buyer
- 约束表单（加工方式、材质、数量、交付等）
- 供应商推荐（规则驱动）
- RFQ 预览数据组织
- 供应商报价结构化（单 supplier 单 component 单轮）
- 报价标准化（多币种归一化）
- Award comparison 横向对比
- 加权评分与可解释推荐

### 未实现 (P2 - 后置)
- 真 Excel 导出
- 邮件自动收发
- AI 邮件理解与回流
- 正式数据库持久化
- 工程变更全链路

## 快速开始

### API 方式

```bash
# 一键初始化完整 demo 链路
curl -X POST http://localhost:3000/api/apps/procurement-rfq-demo/quick-init

# 获取当前状态
curl http://localhost:3000/api/apps/procurement-rfq-demo/state
```

### 分步 API

```bash
# 1. 加载 sample EBOM
curl -X POST http://localhost:3000/api/apps/procurement-rfq-demo/ebom/load-sample

# 2. 分派 Buyer
curl -X POST http://localhost:3000/api/apps/procurement-rfq-demo/buyer/assign

# 3. 选择 component
curl -X PUT http://localhost:3000/api/apps/procurement-rfq-demo/component/ICC-3000-HSG-03/select

# 4. 推荐供应商
curl http://localhost:3000/api/apps/procurement-rfq-demo/supplier/recommend/ICC-3000-HSG-03

# 5. 加载 mock 报价
curl -X POST http://localhost:3000/api/apps/procurement-rfq-demo/quote/load-mock/ICC-3000-HSG-03

# 6. 生成 Award Summary
curl -X POST http://localhost:3000/api/apps/procurement-rfq-demo/award/generate/ICC-3000-HSG-03
```

## 设计原则

1. **Excel 只是视图形态**，不是核心对象形态——内部统一按"单 supplier、单 component、单轮报价一条记录"建模
2. **状态压缩为 5 个主阶段**，不做细碎状态
3. **字段命名全链路 snake_case**
4. **API 统一使用 ctx.success/ctx.error 响应格式**
5. **推荐逻辑可解释**，提供"为什么推荐"的说明

## 相关文档

- [审计报告](../../docs/tasks/active/task-20260629-procurement-rfq-demo-planning/audit-round01.md)
- [原始需求设计](../../docs/tasks/active/task-20260626-procurement-rfq-app/new/README.md)
- [AGENTS.md](../../AGENTS.md)
