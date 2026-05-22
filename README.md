# ARIA — 医疗设备采购立项审批智能体

> **ARIA** (Approval & Review Intelligence Agent) 是一套面向医疗机构的 AI 自动化审批辅助系统。基于 MinerU 文档解析引擎，通过"文档摄入 → 7-Agent 并行审批"两阶段流水线，自动完成立项申请材料的结构化抽取、合理性评估与立项文书生成。

- 🌐 **API 服务**：[http://120.55.247.187:8000/docs](http://120.55.247.187:8000/docs)
- 🖥️ **前端演示**：[http://120.55.247.187/mriagent/](http://120.55.247.187/mriagent/)

---

## 目录结构

```
ARIA-Agent/
├── mr_approval_agent/          # 核心后端：Agent 流水线 + REST API
│   ├── api_server.py           # FastAPI 主服务入口
│   ├── agent_ingest.py         # 阶段一：文档摄入与结构化解析
│   ├── agent_approval.py       # 阶段二：7-Agent 审批流水线
│   ├── word_export.py          # 立项文书 Word 导出模块
│   ├── server_preflight.py     # 启动前环境自检
│   ├── setup_demo_data.py      # 演示数据初始化脚本
│   ├── config/
│   │   └── agent_config.json   # Agent 参数与模型配置
│   ├── datasource/             # 知识库 / 语料文件
│   ├── cases/                  # 立项案例数据（运行时生成）
│   ├── outputs/                # 流水线输出结果
│   ├── templates/              # 文书导出模板
│   ├── assets/                 # 静态资源
│   ├── docs/                   # 模块内部文档
│   ├── tests/                  # 单元 & 集成测试
│   ├── requirements.txt        # Python 依赖
│   ├── setup_env.sh            # 环境初始化脚本
│   ├── AgentDeploy.sh          # 一键部署脚本
│   ├── README.md               # 模块说明
│   └── README_RUN.md           # 快速启动指南
│
├── ectm/                       # 评测框架（Evaluation & Test Module）
│   ├── mineru_pipeline_test/   # MinerU 解析流水线端到端测试
│   │   ├── agent_api_client.py # 评委评测入口（生成 prediction.csv）
│   │   ├── mineru_extractor.py # MinerU 字段抽取封装
│   │   └── evaluation_report.py# 评测报告生成
│   ├── dataset_test/           # 数据集质量验证
│   ├── latency_test/           # 接口延迟基准测试
│   ├── hitl_trigger_test/      # 人机协同触发机制测试
│   ├── cohens_kappa_test/      # 标注一致性（Cohen's Kappa）评估
│   ├── reports/                # 历次评测报告归档
│   ├── test_api.py             # API 功能冒烟测试
│   ├── test_api_report.py      # API 测试报告生成
│   ├── test_env.py             # 环境依赖检查
│   └── requirements.txt        # 评测模块 Python 依赖
│
├── web-workstation/            # 前端交互界面（React + TypeScript + Vite）
│   ├── src/
│   │   ├── pages/              # 页面级组件（案例列表、审批详情等）
│   │   ├── components/         # 通用 UI 组件
│   │   ├── lib/                # 工具函数 / API 请求封装
│   │   └── data/               # 前端静态数据 / Mock
│   ├── public/                 # 静态资源
│   ├── dist/                   # 构建产物（部署用）
│   ├── index.html              # HTML 入口
│   ├── vite.config.ts          # Vite 构建配置
│   ├── package.json            # 前端依赖
│   ├── deploy.sh               # 前端部署脚本
│   └── README.md               # 前端模块说明
│
├── 测试日志集/                  # 历次完整测试日志与评测报告
│   ├── SHA6PH_运行日志_*.jsonl  # Agent 运行原始日志（JSONL 格式）
│   ├── SHA6PH_运行日志_*.md     # 可读版运行日志
│   ├── api_test_report.html     # API 测试 HTML 报告
│   ├── ectm_evaluation_report*.md  # 综合评测报告（含各案例）
│   ├── ectm_kappa_report.md     # 标注一致性报告
│   ├── ectm_latency_report.md   # 延迟测试报告
│   └── ectm_hitl_trigger_report.md # 人机协同触发报告
│
└── ARIA_API.md                 # REST API 完整接口文档
```

---

## 快速开始

### 1. 启动后端服务

```bash
cd mr_approval_agent
bash setup_env.sh        # 初始化环境（首次运行）
bash AgentDeploy.sh      # 启动 API 服务（默认端口 8000）
```

### 2. 验证服务状态

```bash
curl http://localhost:8000/health
# 预期返回：{"status":"ok"}
```

### 3. 访问交互式文档

浏览器打开 [http://localhost:8000/docs](http://localhost:8000/docs)，可在线调试全部接口。

### 4. 启动前端（可选）

```bash
cd web-workstation
npm install && npm run dev
```

---

## 系统架构

```
用户上传材料
     │
     ▼
┌─────────────┐     ┌──────────────────────────┐
│ agent_ingest │────▶│  7-Agent 审批流水线        │
│ 文档摄入解析  │     │  （合理性 / 合规 / 预算…） │
└─────────────┘     └──────────┬───────────────┘
                               │
                    ┌──────────▼───────────┐
                    │   立项文书生成 / 归档   │
                    └──────────────────────┘
```

**Case 状态流转**：`created → uploading → ready → ingesting → processing → done`

---

## 评委评测入口

组委会通过以下方式进行能力评测：

```bash
# 自动调用 API 并生成 prediction.csv
cd ectm/mineru_pipeline_test
python agent_api_client.py --case_id <案例ID>
```

或直接调用接口：

```
GET http://120.55.247.187:8000/api/snapshot?case_id=<案例ID>
```

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 文档解析 | MinerU |
| 后端框架 | FastAPI + uvicorn |
| Agent 编排 | 自研 7-Agent 流水线 |
| 前端 | React 18 + TypeScript + Vite |
| 文书导出 | python-docx |
| 评测框架 | 自研 ECTM（含 Kappa、延迟、HITL 测试） |
