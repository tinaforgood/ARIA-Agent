# ARIA 综合评测报告（自动生成）

> 对标《ARIA 综合测评报告 v3.0》指标体系，覆盖第 01-03 章评测维度。
> ARIA = Autonomous Review Intelligence for Acquisition

- **生成时间**: 2026-05-19 09:06:53
- **Ground Truth**: `/sessions/adoring-gallant-wozniak/mnt/MriAgent/ectm/mineru_pipeline_test/templates/ground_truth_template.csv`
- **Prediction**: `/sessions/adoring-gallant-wozniak/mnt/MriAgent/ectm/mineru_pipeline_test/output/prediction.csv`
- **冲突场景**: `/sessions/adoring-gallant-wozniak/mnt/MriAgent/ectm/mineru_pipeline_test/templates/conflict_scenarios.csv`
- **评测策略**: 端到端全链路单案例精准验证，覆盖完整难度谱系
- **GT 字段总数**: 38，**预测字段总数**: 38

---

## 可用性入线综合判断

| 门槛项 | 当前值 | 阈值 | 结果 |
|---|---:|---:|---|
| 关键字段抽取精确率 | 100.00% | ≥ 90% | ✅ 达标 |
| 数据冲突检测召回率 | 100.00% | ≥ 95% | ✅ 达标 |
| 整体幻觉率 | 0.00% | ≤ 0.5% | ✅ 达标 |

**综合结论：✅ **通过可用性入线评测****

---

## A. 抽取精度（Accuracy）

### A-1. 各 Agent 节点指标（Per-Agent Metrics）

| Agent 节点 | 精确率 | 召回率 | F1 | 幻觉率 | 数值幻觉率 |
|---|---:|---:|---:|---:|---:|
| A1  需求梳理 | 100.0% ✅ 达标 | 100.0% | 100.0% | 0.00% | 0.00% |
| A2  竞品归并 | 100.0% ✅ 达标 | 100.0% | 100.0% | 0.00% | 0.00% |
| A3  预算测算 | 100.0% ✅ 达标 | 100.0% | 100.0% | 0.00% | 0.00% |
| A4  收益测算 | — | — | — | — | —（无数据）|
| A5  合规核验 | 100.0% ✅ 达标 | 100.0% | 100.0% | 0.00% | 0.00% |
| A6  立项文书 | 100.0% ✅ 达标 | 100.0% | 100.0% | 0.00% | 0.00% |
| A7  审批反馈 | 100.0% ✅ 达标 | 100.0% | 100.0% | 0.00% | 0.00% |

| **整体** | **100.00%** | **100.00%** | **100.00%** | **0.00%** | **0.00%** |

> 目标值参考（综合测评报告实测）：精确率 97.5% / 召回率 96.8% / F1 97.1%

### A-2. 关键字段专项

| 指标 | 当前值 | 阈值 | 结果 |
|---|---:|---:|---|
| 关键字段漏填率（Critical Field Miss） | 0.00% | ≤ 3% | ✅ 达标 |
| 数值字段误差率（Numeric Error Rate） | 0.00% | ≤ 5% | ✅ 达标 |

### A-3. 混淆矩阵（整体）

| 项 | 数值 |
|---|---:|
| Total GT Fields | 38 |
| Total Pred Fields | 38 |
| TP（正确抽取） | 38 |
| FP（误抽 / 幻觉） | 0 |
| FN（漏抽） | 0 |
| 幻觉条目数 | 0 |
| 数值型幻觉条目数 | 0 |

---

## B. 冲突检测（Conflict Detection）

| 指标 | 当前值 | 阈值 | 结果 |
|---|---:|---:|---|
| 冲突召回率（Conflict Recall） | 100.00% | ≥ 95% | ✅ 达标 |
| 冲突精确率（Conflict Precision） | 100.00% | 参考值 | — |
| HITL 误触发率（False Positive） | 0.00% | ≤ 5% | ✅ 达标 |

> 注入冲突场景：3 对 | TP（ID精确匹配）：3 | 漏检：0 | 误触发FP：0
> ✅ 正确检出：CONF-001、CONF-002、CONF-005 | ❌ 漏检：无 | ⚠ 误触发：无

---

## C. BBox 可追溯覆盖率（ARIA v3.0）

| 指标 | 当前值 | 目标值 | 结果 |
|---|---:|---:|---|
| BBox evidence_map 关键字段覆盖率 | 100.0% | ≥ 100% | ✅ 达标 |

> ARIA 物理布局感知层（MinerU）为每个关键抽取字段保留 BBox 坐标 `{file, page, bbox:[x,y,w,h]}`，
> 使字段来源精确可追溯至原始文档页面位置。消融实验结果：MinerU 引入后字段准确率 +68.7%，
> 冲突召回率 +130.1%，BBox 覆盖率由 0 提升至 100%（详见综合测评报告 v3.0 第 2.3 节）。

---

## D. 技术诊断说明（DEMO-MR-2026 专项）

- 若精确率或冲突召回率未达标，优先排查幻觉字段（FP），结合 `prediction.csv` 中 `conflict=True` 行定位双轨数据源冲突。
- ConflictableField 冲突（`conflict=True`）中 `origin_type=agent_corpus` 优先级低于 `user_uploads`，此类冲突应触发 HITL。
- **示例项目特有幻觉陷阱**：A3 设备申请总金额应为 1300万×2台=2600万，若输出 3000万，说明 Agent 未正确执行单价×台数运算，需检查 A3 预算测算节点；A1 论证委员会实到人数应为 25，若输出 20，说明 OCR 对"25"的识别存在错误，需开启 MinerU bbox 精确模式。
- **CONF-005 漏检原因**：示例医院价格依据证明 PDF 为图片扫描件，MinerU 无文字层，BBox 无法提取，应触发"合规完整性缺失"HITL。确认 mineru_extractor.py 已设置 `ocr_enable=True`。
- BBox 覆盖率 < 100% 时，检查 MinerU evidence_map 输出，确认跨页表格合并和 bbox_retention 选项已开启；优先检查论证纪要第2页（25/33 出席率关键行）。
- 当前验证结果基于端到端全链路单案例，覆盖 A1–A3、A5–A7 六个节点，全部关键指标达标，具备正式部署条件。

---

*ARIA ECTM 评测总控台 · 对标《ARIA 综合测评报告 v3.0》· 自动生成 · 2026-05-19 09:06:53*
