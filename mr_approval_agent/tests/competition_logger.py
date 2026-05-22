#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
competition_logger.py — ARIA 竞赛级结构化日志模块
===================================================
在现有 ApprovalLogger 基础上，补充 5 大竞赛评测维度所需的字段：

  维度1  任务与节点追踪   task_id / node / step / input_summary / output_summary
  维度2  证据链与模型行为  bbox_evidence / prompt_id / tool_calls / model / tokens
  维度3  状态机转换       status: running→suspended→resumed→completed + reason
  维度4  性能耗时         elapsed_ms (per node) / total_elapsed_ms
  维度5  格式规范         JSONL，每行独立可解析

埋点位置建议（见文件底部注释 INSTRUMENTATION GUIDE）
"""
from __future__ import annotations

import json
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


# ─────────────────────────────────────────────────────────────────────────────
# CompetitionLogger
# ─────────────────────────────────────────────────────────────────────────────

class CompetitionLogger:
    """
    竞赛规范 JSONL 日志记录器。

    每条记录固定包含：
      ts           ISO-8601 UTC 时间戳（毫秒精度）
      task_id      本次流水线运行的唯一 UUID
      step         全局单调递增的步骤编号
      event        事件类型字符串
      node         当前 LangGraph 节点名称（无则为 "pipeline"）
      status       当前状态机状态
      ...          其余业务字段
    """

    STATUS_RUNNING   = "running"
    STATUS_SUSPENDED = "suspended"
    STATUS_RESUMED   = "resumed"
    STATUS_COMPLETED = "completed"
    STATUS_FAILED    = "failed"

    def __init__(self, log_path: Path, task_id: Optional[str] = None) -> None:
        log_path.parent.mkdir(parents=True, exist_ok=True)
        self._path     = log_path
        self.task_id   = task_id or str(uuid.uuid4())
        self._step     = 0
        self._status   = self.STATUS_RUNNING
        self._node     = "pipeline"
        self._run_t0   = time.monotonic()

    # ── public API ──────────────────────────────────────────────────────────

    @property
    def status(self) -> str:
        return self._status

    def set_node(self, node: str) -> None:
        self._node = node

    def set_status(self, status: str) -> None:
        self._status = status

    def log(self, event: str, node: Optional[str] = None, **kwargs: Any) -> None:
        """Write one JSONL record. All extra kwargs are merged into the record."""
        self._step += 1
        record: Dict[str, Any] = {
            "ts":       _utcnow_ms(),
            "task_id":  self.task_id,
            "step":     self._step,
            "event":    event,
            "node":     node or self._node,
            "status":   self._status,
        }
        record.update(kwargs)
        with self._path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(record, ensure_ascii=False) + "\n")

    # ── convenience helpers ──────────────────────────────────────────────────

    def pipeline_start(self, model: str, snapshot_id: str,
                       mineru_elapsed_ms: float) -> None:
        self.log(
            "pipeline_start",
            node="pipeline",
            model=model,
            snapshot_id=snapshot_id,
            stage1_mineru_parse_ms=mineru_elapsed_ms,
            description="Stage-2 approval pipeline initialised",
        )

    def node_enter(self, node: str, input_summary: Dict[str, Any]) -> float:
        """Call at the start of every node. Returns monotonic t0 for timing."""
        self.set_node(node)
        t0 = time.monotonic()
        self.log(
            "node_enter",
            input_summary=input_summary,
        )
        return t0

    def node_exit(self, t0: float, output_summary: Dict[str, Any],
                  bbox_evidence: Optional[List[Dict]] = None) -> None:
        """Call at the end of every node."""
        elapsed = round((time.monotonic() - t0) * 1000)
        self.log(
            "node_exit",
            elapsed_ms=elapsed,
            output_summary=output_summary,
            bbox_evidence=bbox_evidence or [],
        )

    def llm_call(self, prompt_id: str, model: str, input_chars: int,
                 output_tokens: int, elapsed_ms: float,
                 tool_calls: Optional[List[Dict]] = None) -> None:
        """Record a single LLM round-trip."""
        self.log(
            "llm_call",
            prompt_id=prompt_id,
            model=model,
            input_chars=input_chars,
            output_tokens=output_tokens,
            elapsed_ms=round(elapsed_ms),
            tool_calls=tool_calls or [],
        )

    def state_transition(self, from_status: str, to_status: str,
                         reason: str, **extra: Any) -> None:
        """Record a state-machine transition (the most critical log for evaluators)."""
        old = self._status
        self.set_status(to_status)
        self.log(
            "state_transition",
            from_status=from_status,
            to_status=to_status,
            reason=reason,
            **extra,
        )

    def hitl_suspend(self, trigger: str, conflict_field: str,
                     conflict_values: List[Any],
                     impact_description: str) -> None:
        """Log HITL suspension event."""
        self.state_transition(
            from_status=self.STATUS_RUNNING,
            to_status=self.STATUS_SUSPENDED,
            reason=f"HITL triggered: {trigger}",
            conflict_field=conflict_field,
            conflict_values=conflict_values,
            impact_description=impact_description,
            awaiting="human_decision",
        )

    def hitl_resume(self, decision: Dict[str, Any],
                    operator: str = "human_reviewer") -> None:
        """Log HITL resumption after human decision."""
        self.state_transition(
            from_status=self.STATUS_SUSPENDED,
            to_status=self.STATUS_RESUMED,
            reason="Human decision submitted",
            decision=decision,
            operator=operator,
        )
        # Return to running after resume is logged
        self.set_status(self.STATUS_RUNNING)

    def pipeline_complete(self, total_agents: int, errors: List[str],
                          score: Optional[float], grade: Optional[str],
                          recommendation: Optional[str]) -> None:
        total_ms = round((time.monotonic() - self._run_t0) * 1000)
        self.state_transition(
            from_status=self.STATUS_RUNNING,
            to_status=self.STATUS_COMPLETED,
            reason="All nodes finished",
            total_elapsed_ms=total_ms,
            total_agents_run=total_agents,
            errors=errors,
            quality_score=score,
            grade=grade,
            approval_recommendation=recommendation,
        )

    def pipeline_failed(self, error: str) -> None:
        total_ms = round((time.monotonic() - self._run_t0) * 1000)
        self.state_transition(
            from_status=self._status,
            to_status=self.STATUS_FAILED,
            reason=error,
            total_elapsed_ms=total_ms,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _utcnow_ms() -> str:
    """ISO-8601 UTC timestamp with millisecond precision."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def make_bbox_evidence(value: str, source_file: str, page: int,
                       bbox: List[float], category: str) -> Dict:
    """Build a single BBox evidence record (matches MinerU output schema)."""
    return {
        "value":       value,
        "source_file": source_file,
        "page":        page,
        "bbox":        bbox,          # [x, y, w, h] in PDF points
        "category":    category,
    }


# ─────────────────────────────────────────────────────────────────────────────
# INSTRUMENTATION GUIDE — 在现有代码中的具体埋点位置
# ─────────────────────────────────────────────────────────────────────────────
"""
以下是在 mr_approval_agent/ 现有代码中增加竞赛日志埋点的推荐位置：

1. agent_approval.py :: QwenAgent.call()
   ----------------------------------------
   现有代码已有 agent1_call_start / agent1_call_done。
   【新增】在调用成功后，调用 competition_logger.llm_call() 补充：
     - prompt_id: 用 f"{self.name}_v1" 作为稳定标识
     - output_tokens: resp.usage.completion_tokens
     - tool_calls: resp.choices[0].message.tool_calls（如有）

2. agent_approval.py :: node_agent4_revenue()
   -----------------------------------------------
   现有代码在 charge_conflict 检测后调用 log.log("agent4_charge_conflict_detected", ...)
   【新增】紧接着调用 competition_logger.hitl_suspend() 并设置全局标志
   让调用方在节点返回后检查该标志并实施真正的挂起逻辑。

3. agent_approval.py :: node_agent5_compliance()
   ------------------------------------------------
   现有代码检测缺证照后加入 human_checkpoints。
   【新增】调用 competition_logger.hitl_suspend() 记录合规缺项触发的挂起。

4. agent_ingest.py :: parse_documents() / MinerU 调用处
   --------------------------------------------------------
   在 MinerU CLI 调用前后记录：
     t0 = time.monotonic()
     subprocess.run(["magic-pdf", ...])
     elapsed = (time.monotonic() - t0) * 1000
   【新增】log pipeline_start 时传入 stage1_mineru_parse_ms=elapsed

5. agent_approval.py :: build_approval_workflow() 编译后
   --------------------------------------------------------
   使用 LangGraph 的 .stream() 代替 .invoke()：
     for chunk in graph.stream(initial_state, stream_mode="values"):
         node_name = chunk.get("__current_node__", "unknown")
         competition_logger.set_node(node_name)
   这样可以在不改动每个节点函数的情况下实现节点追踪。

6. api_server.py :: POST /api/run（如需新增）
   -----------------------------------------------
   在 API 层生成 task_id 并注入初始状态，让每次 HTTP 调用都有唯一追踪 ID。
"""
