#!/usr/bin/env python3
"""
hitl_trigger_test.py — ARIA HITL 触发规则验证脚本

对标《ARIA 综合测评报告 v2.0（修订版）》第 6.2 节"安全兜底机制：Human-in-the-Loop 触发规则"。

四类触发规则：
  L1 低置信触发  任意必填字段置信度 < 0.60；
                 或关键字段（设备型号/单次收费基准/注册证编号）置信度 < 0.75
  L2 完整性触发  文档类型对应的必填字段缺失率 > 20%
  L3 逻辑一致性  数值型字段跨文档逻辑矛盾：
                 ① TCO汇总值 与 单价×台数 差异 > 5%
                 ② 收费基准跨文档差异 > 5%
                 ③ 关键计数字段跨文档不一致（超出容差）
  L4 合理性Gate  node_rationality_gate 判定结果触发：
                 ① verdict = "reject"      → 阳性率 < 60%，写入 human_checkpoints
                                             conflict_type: 合理性否决，pipeline 不中止但文书标红
                 ② verdict = "conditional" → 存在黄灯维度/数据缺失，写入 human_checkpoints
                                             conflict_type: 合理性条件通过
                 pass / exempt_renewal 不触发（exempt_renewal 成新率 ≤ 30% 一票通过）

任一条件满足即挂起 LangGraph 执行图，推送结构化人工核验工单。

用法：
  python3 hitl_trigger_test.py
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional


# ── 阈值常量（对标报告 §6.2）────────────────────────────────────────────────
L1_CONFIDENCE_REQUIRED  = 0.60   # 普通必填字段置信度下限
L1_CONFIDENCE_CRITICAL  = 0.75   # 关键字段置信度下限
L2_MISSING_RATE_LIMIT   = 0.20   # 必填字段缺失率上限（严格大于）
L3_PRICE_DIFF_LIMIT     = 0.05   # 收费基准/总金额差异率上限（严格大于）
L3_COUNT_TOLERANCE_PCT  = 5.0    # 计数字段默认容差（%）

CRITICAL_FIELDS = {"设备型号", "单次收费基准", "注册证编号"}


# ── 数据结构 ─────────────────────────────────────────────────────────────────
@dataclass
class HITLCheckpoint:
    triggered: bool
    level: Optional[str]       # "L1" / "L2" / "L3" / None
    reason: str
    detail: dict = field(default_factory=dict)


@dataclass
class TestResult:
    case_id: str
    desc: str
    scene: str
    expected_trigger: bool
    expected_level: Optional[str]
    actual: HITLCheckpoint
    passed: bool


# ── L1 检查器 ────────────────────────────────────────────────────────────────
def check_L1(fields: list[dict]) -> HITLCheckpoint:
    """
    L1 低置信触发：
      - 任意必填字段置信度 < L1_CONFIDENCE_REQUIRED
      - 或关键字段置信度 < L1_CONFIDENCE_CRITICAL
    """
    for f in fields:
        if not f.get("required", True):
            continue
        conf = f["confidence"]
        name = f["name"]
        is_critical = f.get("is_critical", False) or name in CRITICAL_FIELDS

        if is_critical and conf < L1_CONFIDENCE_CRITICAL:
            return HITLCheckpoint(
                triggered=True, level="L1",
                reason=f"关键字段「{name}」置信度 {conf:.2f} < {L1_CONFIDENCE_CRITICAL}",
                detail={"field": name, "confidence": conf,
                        "threshold": L1_CONFIDENCE_CRITICAL, "is_critical": True},
            )
        if conf < L1_CONFIDENCE_REQUIRED:
            return HITLCheckpoint(
                triggered=True, level="L1",
                reason=f"必填字段「{name}」置信度 {conf:.2f} < {L1_CONFIDENCE_REQUIRED}",
                detail={"field": name, "confidence": conf,
                        "threshold": L1_CONFIDENCE_REQUIRED, "is_critical": False},
            )

    return HITLCheckpoint(triggered=False, level=None,
                          reason="所有必填字段置信度达标", detail={})


# ── L2 检查器 ────────────────────────────────────────────────────────────────
def check_L2(required_fields: list[str],
             missing_fields: list[str]) -> HITLCheckpoint:
    """
    L2 完整性触发：必填字段缺失率严格大于 L2_MISSING_RATE_LIMIT。
    """
    n_required = len(required_fields)
    if n_required == 0:
        return HITLCheckpoint(triggered=False, level=None,
                              reason="无必填字段定义", detail={})

    n_missing = len(missing_fields)
    rate = n_missing / n_required

    if rate > L2_MISSING_RATE_LIMIT:
        return HITLCheckpoint(
            triggered=True, level="L2",
            reason=f"必填字段缺失率 {rate:.1%}（{n_missing}/{n_required}）> {L2_MISSING_RATE_LIMIT:.0%}",
            detail={"missing": missing_fields, "rate": rate,
                    "threshold": L2_MISSING_RATE_LIMIT},
        )

    return HITLCheckpoint(
        triggered=False, level=None,
        reason=f"必填字段缺失率 {rate:.1%}（{n_missing}/{n_required}）≤ {L2_MISSING_RATE_LIMIT:.0%}，达标",
        detail={"rate": rate},
    )


# ── L3 检查器 ────────────────────────────────────────────────────────────────
def check_L3(check_type: str, values: dict) -> HITLCheckpoint:
    """
    L3 逻辑一致性触发，支持三种子类型：
      tco_arithmetic   : 单价×台数 vs 申报总金额
      price_discrepancy: 两个来源的收费基准差异率
      cross_doc_count  : 关键计数字段跨文档不一致
    """
    if check_type == "tco_arithmetic":
        unit  = values["unit_price_wan"]
        qty   = values["quantity"]
        total = values["total_wan"]
        calc  = unit * qty
        if calc == 0:
            return HITLCheckpoint(triggered=False, level=None,
                                  reason="单价为0，跳过算术核验", detail={})
        diff_rate = abs(total - calc) / calc
        if diff_rate > L3_PRICE_DIFF_LIMIT:
            return HITLCheckpoint(
                triggered=True, level="L3",
                reason=(f"TCO算术矛盾：申报总金额 {total}万 ≠ 单价×台数 "
                        f"{unit}×{qty}={calc}万（差异 {diff_rate:.1%} > {L3_PRICE_DIFF_LIMIT:.0%}）"),
                detail={"unit_price": unit, "quantity": qty,
                        "declared_total": total, "calculated_total": calc,
                        "diff_rate": diff_rate},
            )
        return HITLCheckpoint(
            triggered=False, level=None,
            reason=f"算术一致：{unit}×{qty}={calc}万，差异{diff_rate:.1%}≤{L3_PRICE_DIFF_LIMIT:.0%}",
            detail={"diff_rate": diff_rate},
        )

    elif check_type == "price_discrepancy":
        a_val = values["source_a"]["value_yuan"]
        b_val = values["source_b"]["value_yuan"]
        a_name = values["source_a"]["name"]
        b_name = values["source_b"]["name"]
        base = max(a_val, b_val)
        if base == 0:
            return HITLCheckpoint(triggered=False, level=None,
                                  reason="基准值为0，跳过差异核验", detail={})
        diff_rate = abs(a_val - b_val) / base
        if diff_rate > L3_PRICE_DIFF_LIMIT:
            return HITLCheckpoint(
                triggered=True, level="L3",
                reason=(f"收费基准跨文档矛盾：{a_name} {a_val} vs {b_name} {b_val}"
                        f"，差异 {diff_rate:.1%} > {L3_PRICE_DIFF_LIMIT:.0%}"),
                detail={"source_a": a_name, "value_a": a_val,
                        "source_b": b_name, "value_b": b_val,
                        "diff_rate": diff_rate},
            )
        return HITLCheckpoint(
            triggered=False, level=None,
            reason=f"收费基准差异{diff_rate:.1%}≤{L3_PRICE_DIFF_LIMIT:.0%}，在容差范围内",
            detail={"diff_rate": diff_rate},
        )

    elif check_type == "cross_doc_count":
        field_name = values["field"]
        a_val  = values["source_a"]["value"]
        b_val  = values["source_b"]["value"]
        a_doc  = values["source_a"]["doc"]
        b_doc  = values["source_b"]["doc"]
        tol    = values.get("tolerance_pct", L3_COUNT_TOLERANCE_PCT)

        if a_val == b_val:
            return HITLCheckpoint(
                triggered=False, level=None,
                reason=f"「{field_name}」跨文档一致（均为{a_val}）",
                detail={},
            )
        base = max(a_val, b_val)
        diff_pct = abs(a_val - b_val) / base * 100
        if diff_pct > tol:
            return HITLCheckpoint(
                triggered=True, level="L3",
                reason=(f"「{field_name}」跨文档不一致：{a_doc}={a_val} vs {b_doc}={b_val}"
                        f"（差异{diff_pct:.1f}% > 容差{tol:.0f}%）"),
                detail={"field": field_name, "value_a": a_val, "value_b": b_val,
                        "diff_pct": diff_pct, "tolerance_pct": tol},
            )
        return HITLCheckpoint(
            triggered=False, level=None,
            reason=(f"「{field_name}」差异{diff_pct:.1f}%≤容差{tol:.0f}%，视为等价"),
            detail={"diff_pct": diff_pct},
        )

    return HITLCheckpoint(triggered=False, level=None,
                          reason=f"未知校验类型: {check_type}", detail={})


# ── L4 检查器 ────────────────────────────────────────────────────────────────
def check_L4(verdict: str, dimensions: dict | None = None) -> HITLCheckpoint:
    """
    L4 合理性Gate触发（node_rationality_gate）：
      - verdict = "reject"      → 阳性率 < 60%，即便负荷饱和也暂缓立项 → 触发 HITL（合理性否决）
      - verdict = "conditional" → 存在黄灯维度或数据缺失 → 触发 HITL（合理性条件通过）
      - verdict = "pass"        → 全维度绿灯 → 不触发
      - verdict = "exempt_renewal" → 成新率 ≤ 30%，更新场景一票通过 → 不触发

    参数:
        verdict:    合理性Gate输出的判定结论字符串
        dimensions: 各维度评分字典（可选，用于丰富 detail 信息）
    """
    dims = dimensions or {}

    if verdict == "reject":
        blocking = dims.get("positive_rate", {}).get("note", "阳性率 < 60%，暂缓立项")
        return HITLCheckpoint(
            triggered=True, level="L4",
            reason=f"合理性Gate拒绝：{blocking}（conflict_type: 合理性否决）",
            detail={"verdict": verdict, "conflict_type": "合理性否决",
                    "positive_rate": dims.get("positive_rate", {})},
        )

    if verdict == "conditional":
        yellow_dims = [k for k, v in dims.items() if isinstance(v, dict) and v.get("score") == "yellow"]
        unknown_dims = [k for k, v in dims.items() if isinstance(v, dict) and v.get("score") == "unknown"]
        note = f"黄灯维度: {yellow_dims or '—'}，数据缺失维度: {unknown_dims or '—'}"
        return HITLCheckpoint(
            triggered=True, level="L4",
            reason=f"合理性Gate条件通过：{note}（conflict_type: 合理性条件通过）",
            detail={"verdict": verdict, "conflict_type": "合理性条件通过",
                    "yellow_dims": yellow_dims, "unknown_dims": unknown_dims},
        )

    if verdict == "pass":
        return HITLCheckpoint(
            triggered=False, level=None,
            reason="合理性Gate全维度绿灯，直接通过，不触发HITL",
            detail={"verdict": verdict},
        )

    if verdict == "exempt_renewal":
        return HITLCheckpoint(
            triggered=False, level=None,
            reason="合理性Gate更新豁免（成新率 ≤ 30%），一票通过，不触发HITL",
            detail={"verdict": verdict, "renewal_exemption": True},
        )

    return HITLCheckpoint(triggered=False, level=None,
                          reason=f"合理性Gate未知verdict: {verdict}", detail={})


# ── 测试执行器 ───────────────────────────────────────────────────────────────
def run_case(group: str, case: dict) -> TestResult:
    exp_trig  = case["expected_trigger"]
    exp_level = case.get("expected_level")
    scene     = case.get("scene", "—")

    if group == "L1":
        actual = check_L1(case["fields"])
    elif group == "L2":
        actual = check_L2(case["required_fields"], case["missing_fields"])
    elif group == "L3":
        actual = check_L3(case["check_type"], case["values"])
    elif group == "L4":
        actual = check_L4(case["verdict"], case.get("dimensions"))
    else:
        raise ValueError(f"Unknown group: {group}")

    # 判断是否通过
    trig_ok  = actual.triggered == exp_trig
    level_ok = (actual.level == exp_level) if exp_trig else True
    passed   = trig_ok and level_ok

    return TestResult(
        case_id=case["id"],
        desc=case["desc"],
        scene=scene,
        expected_trigger=exp_trig,
        expected_level=exp_level,
        actual=actual,
        passed=passed,
    )


# ── 报告生成 ─────────────────────────────────────────────────────────────────
def generate_report(results: list[TestResult], workdir: Path) -> Path:
    report_dir = workdir / "report"
    report_dir.mkdir(exist_ok=True)
    report_path = report_dir / "hitl_trigger_report.md"

    now     = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    total   = len(results)
    passed  = sum(1 for r in results if r.passed)
    failed  = total - passed
    pass_rate = passed / total * 100 if total else 0

    overall = "✅ 全部通过" if failed == 0 else f"❌ {failed} 个用例失败"

    # 分组统计
    groups: dict[str, list[TestResult]] = {"L1": [], "L2": [], "L3": [], "L4": []}
    for r in results:
        groups[r.case_id[:2]].append(r)

    group_rows = ""
    for lvl, rs in groups.items():
        gp = sum(1 for r in rs if r.passed)
        gt = len(rs)
        flag = "✅" if gp == gt else "❌"
        group_rows += f"| {lvl} | {gt} | {gp} | {gt - gp} | {flag} |\n"

    # 明细表
    detail_rows = ""
    for r in results:
        icon    = "✅" if r.passed else "❌"
        exp_str = f"触发({r.expected_level})" if r.expected_trigger else "不触发"
        act_str = f"触发({r.actual.level})" if r.actual.triggered else "不触发"
        scene   = f"`{r.scene}`" if r.scene != "—" else "—"
        detail_rows += (
            f"| {icon} | {r.case_id} | {r.desc[:38]} | "
            f"{scene} | {exp_str} | {act_str} |\n"
        )

    # 失败原因
    failure_block = ""
    failed_cases = [r for r in results if not r.passed]
    if failed_cases:
        failure_block = "\n## ❌ 失败用例详情\n\n"
        for r in failed_cases:
            failure_block += (
                f"### {r.case_id} — {r.desc}\n\n"
                f"- 预期：{'触发' if r.expected_trigger else '不触发'}({r.expected_level})\n"
                f"- 实测：{'触发' if r.actual.triggered else '不触发'}({r.actual.level})\n"
                f"- 原因：{r.actual.reason}\n\n"
            )

    md = f"""\
# ARIA HITL 触发规则验证报告

> 对标《ARIA 综合测评报告 v2.0（修订版）》第 6.2 节"安全兜底机制：Human-in-the-Loop 触发规则"。

- **生成时间**: {now}
- **测试用例数**: {total}
- **通过**: {passed} / {total}（{pass_rate:.1f}%）
- **综合结论**: {overall}

---

## 触发规则阈值（对标 §6.2）

| 规则 | 触发条件 | 阈值 |
|---|---|---|
| L1 低置信触发 | 普通必填字段置信度 | < {L1_CONFIDENCE_REQUIRED} |
| L1 低置信触发 | 关键字段（设备型号/单次收费基准/注册证编号）置信度 | < {L1_CONFIDENCE_CRITICAL} |
| L2 完整性触发 | 文档必填字段缺失率 | > {L2_MISSING_RATE_LIMIT:.0%} |
| L3 逻辑一致性 | TCO总金额与单价×台数差异率 | > {L3_PRICE_DIFF_LIMIT:.0%} |
| L3 逻辑一致性 | 收费基准跨文档差异率 | > {L3_PRICE_DIFF_LIMIT:.0%} |
| L3 逻辑一致性 | 关键计数字段跨文档差异率 | > {L3_COUNT_TOLERANCE_PCT:.0f}%（默认容差） |
| L4 合理性Gate | verdict = reject（阳性率 < 60%） | 触发，conflict_type: 合理性否决 |
| L4 合理性Gate | verdict = conditional（存在黄灯/数据缺失） | 触发，conflict_type: 合理性条件通过 |
| L4 合理性Gate | verdict = pass / exempt_renewal | 不触发 |

---

## 分组汇总

| 规则级别 | 用例数 | 通过 | 失败 | 状态 |
|---|---:|---:|---:|---|
{group_rows}
| **合计** | **{total}** | **{passed}** | **{failed}** | **{overall}** |

---

## 全量用例明细

| 状态 | 用例ID | 描述 | 关联场景 | 预期 | 实测 |
|---|---|---|---|---|---|
{detail_rows}
---

## DEMO-MR-2026 真实场景映射验证

| 冲突场景 | HITL规则 | 用例ID | 验证结论 |
|---|---|---|---|
| CONF-001（徐汇MR台数跨文档不一致） | L3 逻辑一致性 | L3-005 | {"✅ 正确触发" if any(r.case_id=="L3-005" and r.passed for r in results) else "❌ 异常"} |
| CONF-003（应到人数差1，容差内）    | L3 不触发     | L3-006 | {"✅ 正确放行" if any(r.case_id=="L3-006" and r.passed for r in results) else "❌ 异常"} |
| CONF-004（门诊量尾零，格式差异）   | L3 不触发     | L3-007 | {"✅ 正确放行" if any(r.case_id=="L3-007" and r.passed for r in results) else "❌ 异常"} |
| CONF-005（扫描件无文字层，L1+L2） | L1 + L2      | L1-004, L2-004 | {"✅ 双路触发" if all(any(r.case_id==cid and r.passed for r in results) for cid in ["L1-004","L2-004"]) else "❌ 异常"} |
| BUG-002 修复前（总金额3000≠2600） | L3 逻辑一致性 | L3-002 | {"✅ 正确触发" if any(r.case_id=="L3-002" and r.passed for r in results) else "❌ 异常"} |
| RAT-001（阳性率55%<60%，否决）    | L4 合理性Gate | L4-001 | {"✅ 正确触发" if any(r.case_id=="L4-001" and r.passed for r in results) else "❌ 异常"} |
| RAT-002（负荷黄灯，条件通过）      | L4 合理性Gate | L4-002 | {"✅ 正确触发" if any(r.case_id=="L4-002" and r.passed for r in results) else "❌ 异常"} |
| RAT-003（全绿通过，不触发）        | L4 不触发     | L4-003 | {"✅ 正确放行" if any(r.case_id=="L4-003" and r.passed for r in results) else "❌ 异常"} |
| RAT-004（成新率28%，更新豁免）     | L4 不触发     | L4-004 | {"✅ 正确放行" if any(r.case_id=="L4-004" and r.passed for r in results) else "❌ 异常"} |
{failure_block}
---

## 说明

- **L1/L2 双路触发（CONF-005）**：价格证明PDF为图片扫描件时，既因OCR置信度极低触发L1，又因必填字段全缺失触发L2，体现系统多层防护设计。
- **容差机制（CONF-003/004）**：应到人数差1人（3%）及格式类差异均未触发L3，验证规则引擎具备合理容错能力，避免过度干预。
- **算术核验（BUG-002）**：设备申请总金额与单价×台数不符时，L3规则在A3节点算术核验阶段即可拦截，无需等到A5合规节点。
- **L4 合理性Gate（新增）**：位于A1之后A2之前，基于四维运营指标（工作负荷/候检时间/阳性率/成新率）独立判定立项合理性。verdict=reject时文书标红但pipeline不中止，保留完整审计链；exempt_renewal为成新率特殊豁免通道，不参与其他维度否决。基准数据来自2025年四季度上海市级医院综合绩效简报（总第71期）。

---

*ARIA HITL 触发规则验证 · 对标《ARIA 综合测评报告 v2.0（修订版）》第 6.2 节 · 自动生成 · {now}*
"""
    report_path.write_text(md, encoding="utf-8")
    return report_path


# ── 主程序 ───────────────────────────────────────────────────────────────────
def main() -> None:
    workdir   = Path(__file__).resolve().parent
    cases_path = workdir / "test_cases.json"

    print(f"[信息] 加载测试用例: {cases_path.name}")
    with open(cases_path, encoding="utf-8") as f:
        data = json.load(f)

    results: list[TestResult] = []
    for group in ("L1", "L2", "L3", "L4"):
        key = f"{group}_cases"
        for case in data.get(key, []):
            r = run_case(group, case)
            results.append(r)

    # 终端输出
    total  = len(results)
    passed = sum(1 for r in results if r.passed)
    failed = total - passed

    border = "=" * 56
    print()
    print(border)
    print("  ARIA HITL 触发规则验证")
    print(border)

    current_group = ""
    for r in results:
        grp = r.case_id[:2]
        if grp != current_group:
            current_group = grp
            label = {"L1": "L1 低置信触发", "L2": "L2 完整性触发",
                     "L3": "L3 逻辑一致性触发", "L4": "L4 合理性Gate触发"}.get(grp, grp)
            print(f"\n  --- {label} ---")
        icon = "OK" if r.passed else "FAIL"
        trig = f"触发({r.actual.level})" if r.actual.triggered else "不触发"
        print(f"  [{icon}] {r.case_id:<8}  {trig:<12}  {r.desc[:38]}")
        if not r.passed:
            print(f"         预期: {'触发('+r.expected_level+')' if r.expected_trigger else '不触发'}"
                  f"  实测: {trig}")
            print(f"         原因: {r.actual.reason}")

    print()
    print(border)
    print(f"  总用例数   : {total}")
    print(f"  通过       : {passed}")
    print(f"  失败       : {failed}")
    if failed == 0:
        print(f"  结论       : 全部通过 — HITL 触发规则验证达标")
    else:
        print(f"  结论       : {failed} 个用例失败，请检查触发逻辑")
    print(border)
    print()

    report_path = generate_report(results, workdir)
    print(f"[完成] 验证报告: {report_path}")

    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
