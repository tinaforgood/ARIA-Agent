"""
agent_approval.py — Stage 2: Business Agent Collaboration Pipeline

Seven specialized agents cooperate to produce the final project-approval
document (立项建议书) from the structured snapshot emitted by agent_ingest.py.

Artefacts (under --output-root):
  results/*.json          — per-agent structured outputs + task_overview
  results/project_document.md   — agent6 Markdown draft
  results/project_document.docx — Word：院方模板 + JSON 摘要 + 正文（见 word_export.py）
  logs/approval_report_*.pdf    — ReportLab 技术摘要（非完整建议书）
  logs/approval_runtime.jsonl   — JSONL 运行日志

Pipeline
--------
init
  → agent1_requirements   (scene boundary & baseline)
  → agent2_competitor     (competitor comparison table)
  → agent3_budget         (budget estimation)
  → agent4_revenue        (revenue & ROI projection)
  → agent5_compliance     (regulatory compliance check)
  → agent6_document       (approval document drafting)
  → agent7_feedback       (self-review & scoring)
  → finalize              (persist all artefacts, PDF log)

Usage
-----
python agent_approval.py \\
    --snapshot  ./outputs/ingest/results/project_snapshot.json \\
    --output-root ./outputs/approval \\
    --config    ./config/agent_config.json
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import subprocess
import textwrap
import time
from datetime import datetime
from pathlib import Path
from typing import Any, List, Optional, Set

from json_repair import repair_json
from langgraph.graph import END, StateGraph
from openai import OpenAI
from reportlab.lib.pagesizes import A4

from word_export import export_approval_word
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
from typing_extensions import TypedDict

# ─────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("agent_approval")


# ─────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────

class AppConfig:
    """Load and expose all runtime settings from agent_config.json."""

    def __init__(self, config_path: str) -> None:
        raw = json.loads(Path(config_path).read_text(encoding="utf-8"))

        q = raw.get("qwen", {})
        # 优先读环境变量 DASHSCOPE_API_KEY，再 fallback 到 config 文件
        self.api_key: str = (
            os.getenv("DASHSCOPE_API_KEY", "").strip()
            or str(q.get("api_key", "") or "").strip()
        )
        self.base_url: str = q.get(
            "base_url", "https://dashscope.aliyuncs.com/compatible-mode/v1"
        )
        self.model: str = q.get("model", "qwen3-max")
        self.max_tokens: int = int(q.get("max_tokens", 2000))
        self.temperature: float = float(q.get("temperature", 0.2))

        rt = raw.get("runtime", {})
        self.max_workers: int = int(rt.get("max_workers", 4))

    def openai_client(self) -> OpenAI:
        return OpenAI(api_key=self.api_key, base_url=self.base_url)


# ─────────────────────────────────────────────
# JSONL Logger
# ─────────────────────────────────────────────

class ApprovalLogger:
    """Append structured JSONL records to the runtime log."""

    def __init__(self, log_path: Path) -> None:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        self._path = log_path

    def log(self, event: str, **kwargs: Any) -> None:
        record = {
            "ts": datetime.utcnow().isoformat(timespec="seconds") + "Z",
            "event": event,
            **kwargs,
        }
        with self._path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(record, ensure_ascii=False) + "\n")
        logger.info("[%s] %s", event, {k: v for k, v in kwargs.items() if k != "content"})


# ─────────────────────────────────────────────
# Base Qwen Agent
# ─────────────────────────────────────────────

class QwenAgent:
    """Wrapper around the DashScope-compatible OpenAI SDK for one-shot completions."""

    def __init__(self, name: str, config: AppConfig, log: ApprovalLogger) -> None:
        self.name = name
        self.config = config
        self.log = log
        self._client = config.openai_client()

    def call(self, system_prompt: str, user_content: str) -> str:
        """Send a chat completion request and return the assistant's reply."""
        self.log.log(f"{self.name}_call_start", chars=len(user_content))
        t0 = time.time()
        try:
            resp = self._client.chat.completions.create(
                model=self.config.model,
                max_tokens=self.config.max_tokens,
                temperature=self.config.temperature,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content},
                ],
            )
            text = resp.choices[0].message.content or ""
            self.log.log(
                f"{self.name}_call_done",
                elapsed_s=round(time.time() - t0, 2),
                tokens=resp.usage.total_tokens if resp.usage else None,
            )
            return text
        except Exception as exc:
            self.log.log(f"{self.name}_call_error", error=str(exc))
            raise

    def call_json(self, system_prompt: str, user_content: str) -> Any:
        """Call the model and parse the response as JSON (with repair)."""
        raw = self.call(system_prompt, user_content)
        # Strip markdown fences if present
        raw = re.sub(r"^```(?:json)?\s*", "", raw.strip(), flags=re.IGNORECASE)
        raw = re.sub(r"\s*```$", "", raw.strip())
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            repaired = repair_json(raw)
            return json.loads(repaired)


# ─────────────────────────────────────────────
# Pipeline State
# ─────────────────────────────────────────────

class ApprovalState(TypedDict, total=False):
    # ── inputs ──────────────────────────────
    snapshot: dict                  # project_snapshot from agent_ingest

    # ── per-agent outputs ────────────────────
    requirements_result: dict       # agent1: baseline & clinical need
    rationality_result: dict        # rationality_gate: 采购合理性判定（三维评估）
    competitor_table: list          # agent2: structured competitor rows
    budget_summary: dict            # agent3: cost breakdown
    revenue_roi: dict               # agent4: revenue forecast & ROI
    compliance_result: dict         # agent5: compliance flags
    project_document: str           # agent6: full Markdown approval doc
    feedback_result: dict           # agent7: quality scores & suggestions

    # ── evidence chain ───────────────────────
    evidence_trace: list            # [{conclusion, source_file, category}]

    # ── human review checkpoints ─────────────
    human_checkpoints: list         # items requiring manual confirmation

    # ── runtime ──────────────────────────────
    output_root: Path
    config: AppConfig
    app_log: ApprovalLogger
    errors: list


# ─────────────────────────────────────────────
# 申康绩效基准常量
# 来源：2025年四季度上海市级医院综合绩效简报（总第71期）
# ─────────────────────────────────────────────

_SHENKANG_MR_BENCH = {
    # 工作负荷（Workload）
    "city_avg_daily_volume":          49.64,   # 市级均值 日台均服务量（人次）
    "city_avg_saturation":            78.84,   # 市级均值 工作饱和度（%）
    "city_avg_work_hours":            10.03,   # 市级均值 日均工作时长（小时）
    "comprehensive_median_volume":    52.50,   # 综合性医院中位数 日台均
    "comprehensive_median_saturation": 83.32,  # 综合性医院中位数 饱和度（%）
    # 候检时间（Efficiency）
    "city_avg_waiting_booking_days":   4.70,   # 市级均值 收费→检查（天，真实候检）
    "city_avg_waiting_total_days":     5.50,   # 市级均值 付费→出报告（天）
    # 设备成新率（Device Age）
    "city_avg_chengxin_rate":         44.34,   # 市级均值 MR成新率（%）
    "city_avg_depreciation_ratio":    16.90,   # 折旧成本占检查收入比（%）
    "city_avg_maintenance_ratio":      5.75,   # 维护成本占检查收入比（%）
    # 阳性率（Quality）—— 精确基准待年度简报补全，暂用保守阈值
    "positive_rate_red_threshold":     0.60,   # 低于此值→红灯（强整改）
    "positive_rate_yellow_threshold":  0.70,   # 低于此值→黄灯（条件整改）
}

# 判定阈值
_WORKLOAD_GREEN_SATURATION   = 90.0   # 饱和度 ≥ 90% → 绿灯
_WORKLOAD_YELLOW_SATURATION  = 85.0   # 饱和度 ≥ 85% → 黄灯
_WAITING_GREEN_DAYS          = 7.0    # 候检 > 7天   → 绿灯
_WAITING_YELLOW_DAYS         = 5.5    # 候检 > 市均   → 黄灯
_RENEWAL_EXEMPTION_CHENGXIN  = 30.0   # 成新率 ≤ 30% → 更新豁免（一票通过）


def _load_ops_bench_from_xlsx(snapshot: dict) -> dict:
    """
    尝试从 d_operations/MR使用效率数据.xlsx 读取申请医院的实际运营数据。
    若文件不存在或医院名不匹配，返回空 dict，gate 将依赖 snapshot 字段。
    """
    import openpyxl
    result: dict = {}
    # 在 snapshot 的 datasource_layout 中找到 xlsx 路径
    ds_root = snapshot.get("_datasource_layout", {}).get("agent_corpus_root", "")
    candidates = [
        Path(ds_root) / "d_operations" / "MR使用效率数据.xlsx",
        Path("datasource/agent_corpus/d_operations/MR使用效率数据.xlsx"),
    ]
    xlsx_path = next((p for p in candidates if p.exists()), None)
    if not xlsx_path:
        return result

    try:
        wb = openpyxl.load_workbook(str(xlsx_path), data_only=True)
        ws = wb["使用效率"]
        # 列索引（0-based）：医院名=col1(idx=1), 日均量=2, 工时=3, 开机=4, 饱和度=5
        # 2025列偏移：医院名=col9(idx=9), 日均量=10, 工时=11, 开机=12, 饱和度=13
        hospital_name = snapshot.get("key_params", {}).get(
            "applicant_hospital", {}).get("value", "") or ""
        if not hospital_name:
            # 尝试从 requirements 里拿
            hospital_name = ""

        for row in ws.iter_rows(min_row=3, values_only=True):
            name_2025 = str(row[9] or "").strip()
            if hospital_name and hospital_name in name_2025:
                try:
                    result["daily_volume_2025"]  = float(row[10])
                    result["work_hours_2025"]    = float(row[11])
                    result["open_hours_2025"]    = float(row[12])
                    result["saturation_2025"]    = float(row[13])
                except (TypeError, ValueError):
                    pass
                break
    except Exception:
        pass
    return result


def _score_dimension(value: Optional[float], green_threshold: float,
                     yellow_threshold: float, higher_is_better: bool = True) -> str:
    """返回 'green' | 'yellow' | 'red'。value=None 时返回 'unknown'。"""
    if value is None:
        return "unknown"
    if higher_is_better:
        if value >= green_threshold:
            return "green"
        if value >= yellow_threshold:
            return "yellow"
        return "red"
    else:
        # lower is better（如候检天数）
        if value <= yellow_threshold:
            return "red"       # 候检时间很短 → 排队不构成瓶颈 → 红（不支持新增）
        if value <= green_threshold:
            return "yellow"
        return "green"


# ─────────────────────────────────────────────
# Node helpers
# ─────────────────────────────────────────────

def _b_competitor_prompt_exclusions(snapshot: dict) -> Set[str]:
    """Basenames of B-class files that must not appear in Agent2 raw text (already split out)."""
    names: Set[str] = set()
    for e in snapshot.get("excluded_internal_promo", []):
        fn = e.get("file")
        if fn:
            names.add(str(fn))
    for row in snapshot.get("reference_only_competitors", []):
        fn = row.get("source")
        if fn:
            names.add(str(fn))
    return names


def _snapshot_text(
    snapshot: dict,
    category: str,
    exclude_files: Optional[Set[str]] = None,
) -> str:
    """Return a compact text dump of one category from the snapshot."""
    items = snapshot.get("categories", {}).get(category, [])
    lines = []
    for item in items:
        src = item.get("file") or item.get("source_file") or ""
        if exclude_files and src and src in exclude_files:
            continue
        lines.append(f"[{src}]")
        for k, v in item.get("fields", {}).items():
            if v:
                lines.append(f"  {k}: {v}")
    return "\n".join(lines) if lines else "(no data)"


def _add_evidence(state: ApprovalState, conclusion: str, source_file: str, category: str) -> None:
    state.setdefault("evidence_trace", [])
    state["evidence_trace"].append(
        {"conclusion": conclusion, "source_file": source_file, "category": category}
    )


# ─────────────────────────────────────────────
# Node 0 — Init
# ─────────────────────────────────────────────

def node_init(state: ApprovalState) -> ApprovalState:
    log = state["app_log"]
    log.log("pipeline_init", model=state["config"].model)
    state.setdefault("evidence_trace", [])
    state.setdefault("human_checkpoints", [])
    state.setdefault("errors", [])
    return state


# ─────────────────────────────────────────────
# Node 1.5 — Rationality Gate（采购合理性判定）
# ─────────────────────────────────────────────

def node_rationality_gate(state: ApprovalState) -> ApprovalState:
    """
    申康三维采购合理性判定 Gate。

    判定维度：
    ┌─────────────────┬────────────────────────────────────────────────────┐
    │ 维度            │ 逻辑                                               │
    ├─────────────────┼────────────────────────────────────────────────────┤
    │ 工作负荷        │ 饱和度/日台均 vs 市级基准；≥90%=绿，≥85%=黄，<85%=红 │
    │ 候检时间        │ 收费→检查等待天数；>7天=绿，>5.5天=黄，≤5.5天=红   │
    │ 检查阳性率      │ <60%=红（强整改），<70%=黄，≥70%=绿；无数据=unknown │
    │ 设备成新率      │ ≤30%=豁免（更新场景一票通过）；>30%参与综合判定     │
    └─────────────────┴────────────────────────────────────────────────────┘

    Verdict 规则：
    - exempt_renewal : 成新率 ≤ 30% → 更新场景一票通过，不受其他维度约束
    - reject         : 阳性率=红（滥开单，即便负荷高也不支持新增）
    - pass           : 工作负荷绿 + 候检时间绿/黄 + 阳性率非红
    - conditional    : 其余情况（有黄有绿，需人工核查）
    """
    log = state["app_log"]
    log.log("rationality_gate_start")

    snapshot  = state["snapshot"]
    req       = state.get("requirements_result", {})
    bench     = _SHENKANG_MR_BENCH

    # ── 1. 从 xlsx 加载该医院实际运营数据 ────────────────────────────────────
    ops_data = _load_ops_bench_from_xlsx(snapshot)

    # 优先用 xlsx 实测值，退而求其次用 snapshot d_operations 字段
    daily_volume : Optional[float] = ops_data.get("daily_volume_2025")
    saturation   : Optional[float] = ops_data.get("saturation_2025")
    work_hours   : Optional[float] = ops_data.get("work_hours_2025")

    # 从 key_params.daily_utilization 兜底
    if saturation is None:
        raw_util = snapshot.get("key_params", {}).get("daily_utilization", {})
        raw_val  = raw_util.get("value") if isinstance(raw_util, dict) else raw_util
        try:
            saturation = float(str(raw_val).replace("%", "")) if raw_val else None
        except (TypeError, ValueError):
            saturation = None

    # ── 2. 候检时间：从 snapshot 读；若无则标 unknown ──────────────────────
    waiting_days: Optional[float] = None
    for cat in ("d_operations", "a_requirements"):
        for item in snapshot.get("categories", {}).get(cat, []):
            for k, v in item.get("fields", {}).items():
                if any(kw in k for kw in ["候检", "预约", "等待", "等候"]):
                    try:
                        waiting_days = float(str(v).replace("天", "").replace("d", "").strip())
                        break
                    except (TypeError, ValueError):
                        pass
            if waiting_days is not None:
                break
        if waiting_days is not None:
            break

    # ── 3. 阳性率：从 snapshot 读 ────────────────────────────────────────────
    positive_rate: Optional[float] = None
    for cat in ("d_operations", "a_requirements"):
        for item in snapshot.get("categories", {}).get(cat, []):
            for k, v in item.get("fields", {}).items():
                if "阳性率" in k:
                    try:
                        val_str = str(v).replace("%", "").strip()
                        positive_rate = float(val_str) / 100 if float(val_str) > 1 else float(val_str)
                        break
                    except (TypeError, ValueError):
                        pass
            if positive_rate is not None:
                break
        if positive_rate is not None:
            break

    # ── 4. 成新率（设备年龄/更新场景） ────────────────────────────────────────
    chengxin_rate: Optional[float] = None
    for item in snapshot.get("categories", {}).get("d_operations", []):
        for k, v in item.get("fields", {}).items():
            if "成新率" in k or "折旧" in k:
                try:
                    chengxin_rate = float(str(v).replace("%", "").strip())
                    break
                except (TypeError, ValueError):
                    pass
        if chengxin_rate is not None:
            break

    # ── 5. 维度评分 ──────────────────────────────────────────────────────────

    # 工作负荷：饱和度优先；若无饱和度则用日台均与市均之比估算
    workload_score: str
    workload_note: str
    if saturation is not None:
        workload_score = _score_dimension(saturation,
                                         _WORKLOAD_GREEN_SATURATION,
                                         _WORKLOAD_YELLOW_SATURATION,
                                         higher_is_better=True)
        workload_note = (
            f"工作饱和度 {saturation:.1f}%，"
            f"市均 {bench['city_avg_saturation']}%，"
            f"综合性医院中位数 {bench['comprehensive_median_saturation']}%"
        )
    elif daily_volume is not None:
        ratio = daily_volume / bench["city_avg_daily_volume"]
        if ratio >= 1.3:
            workload_score = "green"
        elif ratio >= 1.1:
            workload_score = "yellow"
        else:
            workload_score = "red"
        workload_note = (
            f"日台均 {daily_volume:.1f}人次，"
            f"市均 {bench['city_avg_daily_volume']}，"
            f"比值 {ratio:.2f}（饱和度数据缺失，由日台均估算）"
        )
    else:
        workload_score = "unknown"
        workload_note = "工作负荷数据缺失，需补充运营数据"

    # 候检时间：waiting_days 越大越支持立项（lower is better=False → higher is better=True）
    waiting_score: str
    waiting_note: str
    if waiting_days is not None:
        waiting_score = _score_dimension(waiting_days,
                                         _WAITING_GREEN_DAYS,
                                         _WAITING_YELLOW_DAYS,
                                         higher_is_better=True)
        waiting_note = (
            f"候检时间 {waiting_days:.1f}天（收费→检查），"
            f"市均 {bench['city_avg_waiting_booking_days']}天，"
            f"绿灯阈值 {_WAITING_GREEN_DAYS}天"
        )
    else:
        waiting_score = "unknown"
        waiting_note = f"候检时间数据缺失（市均为 {bench['city_avg_waiting_booking_days']}天）"

    # 阳性率
    quality_score: str
    quality_note: str
    if positive_rate is not None:
        if positive_rate < bench["positive_rate_red_threshold"]:
            quality_score = "red"
        elif positive_rate < bench["positive_rate_yellow_threshold"]:
            quality_score = "yellow"
        else:
            quality_score = "green"
        quality_note = (
            f"检查阳性率 {positive_rate*100:.1f}%，"
            f"红灯阈值 {bench['positive_rate_red_threshold']*100:.0f}%，"
            f"黄灯阈值 {bench['positive_rate_yellow_threshold']*100:.0f}%"
        )
    else:
        quality_score = "unknown"
        quality_note = "阳性率数据缺失，需补充（建议从医院HIS系统获取近12个月大型设备检查阳性率）"

    # 成新率/设备年龄
    renewal_exemption = False
    device_age_score: str
    device_age_note: str
    if chengxin_rate is not None:
        if chengxin_rate <= _RENEWAL_EXEMPTION_CHENGXIN:
            device_age_score  = "green"
            renewal_exemption = True
            device_age_note   = (
                f"成新率 {chengxin_rate:.1f}% ≤ {_RENEWAL_EXEMPTION_CHENGXIN}%，"
                "触发更新场景豁免，立项类型应为设备更新而非新增"
            )
        elif chengxin_rate <= bench["city_avg_chengxin_rate"]:
            device_age_score = "yellow"
            device_age_note  = (
                f"成新率 {chengxin_rate:.1f}%，低于市均 {bench['city_avg_chengxin_rate']}%，"
                "设备老化程度偏高，建议在立项文书中单独说明维修成本趋势"
            )
        else:
            device_age_score = "red"
            device_age_note  = (
                f"成新率 {chengxin_rate:.1f}%，高于市均 {bench['city_avg_chengxin_rate']}%，"
                "设备相对较新，更新型申请理由不充分"
            )
    else:
        device_age_score = "unknown"
        device_age_note  = "成新率数据缺失，无法判断是否为更新场景"

    # ── 6. 综合 Verdict ───────────────────────────────────────────────────────
    scores = {
        "workload": workload_score,
        "waiting_time": waiting_score,
        "positive_rate": quality_score,
        "device_age": device_age_score,
    }

    blocking_reason = ""
    recommendation  = ""

    if renewal_exemption:
        verdict = "exempt_renewal"
        recommendation = (
            "设备成新率极低，属更新替换场景，豁免工作负荷/候检/阳性率门槛。"
            "立项建议书重点论述：设备老化对临床质量的影响、维修费用趋势及停机风险。"
        )
    elif quality_score == "red":
        verdict = "reject"
        blocking_reason = (
            f"大型设备检查阳性率过低（{positive_rate*100:.1f}% < "
            f"{bench['positive_rate_red_threshold']*100:.0f}%），"
            "存在过度检查、开单不合理问题。即便工作负荷饱和，"
            "申康绩效体系要求先整改开单规范，再申报新增设备。"
        )
        recommendation = (
            "建议暂缓立项。整改方向：(1) 开展大型设备检查适应症培训；"
            "(2) 建立检查申请审批机制；(3) 整改满6个月且阳性率达标后重新申报。"
        )
    elif workload_score == "green" and waiting_score in ("green", "yellow"):
        if quality_score in ("green", "unknown"):
            verdict = "pass"
            recommendation = (
                "工作负荷饱和、候检时间超过阈值，采购合理性较强。"
                "建议在立项文书中重点量化：新增设备后的预约等待改善天数。"
            )
        else:
            verdict = "conditional"
            recommendation = (
                "工作负荷和候检时间支持新增，但阳性率偏低（黄灯），"
                "需在文书中说明检查结构（是否含大量随访/筛查），提供阳性率偏低的合理解释。"
            )
    else:
        verdict = "conditional"
        unknown_dims = [k for k, v in scores.items() if v == "unknown"]
        red_dims     = [k for k, v in scores.items() if v == "red" and k != "positive_rate"]
        if unknown_dims:
            recommendation = (
                f"以下维度数据缺失，无法完整判定：{', '.join(unknown_dims)}。"
                "请补充相关运营数据后重新评估。"
            )
        elif red_dims:
            recommendation = (
                f"工作负荷不足以单独支撑立项（{workload_note}）。"
                "建议核查是否属于设备更新场景，或等待负荷进一步提升后再申报。"
            )
        else:
            recommendation = (
                "各维度均处于黄灯区间，合理性尚可但论据偏弱。"
                "建议补充历年检查量增长趋势数据及候检时间监测记录，加强文书说服力。"
            )

    # ── 7. 组装输出 JSON ──────────────────────────────────────────────────────
    rationality_result = {
        "verdict": verdict,
        "renewal_exemption": renewal_exemption,
        "dimensions": {
            "workload": {
                "score": workload_score,
                "hospital_daily_volume": daily_volume,
                "hospital_saturation":   saturation,
                "hospital_work_hours":   work_hours,
                "city_avg_daily_volume": bench["city_avg_daily_volume"],
                "city_avg_saturation":   bench["city_avg_saturation"],
                "threshold_saturation_green":  _WORKLOAD_GREEN_SATURATION,
                "threshold_saturation_yellow": _WORKLOAD_YELLOW_SATURATION,
                "note": workload_note,
            },
            "waiting_time": {
                "score": waiting_score,
                "hospital_waiting_days":      waiting_days,
                "city_avg_waiting_days":      bench["city_avg_waiting_booking_days"],
                "city_avg_waiting_total":     bench["city_avg_waiting_total_days"],
                "threshold_green_days":       _WAITING_GREEN_DAYS,
                "threshold_yellow_days":      _WAITING_YELLOW_DAYS,
                "note": waiting_note,
            },
            "positive_rate": {
                "score": quality_score,
                "hospital_positive_rate":     positive_rate,
                "city_avg_not_available":     True,
                "threshold_red":              bench["positive_rate_red_threshold"],
                "threshold_yellow":           bench["positive_rate_yellow_threshold"],
                "data_available":             positive_rate is not None,
                "note": quality_note,
            },
            "device_age": {
                "score": device_age_score,
                "hospital_chengxin_rate":     chengxin_rate,
                "city_avg_chengxin_rate":     bench["city_avg_chengxin_rate"],
                "exemption_threshold":        _RENEWAL_EXEMPTION_CHENGXIN,
                "exemption_triggered":        renewal_exemption,
                "note": device_age_note,
            },
        },
        "blocking_reason": blocking_reason,
        "recommendation":  recommendation,
        "benchmark_source": "2025年四季度上海市级医院综合绩效简报（总第71期）",
    }

    state["rationality_result"] = rationality_result

    # ── 8. 若 verdict=reject，加入 human_checkpoint 并提前预警 ──────────────
    if verdict == "reject":
        state["human_checkpoints"].append({
            "agent":          "rationality_gate",
            "item":           f"⛔ 采购合理性判定：{verdict.upper()}",
            "action":         blocking_reason,
            "conflict_type":  "合理性否决",
        })
    elif verdict == "conditional":
        state["human_checkpoints"].append({
            "agent":          "rationality_gate",
            "item":           "⚠️ 采购合理性判定：CONDITIONAL（部分维度不足或数据缺失）",
            "action":         recommendation,
            "conflict_type":  "合理性条件通过",
        })

    _add_evidence(
        state,
        f"采购合理性判定：{verdict}",
        "d_operations/MR使用效率数据.xlsx",
        "d_operations",
    )

    log.log(
        "rationality_gate_done",
        verdict=verdict,
        workload=workload_score,
        waiting=waiting_score,
        quality=quality_score,
        device_age=device_age_score,
        renewal_exemption=renewal_exemption,
    )
    return state


# ─────────────────────────────────────────────
# Node 1 — Requirements Analysis
# ─────────────────────────────────────────────

def node_agent1_requirements(state: ApprovalState) -> ApprovalState:
    """
    Agent 1: Analyse scene boundary and project baseline.
    Reads category A (场景边界与立项基础) from the snapshot.
    """
    log = state["app_log"]
    log.log("agent1_requirements_start")

    snapshot = state["snapshot"]
    text_a = _snapshot_text(snapshot, "a_requirements")

    agent = QwenAgent("agent1_requirements", state["config"], log)

    system = textwrap.dedent("""\
        你是一名医疗设备采购专家。根据提供的立项基础资料，提取并结构化以下内容：
        1. 设备基本信息（名称、型号需求、申请科室、数量）
        2. 临床痛点与业务需求（限300字）
        3. 当前资产状况（现有设备数量、使用年限、饱和度）
        4. 立项必要性摘要（限200字）
        输出严格 JSON，格式：
        {
          "device_name": "",
          "department": "",
          "quantity": 0,
          "clinical_pain": "",
          "current_assets": "",
          "necessity_summary": "",
          "source_files": []
        }
    """)
    user = f"立项基础资料（A类）：\n{text_a}"

    try:
        result = agent.call_json(system, user)
        state["requirements_result"] = result
        for sf in result.get("source_files", []):
            _add_evidence(state, "临床需求与立项基础", sf, "a_requirements")
        log.log("agent1_requirements_done", device=result.get("device_name"))
    except Exception as exc:
        state["errors"].append(f"agent1: {exc}")
        state["requirements_result"] = {}
        log.log("agent1_requirements_error", error=str(exc))

    return state


# ─────────────────────────────────────────────
# Node 2 — Competitor Analysis
# ─────────────────────────────────────────────

def node_agent2_competitor(state: ApprovalState) -> ApprovalState:
    """
    Agent 2: Build a structured competitor comparison table.
    Reads category B (设备选型与竞品资料).
    """
    log = state["app_log"]
    log.log("agent2_competitor_start")

    snapshot = state["snapshot"]
    b_exclude = _b_competitor_prompt_exclusions(snapshot)
    text_b = _snapshot_text(snapshot, "b_competitors", exclude_files=b_exclude)

    extra_blocks: List[str] = []
    if snapshot.get("excluded_internal_promo"):
        extra_blocks.append(
            "【合规排除 — 下列为内部或未获广审宣传材料，不得写入对比表或对外引用其参数】\n"
            + json.dumps(snapshot["excluded_internal_promo"], ensure_ascii=False)
        )
    if snapshot.get("reference_only_competitors"):
        extra_blocks.append(
            "【低场强参考 — 下列为约 1.5T 等资料，仅作背景，禁止与 3.0T 混列为同级对标】\n"
            + json.dumps(snapshot["reference_only_competitors"], ensure_ascii=False)
        )
    b_suffix = ("\n\n" + "\n\n".join(extra_blocks)) if extra_blocks else ""

    agent = QwenAgent("agent2_competitor", state["config"], log)

    system = textwrap.dedent("""\
        你是一名医疗设备选型专家。根据竞品资料，生成结构化竞品对比表。
        主对比表仅针对 3.0T 超导磁共振申报场景：不得将 1.5T 产品与 3.0T 混列为直接竞品对比行。
        若输入中含有「低场强参考」JSON，仅能作背景说明，不得与 3.0T 使用同一套场强/梯度对比口径。
        若输入中含有「合规排除」JSON，禁止引用其中任一文件的具体技术参数或宣传表述。
        每个品牌/型号输出一条记录，字段：
        {
          "brand": "",
          "model": "",
          "field_strength": "",
          "key_specs": "",
          "list_price_rmb": "",
          "service_life_years": 0,
          "market_share_note": "",
          "source_file": ""
        }
        输出严格 JSON 数组，不含 markdown 代码块。
    """)
    user = f"竞品资料（B类）：\n{text_b}{b_suffix}"

    try:
        result = agent.call_json(system, user)
        if isinstance(result, dict):
            result = [result]
        state["competitor_table"] = result
        for row in result:
            _add_evidence(state, f"竞品参数：{row.get('brand', '')} {row.get('model', '')}", row.get("source_file", ""), "b_competitors")
        log.log("agent2_competitor_done", rows=len(result))

        # FIX-5b: add human_checkpoints for competitors with missing/invalid price.
        # Source 1: entries flagged by agent_ingest during snapshot build.
        _MISSING_MARKERS: Set[str] = {"", "n/a", "无", "——", "—", "待询价", "null", "none", "未知", "tbd"}
        missing_from_snapshot = snapshot.get("missing_price_competitors", [])
        seen_brands_flagged: Set[str] = set()
        for m in missing_from_snapshot:
            brand = str(m.get("brand") or "").strip()
            model = str(m.get("model") or "").strip()
            state["human_checkpoints"].append({
                "agent":  "agent2_competitor",
                "item":   f"竞品含税报价缺失：{brand} {model}（来源：{m.get('source', '')}）",
                "action": "请联系厂商获取正式含税报价单并更新 datasource/b_competitors 中对应文件",
            })
            seen_brands_flagged.add(brand)
        # Source 2: any brand in the LLM-built table that still has no price
        # and wasn't already captured above (e.g. LLM invented a row).
        for row in result:
            brand = str(row.get("brand") or "").strip()
            price = str(row.get("list_price_rmb") or "").strip()
            if price.lower() in _MISSING_MARKERS and brand not in seen_brands_flagged:
                model = str(row.get("model") or "").strip()
                state["human_checkpoints"].append({
                    "agent":  "agent2_competitor",
                    "item":   f"竞品含税报价缺失（LLM对比表）：{brand} {model}",
                    "action": "请联系厂商获取正式含税报价单",
                })
                seen_brands_flagged.add(brand)
        if seen_brands_flagged:
            log.log("agent2_missing_price_checkpoints", brands=sorted(seen_brands_flagged))

    except Exception as exc:
        state["errors"].append(f"agent2: {exc}")
        state["competitor_table"] = []
        log.log("agent2_competitor_error", error=str(exc))

    return state


# ─────────────────────────────────────────────
# Node 3 — Budget Estimation
# ─────────────────────────────────────────────

def node_agent3_budget(state: ApprovalState) -> ApprovalState:
    """
    Agent 3: Derive cost breakdown from competitor and operations data.
    Flags uncertain items to human_checkpoints.
    """
    log = state["app_log"]
    log.log("agent3_budget_start")

    competitor_json = json.dumps(state.get("competitor_table", []), ensure_ascii=False)
    text_d = _snapshot_text(state["snapshot"], "d_operations")

    agent = QwenAgent("agent3_budget", state["config"], log)

    system = textwrap.dedent("""\
        你是一名医院财务预算专家。综合竞品报价与运营数据，输出设备采购预算测算结果。
        输出严格 JSON：
        {
          "recommended_brand": "",
          "recommended_model": "",
          "equipment_price_rmb": 0,
          "installation_cost_rmb": 0,
          "room_renovation_rmb": 0,
          "it_integration_rmb": 0,
          "training_rmb": 0,
          "annual_maintenance_rmb": 0,
          "total_budget_rmb": 0,
          "confidence": "high|medium|low",
          "uncertain_items": []
        }
        若机房改造费用无原始数据，将该项列入 uncertain_items 并给出估算区间。
    """)
    user = (
        f"竞品对比表（JSON）：\n{competitor_json}\n\n"
        f"运营与预算数据（D类）：\n{text_d}"
    )

    try:
        result = agent.call_json(system, user)

        # ── FIX-CONF001: deterministic arithmetic cross-check (单价×台数=总金额) ─────
        # LLMs sometimes mis-multiply (e.g. 1300×2=3000 instead of 2600).
        # We re-compute from the competitor table to catch such errors.
        _arith_errors: list[str] = []
        eq_price = result.get("equipment_price_rmb", 0)
        req = state.get("requirements_result", {})
        qty = int(req.get("quantity") or 0)
        if eq_price and qty:
            expected_equip_total = round(eq_price * qty, 2)
            llm_total = result.get("total_budget_rmb", 0)
            # total_budget_rmb includes non-equipment items, so we only check
            # equipment line: if competitor table gives a clear unit price × qty.
            # Build expected from competitor rows where brand matches recommendation
            rec_brand = str(result.get("recommended_brand", "")).strip()
            for row in state.get("competitor_table", []):
                if str(row.get("brand", "")).strip() == rec_brand:
                    try:
                        unit_price = float(str(row.get("list_price_rmb", 0) or 0).replace("万", "").replace(",", "").strip())
                    except (ValueError, TypeError):
                        unit_price = 0.0
                    if unit_price > 0:
                        computed_total = round(unit_price * qty, 2)
                        llm_equip = round(float(eq_price), 2)
                        if abs(llm_equip - computed_total) > 0.5:  # tolerance 0.5万
                            _arith_errors.append(
                                f"设备总金额计算有误：LLM给出单价{llm_equip}万×台数{qty}"
                                f"应={computed_total}万，但 equipment_price_rmb={llm_equip}万与竞品报价{unit_price}万不符"
                            )
                        break

        if _arith_errors:
            for err in _arith_errors:
                state["human_checkpoints"].append({
                    "agent":  "agent3_budget",
                    "item":   f"预算金额计算矛盾【CONF-001预防】：{err}",
                    "action": "请人工核对预算清单中的单价、台数与总金额，确保 单价×台数=总金额",
                    "conflict_type": "预算总额核算矛盾",
                })
            log.log("agent3_budget_arith_error", errors=_arith_errors)

        state["budget_summary"] = result
        for item in result.get("uncertain_items", []):
            state["human_checkpoints"].append(
                {"agent": "agent3_budget", "item": item, "action": "请核实并填写准确金额"}
            )
        _add_evidence(state, "预算测算", "budget_summary", "d_operations")
        log.log(
            "agent3_budget_done",
            total_rmb=result.get("total_budget_rmb"),
            confidence=result.get("confidence"),
            arith_ok=len(_arith_errors) == 0,
        )
    except Exception as exc:
        state["errors"].append(f"agent3: {exc}")
        state["budget_summary"] = {}
        log.log("agent3_budget_error", error=str(exc))

    return state


# ─────────────────────────────────────────────
# Node 4 — Revenue & ROI Projection
# ─────────────────────────────────────────────

def _cf_value(field: Any) -> Any:
    """
    Resolve a ConflictableField dict to its winning scalar value.
    Falls back to the raw value if it is not a ConflictableField.
    """
    if isinstance(field, dict) and "value" in field and "all_values" in field:
        return field["value"]
    return field


def _cf_origin(field: Any) -> str:
    """Return origin_type from a ConflictableField, or '' if plain value."""
    if isinstance(field, dict) and "origin_type" in field:
        return field["origin_type"]
    return ""


def node_agent4_revenue(state: ApprovalState) -> ApprovalState:
    """
    Agent 4: Project revenue, utilisation, and payback period.

    Dual-track aware (dual-track schema from agent_ingest).
    ──────────────────────────────────────────────────────────
    revenue_params scalars are now ConflictableField objects:
      {value, origin_type, source_file, doc_category, conflict, all_values}

    This node:
    1. Flattens ConflictableField → scalar for the LLM prompt (clean numbers).
    2. Reads the resolved .value; annotates which track it came from.
    3. Detects conflict via the .conflict flag and surfaces a human_checkpoint.
    4. Backward-compat: also reads flat charge_conflict / charge_per_exam_all.
    """
    log = state["app_log"]
    log.log("agent4_revenue_start")

    text_d = _snapshot_text(state["snapshot"], "d_operations")
    budget = state.get("budget_summary", {})

    revenue_params = (
        state["snapshot"].get("key_params", {}).get("revenue_params", {})
    )

    # ── Flatten ConflictableField objects → clean scalars for LLM prompt ─────
    _INTERNAL_KEYS = {"charge_per_exam_all", "charge_conflict"}
    _params_for_prompt: dict = {}
    for k, v in revenue_params.items():
        if k in _INTERNAL_KEYS:
            continue
        resolved = _cf_value(v)
        if resolved is not None:
            origin = _cf_origin(v)
            _params_for_prompt[k] = (
                f"{resolved}（来源轨道：{origin}）" if origin else resolved
            )

    known_params_text = ""
    if _params_for_prompt:
        known_params_text = (
            "\n\n已从申报文件中提取到以下收益参数（优先使用，无需列入assumption_flags）：\n"
            + json.dumps(_params_for_prompt, ensure_ascii=False, indent=2)
        )

    # ── Conflict detection: ConflictableField path (dual-track schema) ───────
    charge_field    = revenue_params.get("charge_per_exam")
    cf_conflict     = (
        isinstance(charge_field, dict) and charge_field.get("conflict", False)
    )
    cf_all_values   = (
        charge_field.get("all_values", []) if isinstance(charge_field, dict) else []
    )

    # Backward-compat path: flat charge_conflict / charge_per_exam_all
    flat_conflict   = revenue_params.get("charge_conflict", False)
    flat_all        = revenue_params.get("charge_per_exam_all", [])

    charge_conflict = cf_conflict or flat_conflict
    # Prefer the richer ConflictableField all_values when available
    charge_all      = cf_all_values if cf_all_values else flat_all

    if charge_conflict and len(charge_all) >= 2:
        conflict_lines = "\n".join(
            f"  - {e.get('value', e)}  "
            f"（来源：{e.get('source_file', e.get('source', ''))}，"
            f"轨道：{e.get('origin_type', e.get('category', ''))}）"
            for e in charge_all
        )
        state["human_checkpoints"].append({
            "agent":           "agent4_revenue",
            "item":            f"单次收费标准冲突：发现 {len(charge_all)} 个来源提供了不同数值",
            "action":          "请在工作台【收益测算】页面选择正确的收费标准（或手动输入），确认后点击「确认并继续执行 Agent 4」",
            "conflict_values": charge_all,
        })
        known_params_text += (
            f"\n\n⚠ 收费标准冲突警告：{len(charge_all)} 个文件来源的数值不一致：\n"
            + conflict_lines
            + "\n收益基础测算请使用最保守的数值，并在 assumption_flags 中注明此冲突及各来源数值。"
        )
        log.log(
            "agent4_charge_conflict_detected",
            conflict_values=[e.get("value", str(e)) for e in charge_all],
            sources=[e.get("source_file", e.get("source", "")) for e in charge_all],
        )

    agent = QwenAgent("agent4_revenue", state["config"], log)

    system = textwrap.dedent("""\
        你是一名医院运营分析专家。根据运营数据和预算测算结果，输出收益测算与ROI分析。
        输出严格 JSON：
        {
          "daily_volume_assumed": 0,
          "working_days_per_year": 0,
          "charge_per_exam_rmb": 0,
          "insurance_ratio": 0.0,
          "annual_revenue_rmb": 0,
          "annual_operating_cost_rmb": 0,
          "annual_net_income_rmb": 0,
          "payback_period_years": 0.0,
          "roi_5yr_percent": 0.0,
          "assumption_flags": [],
          "notes": ""
        }
        若关键参数（单次收费/年工作天数/医保比例）无原始数据，列入 assumption_flags。
    """)
    user = (
        f"运营数据（D类）：\n{text_d}\n\n"
        f"预算汇总：\n{json.dumps(budget, ensure_ascii=False)}"
        f"{known_params_text}"
    )

    try:
        result = agent.call_json(system, user)
        state["revenue_roi"] = result
        for flag in result.get("assumption_flags", []):
            state["human_checkpoints"].append(
                {"agent": "agent4_revenue", "item": flag, "action": "请确认收益测算假设参数"}
            )
        _add_evidence(state, "收益与ROI测算", "revenue_roi", "d_operations")
        log.log(
            "agent4_revenue_done",
            payback=result.get("payback_period_years"),
            roi=result.get("roi_5yr_percent"),
        )
    except Exception as exc:
        state["errors"].append(f"agent4: {exc}")
        state["revenue_roi"] = {}
        log.log("agent4_revenue_error", error=str(exc))

    return state


# ─────────────────────────────────────────────
# Node 5 — Compliance Check
# ─────────────────────────────────────────────

def _check_price_proof_completeness(state: ApprovalState) -> list[dict]:
    """
    FIX-CONF005: Verify that price proof documents contain required structured fields.

    When 预算清单 declares 价格依据类型=询价单, the corresponding price proof PDF must
    contain all of: 品牌, 型号, 含税报价, 询价日期.  When MinerU OCR only extracts page
    numbers / stamps (e.g. value="28") without those fields, this signals that the
    scanned inquiry form is illegible to the system and human review is required.

    Returns a list of human_checkpoint dicts for each incomplete price proof found.
    """
    checkpoints: list[dict] = []

    snapshot = state["snapshot"]
    # ── 1. Collect all declared price-proof documents from 预算清单 (b_competitors / a_requirements) ─
    price_proof_files: list[str] = []
    for cat in ("b_competitors", "a_requirements", "d_operations"):
        for item in snapshot.get("categories", {}).get(cat, []):
            fields = item.get("fields", {})
            price_basis = str(fields.get("价格依据类型", "") or fields.get("价格来源", "")).strip()
            proof_file = str(fields.get("价格依据证明", "") or fields.get("price_proof_file", "")).strip()
            if "询价" in price_basis and proof_file:
                price_proof_files.append(proof_file)

    # ── 2. Also scan for any file tagged as price-proof in the snapshot directly ──
    for doc in snapshot.get("price_proof_docs", []):
        fname = str(doc.get("file", "") or doc.get("source_file", "")).strip()
        if fname and fname not in price_proof_files:
            price_proof_files.append(fname)

    # ── 3. Check each price-proof file via evidence_map ──────────────────────────
    evidence_map: dict = snapshot.get("evidence_map", {})

    REQUIRED_FIELDS = {
        "品牌":   ["品牌", "brand", "manufacturer", "厂家", "生产企业"],
        "型号":   ["型号", "model", "规格型号"],
        "含税报价": ["含税报价", "含税单价", "报价", "单价", "price", "金额"],
        "询价日期": ["询价日期", "报价日期", "日期", "date"],
    }

    # Also check evidence_map keys to see if any entry belongs to a price-proof file
    # but only contains a page-number value (MinerU OCR read page stamp instead of content)
    _PAGE_ONLY_PATTERN = re.compile(r"^\d{1,3}$")  # matches "1", "28", "100" etc.

    for field_key, entry in evidence_map.items():
        src_file = str(entry.get("file", "")).strip()
        entry_value = str(entry.get("value", "")).strip()
        # Detect price-proof files that only yielded page numbers
        is_price_proof = any(
            pf and (pf in src_file or src_file in pf)
            for pf in price_proof_files
        ) or "询价" in src_file or "price_proof" in src_file.lower() or "报价" in src_file
        if not is_price_proof:
            continue
        if _PAGE_ONLY_PATTERN.match(entry_value) or not entry_value:
            checkpoints.append({
                "agent":  "agent5_compliance",
                "item":   (
                    f"价格依据证明内容不完整【CONF-005】：文件「{src_file}」"
                    f"经OCR提取仅得到页码或空白（值='{entry_value}'），"
                    "关键字段（品牌/型号/含税报价/询价日期）缺失。"
                    "疑因扫描件分辨率不足或手写版导致机器无法识别。"
                ),
                "action": (
                    "请提供原始 Word/Excel 版询价单（或清晰扫描件≥300dpi）替换当前PDF扫描件，"
                    "确保品牌、型号、含税报价、询价日期均以机器可读文字呈现。"
                ),
                "conflict_type": "资质内容不完整",
                "source_file":   src_file,
            })
            return checkpoints  # one checkpoint per proof doc is enough

    # ── 4. Fallback: if no evidence_map entries found for declared proof files, flag them ─
    if price_proof_files and not evidence_map:
        for pf in price_proof_files:
            checkpoints.append({
                "agent":  "agent5_compliance",
                "item":   (
                    f"价格依据证明【CONF-005】：文件「{pf}」未在解析结果中找到任何内容，"
                    "无法核验品牌/型号/含税报价/询价日期。"
                ),
                "action": "请确认该文件已上传且MinerU解析成功，或提供可机读版本。",
                "conflict_type": "资质内容不完整",
                "source_file":   pf,
            })

    return checkpoints


def node_agent5_compliance(state: ApprovalState) -> ApprovalState:
    """
    Agent 5: Cross-check registration certificates, Class-B equipment licence,
    AND price proof document completeness (CONF-005 fix).

    Reads category C (合规与制度资料).

    Fix summary (六院-MR-2026 case):
    ─────────────────────────────────
    When 价格依据类型=询价单 is declared in 预算清单, MinerU OCR must successfully
    extract {品牌, 型号, 含税报价, 询价日期} from the proof PDF.  If OCR only returns
    page numbers or empty values (because the PDF is a scanned image at low DPI),
    this node flags a HITL checkpoint with conflict_type="资质内容不完整" before
    the LLM call so the compliance summary correctly reflects the gap.
    """
    log = state["app_log"]
    log.log("agent5_compliance_start")

    # ── Pre-check: price proof completeness (CONF-005) ───────────────────────────
    price_proof_gaps = _check_price_proof_completeness(state)
    for gap in price_proof_gaps:
        state["human_checkpoints"].append(gap)
        log.log(
            "agent5_price_proof_incomplete",
            file=gap.get("source_file", ""),
            conflict_type=gap.get("conflict_type", ""),
        )

    completeness_note = ""
    if price_proof_gaps:
        files_str = "；".join(g.get("source_file", "") for g in price_proof_gaps)
        completeness_note = (
            f"\n\n⚠️ 价格依据完整性预检（系统自动）：以下价格依据文件OCR仅提取到页码，"
            f"缺失结构化字段（品牌/型号/含税报价/询价日期），已触发人工审核：\n{files_str}"
        )

    text_c = _snapshot_text(state["snapshot"], "c_compliance")
    req = state.get("requirements_result", {})
    device_name = req.get("device_name", "磁共振设备")

    agent = QwenAgent("agent5_compliance", state["config"], log)

    system = textwrap.dedent("""\
        你是一名医疗设备合规审查专家。根据合规资料，核验以下内容：
        1. 注册证是否覆盖目标设备型号
        2. 注册证是否在有效期内
        3. 乙类大型设备配置许可是否已申请或已具备
        4. 价格依据证明是否完整（含税报价/品牌/型号/询价日期均须机器可读）
        5. 是否有明显合规风险
        输出严格 JSON：
        {
          "registration_certs": [
            {"cert_no": "", "device_name": "", "manufacturer": "", "valid_until": "", "status": "valid|expired|unknown"}
          ],
          "class_b_license_status": "obtained|pending|not_required|missing",
          "price_proof_completeness": "complete|incomplete|not_checked",
          "compliance_risks": [],
          "overall_compliance": "pass|conditional_pass|fail",
          "notes": ""
        }
        若价格依据完整性预检已发现缺失，将 price_proof_completeness 设为 "incomplete"，
        overall_compliance 设为 "conditional_pass"，并在 compliance_risks 中注明。
    """)
    user = (
        f"目标设备：{device_name}\n\n"
        f"合规资料（C类）：\n{text_c}"
        f"{completeness_note}"
    )

    try:
        result = agent.call_json(system, user)
        # If pre-check found gaps but LLM didn't reflect them, enforce them
        if price_proof_gaps and result.get("price_proof_completeness") != "incomplete":
            result["price_proof_completeness"] = "incomplete"
            result.setdefault("compliance_risks", []).append(
                "价格依据证明OCR提取内容不完整，关键字段缺失，需人工核验"
            )
            if result.get("overall_compliance") == "pass":
                result["overall_compliance"] = "conditional_pass"
        state["compliance_result"] = result
        for cert in result.get("registration_certs", []):
            _add_evidence(
                state,
                f"注册证核验：{cert.get('cert_no', '')}",
                cert.get("cert_no", ""),
                "c_compliance",
            )
        log.log(
            "agent5_compliance_done",
            overall=result.get("overall_compliance"),
            price_proof=result.get("price_proof_completeness"),
            hitl_triggered=len(price_proof_gaps) > 0,
        )
    except Exception as exc:
        state["errors"].append(f"agent5: {exc}")
        state["compliance_result"] = {}
        log.log("agent5_compliance_error", error=str(exc))

    return state


# ─────────────────────────────────────────────
# Node 6 — Document Generation
# ─────────────────────────────────────────────

def node_agent6_document(state: ApprovalState) -> ApprovalState:
    """
    Agent 6: Synthesise all prior outputs into the full approval document (立项建议书).
    Flags the draft for human confirmation.
    """
    log = state["app_log"]
    log.log("agent6_document_start")

    snapshot = state["snapshot"]
    rationality = state.get("rationality_result", {})
    # Gather all prior structured results
    context = json.dumps(
        {
            "requirements": state.get("requirements_result", {}),
            "rationality_gate": {
                "verdict":        rationality.get("verdict"),
                "dimensions":     {k: {"score": v.get("score"), "note": v.get("note")}
                                   for k, v in rationality.get("dimensions", {}).items()},
                "recommendation": rationality.get("recommendation"),
                "blocking_reason": rationality.get("blocking_reason", ""),
            },
            "competitor_table": state.get("competitor_table", []),
            "budget_summary": state.get("budget_summary", {}),
            "revenue_roi": state.get("revenue_roi", {}),
            "compliance_result": state.get("compliance_result", {}),
            "ingest_compliance": {
                "excluded_internal_promo": snapshot.get("excluded_internal_promo", []),
                "reference_only_competitors": snapshot.get("reference_only_competitors", []),
            },
        },
        ensure_ascii=False,
        indent=2,
    )

    agent = QwenAgent("agent6_document", state["config"], log)

    system = textwrap.dedent("""\
        你是一名资深医院采购管理顾问，擅长撰写医疗设备立项建议书。
        根据以下结构化数据，生成一份完整、专业的医疗设备立项建议书（Markdown格式）。

        文档结构要求：
        # 医疗设备立项建议书
        ## 一、项目概述
        ## 二、临床需求与必要性分析
        ## 三、设备选型对比分析
        ## 四、预算测算
        ## 五、收益测算与投资回报分析
        ## 六、合规性审查
        ## 七、风险评估与应对措施
        ## 八、综合建议与结论

        要求：
        - 语言正式、专业，使用医院管理规范用语
        - 数据来源于输入的结构化结果，不得编造数字
        - 竞品对比须与 competitor_table 一致；不得引用 ingest_compliance.excluded_internal_promo
          所列内部/未广审材料中的参数或宣传表述
        - 不得将 ingest_compliance.reference_only_competitors（低场强资料）表述为与 3.0T 同台对标的结论
        - 不确定数据用【待确认】标注
        - 全文3000-5000字
        - 必须在"二、临床需求与必要性分析"章节中引用 rationality_gate 的判定结果：
          * 若 verdict=pass/conditional：将三维指标（负荷/候检/阳性率）量化写入，
            并对照申康市级基准说明合理性依据
          * 若 verdict=reject：在章节末注明"根据申康绩效评估，检查阳性率低于阈值，
            建议整改后重新申报"，blocking_reason 内容须完整引用
          * 若 verdict=exempt_renewal：在章节中重点论述设备老化（成新率数据）、
            维修成本上升趋势及临床质量风险，说明这属于更新替换而非新增场景
    """)
    user = f"结构化分析数据：\n{context}"

    try:
        doc_text = agent.call(system, user)
        state["project_document"] = doc_text
        state["human_checkpoints"].append(
            {
                "agent": "agent6_document",
                "item": "立项建议书全文",
                "action": "请审阅 outputs/approval/results/project_document.docx（或 .md）；修改后可替换模板 templates/approval_proposal_template.docx 后重跑全流程",
            }
        )
        log.log("agent6_document_done", chars=len(doc_text))
    except Exception as exc:
        state["errors"].append(f"agent6: {exc}")
        state["project_document"] = ""
        log.log("agent6_document_error", error=str(exc))

    return state


# ─────────────────────────────────────────────
# Node 7 — Feedback & Quality Scoring
# ─────────────────────────────────────────────

def node_agent7_feedback(state: ApprovalState) -> ApprovalState:
    """
    Agent 7: Self-review the generated document and provide quality scores.
    """
    log = state["app_log"]
    log.log("agent7_feedback_start")

    doc = state.get("project_document", "")
    if not doc:
        state["feedback_result"] = {"error": "no document to review"}
        return state

    agent = QwenAgent("agent7_feedback", state["config"], log)

    system = textwrap.dedent("""\
        你是一名医院设备采购评审专家，负责对立项建议书进行质量评审。
        从以下维度打分（0-10）并给出改进建议：
        - completeness: 内容完整性
        - data_accuracy: 数据准确性与来源可信度
        - compliance_coverage: 合规性覆盖
        - financial_rigor: 财务测算严谨性
        - readability: 可读性与专业性
        输出严格 JSON：
        {
          "scores": {
            "completeness": 0,
            "data_accuracy": 0,
            "compliance_coverage": 0,
            "financial_rigor": 0,
            "readability": 0
          },
          "total_score": 0,
          "grade": "A|B|C|D",
          "suggestions": [],
          "approval_recommendation": "建议立项|建议补充材料后立项|暂缓立项"
        }
    """)
    user = f"立项建议书全文：\n\n{doc[:4000]}"  # token budget guard

    try:
        result = agent.call_json(system, user)
        state["feedback_result"] = result
        log.log(
            "agent7_feedback_done",
            total_score=result.get("total_score"),
            grade=result.get("grade"),
            recommendation=result.get("approval_recommendation"),
        )
    except Exception as exc:
        state["errors"].append(f"agent7: {exc}")
        state["feedback_result"] = {}
        log.log("agent7_feedback_error", error=str(exc))

    return state


# ─────────────────────────────────────────────
# Node 8 — Finalize & Persist Artefacts
# ─────────────────────────────────────────────

def node_finalize(state: ApprovalState) -> ApprovalState:
    """Persist all result JSONs, the Markdown document, and a PDF technical report."""
    log = state["app_log"]
    log.log("finalize_start")

    results_dir: Path = state["output_root"] / "results"
    logs_dir: Path = state["output_root"] / "logs"
    results_dir.mkdir(parents=True, exist_ok=True)
    logs_dir.mkdir(parents=True, exist_ok=True)

    def _save_json(name: str, data: Any) -> None:
        path = results_dir / name
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        log.log("artefact_saved", file=str(path))

    _save_json("requirements_result.json", state.get("requirements_result", {}))
    _save_json("rationality_result.json", state.get("rationality_result", {}))
    _save_json("competitor_table.json", state.get("competitor_table", []))
    _save_json("budget_summary.json", state.get("budget_summary", {}))
    _save_json("revenue_roi.json", state.get("revenue_roi", {}))
    _save_json("compliance_result.json", state.get("compliance_result", {}))
    _save_json("feedback_result.json", state.get("feedback_result", {}))
    _save_json("evidence_trace.json", state.get("evidence_trace", []))

    # Task overview / score card
    feedback     = state.get("feedback_result", {})
    rationality  = state.get("rationality_result", {})
    overview = {
        "run_timestamp": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "model": state["config"].model,
        "errors": state.get("errors", []),
        "human_checkpoints": state.get("human_checkpoints", []),
        # 申康合理性判定摘要
        "rationality_verdict":    rationality.get("verdict"),
        "rationality_dimensions": {
            k: v.get("score") for k, v in rationality.get("dimensions", {}).items()
        },
        "rationality_recommendation": rationality.get("recommendation"),
        # 质量评审得分
        "scores": feedback.get("scores", {}),
        "total_score": feedback.get("total_score"),
        "grade": feedback.get("grade"),
        "approval_recommendation": feedback.get("approval_recommendation"),
    }
    _save_json("task_overview.json", overview)

    # Markdown document + Word（模板 + JSON 摘要 + 正文）
    doc_text = state.get("project_document", "")
    if doc_text:
        doc_path = results_dir / "project_document.md"
        doc_path.write_text(doc_text, encoding="utf-8")
        log.log("artefact_saved", file=str(doc_path))

    try:
        word_path = export_approval_word(state, results_dir)
        log.log("artefact_saved", file=str(word_path))
    except Exception as exc:
        log.log("word_export_error", error=str(exc))
        state.setdefault("errors", []).append(f"word_export: {exc}")

    # PDF technical report（摘要级，写入 logs/）
    _export_pdf(state, logs_dir)

    # Print human checkpoints
    checkpoints = state.get("human_checkpoints", [])
    if checkpoints:
        print("\n" + "═" * 60)
        print("⚠  人工确认点 (Human Review Required)")
        print("═" * 60)
        for i, cp in enumerate(checkpoints, 1):
            print(f"{i}. [{cp['agent']}] {cp['item']}")
            print(f"   → {cp['action']}")
        print("═" * 60 + "\n")

    log.log("finalize_done", artefacts=str(results_dir))
    return state


# ─────────────────────────────────────────────
# PDF Export
# ─────────────────────────────────────────────

def _export_pdf(state: ApprovalState, logs_dir: Path) -> None:
    """Generate a ReportLab PDF technical report of the run."""
    log = state["app_log"]

    try:
        pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
        font_name = "STSong-Light"
    except Exception:
        font_name = "Helvetica"

    pdf_path = logs_dir / f"approval_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    doc = SimpleDocTemplate(str(pdf_path), pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "ChTitle", fontName=font_name, fontSize=16, leading=22, spaceAfter=12
    )
    h2_style = ParagraphStyle(
        "ChH2", fontName=font_name, fontSize=13, leading=18, spaceBefore=10, spaceAfter=6
    )
    body_style = ParagraphStyle(
        "ChBody", fontName=font_name, fontSize=10, leading=16
    )

    story = []

    def p(text: str, style: ParagraphStyle) -> None:
        story.append(Paragraph(text.replace("\n", "<br/>"), style))

    feedback = state.get("feedback_result", {})
    overview = state.get("budget_summary", {})
    req = state.get("requirements_result", {})

    p("医疗设备立项建议书 — 技术报告", title_style)
    p(f"生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M')}", body_style)
    story.append(Spacer(1, 6 * mm))

    p("一、项目概况", h2_style)
    p(f"设备名称：{req.get('device_name', 'N/A')}", body_style)
    p(f"申请科室：{req.get('department', 'N/A')}", body_style)
    p(f"申请数量：{req.get('quantity', 'N/A')}", body_style)
    story.append(Spacer(1, 4 * mm))

    p("二、预算测算摘要", h2_style)
    p(f"推荐品牌/型号：{overview.get('recommended_brand', 'N/A')} {overview.get('recommended_model', '')}", body_style)
    p(f"设备采购价格：¥{overview.get('equipment_price_rmb', 0):,}", body_style)
    p(f"项目总预算：¥{overview.get('total_budget_rmb', 0):,}", body_style)
    story.append(Spacer(1, 4 * mm))

    p("三、质量评审得分", h2_style)
    scores = feedback.get("scores", {})
    for dim, score in scores.items():
        p(f"  {dim}: {score}/10", body_style)
    p(f"综合得分：{feedback.get('total_score', 'N/A')}  等级：{feedback.get('grade', 'N/A')}", body_style)
    p(f"评审结论：{feedback.get('approval_recommendation', 'N/A')}", body_style)
    story.append(Spacer(1, 4 * mm))

    errors = state.get("errors", [])
    if errors:
        p("四、运行异常", h2_style)
        for e in errors:
            p(f"• {e}", body_style)

    try:
        doc.build(story)
        log.log("pdf_exported", file=str(pdf_path))
    except Exception as exc:
        log.log("pdf_export_error", error=str(exc))


# ─────────────────────────────────────────────
# Build LangGraph Workflow
# ─────────────────────────────────────────────

def build_approval_workflow():
    """Compile the 8-node LangGraph workflow."""
    graph = StateGraph(ApprovalState)

    graph.add_node("init",                  node_init)
    graph.add_node("agent1_requirements",   node_agent1_requirements)
    graph.add_node("rationality_gate",      node_rationality_gate)
    graph.add_node("agent2_competitor",     node_agent2_competitor)
    graph.add_node("agent3_budget",         node_agent3_budget)
    graph.add_node("agent4_revenue",        node_agent4_revenue)
    graph.add_node("agent5_compliance",     node_agent5_compliance)
    graph.add_node("agent6_document",       node_agent6_document)
    graph.add_node("agent7_feedback",       node_agent7_feedback)
    graph.add_node("finalize",              node_finalize)

    graph.set_entry_point("init")
    graph.add_edge("init",               "agent1_requirements")
    graph.add_edge("agent1_requirements","rationality_gate")
    graph.add_edge("rationality_gate",   "agent2_competitor")
    graph.add_edge("agent2_competitor",  "agent3_budget")
    graph.add_edge("agent3_budget",      "agent4_revenue")
    graph.add_edge("agent4_revenue",     "agent5_compliance")
    graph.add_edge("agent5_compliance",  "agent6_document")
    graph.add_edge("agent6_document",    "agent7_feedback")
    graph.add_edge("agent7_feedback",    "finalize")
    graph.add_edge("finalize",           END)

    return graph.compile()


# ─────────────────────────────────────────────
# Entrypoint
# ─────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Stage 2 — 7-agent business approval pipeline"
    )
    parser.add_argument(
        "--snapshot",
        default="./outputs/ingest/results/project_snapshot.json",
        help="Path to project_snapshot.json from agent_ingest.py",
    )
    parser.add_argument(
        "--output-root",
        default="./outputs/approval",
        help="Root directory for all Stage 2 outputs",
    )
    parser.add_argument(
        "--config",
        default="./config/agent_config.json",
        help="Path to agent_config.json",
    )
    parser.add_argument(
        "--hospital-name",
        default="",
        help="Hospital name for cover page (optional)",
    )
    args = parser.parse_args()

    snapshot_path = Path(args.snapshot)
    output_root = Path(args.output_root)
    config_path = args.config

    if not snapshot_path.exists():
        raise FileNotFoundError(
            f"Snapshot not found: {snapshot_path}\n"
            "Run agent_ingest.py first to generate the project snapshot."
        )

    config = AppConfig(config_path)
    log = ApprovalLogger(output_root / "logs" / "approval_runtime.jsonl")

    snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))

    initial_state: ApprovalState = {
        "snapshot": snapshot,
        "output_root": output_root,
        "config": config,
        "app_log": log,
        "evidence_trace": [],
        "human_checkpoints": [],
        "errors": [],
        "hospital_name": args.hospital_name or "",
    }

    workflow = build_approval_workflow()

    print("\n" + "═" * 60)
    print("  MR Approval Agent — Stage 2: Business Agents")
    print(f"  Snapshot : {snapshot_path}")
    print(f"  Output   : {output_root}")
    print(f"  Model    : {config.model}")
    print("═" * 60 + "\n")

    t0 = time.time()
    final_state = workflow.invoke(initial_state)
    elapsed = round(time.time() - t0, 1)

    feedback = final_state.get("feedback_result", {})
    print("\n" + "═" * 60)
    print(f"  Pipeline completed in {elapsed}s")
    print(f"  Grade: {feedback.get('grade', 'N/A')}  "
          f"Score: {feedback.get('total_score', 'N/A')}  "
          f"→ {feedback.get('approval_recommendation', 'N/A')}")
    errors = final_state.get("errors", [])
    if errors:
        print(f"  Errors ({len(errors)}): {errors}")
    print(f"  Results saved to: {output_root / 'results'}")
    print(f"  Word 建议书: {output_root / 'results' / 'project_document.docx'}")
    print(f"  PDF 技术报告: {output_root / 'logs'} (approval_report_*.pdf)")
    print("═" * 60 + "\n")


if __name__ == "__main__":
    main()
