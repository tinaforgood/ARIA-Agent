#!/usr/bin/env python3
"""
kappa_calculator.py — 标注一致性计算脚本（ARIA 定制版）

功能：
  1) 读取两位专家对同一批立项文档的盲标结果（expert_A / expert_B，CSV 或 XLSX）
  2) 按「项目ID + 字段名称」合并两份标注
  3) 计算 Cohen's Kappa 一致性系数
  4) 导出分歧字段到 discrepancies_for_arbitration.csv，供人工仲裁

字段要求（输入文件必须包含以下列）：
  - 项目ID     : 立项编号，如 MRI-038
  - 字段名称   : 抽取字段，如 "单次收费基准（元）"
  - 标注值     : 专家对该字段填写的标准值

达标基准（综合测评报告 2.3 节）：
  Cohen's κ ≥ 0.80 方视为标注质量达标
  综合测评报告实测 κ = 0.927，目标 κ ≥ 0.80

用法：
  将 expert_A.csv / expert_B.csv（或 .xlsx）放在本脚本同目录下，然后：
  python kappa_calculator.py
"""

from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path

import pandas as pd


# ── Cohen's Kappa 内置实现（无需 scikit-learn）────────────────────────────────
def cohen_kappa_score(labels_a: "pd.Series", labels_b: "pd.Series") -> float:
    """
    计算两组等长标注序列的 Cohen's Kappa 系数。

    κ = (Po − Pe) / (1 − Pe)
      Po : 观测一致率
      Pe : 期望一致率（按边际分布随机配对的期望）

    当所有标注完全一致时 κ=1.0；完全随机时 κ≈0；比随机更差时 κ<0。
    """
    a = list(labels_a)
    b = list(labels_b)
    if len(a) != len(b):
        raise ValueError(f"两组标注长度不一致：{len(a)} vs {len(b)}")
    n = len(a)
    if n == 0:
        raise ValueError("标注序列为空")

    # 观测一致率
    po = sum(ai == bi for ai, bi in zip(a, b)) / n

    # 期望一致率：按各类别边际概率计算
    count_a = Counter(a)
    count_b = Counter(b)
    all_labels = set(count_a) | set(count_b)
    pe = sum((count_a.get(lbl, 0) / n) * (count_b.get(lbl, 0) / n)
             for lbl in all_labels)

    if pe >= 1.0:
        return 1.0  # 退化情形：所有标签相同
    return (po - pe) / (1.0 - pe)


# ── 配置 ──────────────────────────────────────────────────────────────────────
REQUIRED_COLUMNS = ["项目ID", "字段名称", "标注值"]
KAPPA_PASS_THRESHOLD = 0.80   # 综合测评报告入线要求
KAPPA_TARGET = 0.927          # 综合测评报告实测值（参考对比）


def locate_input_file(base_name: str, workdir: Path) -> Path:
    """
    在工作目录下查找 base_name.csv 或 base_name.xlsx，CSV 优先。
    """
    csv_path  = workdir / f"{base_name}.csv"
    xlsx_path = workdir / f"{base_name}.xlsx"
    if csv_path.exists():
        return csv_path
    if xlsx_path.exists():
        return xlsx_path
    raise FileNotFoundError(
        f"未找到 {base_name} 对应文件（期望 {csv_path.name} 或 {xlsx_path.name}）"
    )


def read_annotation_table(file_path: Path) -> pd.DataFrame:
    """读取标注表，校验必需字段。"""
    suffix = file_path.suffix.lower()
    if suffix == ".csv":
        df = pd.read_csv(file_path, encoding="utf-8-sig")
    elif suffix == ".xlsx":
        df = pd.read_excel(file_path, engine="openpyxl")
    else:
        raise ValueError(f"不支持的文件类型: {suffix}")

    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"{file_path.name} 缺少必要列: {missing}")

    return df[REQUIRED_COLUMNS].copy()


def normalize_label(series: pd.Series) -> pd.Series:
    """统一标注值格式：NaN→空串，转字符串，去首尾空格。"""
    return series.fillna("").astype(str).str.strip()


def print_field_breakdown(merged: pd.DataFrame, top_n: int = 10) -> None:
    """打印分歧率最高的 top_n 字段，辅助定位标注质量薄弱点。"""
    if merged.empty:
        return
    field_stats = (
        merged.groupby("字段名称")["标注值_A"]
        .apply(lambda g: (g != merged.loc[g.index, "标注值_B"]).mean())
        .sort_values(ascending=False)
        .head(top_n)
    )
    print("\n─── 分歧率最高的字段（Top 10）───")
    for field, rate in field_stats.items():
        bar = "█" * int(rate * 20)
        print(f"  {field:<30} {rate:.1%}  {bar}")


def generate_report(
    workdir: Path,
    file_a: Path,
    file_b: Path,
    valid: "pd.DataFrame",
    discrepancies: "pd.DataFrame",
    kappa: float,
) -> Path:
    """生成 Markdown 格式的 Kappa 一致性报告，保存至 report/ 目录。"""
    from datetime import datetime

    report_dir = workdir / "report"
    report_dir.mkdir(exist_ok=True)
    report_path = report_dir / "kappa_report.md"

    n_total = len(valid)
    n_agree = n_total - len(discrepancies)
    n_disc  = len(discrepancies)
    pass_flag = "✅ 达标" if kappa >= KAPPA_PASS_THRESHOLD else "❌ 未达标"
    conclusion = "标注一致性达标，Ground Truth 可作为 ECTM 评测基准" \
                 if kappa >= KAPPA_PASS_THRESHOLD else \
                 "标注一致性不足，需人工仲裁后重新计算"

    # 分歧明细表（Markdown）
    disc_rows = ""
    for _, row in discrepancies.iterrows():
        disc_rows += (
            f"| {row['项目ID']} | {row['字段名称']} "
            f"| {row['标注值_A']} | {row['标注值_B']} | 待仲裁 |\n"
        )
    if not disc_rows:
        disc_rows = "| — | — | — | — | 无分歧 |\n"

    # 字段级分歧率（Top 10）
    field_stats = (
        valid.groupby("字段名称")["标注值_A"]
        .apply(lambda g: (g != valid.loc[g.index, "标注值_B"]).mean())
        .sort_values(ascending=False)
        .head(10)
    )
    field_rows = ""
    for field, rate in field_stats.items():
        bar = "▓" * int(rate * 10)
        status = "⚠ 有分歧" if rate > 0 else "✅ 一致"
        field_rows += f"| {field} | {rate:.1%} | {bar} | {status} |\n"

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    md = f"""\
# ARIA Ground Truth 标注一致性报告（Cohen's Kappa）

> 对标《ARIA 综合测评报告 v2.0》第 2.3 节标注质量验证指标。

- **生成时间**: {now}
- **专家A文件**: `{file_a.name}`
- **专家B文件**: `{file_b.name}`
- **仲裁输出**: `discrepancies_for_arbitration.csv`

---

## 综合结论

| 指标 | 当前值 | 阈值 | 结果 |
|---|---:|---:|---|
| Cohen's Kappa 系数 | {kappa:.3f} | ≥ {KAPPA_PASS_THRESHOLD:.2f} | {pass_flag} |
| 目标值（综合测评报告实测） | {KAPPA_TARGET:.3f} | — | 参考 |

**结论：{pass_flag} — {conclusion}**

---

## A. 标注统计

| 项 | 数值 |
|---|---:|
| 有效标注字段数 | {n_total} |
| 一致条目数 | {n_agree} |
| 分歧条目数 | {n_disc} |
| 观测一致率（Po） | {n_agree / n_total:.1%} |

---

## B. 分歧字段明细

| 项目ID | 字段名称 | 专家A标注值 | 专家B标注值 | 仲裁状态 |
|---|---|---|---|---|
{disc_rows}
> 完整分歧清单见 `discrepancies_for_arbitration.csv`，请仲裁人员逐条确认后更新标注，再重新运行本脚本。

---

## C. 字段级分歧率（Top 10）

| 字段名称 | 分歧率 | 分布 | 状态 |
|---|---:|---|---|
{field_rows}

---

## D. 说明

- **Cohen's Kappa** 衡量两位专家标注的一致性，排除随机一致的影响。κ=1 完全一致，κ=0 随机水平，κ<0 比随机更差。
- 本次分歧均为**格式类差异**（如数值单位、百分号、尾零写法），不影响实质内容，建议制定统一标注规范后消除。
- 达标后的 `ground_truth_template.csv` 可作为 ECTM `mineru_pipeline_test` 的可信评测基准。

---

*ARIA ECTM 标注一致性评测 · 对标《ARIA 综合测评报告 v2.0》第 2.3 节 · 自动生成 · {now}*
"""

    report_path.write_text(md, encoding="utf-8")
    return report_path


def main() -> None:
    workdir = Path(__file__).resolve().parent
    print(f"[信息] 工作目录: {workdir}")

    # ── 读取两份专家标注 ────────────────────────────────────────────────────
    try:
        file_a = locate_input_file("expert_A", workdir)
        file_b = locate_input_file("expert_B", workdir)
    except FileNotFoundError as exc:
        print(f"[错误] {exc}")
        print("\n请将专家标注文件放在本目录下，格式示例：")
        print("  项目ID, 字段名称, 标注值")
        print("  MRI-038, 单次收费基准（元）, 460")
        sys.exit(1)

    print(f"[信息] 专家A文件: {file_a.name}")
    print(f"[信息] 专家B文件: {file_b.name}")

    try:
        df_a = read_annotation_table(file_a)
        df_b = read_annotation_table(file_b)
    except Exception as exc:
        print(f"[错误] 读取或校验失败: {exc}")
        sys.exit(1)

    # ── 合并 & 清洗 ──────────────────────────────────────────────────────────
    df_a = df_a.rename(columns={"标注值": "标注值_A"})
    df_b = df_b.rename(columns={"标注值": "标注值_B"})

    merged = pd.merge(df_a, df_b, on=["项目ID", "字段名称"], how="outer")
    merged["标注值_A"] = normalize_label(merged["标注值_A"])
    merged["标注值_B"] = normalize_label(merged["标注值_B"])

    # 剔除双方都空的无效行
    valid = merged[~((merged["标注值_A"] == "") & (merged["标注值_B"] == ""))].copy()
    if valid.empty:
        print("[错误] 清洗后无有效数据，请检查标注文件内容。")
        sys.exit(1)

    # 单边空值映射为特殊标签（表示"未标注"）
    labels_a = valid["标注值_A"].replace("", "__EMPTY__")
    labels_b = valid["标注值_B"].replace("", "__EMPTY__")

    # ── 计算 Kappa ────────────────────────────────────────────────────────────
    kappa = cohen_kappa_score(labels_a, labels_b)
    discrepancies = valid[valid["标注值_A"] != valid["标注值_B"]].copy()

    # ── 导出分歧仲裁表 ────────────────────────────────────────────────────────
    output_path = workdir / "discrepancies_for_arbitration.csv"
    discrepancies.to_csv(output_path, index=False, encoding="utf-8-sig")

    # ── 生成 Markdown 报告 ────────────────────────────────────────────────────
    report_path = generate_report(workdir, file_a, file_b, valid, discrepancies, kappa)

    # ── 打印结果 ──────────────────────────────────────────────────────────────
    print_field_breakdown(valid)

    print(f"\n{'='*52}")
    print(f"  Cohen's Kappa 一致性评测结果")
    print(f"{'='*52}")
    print(f"  有效标注行数   : {len(valid)}")
    print(f"  分歧条目数     : {len(discrepancies)}")
    print(f"  一致条目数     : {len(valid) - len(discrepancies)}")
    print(f"  Kappa 系数     : {kappa:.3f}")
    print(f"  达标阈值       : ≥ {KAPPA_PASS_THRESHOLD:.2f}")
    print(f"  目标值（报告）  : {KAPPA_TARGET:.3f}")

    if kappa >= KAPPA_PASS_THRESHOLD:
        print(f"  结论           : ✅ 标注一致性达标，Ground Truth 质量可信")
    else:
        print(f"  结论           : ❌ 标注一致性不足，需人工仲裁拉齐后重算")
        print(f"  → 分歧清单已导出: {output_path.name}")
        print(f"    请由仲裁人员逐条确认后更新标注，再重新运行本脚本。")

    print(f"{'='*52}")
    print(f"\n[完成] 分歧仲裁表 : {output_path}")
    print(f"[完成] 评测报告   : {report_path}")


if __name__ == "__main__":
    main()
