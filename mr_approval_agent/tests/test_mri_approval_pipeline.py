#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_mri_approval_pipeline.py
=====================================
ARIA — 端到端竞赛评测测试脚本
场景：3.0T 核磁立项 Demo

覆盖评测维度
------------
  ✅ 任务与节点追踪    task_id / node / step / input‑output summary
  ✅ 证据链与模型行为  BBox 坐标元数据 / prompt_id / tool_calls 字段
  ✅ 状态机转换        running → suspended → resumed → completed + 时间戳
  ✅ 性能耗时          MinerU(模拟) / 单节点推理 / 端到端总计
  ✅ 格式规范          JSONL，评委脚本可直接 grep / jq 解析

运行方式
--------
    # 从 mr_approval_agent/ 目录执行：
    python tests/test_mri_approval_pipeline.py

    # 指定输出目录：
    python tests/test_mri_approval_pipeline.py --output-root ./outputs/test

日志输出：<output_root>/logs/competition_<task_id_short>.jsonl
结果输出：<output_root>/results/*.json
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from unittest.mock import MagicMock, patch

# ── 路径注入（从 tests/ 向上找 mr_approval_agent/）──────────────────────────
_HERE      = Path(__file__).resolve().parent
_AGENT_DIR = _HERE.parent
sys.path.insert(0, str(_AGENT_DIR))

from agent_approval import (
    AppConfig,
    ApprovalLogger,
    ApprovalState,
    node_agent1_requirements,
    node_agent2_competitor,
    node_agent3_budget,
    node_agent4_revenue,
    node_agent5_compliance,
    node_agent6_document,
    node_agent7_feedback,
    node_finalize,
    node_init,
)
from competition_logger import CompetitionLogger, make_bbox_evidence

# ═════════════════════════════════════════════════════════════════════════════
# 1. MOCK LLM 响应 — 无需真实 API Key
# ═════════════════════════════════════════════════════════════════════════════

# 每个 Agent 节点的预设 JSON 响应（与真实 Qwen 输出结构保持一致）

MOCK_A1_RESPONSE = json.dumps({
    "device_name": "3.0T 超导磁共振成像系统",
    "department": "放射科",
    "quantity": 1,
    "clinical_pain": (
        "现有 1.5T 设备已运行 9 年，年维修费用超残值 30%；"
        "候诊等待时间超 3 周，年均检查量 12,000 次已达设备上限；"
        "3.0T 可支持 fMRI、波谱分析等高端序列，满足神经外科术前规划需求。"
    ),
    "current_assets": "在用 1.5T 飞利浦 Ingenia 1 台，2015 年购入，账面净值约 180 万元",
    "necessity_summary": (
        "设备老化、产能饱和、技术落后三重压力并存，升级为 3.0T 为临床刚需。"
        "预计可释放 40% 额外产能，支撑年收入增长约 552 万元。"
    ),
    "source_files": ["可行性研究报告初稿.pdf", "放射科年度工作报告.xlsx"],
}, ensure_ascii=False)

MOCK_A2_RESPONSE = json.dumps([
    {
        "brand": "西门子", "model": "MAGNETOM Vida 3T",
        "field_strength": "3.0T", "key_specs": "梯度切换率 200 T/m/s；64 通道线圈",
        "list_price_rmb": "18600000", "service_life_years": 10,
        "market_share_note": "国内三甲医院首选，市场占有率约 38%",
        "source_file": "西门子3T报价单.pdf",
    },
    {
        "brand": "GE", "model": "SIGNA Premier 3T",
        "field_strength": "3.0T", "key_specs": "梯度切换率 200 T/m/s；48 通道线圈",
        "list_price_rmb": "19200000", "service_life_years": 10,
        "market_share_note": "高端科研市场占有率 28%",
        "source_file": "GE3T报价单.pdf",
    },
    {
        "brand": "联影", "model": "uMR 790",
        "field_strength": "3.0T", "key_specs": "梯度切换率 220 T/m/s；64 通道线圈",
        "list_price_rmb": "16800000", "service_life_years": 10,
        "market_share_note": "国产领先品牌，近 3 年市占率提升至 22%",
        "source_file": "联影3T报价单.pdf",
    },
], ensure_ascii=False)

MOCK_A3_RESPONSE = json.dumps({
    "recommended_brand": "联影",
    "recommended_model": "uMR 790",
    "equipment_price_rmb": 16800000,
    "installation_cost_rmb": 200000,
    "room_renovation_rmb": 1200000,
    "it_integration_rmb": 150000,
    "training_rmb": 80000,
    "annual_maintenance_rmb": 1344000,
    "total_budget_rmb": 18430000,
    "confidence": "medium",
    "uncertain_items": ["机房改造费用依据院方勘测结果，区间 80–150 万，取中值 120 万"],
}, ensure_ascii=False)

MOCK_A4_RESPONSE = json.dumps({
    "annual_revenue_rmb": 5520000,
    "annual_exams": 12000,
    "charge_per_exam_used": 460,
    "charge_source_note": "采用 2024 年更新收费标准 460 元/次（人工裁决确认）",
    "payback_years": 5.1,
    "roi_8yr_pct": 25.4,
    "npv_8yr_rmb": 35600000,
    "assumption_flags": [
        "年均检查量基于近 3 年复合增长率 12% 估算",
        "收费标准已经人工裁决，采信 2024 年版 460 元",
    ],
    "source_files": ["HIS历史检查量数据.xlsx", "2024年收费更新通知.pdf"],
}, ensure_ascii=False)

MOCK_A5_RESPONSE = json.dumps({
    "items": [
        {"cert": "医疗机构执业许可证",          "status": "通过", "expiry": "2027-12"},
        {"cert": "乙类大型医用设备配置许可证",   "status": "通过", "expiry": "2026-06"},
        {"cert": "放射诊疗许可证（放射科专项）", "status": "缺失", "expiry": None,
         "action": "请上传最新版放射诊疗许可证扫描件"},
        {"cert": "职业病危害放射防护评价报告",   "status": "通过", "expiry": "2025-11"},
    ],
    "passed": 3,
    "missing": 1,
    "overall_compliance": "条件通过（补充放射诊疗许可证后转为完全通过）",
    "source_files": ["医疗机构执业许可证.pdf", "大型设备配置证.pdf", "放射防护评价报告.pdf"],
}, ensure_ascii=False)

MOCK_A6_RESPONSE = """# 医疗设备立项建议书

## 一、项目概述
本报告就放射科 3.0T 超导磁共振成像系统（联影 uMR 790）的采购立项进行综合论证。

## 二、临床需求与必要性分析
现有 1.5T 设备运行 9 年，年均维修费超残值 30%。年检查量达 12,000 次已触及设备上限，
候诊等待超 3 周，严重制约神经外科精准诊断能力。升级 3.0T 为临床刚需。

## 三、设备选型对比分析
| 品牌 | 型号 | 梯度(T/m/s) | 含税价(万元) |
|------|------|------------|------------|
| 西门子 | MAGNETOM Vida | 200 | 1,860 |
| GE | SIGNA Premier | 200 | 1,920 |
| 联影 | uMR 790 | 220 | 1,680 |

推荐联影 uMR 790：性价比最优，交货周期最短（12 周），梯度性能最强。

## 四、预算测算
设备总预算 1,843 万元（设备 1,680 万 + 机房改造 120 万 + 安装集成 43 万）。
年维保费用约 134.4 万元（8%）。

## 五、收益测算与投资回报
年均收益 552 万元（12,000 次 × 460 元）。投资回收期约 5.1 年，8 年 ROI 约 25.4%。

## 六、合规性审查
当前 3 项证照齐全，放射诊疗许可证（放射科专项）待补充，补充后合规完全通过。

## 七、风险评估
主要风险：机房改造超预算（概率低，已预留 20% 弹性）、设备交货延迟（联影国内供应链稳定）。

## 八、综合建议与结论
综合技术、财务、合规三维度评估，建议立项。建议在补充放射诊疗许可证后正式提交院办审批。
"""

MOCK_A7_RESPONSE = json.dumps({
    "scores": {
        "completeness": 9,
        "data_accuracy": 8,
        "compliance_coverage": 8,
        "financial_rigor": 9,
        "readability": 9,
    },
    "total_score": 43,
    "grade": "A",
    "suggestions": [
        "建议补充放射科历史故障率数据以增强必要性论证",
        "可增加竞品 5 年维保费用横向对比",
    ],
    "approval_recommendation": "建议补充材料后立项",
}, ensure_ascii=False)


# ═════════════════════════════════════════════════════════════════════════════
# 2. MOCK SNAPSHOT — 含 430 vs 460 收费冲突（触发 HITL）
# ═════════════════════════════════════════════════════════════════════════════

def build_mock_snapshot() -> dict:
    """
    构造 Demo 用 project_snapshot.json。
    key_params.revenue_params.charge_per_exam 设置为 ConflictableField，
    conflict=True，触发 Agent4 的 HITL 挂起逻辑。
    """
    return {
        "project_id": "proj_demo_3t_mri_2024",
        "device_type": "3.0T MRI",
        "generated_at": "2026-05-16T06:00:00Z",
        "categories": {
            "a_requirements": [
                {
                    "file": "可行性研究报告初稿.pdf",
                    "fields": {
                        "device_name": "3.0T 超导磁共振成像系统",
                        "department": "放射科",
                        "annual_exams_current": "12000",
                        "current_device_age_years": "9",
                    },
                    # BBox 元数据：MinerU 保留的物理坐标
                    "bbox_meta": [
                        {"text": "年检查量 12,000 次", "page": 3, "bbox": [72.0, 345.2, 180.5, 14.8]},
                        {"text": "3.0T 超导磁共振",   "page": 1, "bbox": [72.0, 210.0, 220.0, 20.0]},
                    ],
                }
            ],
            "b_competitors": [
                {"file": "西门子3T报价单.pdf",   "fields": {"brand": "西门子", "price_rmb": "18600000"}},
                {"file": "GE3T报价单.pdf",       "fields": {"brand": "GE",    "price_rmb": "19200000"}},
                {"file": "联影3T报价单.pdf",     "fields": {"brand": "联影",  "price_rmb": "16800000"}},
            ],
            "c_compliance": [
                {"file": "医疗机构执业许可证.pdf",   "fields": {"cert_type": "执照", "expiry": "2027-12"}},
                {"file": "大型设备配置证.pdf",       "fields": {"cert_type": "配置证", "expiry": "2026-06"}},
                # 放射诊疗许可证 故意缺失，触发 A5 HITL
            ],
            "d_operations": [
                {
                    "file": "HIS历史检查量数据.xlsx",
                    "fields": {"annual_exams": "12000", "growth_rate_3yr": "12%"},
                    "bbox_meta": [
                        {"text": "年均检查量 12,000 次", "page": 1, "bbox": [100.0, 220.0, 200.0, 14.0]},
                    ],
                },
                {
                    "file": "历史收费标准.xlsx",
                    "fields": {"charge_per_exam": "430"},
                    "bbox_meta": [
                        {"text": "收费标准：430 元/次", "page": 1, "bbox": [72.0, 180.0, 160.0, 12.0]},
                    ],
                },
                {
                    "file": "2024年收费更新通知.pdf",
                    "fields": {"charge_per_exam": "460"},
                    "bbox_meta": [
                        {"text": "调整后收费标准：460 元/次", "page": 3, "bbox": [72.0, 412.5, 190.0, 14.0]},
                    ],
                },
            ],
        },
        # ConflictableField schema — 被 node_agent4_revenue 直接读取
        "key_params": {
            "revenue_params": {
                "charge_per_exam": {
                    "value": 430,           # 默认采用保守值（旧标准）
                    "conflict": True,       # ← 触发 HITL 的关键标志
                    "origin_type": "historical_baseline",
                    "source_file": "历史收费标准.xlsx",
                    "doc_category": "d_operations",
                    "all_values": [
                        {
                            "value": 430,
                            "source_file": "历史收费标准.xlsx",
                            "origin_type": "historical_baseline",
                            "bbox": {"page": 1, "bbox": [72.0, 180.0, 160.0, 12.0]},
                        },
                        {
                            "value": 460,
                            "source_file": "2024年收费更新通知.pdf",
                            "origin_type": "price_document",
                            "bbox": {"page": 3, "bbox": [72.0, 412.5, 190.0, 14.0]},
                        },
                    ],
                },
                "annual_exams": {
                    "value": 12000,
                    "conflict": False,
                    "origin_type": "his_system",
                    "source_file": "HIS历史检查量数据.xlsx",
                    "all_values": [{"value": 12000, "source_file": "HIS历史检查量数据.xlsx"}],
                },
                "depreciation_years": {
                    "value": 8,
                    "conflict": False,
                    "origin_type": "financial_policy",
                    "source_file": "财务制度手册.pdf",
                    "all_values": [{"value": 8, "source_file": "财务制度手册.pdf"}],
                },
            }
        },
        "missing_price_competitors": [],
        "excluded_internal_promo": [],
        "reference_only_competitors": [],
        "ingest_compliance": {
            "excluded_internal_promo": [],
            "reference_only_competitors": [],
        },
    }


# ═════════════════════════════════════════════════════════════════════════════
# 3. MOCK AppConfig
# ═════════════════════════════════════════════════════════════════════════════

def make_mock_config() -> AppConfig:
    """创建不依赖真实 agent_config.json 的测试配置。"""
    cfg = object.__new__(AppConfig)
    cfg.api_key    = "sk-test-mock-key"
    cfg.base_url   = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    cfg.model      = "qwen3-max"
    cfg.max_tokens = 2000
    cfg.temperature = 0.1
    cfg.max_workers = 4
    return cfg


# ═════════════════════════════════════════════════════════════════════════════
# 4. 节点计时与日志包装器
# ═════════════════════════════════════════════════════════════════════════════

class NodeRunner:
    """
    按竞赛规范包装每个 LangGraph 节点的调用，注入：
      - node_enter / node_exit 日志
      - BBox 证据链提取
      - 性能计时
    """

    def __init__(self, clog: CompetitionLogger) -> None:
        self.clog = clog

    def run(self, node_fn, state: ApprovalState,
            node_name: str,
            input_summary: Dict,
            bbox_fn=None) -> ApprovalState:
        """
        执行一个节点函数，自动记录 enter/exit 日志。
        bbox_fn: callable(state) -> List[BBoxEvidence]，用于提取证据链坐标
        """
        t0 = self.clog.node_enter(node_name, input_summary)
        t_wall = time.monotonic()
        state = node_fn(state)
        elapsed = round((time.monotonic() - t_wall) * 1000)

        # 提取 BBox 证据
        evidence = bbox_fn(state) if bbox_fn else []

        # 构造 output summary（不含大文本，只含关键指标）
        out_summary = _extract_output_summary(node_name, state)
        out_summary["elapsed_ms"] = elapsed

        self.clog.node_exit(t0, out_summary, bbox_evidence=evidence)
        return state


def _extract_output_summary(node: str, state: ApprovalState) -> dict:
    """从 state 中提取各节点的关键输出指标（避免把完整 JSON 写入日志）。"""
    summaries = {
        "agent1_requirements": lambda s: {
            "device_name": s.get("requirements_result", {}).get("device_name"),
            "department":  s.get("requirements_result", {}).get("department"),
        },
        "agent2_competitor": lambda s: {
            "competitor_count": len(s.get("competitor_table", [])),
            "brands": [r.get("brand") for r in s.get("competitor_table", [])],
        },
        "agent3_budget": lambda s: {
            "total_budget_rmb":    s.get("budget_summary", {}).get("total_budget_rmb"),
            "recommended_brand":   s.get("budget_summary", {}).get("recommended_brand"),
            "confidence":          s.get("budget_summary", {}).get("confidence"),
            "uncertain_items_cnt": len(s.get("budget_summary", {}).get("uncertain_items", [])),
        },
        "agent4_revenue": lambda s: {
            "annual_revenue_rmb": s.get("revenue_roi", {}).get("annual_revenue_rmb"),
            "payback_years":      s.get("revenue_roi", {}).get("payback_years"),
            "roi_8yr_pct":        s.get("revenue_roi", {}).get("roi_8yr_pct"),
            "charge_used":        s.get("revenue_roi", {}).get("charge_per_exam_used"),
            "new_checkpoints_cnt": len(s.get("human_checkpoints", [])),
        },
        "agent5_compliance": lambda s: {
            "passed": s.get("compliance_result", {}).get("passed"),
            "missing": s.get("compliance_result", {}).get("missing"),
            "overall": s.get("compliance_result", {}).get("overall_compliance"),
        },
        "agent6_document": lambda s: {
            "doc_chars": len(s.get("project_document", "")),
        },
        "agent7_feedback": lambda s: {
            "total_score": s.get("feedback_result", {}).get("total_score"),
            "grade":       s.get("feedback_result", {}).get("grade"),
            "recommendation": s.get("feedback_result", {}).get("approval_recommendation"),
        },
        "finalize": lambda s: {
            "evidence_count":   len(s.get("evidence_trace", [])),
            "error_count":      len(s.get("errors", [])),
            "checkpoint_count": len(s.get("human_checkpoints", [])),
        },
    }
    fn = summaries.get(node, lambda s: {})
    try:
        return fn(state)
    except Exception:
        return {}


# ═════════════════════════════════════════════════════════════════════════════
# 5. HITL 协调器
# ═════════════════════════════════════════════════════════════════════════════

class HITLCoordinator:
    """
    管理 HITL 挂起/恢复流程，并向 CompetitionLogger 写入状态转换事件。
    在真实生产环境中，此类应对接 FastAPI WebSocket 或工作台回调接口。
    测试环境中模拟人工决策。
    """

    def __init__(self, clog: CompetitionLogger) -> None:
        self.clog      = clog
        self.suspended = False

    def check_and_suspend(self, state: ApprovalState,
                          checkpoint_count_before: int) -> bool:
        """
        检查节点返回后是否新增了 HITL 检查点。
        如果发现收费冲突类 checkpoint，执行挂起。
        返回 True 表示已挂起，调用方应等待人工决策。
        """
        checkpoints = state.get("human_checkpoints", [])
        new_cps = checkpoints[checkpoint_count_before:]

        # 查找收费冲突类 checkpoint
        for cp in new_cps:
            if "冲突" in cp.get("item", "") and cp.get("agent") == "agent4_revenue":
                conflict_values = cp.get("conflict_values", [])
                self.clog.hitl_suspend(
                    trigger="data_conflict_charge_per_exam",
                    conflict_field="charge_per_exam",
                    conflict_values=[
                        {"value": v.get("value"), "source": v.get("source_file"),
                         "bbox": v.get("bbox")}
                        for v in conflict_values
                    ],
                    impact_description=(
                        "收费标准差异 30 元/次，年收益偏差 ≈ 36 万元，"
                        "8 年全周期 NPV 偏差 ≈ 288 万元。需人工裁决后方可继续。"
                    ),
                )
                self.suspended = True
                return True

            # 合规缺项类 checkpoint
            if "缺少" in cp.get("item", "") or "缺失" in cp.get("item", ""):
                if cp.get("agent") == "agent5_compliance":
                    self.clog.hitl_suspend(
                        trigger="compliance_cert_missing",
                        conflict_field="compliance_certs",
                        conflict_values=[cp.get("item")],
                        impact_description="证照缺失将导致立项申请被驳回，需补充后继续。",
                    )
                    self.suspended = True
                    return True

        return False

    def simulate_human_decision(self, decision: dict,
                                wait_seconds: float = 0.5) -> None:
        """
        模拟人工决策过程（测试环境）。
        生产环境中此方法应替换为工作台 WebSocket 回调等待。
        """
        print(f"\n  ⏸  HITL 挂起中... 模拟人工决策等待 {wait_seconds}s")
        time.sleep(wait_seconds)   # 模拟人工操作时间
        print(f"  ▶  人工决策已提交：{decision}")
        self.clog.hitl_resume(decision=decision, operator="test_simulated_human")
        self.suspended = False

    def apply_charge_decision(self, state: ApprovalState,
                               chosen_value: float,
                               source_file: str) -> ApprovalState:
        """
        将人工裁决结果写入 snapshot，覆盖 ConflictableField 的 value，
        并清除 conflict 标志，使 Agent4 重跑时采用裁决值。
        """
        rp = state["snapshot"]["key_params"]["revenue_params"]
        if "charge_per_exam" in rp:
            rp["charge_per_exam"]["value"]   = chosen_value
            rp["charge_per_exam"]["conflict"] = False
            rp["charge_per_exam"]["origin_type"] = "human_decision"
            rp["charge_per_exam"]["source_file"] = source_file

        # 清除对应的 human_checkpoint（已由人工处理）
        state["human_checkpoints"] = [
            cp for cp in state.get("human_checkpoints", [])
            if not (cp.get("agent") == "agent4_revenue" and "冲突" in cp.get("item", ""))
        ]
        return state


# ═════════════════════════════════════════════════════════════════════════════
# 6. LLM Mock Patch 上下文管理器
# ═════════════════════════════════════════════════════════════════════════════

# 按节点名称映射 Mock 响应
_AGENT_MOCK_MAP = {
    "agent1_requirements": MOCK_A1_RESPONSE,
    "agent2_competitor":   MOCK_A2_RESPONSE,
    "agent3_budget":       MOCK_A3_RESPONSE,
    "agent4_revenue":      MOCK_A4_RESPONSE,
    "agent5_compliance":   MOCK_A5_RESPONSE,
    "agent6_document":     MOCK_A6_RESPONSE,
    "agent7_feedback":     MOCK_A7_RESPONSE,
}

# 记录每次 LLM 调用的 agent 名称顺序（用于 mock 响应路由）
_call_index: List[str] = []


def make_mock_llm_call(clog: CompetitionLogger):
    """
    返回一个替换 QwenAgent.call 的 mock 函数。
    根据 self.name（agent1_requirements 等）返回对应预设响应，
    同时向 competition_logger 写入 llm_call 记录。
    """
    def _mock_call(self_agent, system_prompt: str, user_content: str) -> str:
        agent_name = self_agent.name
        response   = _AGENT_MOCK_MAP.get(agent_name, '{"mock": true}')

        # 模拟推理延迟（50–200ms，反映真实 API 调用量级）
        simulated_ms = {
            "agent1_requirements": 680,
            "agent2_competitor":   920,
            "agent3_budget":       540,
            "agent4_revenue":      750,
            "agent5_compliance":   430,
            "agent6_document":    1850,  # 文书生成耗时最长
            "agent7_feedback":     560,
        }.get(agent_name, 500)
        time.sleep(simulated_ms / 1000)

        clog.llm_call(
            prompt_id    = f"{agent_name}_v1",
            model        = self_agent.config.model,
            input_chars  = len(system_prompt) + len(user_content),
            output_tokens= len(response) // 3,      # 估算：1 token ≈ 3 char
            elapsed_ms   = simulated_ms,
            tool_calls   = [],                       # 当前 Qwen 未启用 function calling
        )
        return response

    return _mock_call


# ═════════════════════════════════════════════════════════════════════════════
# 7. BBox 证据链提取器（各节点）
# ═════════════════════════════════════════════════════════════════════════════

def bbox_for_a1(state: ApprovalState):
    """从 snapshot 的 bbox_meta 中提取 A1 节点相关物理坐标。"""
    items = state["snapshot"]["categories"].get("a_requirements", [])
    result = []
    for item in items:
        for bm in item.get("bbox_meta", []):
            result.append(make_bbox_evidence(
                value=bm["text"], source_file=item["file"],
                page=bm["page"], bbox=bm["bbox"], category="a_requirements",
            ))
    return result


def bbox_for_a4(state: ApprovalState):
    """提取收费冲突两个来源的 BBox 坐标（核心证据链）。"""
    rp     = state["snapshot"]["key_params"]["revenue_params"]
    charge = rp.get("charge_per_exam", {})
    result = []
    for v in charge.get("all_values", []):
        bx = v.get("bbox", {})
        if bx:
            result.append(make_bbox_evidence(
                value=f"收费标准 {v['value']} 元/次",
                source_file=v["source_file"],
                page=bx.get("page", 1),
                bbox=bx.get("bbox", []),
                category="d_operations",
            ))
    return result


# ═════════════════════════════════════════════════════════════════════════════
# 8. 主测试流程
# ═════════════════════════════════════════════════════════════════════════════

def run_e2e_test(output_root: Path) -> bool:
    """
    端到端测试主函数。
    返回 True 表示测试通过，False 表示存在断言失败。
    """
    output_root.mkdir(parents=True, exist_ok=True)
    logs_dir    = output_root / "logs"
    results_dir = output_root / "results"
    logs_dir.mkdir(exist_ok=True)
    results_dir.mkdir(exist_ok=True)

    task_id   = str(uuid.uuid4())
    short_id  = task_id[:8]
    log_path  = logs_dir / f"competition_{short_id}.jsonl"

    print(f"\n{'═'*60}")
    print(f"  ARIA 端到端竞赛评测")
    print(f"  场景：3.0T 核磁立项 Demo")
    print(f"  Task ID: {task_id}")
    print(f"  日志：{log_path}")
    print(f"{'═'*60}")

    # ── 初始化组件 ──────────────────────────────────────────────────────────
    clog   = CompetitionLogger(log_path, task_id=task_id)
    cfg    = make_mock_config()
    alog   = ApprovalLogger(logs_dir / f"approval_runtime_{short_id}.jsonl")
    runner = NodeRunner(clog)
    hitl   = HITLCoordinator(clog)

    # 模拟 Stage 1（MinerU）解析耗时（真实场景约 18s for 47 pages）
    simulated_mineru_ms = 18340.0

    snapshot = build_mock_snapshot()
    clog.pipeline_start(
        model              = cfg.model,
        snapshot_id        = snapshot["project_id"],
        mineru_elapsed_ms  = simulated_mineru_ms,
    )

    # 构造初始 LangGraph 状态
    state: ApprovalState = {
        "snapshot":    snapshot,
        "config":      cfg,
        "app_log":     alog,
        "output_root": results_dir,
        "evidence_trace":    [],
        "human_checkpoints": [],
        "errors":            [],
    }

    passed = True

    # ── Mock LLM 调用 ────────────────────────────────────────────────────────
    mock_call = make_mock_llm_call(clog)

    with patch("agent_approval.QwenAgent.call", new=mock_call):

        # ── Phase 1: A1 → A2 → A3 ──────────────────────────────────────────
        print("\n[ Phase 1 ] A1–A3 正常流转...")

        state = runner.run(
            node_init, state, "init",
            input_summary={"snapshot_id": snapshot["project_id"]},
        )
        state = runner.run(
            node_agent1_requirements, state, "agent1_requirements",
            input_summary={"category": "a_requirements",
                           "files": [i["file"] for i in snapshot["categories"]["a_requirements"]]},
            bbox_fn=bbox_for_a1,
        )
        assert state.get("requirements_result"), "A1 应输出 requirements_result"
        print(f"  ✓ A1 完成：{state['requirements_result'].get('device_name')}")

        state = runner.run(
            node_agent2_competitor, state, "agent2_competitor",
            input_summary={"competitor_files": [i["file"] for i in snapshot["categories"]["b_competitors"]]},
        )
        assert len(state.get("competitor_table", [])) == 3, "A2 应输出 3 条竞品记录"
        print(f"  ✓ A2 完成：{len(state['competitor_table'])} 条竞品")

        state = runner.run(
            node_agent3_budget, state, "agent3_budget",
            input_summary={"competitor_count": len(state["competitor_table"])},
        )
        assert state.get("budget_summary", {}).get("total_budget_rmb"), "A3 应输出预算总额"
        print(f"  ✓ A3 完成：总预算 ¥{state['budget_summary']['total_budget_rmb']:,}")

        # ── Phase 2: A4 → HITL 挂起 ─────────────────────────────────────────
        print("\n[ Phase 2 ] A4 收益测算（预期触发 HITL 冲突挂起）...")
        cp_before = len(state["human_checkpoints"])

        state = runner.run(
            node_agent4_revenue, state, "agent4_revenue",
            input_summary={
                "budget_total":    state["budget_summary"]["total_budget_rmb"],
                "conflict_exists": True,    # 已知冲突，标注在 input summary 中
            },
            bbox_fn=bbox_for_a4,
        )

        # 检查 HITL 是否被触发
        hitl_triggered = hitl.check_and_suspend(state, cp_before)
        if not hitl_triggered:
            print("  ⚠  警告：预期 HITL 冲突未被检测到，检查 snapshot 冲突字段配置")
            passed = False
        else:
            print(f"  ✓ A4 检测到收费冲突，状态 → {clog.status}")

            # ── Phase 3: 模拟人工决策 ────────────────────────────────────────
            print("\n[ Phase 3 ] HITL：模拟人工裁决...")
            human_decision = {
                "field":         "charge_per_exam",
                "chosen_value":  460,
                "source_file":   "2024年收费更新通知.pdf",
                "rationale":     "2024 年版为最新有效标准，优先采信",
                "decided_at":    datetime.utcnow().isoformat() + "Z",
            }
            hitl.simulate_human_decision(human_decision, wait_seconds=0.3)

            # 将裁决结果写入 snapshot，下游节点直接读取已修正值
            state = hitl.apply_charge_decision(
                state,
                chosen_value = 460,
                source_file  = "2024年收费更新通知.pdf",
            )
            print(f"  ✓ 人工裁决完成，收费标准更新为 460 元/次，状态 → {clog.status}")

            # ── Phase 4: A5–A7 继续流转 ──────────────────────────────────────
            print("\n[ Phase 4 ] A5–A7 恢复执行...")

            state = runner.run(
                node_agent5_compliance, state, "agent5_compliance",
                input_summary={"compliance_files": [i["file"] for i in snapshot["categories"]["c_compliance"]]},
            )
            comp = state.get("compliance_result", {})
            print(f"  ✓ A5 完成：通过 {comp.get('passed')} 项，缺失 {comp.get('missing')} 项")

            state = runner.run(
                node_agent6_document, state, "agent6_document",
                input_summary={
                    "budget_total":   state["budget_summary"]["total_budget_rmb"],
                    "compliance_status": comp.get("overall_compliance"),
                },
            )
            assert len(state.get("project_document", "")) > 500, "A6 应生成有效文书"
            print(f"  ✓ A6 完成：立项建议书 {len(state['project_document'])} 字符")

            state = runner.run(
                node_agent7_feedback, state, "agent7_feedback",
                input_summary={"doc_chars": len(state["project_document"])},
            )
            fb = state.get("feedback_result", {})
            print(f"  ✓ A7 完成：评分 {fb.get('total_score')}/50，等级 {fb.get('grade')}")

            # ── Phase 5: Finalize ─────────────────────────────────────────────
            print("\n[ Phase 5 ] 写入产物...")
            state = runner.run(
                node_finalize, state, "finalize",
                input_summary={
                    "evidence_count":   len(state["evidence_trace"]),
                    "checkpoint_count": len(state["human_checkpoints"]),
                },
            )

            # 写入竞赛结果 JSON（供评委脚本直接读取）
            contest_result = {
                "task_id":    task_id,
                "snapshot_id": snapshot["project_id"],
                "model":      cfg.model,
                "hitl_triggered": hitl_triggered,
                "human_decision": human_decision,
                "final_score":    fb.get("total_score"),
                "grade":          fb.get("grade"),
                "recommendation": fb.get("approval_recommendation"),
                "evidence_count": len(state.get("evidence_trace", [])),
                "errors":         state.get("errors", []),
            }
            (results_dir / "contest_result.json").write_text(
                json.dumps(contest_result, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )

            # 流水线完成日志
            clog.pipeline_complete(
                total_agents    = 7,
                errors          = state.get("errors", []),
                score           = fb.get("total_score"),
                grade           = fb.get("grade"),
                recommendation  = fb.get("approval_recommendation"),
            )

    # ── 汇总输出 ─────────────────────────────────────────────────────────────
    print(f"\n{'═'*60}")
    if passed:
        print("  ✅ 端到端测试通过")
    else:
        print("  ❌ 端到端测试存在失败项，请检查日志")
    print(f"  日志文件：{log_path}")
    print(f"  结果目录：{results_dir}")
    print(f"{'═'*60}\n")

    return passed


# ═════════════════════════════════════════════════════════════════════════════
# 9. CLI 入口
# ═════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="ARIA 端到端竞赛评测测试")
    parser.add_argument(
        "--output-root",
        default="./outputs/test",
        help="测试产物输出根目录（默认 ./outputs/test）",
    )
    args = parser.parse_args()

    ok = run_e2e_test(Path(args.output_root).resolve())
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
