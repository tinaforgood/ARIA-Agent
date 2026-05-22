# ARIA ECTM — 医疗设备立项智能体评测总控台

> **Evaluation & Control Tower for ARIA**  
> ARIA = Autonomous Review Intelligence for Acquisition  
> 将"原始采购文档 → MinerU 物理布局感知解析 → A1–A7 Agent 抽取 → 指标评估 → 标注一致性 → 数据底盘盘点"  
> 整条链路工程化、可追溯、可复核，达到《ARIA 综合测评报告 v2.0》所述的工业级交付标准。

---

## 目录结构

```text
ectm/
├── README.md
├── requirements.txt
├── .gitignore
├── reports/                          # 统一输出停机坪（最终报告汇总）
├── mineru_pipeline_test/             # 抽取效果主战场
│   ├── mineru_extractor.py           # Step 1：MinerU 物理布局感知层封装（含 BBox evidence_map）
│   ├── agent_api_client.py           # Step 2：ARIA A1–A7 流水线接口（含 ConflictableField）
│   ├── evaluation_report.py          # Step 3：综合评测报告生成器（含 BBox 覆盖率指标）
│   ├── raw/                          # 原始脱敏采购文档（不入库）
│   ├── result/                       # MinerU 解析产物（Markdown + evidence_map.json）
│   ├── output/                       # Agent 预测结果（prediction.csv / conflict_prediction.csv）
│   ├── report/                       # 评测报告（Markdown）
│   └── templates/
│       ├── ground_truth_template.csv # 黄金标准答案（MRI-038 示例，A1–A7 节点格式）
│       └── conflict_scenarios.csv    # 注入冲突场景（含 origin_type 双轨标注）
├── cohens_kappa_test/                # 标注质量守门员
│   └── kappa_calculator.py
├── dataset_test/                     # 测试资产底盘盘点器
│   ├── dataset_inventory_check.py
│   ├── ground_truth_master_mock.csv  # mock GT（38字段，DEMO-MR-2026）
│   ├── raw_data/                     # 脱敏采购文档存放区（不入库）
│   └── report/
│       └── dataset_inventory_report.md
├── hitl_trigger_test/                # HITL 触发规则验证（§6.2）
│   ├── hitl_trigger_test.py          # L1/L2/L3 三层规则验证（17用例，100%通过）
│   ├── test_cases.json               # 测试用例（含 CONF-001~005/BUG-002 映射）
│   └── report/
│       └── hitl_trigger_report.md
└── latency_test/                     # 延迟与稳定性测试（§6.3）
    ├── latency_test.py               # SLA 验证（6项全通过）
    ├── execution_log.json            # 50次稳定性测试执行日志（基于六院真实数据）
    └── report/
        └── latency_report.md
```

---

## ARIA 核心架构（v2.0）

ECTM 评测对象是 ARIA 三大核心技术创新，测评指标直接对应创新点：

### 创新一：物理布局感知解析引擎
MinerU 保留 BBox 坐标（`{file, page, bbox:[x,y,w,h]}`），构建 `evidence_map`，
实现字段级可追溯。消融实验：字段准确率 +68.7%，冲突召回率 +130.1%，BBox 覆盖率 0→100%。

**ECTM 评测点**：`mineru_extractor.py` 输出 `evidence_map.json`；`evaluation_report.py` 计算 BBox 可追溯覆盖率（目标 100%）。

### 创新二：单脑多态（Single-Brain, Multi-Role）
单一 `qwen3-max` 推理核通过 LangGraph 状态图驱动 **8 个节点**（A1–A7 七个业务节点 + 合理性判定 Gate），各节点以不同 System Prompt 区分角色，
Temperature 固定 0.10，输出确定性 ≥98%。

**完整节点序列（8节点）：**
```
node_init → A1需求梳理 → [合理性判定Gate] → A2竞品归并 → A3预算测算 → A4收益测算 → A5合规核验 → A6文书生成 → A7审批反馈
```

**各节点职责：**

| 节点 | 代码名称 | 职责 |
|---|---|---|
| A1 需求梳理 | `node_a1_requirements` | 解析临床申请单、历史基线，提取设备需求和运营数据 |
| **合理性判定Gate** | **`node_rationality_gate`** | **四维评估：工作负荷/候检时间/阳性率/设备成新率，输出 verdict（pass/conditional/reject/exempt_renewal）** |
| A2 竞品归并 | `node_a2_competitor` | 汇总多家厂商报价和技术参数，构建竞品矩阵 |
| A3 预算测算 | `node_a3_budget` | 计算 TCO（5年）：裸机 + 改造 + 液氦 + 维保 |
| A4 收益测算 | `node_a4_revenue` | 基于历史基线推算年营收和静态回收期（ROI） |
| A5 合规核验 | `node_a5_compliance` | 验证注册证/许可证有效性，检测跨文档数据冲突 |
| A6 立项文书 | `node_a6_document` | 生成标准立项申报材料（读取 rationality_result 写入建议书） |
| A7 审批反馈 | `node_a7_approval` | 汇总审批决策，输出最终意见 |

**合理性判定Gate 四维阈值（基准：2025年四季度上海市级医院综合绩效简报第71期）：**

| 维度 | 绿灯（通过） | 黄灯（条件通过） | 红灯/特殊 |
|---|---|---|---|
| 工作负荷（饱和度） | ≥ 90% | ≥ 85% | < 85% |
| 候检时间（收费→检查） | > 7天 | > 5.5天 | ≤ 5.5天 |
| 检查阳性率 | ≥ 70% | ≥ 60% | < 60% → 强整改（reject） |
| 设备成新率 | — | — | ≤ 30% → 更新豁免（exempt_renewal） |

**ECTM 评测点**：`agent_api_client.py` 中 8 个节点名与后端 LangGraph 节点严格对应，确保指标可归因；`rationality_result` 注入 state 后由 A6 读取并写入立项建议书。

### 创新三：持久化状态图 SSOT + 幂等检查点
`project_snapshot.json` 作为单一事实来源（SSOT），LangGraph 定向状态图 + 幂等检查点，
50 次稳定性测试 0 次崩溃，一致性 ≥98%。

**数据双轨优先级规则：**
- `user_uploads`（用户上传文件，权威优先，高优先级）
- `agent_corpus`（静态知识库，历史参考，低优先级）

冲突场景：`charge_per_exam` 460元（user_uploads/2026申报表）vs 430元（agent_corpus/2022历史基线），8年累计差异 288 万元，触发 HITL。

**HITL 触发四类条件：**
1. 数据一致性冲突（ConflictableField `conflict: true`）
2. 合规完整性缺失（资质文件未上传）
3. 低置信度输出（置信度 < 0.85）
4. 合理性Gate判定（`verdict = reject` → conflict_type: 合理性否决；`verdict = conditional` → conflict_type: 合理性条件通过）

**ECTM 评测点**：`conflict_scenarios.csv` 含 `origin_type_A/B` 列，区分双轨来源；`evaluation_report.py` 计算冲突召回率。

---

## 三大模块定位

### `mineru_pipeline_test/` — 抽取效果主战场

"模型抽得准不准、有没有幻觉、来源能不能追溯"的核心闭环。

先由 MinerU 对 PDF 报价单、Word 申请表、JPG 扫描证书等进行物理拆解，同步输出 `evidence_map.json`（BBox 坐标索引），
再由 8 节点 Agent 流水线（需求梳理→**合理性判定Gate**→竞品归并→预算测算→收益测算→合规核验→立项文书→审批反馈）执行字段抽取，
最终对标黄金测试集，计算精确率/召回率/F1/幻觉率/冲突召回率/BBox 覆盖率等全套评测指标。

### `cohens_kappa_test/` — 标注质量守门员

先保证 Ground Truth 靠谱，评测才靠谱。  
通过双专家盲标 + Cohen's Kappa 计算，一旦分歧高（κ < 0.80）即导出仲裁清单，
避免拿低质量 GT 去评模型，造成"评测数字好看但结论不可信"。

### `dataset_test/` — 测试资产底盘盘点器

用来证明"不是在小样本上刷分"。  
统计8类文档覆盖规模、有效 GT 字段总数、立项案例数，
目标口径：45个项目 / 312份文档 / 2864个GT字段。

---

## 关键指标口径

对标《ARIA 综合测评报告 v2.0》第 01-03 章：

### 可用性入线门槛（四项全部达标方可通过）

| 指标 | 阈值 | 综合测评报告实测值 |
|---|---|---|
| 关键字段抽取精确率 | ≥ 90% | 94.8% ~ 99.1%（各Agent） |
| 数据冲突检测召回率 | ≥ 95% | 98.3% |
| 幻觉率 | ≤ 0.5% | 0.0% ~ 0.4%（各Agent） |
| BBox 可追溯覆盖率 | = 100% | 100%（MinerU 消融实验验证） |

### 抽取精度指标（A 维度）

| 指标 | 阈值 |
|---|---|
| 字段级精确率 | ≥ 92% |
| 字段级召回率 | ≥ 90% |
| 关键字段漏填率 | ≤ 3% |
| 数值字段误差率（±1% 容忍） | ≤ 5% |

### 冲突检测指标（B 维度）

| 指标 | 阈值 |
|---|---|
| 冲突召回率 | ≥ 95% |
| HITL 误触发率 | ≤ 5% |

### BBox 可追溯指标（C 维度，v2.0 新增）

| 指标 | 阈值 |
|---|---|
| BBox evidence_map 关键字段覆盖率 | = 100% |

### 标注一致性（cohens_kappa_test）

| 指标 | 阈值 | 报告实测 |
|---|---|---|
| Cohen's κ | ≥ 0.80 | 0.927 |

---

## 快速启动

### 1. 安装依赖

```bash
cd MriAgent/ectm
pip install -r requirements.txt
```

### 2. 先盘点资产底盘

```bash
cd dataset_test
python dataset_inventory_check.py
```

确认文档规模和 GT 字段数达到目标口径后，再进行评测。

### 3. 做抽取链路评测（三步流水线）

```bash
cd ../mineru_pipeline_test

# Step 1：MinerU 物理布局感知解析（默认 Mock 模式，输出 Markdown + evidence_map.json）
python mineru_extractor.py

# Step 2：ARIA A1–A7 流水线（默认 Mock 模式，含 ConflictableField 冲突注入）
python agent_api_client.py

# Step 3：生成综合评测报告（含 BBox 覆盖率指标）
python evaluation_report.py
```

报告自动生成到 `report/evaluation_report.md`。

**对接真实后端（ARIA api_server.py）：**

```bash
# 先启动后端
cd MriAgent/mr_approval_agent
uvicorn api_server:app --reload --port 8000

# 再以真实模式运行评测
cd ../ectm/mineru_pipeline_test
ARIA_API_URL=http://localhost:8000 USE_MOCK=false python agent_api_client.py
python evaluation_report.py
```

### 4. 做标注一致性校验

```bash
cd ../cohens_kappa_test
# 将 expert_A.csv / expert_B.csv 放在本目录下（列：项目ID, 字段名称, 标注值）
python kappa_calculator.py
```

---

## 交付建议

- 评审前将所有关键产物汇总到 `reports/`，形成"一页导航 + 多份附件"的交付包。
- 对外公布指标前，必须同时满足：数据底盘达标 + Kappa 达标 + 抽取指标达标 + BBox 覆盖率达标。
- 扩大到完整 45 个项目 / 312 份文档后，再宣称正式评测成绩；当前 Mock 样本仅供联调定位使用。

---

## Mock 数据说明（开发调试阶段）

`agent_api_client.py` 的 Mock 数据基于《ARIA 综合测评报告 v2.0》第 5.1 节 MRI-038 项目真实执行日志构造，
故意注入以下"幻觉陷阱"，用于验证 `evaluation_report.py` 的检出能力：

| 注入点 | 注入内容 | 真实GT | 目的 |
|---|---|---|---|
| A4 收益测算 · 单次收费基准 | 430 元/次（agent_corpus 低优先级） | 460 元/次（user_uploads 高优先级） | 模拟双轨数据源优先级错误，ConflictableField conflict=True |
| A3 预算测算 · TCO总额 | 1850 万 | 1805 万 | 模拟财务汇总计算错误，幻觉检出 |
| 冲突场景 CONF-005 | 漏检 | 应检出 | 模拟资质缺失漏检（低置信度 0.31） |

---

*ARIA ECTM v2.0 · 对标《ARIA 综合测评报告 v2.0》指标体系*
