# mr_approval_agent

**医疗设备预算申报与立项数据智能体（MinerU 版）**

最小闭环场景：放射科 3.0T 超导磁共振设备预算申报与立项论证

---

## 目录结构

```
mr_approval_agent/
├── datasource/
│   ├── a_requirements/        ← 场景边界与立项基础（8 份）
│   ├── b_competitors/         ← 设备选型与竞品资料（12 份）
│   ├── c_compliance/          ← 合规与制度资料（4 份）
│   ├── d_operations/          ← 收益与运营数据（4 份）
│   ├── e_systems/             ← 系统与接口约束（待补充）
│   └── f_validation/          ← 联调校验与答辩支持（12 份）
├── config/
│   └── agent_config.json      ← 填写 API Key
├── outputs/
│   ├── ingest/                ← Stage 1 产物
│   └── approval/              ← Stage 2 产物
├── assets/fonts_pkg/          ← 中文字体
├── agent_ingest.py            ← Stage 1：文档解析 + 字段抽取
├── agent_approval.py          ← Stage 2：7 个业务 Agent + 立项建议书
├── requirements.txt
└── README.md
```

---

## 环境准备

**每次新开终端**：先按 [运行手册 `README_RUN.md`](./README_RUN.md) 执行 `source ./setup_env.sh` 并 `source ./.venv/bin/activate`。

```bash
pip install -r requirements.txt
mineru-models-download          # 首次运行，选 modelscope
```

---

## 配置文件

编辑 `config/agent_config.json`，填入：

- `qwen.api_key`：DashScope API Key（必填）
- `mineru.api_url`：留空 = 本地模式；填 `https://...` = 远程服务

---

## 运行命令

### Stage 1 — 文档解析与字段结构化

```bash
# 正式模式（MinerU OCR，推荐）
python agent_ingest.py \
  --datasource ./datasource \
  --output-root ./outputs/ingest \
  --config ./config/agent_config.json \
  --parser-mode mineru

# 快速基线模式（仅处理 xlsx，跳过 PDF）
python agent_ingest.py --parser-mode openpyxl
```

### Stage 2 — 业务 Agent 协同

```bash
python agent_approval.py \
  --snapshot   ./outputs/ingest/results/project_snapshot.json \
  --output-root ./outputs/approval \
  --config      ./config/agent_config.json
```

---

## 主要输出文件

| 文件 | 说明 |
|---|---|
| `outputs/ingest/results/project_snapshot.json` | 四类字段汇总，Stage 2 输入 |
| `outputs/approval/results/competitor_table.json` | 竞品参数对比表 |
| `outputs/approval/results/budget_summary.json` | 预算测算结果 |
| `outputs/approval/results/revenue_roi.json` | ROI / 回收期 |
| `outputs/approval/results/compliance_result.json` | 合规核验结果 |
| `outputs/approval/results/project_document.md` | **立项建议书全文** |
| `outputs/approval/results/evidence_trace.json` | 证据链清单 |
| `outputs/approval/results/task_overview.json` | 任务概览（评分汇总） |
| `outputs/*/logs/` | JSONL 运行日志 + PDF 技术报告 |

---

## 人工确认点

Stage 2 完成后，终端会打印需人工确认的项目，主要包括：

- **Agent 3**：机房改造费用（无原始数据时给出区间估算）
- **Agent 4**：收益测算假设参数（单次收费 / 年工作天数 / 医保比例）
- **Agent 6**：立项建议书内容确认

确认后可手动修改 `outputs/approval/results/` 下对应 JSON，再重新运行 Agent 6 生成最终版。

---

## 与 supercare 项目对比

| 维度 | supercare | mr_approval_agent |
|---|---|---|
| 输入 | 1 种 Excel | A–F 六类混合文件 |
| MinerU 用途 | 解析 Excel 表格 | OCR 扫描 PDF + 提取表格 |
| Agent 数量 | A0–A5 共 6 个 | 7 个业务 Agent |
| 中间产物 | 知识图谱 JSON | 竞品表 / 预算表 / ROI 表 |
| 最终输出 | 健康档案 + 图谱 PNG | 立项建议书 + 证据链 |
| 编排框架 | LangGraph | LangGraph（相同） |

复用自 supercare：`JsonlLogger` / PDF ReportLab 模式 / MinerU 调用逻辑
