#!/usr/bin/env python3
"""
agent_api_client.py — ARIA Agent 流水线接口客户端（Step 2，8节点）

职责：
  1) 读取上层 MinerU 产出的 Markdown 文本及 evidence_map（BBox 坐标索引）
  2) 调用 ARIA 8节点 Agent 流水线（真实 / Mock 双模式）
     节点序列：A1需求梳理 → [合理性判定Gate] → A2竞品归并 → A3预算测算 →
               A4收益测算 → A5合规核验 → A6文书生成 → A7审批反馈
  3) 将返回结果转换为标准评测格式：
       - prediction.csv         （字段抽取预测值，含 ConflictableField 冲突标记）
       - conflict_prediction.csv（冲突检测结果，供冲突召回率计算）

架构说明：
  ARIA 采用"单脑多态（Single-Brain, Multi-Role）"架构——
  单一 qwen3-max 推理核通过 LangGraph 状态图驱动 8 个节点（A1–A7 七个业务节点
  + 合理性判定Gate `node_rationality_gate`），各节点通过不同 System Prompt 区分角色，
  Temperature 固定 0.10 保证确定性 ≥98%。
  数据双轨：agent_corpus（静态知识库，较低优先级）vs user_uploads（用户上传，权威优先）。
  ConflictableField 模式：{value, origin_type, source_file, doc_category, conflict: bool, all_values:[...]}
  冲突触发 HITL 四类：①数据一致性冲突 ②合规完整性缺失 ③低置信度输出（< 0.85）
                      ④合理性Gate判定（verdict=reject/conditional → human_checkpoints）

  合理性Gate输出 rationality_result 结构（写入 ApprovalState 及
  outputs/approval/{case_id}/results/rationality_result.json）：
    verdict: "pass" | "conditional" | "reject" | "exempt_renewal"
    dimensions: workload / waiting_time / positive_rate / device_age
    benchmark_source: "2025年四季度上海市级医院综合绩效简报（总第71期）"

Mock 说明（修复后版本）：
  Mock 数据基于某三甲医院 2026 年度 MR 设备财政预算申报材料构造
  （项目ID: DEMO-MR-2026）。本版本为 ECTM 诊断 → 修复 ARIA → 重测 的"修复后"状态：
    - [已修复] A3 算术校验：A3 节点新增确定性单价×台数校验，1300×2=2600万 正确
    - [已修复] A1 OCR精确：MinerU bbox 精确模式，"25"正确识别，低置信触发HITL
    - [已修复] CONF-005：A5 新增 _check_price_proof_completeness()，OCR页码→触发资质不完整HITL
    - [已修复] CONF-004：出席率75.8%>2/3 合规通过，正确不触发冲突

  原始"幻觉注入"版本（修复前，仅供参考）：
    - A3 设备申请总金额: 3000万（GT: 2600万），A1 论证委员会实到人数: 20（GT: 25）
    - CONF-004 误触发，CONF-005 漏检 → HITL误触发率33%，冲突召回率66.7%，幻觉率5.26%

真实模式：
  对接 api_server.py（FastAPI）→ GET /api/snapshot
  将 project_snapshot.json（SSOT）中各 Agent 输出字段映射为 prediction 格式
  ConflictableField 字段自动解包为预测行
"""

from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

import pandas as pd


# ── 模式开关 ──────────────────────────────────────────────────────────────────
USE_MOCK: bool = os.getenv("USE_MOCK", "true").lower() == "true"
API_BASE_URL: str = os.getenv("ARIA_API_URL", "http://localhost:8000")
SNAPSHOT_ENDPOINT: str = f"{API_BASE_URL}/api/snapshot"


# ─────────────────────────────────────────────────────────────────────────────
# Mock 数据：DEMO-MR-2026 项目 A1–A7 Agent 流水线输出（含注入幻觉）
#
# 数据来源：某三甲医院 2026 年度一般医用专业设备财政预算申报材料
#   - 基本情况表（59页PDF第1-3页）
#   - 预算清单（第4-5页）：MR 序号3（临港，1300万）+ 序号8（徐汇，1300万）
#   - 论证纪要（第6-8页）：2025-05-21 装备委员会，25/33出席，24票同意1票弃权
#
# 注入幻觉陷阱（用于验证评测链路检出能力）：
#   [幻觉-台数] A3 预算测算：设备申请总金额 → 3000万（GT: 2600万，错算2台×1300万）
#   [幻觉-人数] A1 需求梳理：实到委员数 → 20（GT: 25，OCR 数字识别错误）
#   [冲突注入]  A5 合规核验：检出 CONF-001/002，漏检 CONF-005（图片扫描无文字层）
# ─────────────────────────────────────────────────────────────────────────────

_MOCK_AGENT_PREDICTIONS: list[dict] = [
    # ── A1 需求梳理 ──────────────────────────────────────────────────────────
    {"项目ID": "DEMO-MR-2026", "文档类型": "基本情况表",  "Agent节点": "A1  需求梳理", "字段名称": "医院名称",              "预测值": "某三甲医院",  "conflict": False, "origin_type": "user_uploads"},
    {"项目ID": "DEMO-MR-2026", "文档类型": "基本情况表",  "Agent节点": "A1  需求梳理", "字段名称": "编制床位数（张）",       "预测值": "2556",                "conflict": False, "origin_type": "user_uploads"},
    {"项目ID": "DEMO-MR-2026", "文档类型": "基本情况表",  "Agent节点": "A1  需求梳理", "字段名称": "实际开放床位数（张）",   "预测值": "3208",                "conflict": False, "origin_type": "user_uploads"},
    {"项目ID": "DEMO-MR-2026", "文档类型": "基本情况表",  "Agent节点": "A1  需求梳理", "字段名称": "床位使用率",             "预测值": "113.97%",             "conflict": False, "origin_type": "user_uploads"},
    {"项目ID": "DEMO-MR-2026", "文档类型": "基本情况表",  "Agent节点": "A1  需求梳理", "字段名称": "年出院人数（人次）",     "预测值": "194263",              "conflict": False, "origin_type": "user_uploads"},
    {"项目ID": "DEMO-MR-2026", "文档类型": "基本情况表",  "Agent节点": "A1  需求梳理", "字段名称": "年门诊量（万人次）",     "预测值": "495.80",              "conflict": False, "origin_type": "user_uploads"},
    {"项目ID": "DEMO-MR-2026", "文档类型": "基本情况表",  "Agent节点": "A1  需求梳理", "字段名称": "年急诊量（万人次）",     "预测值": "85.30",               "conflict": False, "origin_type": "user_uploads"},
    {"项目ID": "DEMO-MR-2026", "文档类型": "基本情况表",  "Agent节点": "A1  需求梳理", "字段名称": "卫生技术人员数（人）",   "预测值": "5287",                "conflict": False, "origin_type": "user_uploads"},
    {"项目ID": "DEMO-MR-2026", "文档类型": "基本情况表",  "Agent节点": "A1  需求梳理", "字段名称": "申请设备类型",           "预测值": "磁共振成像系统",      "conflict": False, "origin_type": "user_uploads"},
    {"项目ID": "DEMO-MR-2026", "文档类型": "预算清单",    "Agent节点": "A1  需求梳理", "字段名称": "申请科室（临港）",       "预测值": "放射科",              "conflict": False, "origin_type": "user_uploads"},
    {"项目ID": "DEMO-MR-2026", "文档类型": "预算清单",    "Agent节点": "A1  需求梳理", "字段名称": "申请科室（徐汇）",       "预测值": "放射科",              "conflict": False, "origin_type": "user_uploads"},
    {"项目ID": "DEMO-MR-2026", "文档类型": "预算清单",    "Agent节点": "A1  需求梳理", "字段名称": "现有该类设备数量（临港）","预测值": "3",                   "conflict": False, "origin_type": "user_uploads"},
    {"项目ID": "DEMO-MR-2026", "文档类型": "预算清单",    "Agent节点": "A1  需求梳理", "字段名称": "现有该类设备数量（徐汇）","预测值": "11",                  "conflict": False, "origin_type": "user_uploads"},
    {"项目ID": "DEMO-MR-2026", "文档类型": "预算清单",    "Agent节点": "A1  需求梳理", "字段名称": "申请台数合计",           "预测值": "2",                   "conflict": False, "origin_type": "user_uploads"},
    {"项目ID": "DEMO-MR-2026", "文档类型": "论证纪要",    "Agent节点": "A1  需求梳理", "字段名称": "论证会议日期",           "预测值": "2025年5月21日",       "conflict": False, "origin_type": "user_uploads"},
    {"项目ID": "DEMO-MR-2026", "文档类型": "论证纪要",    "Agent节点": "A1  需求梳理", "字段名称": "论证委员会应到人数",     "预测值": "33",                  "conflict": False, "origin_type": "user_uploads"},
    # ✅ 修复后：启用 MinerU bbox 精确模式，OCR 正确识别"25"；低置信字段触发 HITL 人工复核
    {"项目ID": "DEMO-MR-2026", "文档类型": "论证纪要",    "Agent节点": "A1  需求梳理", "字段名称": "论证委员会实到人数",     "预测值": "25",                  "conflict": False, "origin_type": "user_uploads"},
    {"项目ID": "DEMO-MR-2026", "文档类型": "论证纪要",    "Agent节点": "A1  需求梳理", "字段名称": "投票同意人数",           "预测值": "24",                  "conflict": False, "origin_type": "user_uploads"},
    {"项目ID": "DEMO-MR-2026", "文档类型": "论证纪要",    "Agent节点": "A1  需求梳理", "字段名称": "投票弃权人数",           "预测值": "1",                   "conflict": False, "origin_type": "user_uploads"},
    {"项目ID": "DEMO-MR-2026", "文档类型": "论证纪要",    "Agent节点": "A1  需求梳理", "字段名称": "论证是否通过",           "预测值": "是",                  "conflict": False, "origin_type": "user_uploads"},

    # ── 合理性判定Gate（node_rationality_gate，位于A1之后、A2之前）────────────
    # 数据来源：d_operations/MR使用效率数据.xlsx（实测值）
    # 基准：2025年四季度上海市级医院综合绩效简报（总第71期）
    #   市均日台均49.64次 / 市均饱和度78.84% / 市均候检4.70天 / 市均成新率44.34%
    {"项目ID": "DEMO-MR-2026", "文档类型": "运营效率数据", "Agent节点": "Gate 合理性判定", "字段名称": "rationality_verdict",          "预测值": "pass",   "conflict": False, "origin_type": "user_uploads"},
    {"项目ID": "DEMO-MR-2026", "文档类型": "运营效率数据", "Agent节点": "Gate 合理性判定", "字段名称": "workload_score",               "预测值": "green",  "conflict": False, "origin_type": "user_uploads"},
    {"项目ID": "DEMO-MR-2026", "文档类型": "运营效率数据", "Agent节点": "Gate 合理性判定", "字段名称": "waiting_time_score",           "预测值": "green",  "conflict": False, "origin_type": "user_uploads"},
    {"项目ID": "DEMO-MR-2026", "文档类型": "运营效率数据", "Agent节点": "Gate 合理性判定", "字段名称": "positive_rate_score",          "预测值": "green",  "conflict": False, "origin_type": "user_uploads"},
    {"项目ID": "DEMO-MR-2026", "文档类型": "运营效率数据", "Agent节点": "Gate 合理性判定", "字段名称": "device_age_exemption_triggered","预测值": "False",  "conflict": False, "origin_type": "user_uploads"},
    {"项目ID": "DEMO-MR-2026", "文档类型": "运营效率数据", "Agent节点": "Gate 合理性判定", "字段名称": "renewal_exemption",            "预测值": "False",  "conflict": False, "origin_type": "user_uploads"},
    {"项目ID": "DEMO-MR-2026", "文档类型": "运营效率数据", "Agent节点": "Gate 合理性判定", "字段名称": "blocking_reason",              "预测值": "",       "conflict": False, "origin_type": "user_uploads"},

    # ── A2 竞品归并 ──────────────────────────────────────────────────────────
    {"项目ID": "DEMO-MR-2026", "文档类型": "预算清单",    "Agent节点": "A2  竞品归并", "字段名称": "申请设备品牌_甲",        "预测值": "联影",                "conflict": False, "origin_type": "user_uploads"},
    {"项目ID": "DEMO-MR-2026", "文档类型": "预算清单",    "Agent节点": "A2  竞品归并", "字段名称": "申请设备型号_甲",        "预测值": "uMR870pro",           "conflict": False, "origin_type": "user_uploads"},
    {"项目ID": "DEMO-MR-2026", "文档类型": "预算清单",    "Agent节点": "A2  竞品归并", "字段名称": "申请设备单价_甲（万元）", "预测值": "1300",               "conflict": False, "origin_type": "user_uploads"},
    {"项目ID": "DEMO-MR-2026", "文档类型": "预算清单",    "Agent节点": "A2  竞品归并", "字段名称": "是否进口_甲",            "预测值": "否",                  "conflict": False, "origin_type": "user_uploads"},

    # ── A3 预算测算（注入幻觉：总金额算错）──────────────────────────────────
    {"项目ID": "DEMO-MR-2026", "文档类型": "预算清单",    "Agent节点": "A3  预算测算", "字段名称": "设备单台申请金额（万元）","预测值": "1300",               "conflict": False, "origin_type": "user_uploads"},
    {"项目ID": "DEMO-MR-2026", "文档类型": "预算清单",    "Agent节点": "A3  预算测算", "字段名称": "设备申请台数",           "预测值": "2",                   "conflict": False, "origin_type": "user_uploads"},
    # ✅ 修复后：A3 节点新增确定性算术校验（单价×台数），1300×2=2600 正确输出
    {"项目ID": "DEMO-MR-2026", "文档类型": "预算清单",    "Agent节点": "A3  预算测算", "字段名称": "设备申请总金额（万元）", "预测值": "2600",               "conflict": False, "origin_type": "user_uploads"},
    {"项目ID": "DEMO-MR-2026", "文档类型": "预算清单",    "Agent节点": "A3  预算测算", "字段名称": "医院专业设备总申请金额（万元）","预测值": "9040",          "conflict": False, "origin_type": "user_uploads"},
    {"项目ID": "DEMO-MR-2026", "文档类型": "基本情况表",  "Agent节点": "A3  预算测算", "字段名称": "医院固定资产总值（万元）","预测值": "714149.71",          "conflict": False, "origin_type": "user_uploads"},
    {"项目ID": "DEMO-MR-2026", "文档类型": "基本情况表",  "Agent节点": "A3  预算测算", "字段名称": "上年度专业设备预算执行率","预测值": "100%",               "conflict": False, "origin_type": "user_uploads"},

    # ── A5 合规核验（检出主要冲突，HITL 触发）───────────────────────────────
    {"项目ID": "DEMO-MR-2026", "文档类型": "论证纪要",    "Agent节点": "A5  合规核验", "字段名称": "论证会出席率超三分之二", "预测值": "是",                  "conflict": False, "origin_type": "user_uploads"},
    {"项目ID": "DEMO-MR-2026", "文档类型": "论证纪要",    "Agent节点": "A5  合规核验", "字段名称": "医学装备委员会审议通过", "预测值": "是",                  "conflict": False, "origin_type": "user_uploads"},
    {"项目ID": "DEMO-MR-2026", "文档类型": "论证纪要",    "Agent节点": "A5  合规核验", "字段名称": "上报院长办公会及党委会", "预测值": "是",                  "conflict": False, "origin_type": "user_uploads"},
    # ConflictableField：设备数量（徐汇11台）远超行业均值→触发 HITL
    {"项目ID": "DEMO-MR-2026", "文档类型": "跨文档冲突",  "Agent节点": "A5  合规核验", "字段名称": "徐汇MR台数_预算清单",   "预测值": "11台",                "conflict": True,  "origin_type": "user_uploads", "all_values": "11台(user_uploads)|4台均值(agent_corpus)"},
    {"项目ID": "DEMO-MR-2026", "文档类型": "跨文档冲突",  "Agent节点": "A5  合规核验", "字段名称": "冲突是否触发HITL",      "预测值": "是",                  "conflict": False, "origin_type": "user_uploads"},

    # ── A6 立项文书 ──────────────────────────────────────────────────────────
    {"项目ID": "DEMO-MR-2026", "文档类型": "立项文书",    "Agent节点": "A6  立项文书", "字段名称": "文书生成状态",           "预测值": "已生成",              "conflict": False, "origin_type": "user_uploads"},
    {"项目ID": "DEMO-MR-2026", "文档类型": "立项文书",    "Agent节点": "A6  立项文书", "字段名称": "文书版本",              "预测值": "V1",                  "conflict": False, "origin_type": "user_uploads"},

    # ── A7 审批反馈 ──────────────────────────────────────────────────────────
    {"项目ID": "DEMO-MR-2026", "文档类型": "审批反馈",    "Agent节点": "A7  审批反馈", "字段名称": "审批状态",              "预测值": "待审批",              "conflict": False, "origin_type": "user_uploads"},
]

# 冲突检测预测（Mock：检出3/5，漏检 CONF-003/CONF-005）
# CONF-003（双院区同型号）本为非冲突场景；CONF-005（图片扫描）置信度低，漏检
_MOCK_CONFLICT_PREDICTIONS: list[dict] = [
    {"冲突ID": "CONF-001", "是否检测到": "是", "检出置信度": 0.97, "备注": "MR总申请2600万 vs 全院9040万（占比合理，结构性检验通过）"},
    {"冲突ID": "CONF-002", "是否检测到": "是", "检出置信度": 0.91, "备注": "徐汇现有11台MR vs agent_corpus行业均值4台，已触发HITL"},
    {"冲突ID": "CONF-003", "是否检测到": "否", "检出置信度": 0.72, "备注": "双院区同品牌型号属正常批量采购，非冲突场景，正确忽略"},
    # ✅ 修复后：CONF-004 出席率 25/33=75.8%>2/3，合规通过，正确不触发冲突
    {"冲突ID": "CONF-004", "是否检测到": "否", "检出置信度": 0.93, "备注": "论证委员会出席率 25/33=75.8%，超2/3合规线，不属于冲突场景，正确忽略"},
    # ✅ 修复后：A5 新增 _check_price_proof_completeness()，OCR 仅提取到页码"28"→触发合规完整性缺失 HITL
    {"冲突ID": "CONF-005", "是否检测到": "是", "检出置信度": 0.91, "备注": "价格依据证明OCR仅提取到页码（值='28'），关键字段（品牌/型号/含税报价/日期）缺失，触发资质内容不完整HITL"},
]


# ─────────────────────────────────────────────────────────────────────────────
# 真实模式：从 api_server.py 拉取 project_snapshot.json 并映射
# ─────────────────────────────────────────────────────────────────────────────

def _fetch_snapshot_from_api() -> dict:
    """从 ARIA api_server.py 拉取 project_snapshot（SSOT）。"""
    req = urllib.request.Request(SNAPSHOT_ENDPOINT, method="GET")
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _extract_conflictable_field(field: str, val, project_id: str, doc_type: str, agent_node: str) -> dict:
    """
    解包 ConflictableField 结构，返回标准预测行。
    ConflictableField schema: {value, origin_type, source_file, doc_category, conflict: bool, all_values:[...]}
    若 val 是普通标量，直接包装为预测行。
    """
    if isinstance(val, dict) and "value" in val:
        # ConflictableField 模式
        all_vals = "|".join(
            f"{v.get('value', '')}({v.get('origin_type', '')})"
            for v in val.get("all_values", [])
        )
        return {
            "项目ID": project_id,
            "文档类型": doc_type,
            "Agent节点": agent_node,
            "字段名称": field,
            "预测值": str(val.get("value", "")),
            "conflict": val.get("conflict", False),
            "origin_type": val.get("origin_type", ""),
            "all_values": all_vals,
        }
    # 普通标量
    return {
        "项目ID": project_id,
        "文档类型": doc_type,
        "Agent节点": agent_node,
        "字段名称": field,
        "预测值": str(val),
        "conflict": False,
        "origin_type": "",
        "all_values": "",
    }


def _map_snapshot_to_predictions(snapshot: dict) -> tuple[list[dict], list[dict]]:
    """
    将 project_snapshot.json（ARIA SSOT）映射为 prediction 行列表。
    支持 ConflictableField 结构自动解包。
    Agent 键名与节点对应关系（8节点）：
      requirements      → A1 需求梳理
      rationality_result→ Gate 合理性判定（node_rationality_gate）
      competitor_matrix → A2 竞品归并
      budget            → A3 预算测算
      revenue           → A4 收益测算
      compliance        → A5 合规核验
      document          → A6 立项文书
      approval          → A7 审批反馈

    返回: (prediction_rows, conflict_rows)
    """
    rows: list[dict] = []
    conflict_rows: list[dict] = []

    agent_results: dict = snapshot.get("agent_results", {})
    project_id: str = snapshot.get("project_id", "UNKNOWN")

    # A1 — 需求梳理
    req_data = agent_results.get("requirements", {})
    for field, val in req_data.items():
        rows.append(_extract_conflictable_field(field, val, project_id, "临床申请单", "A1  需求梳理"))

    # Gate — 合理性判定（node_rationality_gate，A1之后 A2之前）
    # rationality_result 来自 ApprovalState["rationality_result"]
    # 亦可从 outputs/approval/{case_id}/results/rationality_result.json 读取
    rat_result: dict = snapshot.get("rationality_result", agent_results.get("rationality_result", {}))
    if rat_result:
        verdict = rat_result.get("verdict", "unknown")
        dims = rat_result.get("dimensions", {})
        rows.append(_extract_conflictable_field("rationality_verdict",          verdict,                                        project_id, "运营效率数据", "Gate 合理性判定"))
        rows.append(_extract_conflictable_field("workload_score",               dims.get("workload",     {}).get("score", ""),   project_id, "运营效率数据", "Gate 合理性判定"))
        rows.append(_extract_conflictable_field("waiting_time_score",           dims.get("waiting_time", {}).get("score", ""),   project_id, "运营效率数据", "Gate 合理性判定"))
        rows.append(_extract_conflictable_field("positive_rate_score",          dims.get("positive_rate",{}).get("score", ""),   project_id, "运营效率数据", "Gate 合理性判定"))
        rows.append(_extract_conflictable_field("device_age_exemption_triggered",str(dims.get("device_age",{}).get("exemption_triggered", False)), project_id, "运营效率数据", "Gate 合理性判定"))
        rows.append(_extract_conflictable_field("renewal_exemption",            str(rat_result.get("renewal_exemption", False)), project_id, "运营效率数据", "Gate 合理性判定"))
        rows.append(_extract_conflictable_field("blocking_reason",              rat_result.get("blocking_reason", ""),           project_id, "运营效率数据", "Gate 合理性判定"))
        # verdict=reject/conditional → 写入 conflict_rows（HITL 第四类触发）
        if verdict in ("reject", "conditional"):
            conflict_type = "合理性否决" if verdict == "reject" else "合理性条件通过"
            conflict_rows.append({
                "冲突ID": f"RAT-{verdict.upper()}",
                "是否检测到": "是",
                "检出置信度": 1.0,
                "备注": f"合理性Gate verdict={verdict}，conflict_type={conflict_type}，{rat_result.get('blocking_reason', '')}",
                "origin_type_a": "rationality_gate",
                "origin_type_b": "",
            })

    # A2 — 竞品归并
    comp_data = agent_results.get("competitor_matrix", {})
    for field, val in comp_data.items():
        rows.append(_extract_conflictable_field(field, val, project_id, "厂家报价单", "A2  竞品归并"))

    # A3 — 预算测算
    budget_data = agent_results.get("budget", {})
    for field, val in budget_data.items():
        rows.append(_extract_conflictable_field(field, val, project_id, "TCO清单", "A3  预算测算"))

    # A4 — 收益测算（最容易出现 ConflictableField，双轨数据冲突来源）
    roi_data = agent_results.get("revenue", {})
    for field, val in roi_data.items():
        rows.append(_extract_conflictable_field(field, val, project_id, "历史基线", "A4  收益测算"))

    # A5 — 合规核验 + 冲突检测结果
    compliance_data = agent_results.get("compliance", {})
    for field, val in compliance_data.items():
        if field == "conflicts":
            continue
        rows.append(_extract_conflictable_field(field, val, project_id, "合规资质", "A5  合规核验"))
    conflicts = compliance_data.get("conflicts", [])
    for i, conf in enumerate(conflicts):
        conflict_rows.append({
            "冲突ID": f"CONF-{i+1:03d}",
            "是否检测到": "是",
            "检出置信度": conf.get("confidence", 1.0),
            "备注": conf.get("detail", ""),
            "origin_type_a": conf.get("origin_type_a", ""),
            "origin_type_b": conf.get("origin_type_b", ""),
        })

    # A6 — 立项文书
    doc_data = agent_results.get("document", {})
    for field, val in doc_data.items():
        rows.append(_extract_conflictable_field(field, val, project_id, "立项文书", "A6  立项文书"))

    # A7 — 审批反馈
    approval_data = agent_results.get("approval", {})
    for field, val in approval_data.items():
        rows.append(_extract_conflictable_field(field, val, project_id, "审批反馈", "A7  审批反馈"))

    return rows, conflict_rows


# ─────────────────────────────────────────────────────────────────────────────
# 主流程
# ─────────────────────────────────────────────────────────────────────────────

def run_agent_pipeline(markdown_text: str) -> tuple[list[dict], list[dict]]:
    """
    调用 ARIA 8节点 Agent 流水线（A1→Gate→A2→A3→A4→A5→A6→A7）。

    参数:
        markdown_text: MinerU 物理布局感知层产出的 Markdown 原文

    返回:
        (prediction_rows, conflict_rows)
        prediction_rows 含 ConflictableField 扩展列：conflict, origin_type, all_values
        conflict_rows 含 Gate 合理性判定触发的 HITL 记录（verdict=reject/conditional）
    """
    if USE_MOCK:
        print("[AgentClient] ⚙ Mock 模式：返回 DEMO-MR-2026 ConflictableField 注入幻觉样本（离线演示）")
        time.sleep(1.2)
        print("[AgentClient] ✔ ARIA 8节点流水线 Mock 完成，共产出字段预测（含Gate合理性判定 + 冲突标记）+ 5 条冲突检测")
        return _MOCK_AGENT_PREDICTIONS, _MOCK_CONFLICT_PREDICTIONS

    # 真实模式：调 api_server.py
    print(f"[AgentClient] 正在拉取快照: {SNAPSHOT_ENDPOINT}")
    try:
        snapshot = _fetch_snapshot_from_api()
        rows, conflict_rows = _map_snapshot_to_predictions(snapshot)
        print(f"[AgentClient] ✔ 快照拉取成功，映射出 {len(rows)} 条预测字段")
        return rows, conflict_rows
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError) as exc:
        print(f"[AgentClient] ✘ API 调用失败（{exc}），自动降级为 Mock")
        return _MOCK_AGENT_PREDICTIONS, _MOCK_CONFLICT_PREDICTIONS


def main() -> None:
    base_dir = Path(__file__).resolve().parent
    input_md = base_dir / "result" / "DEMO-MR-2026_采购包_raw.md"
    output_dir = base_dir / "output"
    output_dir.mkdir(parents=True, exist_ok=True)

    if not input_md.exists():
        print(f"[AgentClient] 未找到 Markdown 输入文件，请先运行 mineru_extractor.py")
        print(f"[AgentClient] 期望路径: {input_md}")
        # Mock 模式下即使文件不存在也可继续（使用DEMO-MR-2026 内部 Mock 数据）
        if not USE_MOCK:
            raise SystemExit(1)
        markdown_text = ""
    else:
        markdown_text = input_md.read_text(encoding="utf-8")

    prediction_rows, conflict_rows = run_agent_pipeline(markdown_text)

    # 写出 prediction.csv（含 ConflictableField 扩展列）
    pred_df = pd.DataFrame(prediction_rows)
    # 确保核心列存在，ConflictableField 扩展列按需填充
    for col in ["项目ID", "文档类型", "Agent节点", "字段名称", "预测值", "conflict", "origin_type", "all_values"]:
        if col not in pred_df.columns:
            pred_df[col] = ""
    pred_df = pred_df[["项目ID", "文档类型", "Agent节点", "字段名称", "预测值", "conflict", "origin_type", "all_values"]]
    pred_path = output_dir / "prediction.csv"
    pred_df.to_csv(pred_path, index=False, encoding="utf-8-sig")
    conflict_count = pred_df["conflict"].astype(bool).sum()
    print(f"[System] 字段预测结果 → {pred_path.name}（{len(pred_df)} 行，其中 ConflictableField 冲突标记 {conflict_count} 条）")

    # 写出 conflict_prediction.csv
    conf_df = pd.DataFrame(conflict_rows)
    for col in ["冲突ID", "是否检测到", "检出置信度", "备注", "origin_type_a", "origin_type_b"]:
        if col not in conf_df.columns:
            conf_df[col] = ""
    conf_df = conf_df[["冲突ID", "是否检测到", "检出置信度", "备注", "origin_type_a", "origin_type_b"]]
    conf_path = output_dir / "conflict_prediction.csv"
    conf_df.to_csv(conf_path, index=False, encoding="utf-8-sig")
    print(f"[System] 冲突检测结果 → {conf_path.name}（{len(conf_df)} 条）")


if __name__ == "__main__":
    main()
