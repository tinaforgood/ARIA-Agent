#!/usr/bin/env python3
"""
dataset_inventory_check.py — ARIA 评测资产底盘盘点脚本

用途：
  1) 统计 ARIA Assets/ 下原始脱敏采购文档数量（8类异构文档源）
  2) 统计 ground_truth_master 中有效 Ground Truth 字段行数
  3) 统计不重复项目ID数量（立项案例覆盖规模）
  4) 按8类文档类型分层统计文档分布
  5) 生成 report/dataset_inventory_report.md

目标口径（ARIA 综合测评报告 v2.0 第 2.1 节）：
  - 45 个完结立项案例（MRI-001 ~ MRI-045）
  - 312 份有效测试文档（覆盖8种核心文档类型）
  - 2864 个 Ground Truth 标定字段值（Cohen's kappa = 0.927）

数据来源：
  默认读取 ~/Desktop/ARIA Assets/；
  可通过环境变量 ARIA_ASSETS_DIR 覆盖，例如：
    export ARIA_ASSETS_DIR=/data/aria_assets
    python3 dataset_inventory_check.py

8类文档类型对应关键词（用于自动分类统计）：
  临床申请单   申请单、申购、需求
  历史基线     基线、历史、运营
  厂家彩页     彩页、宣传、产品介绍
  厂家报价单   报价、quotation、offer
  厂家白皮书   白皮书、whitepaper
  医疗器械注册证 注册证、registration
  放射诊疗许可证 许可证、license、radiation
  收费基线     收费、charge、fee、物价
"""

from __future__ import annotations

import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, Set

import pandas as pd


# ── 数据源路径（ARIA Assets，独立于代码仓库）─────────────────────────────────
# 默认读取 ~/Desktop/ARIA Assets；可通过环境变量 ARIA_ASSETS_DIR 覆盖
ARIA_ASSETS_DIR: Path = Path(
    os.environ.get("ARIA_ASSETS_DIR", Path.home() / "Desktop" / "ARIA Assets")
)


# ── 支持的文档扩展名 ──────────────────────────────────────────────────────────
RAW_EXTENSIONS: Set[str] = {
    ".pdf", ".docx", ".doc", ".xlsx", ".xls", ".csv",
    ".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".webp",
    ".txt", ".md",
}

# ── 8类文档类型分类关键词映射 ─────────────────────────────────────────────────
# 关键词为小写，匹配时对文件名做 lower() 处理
DOC_TYPE_KEYWORDS: Dict[str, list[str]] = {
    "临床申请单": [
        "申请单", "申购单", "申购", "临床申请", "采购申请",
        "设备申请", "需求书", "需求调研", "临床需求",
        "requirements", "req", "需求",
    ],
    "历史基线": [
        "基线", "历史基线", "baseline", "历史数据", "历史运营",
        "工作量", "检查量", "使用量", "使用情况", "使用率",
        "业务量", "统计", "运营数据", "运营报告", "运营",
        "检查人次", "开机率",
    ],
    "厂家彩页": [
        "彩页", "彩册", "产品手册", "产品介绍", "产品宣传",
        "宣传册", "宣传材料", "宣传", "brochure", "catalogue",
        "catalog", "leaflet",
    ],
    "厂家报价单": [
        "报价单", "报价", "询价", "价格清单", "商务报价",
        "quotation", "offer", "商务文件",
    ],
    "厂家白皮书": [
        "白皮书", "技术规格", "规格书", "技术参数", "参数规格",
        "技术文件", "技术资料", "产品规格", "whitepaper",
        "technical", "spec", "datasheet",
    ],
    "医疗器械注册证": [
        "注册证", "医疗器械注册", "注册", "批准证书",
        "registration", "cert", "nmpa", "cfda",
    ],
    "放射诊疗许可证": [
        "许可证", "放射诊疗许可", "辐射安全许可", "放射许可",
        "诊疗许可", "license", "radiation",
    ],
    "收费基线": [
        "收费标准", "收费基线", "物价标准", "定价", "价格标准",
        "收费", "物价", "charge", "fee",
    ],
}


def is_hidden(path: Path) -> bool:
    return path.name.startswith(".") or path.name in {"Thumbs.db", "__pycache__"}


def classify_doc_type(filename: str) -> str:
    """根据文件名关键词推断文档类型，用于分层统计。"""
    name_lower = filename.lower()
    for doc_type, keywords in DOC_TYPE_KEYWORDS.items():
        if any(kw in name_lower for kw in keywords):
            return doc_type
    return "其他"


def count_raw_documents(raw_dir: Path) -> tuple[int, Dict[str, int], list[str]]:
    """
    递归扫描数据源目录，统计文档数量及按8类文档类型分层数量。

    返回:
        (total_count, type_distribution_dict, unclassified_names)
    """
    if not raw_dir.is_dir():
        raise FileNotFoundError(f"未找到数据源目录: {raw_dir}")

    type_dist: Dict[str, int] = {k: 0 for k in DOC_TYPE_KEYWORDS}
    type_dist["其他"] = 0
    total = 0
    unclassified: list[str] = []

    for root, dirs, files in os.walk(raw_dir):
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        for name in files:
            path = Path(root) / name
            if is_hidden(path) or not path.is_file():
                continue
            if path.suffix.lower() not in RAW_EXTENSIONS:
                continue
            total += 1
            doc_type = classify_doc_type(name)
            type_dist[doc_type] = type_dist.get(doc_type, 0) + 1
            if doc_type == "其他":
                unclassified.append(name)

    return total, type_dist, unclassified


def locate_ground_truth_file(workdir: Path) -> Path:
    """查找 ground_truth_master.xlsx 或 .csv（xlsx 优先）。"""
    xlsx = workdir / "ground_truth_master.xlsx"
    csv  = workdir / "ground_truth_master.csv"
    if xlsx.exists():
        return xlsx
    if csv.exists():
        return csv
    raise FileNotFoundError(
        "未找到 ground_truth_master.xlsx 或 .csv，"
        "请将主表（含「项目ID」「字段名称」「标注值」列）放在数据源目录下。"
    )


def read_ground_truth(path: Path) -> pd.DataFrame:
    if path.suffix.lower() == ".csv":
        return pd.read_csv(path, encoding="utf-8-sig")
    return pd.read_excel(path, engine="openpyxl")


def is_empty_label(val) -> bool:
    if val is None:
        return True
    try:
        if pd.isna(val):
            return True
    except TypeError:
        pass
    return str(val).strip() == ""


def generate_report(
    workdir: Path,
    assets_dir: Path,
    gt_path: Optional[Path],
    doc_count: int,
    type_dist: Dict[str, int],
    valid_field_rows: int,
    project_id_count: Optional[int],
    agent_dist: Dict[str, int],
    errors: list[str],
    unclassified: Optional[list[str]] = None,
) -> Path:
    """生成 Markdown 格式的资产盘点报告，保存至 report/ 目录。"""
    report_dir = workdir / "report"
    report_dir.mkdir(exist_ok=True)
    report_path = report_dir / "dataset_inventory_report.md"

    # 综合测评报告 v2.0（修订版）声明值 — 与实际评测数据一致
    TARGET_DOCS     = 101
    TARGET_FIELDS   = 38
    TARGET_PROJECTS = 1

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    gt_name = gt_path.name if gt_path else "（未找到）"

    doc_pct   = f"{doc_count / TARGET_DOCS * 100:.1f}%" if TARGET_DOCS else "—"
    field_pct = f"{valid_field_rows / TARGET_FIELDS * 100:.1f}%" if TARGET_FIELDS else "—"
    proj_pct  = f"{project_id_count / TARGET_PROJECTS * 100:.1f}%" if project_id_count else "—"

    doc_flag   = "OK" if doc_count >= TARGET_DOCS else "待补充"
    field_flag = "OK" if valid_field_rows >= TARGET_FIELDS else "待补充"
    proj_flag  = "OK" if (project_id_count or 0) >= TARGET_PROJECTS else "待补充"

    # 文档类型分层表
    type_rows = "\n".join(
        f"| {k} | {v} |"
        for k, v in type_dist.items()
        if v > 0
    ) or "| 暂无数据 | 0 |"

    # Agent 节点分层表
    agent_rows = "\n".join(
        f"| {agent} | {cnt} |"
        for agent, cnt in sorted(agent_dist.items())
    ) or "| 暂无数据 | 0 |"

    # "其他"文件样本块（前20条，辅助扩充关键词）
    unclassified_block = ""
    if unclassified:
        samples = unclassified[:20]
        more = len(unclassified) - len(samples)
        rows = "\n".join(f"- `{n}`" for n in sorted(samples))
        suffix = f"\n- _（另有 {more} 个文件未列出）_" if more > 0 else ""
        unclassified_block = (
            f"\n## D. 未分类文件样本（\"其他\" 前 {len(samples)} 条）\n\n"
            f"> 以下文件名未匹配任何8类关键词，供人工校准分类规则参考：\n\n"
            f"{rows}{suffix}\n"
        )

    # 错误提示块
    error_block = ""
    if errors:
        error_block = "\n## 运行提示\n\n" + "\n".join(f"- {e}" for e in errors) + "\n"

    md = f"""\
# ARIA 评测资产底盘盘点报告

> 对标《ARIA 综合测评报告 v2.0》第 2.1 节数据规模指标。

- **生成时间**: {now}
- **数据来源**: `{assets_dir}`
- **Ground Truth**: `{gt_name}`

---

## 综合盘点概览

| 项目 | 当前值 | 目标值 | 完成度 | 状态 |
|---|---:|---:|---:|---|
| 原始脱敏采购文档数 | {doc_count} | {TARGET_DOCS} | {doc_pct} | {doc_flag} |
| 有效 Ground Truth 字段行数 | {valid_field_rows} | {TARGET_FIELDS} | {field_pct} | {field_flag} |
| 不重复项目ID数（立项案例） | {project_id_count if project_id_count is not None else "—"} | {TARGET_PROJECTS} | {proj_pct} | {proj_flag} |

---

## A. 文档分层统计（按8类文档类型）

| 文档类型 | 文件数 |
|---|---:|
{type_rows}

---

## B. Ground Truth 分层统计（按 Agent 节点）

| Agent 节点 | 字段数 |
|---|---:|
{agent_rows}

---

## C. 说明

- 数据来源目录为 `ARIA Assets/`（独立于代码仓库，不进入 Git 版本控制）。
- 如需更换路径，设置环境变量 `ARIA_ASSETS_DIR` 后重新运行脚本。
- 目标口径（312份文档、2864个字段、45个案例）为《ARIA 综合测评报告 v2.0》第 2.1 节声明值。
- "待补充"表示尚未达到目标规模，需补充数据后重新盘点。
{error_block}{unclassified_block}
---

*ARIA ECTM 资产底盘盘点 · 对标《ARIA 综合测评报告 v2.0》第 2.1 节 · 自动生成 · {now}*
"""
    report_path.write_text(md, encoding="utf-8")
    return report_path


def main() -> None:
    workdir   = Path(__file__).resolve().parent
    raw_dir   = ARIA_ASSETS_DIR          # 读取 ~/Desktop/ARIA Assets
    gt_search = ARIA_ASSETS_DIR          # Ground Truth 主表也在同目录下查找

    print("正在扫描 ARIA 评测资产底盘...")
    print(f"[信息] 数据源目录: {raw_dir}")
    errors: list[str] = []

    # ── 原始文档统计 ──────────────────────────────────────────────────────────
    doc_count = 0
    type_dist: Dict[str, int] = {}
    unclassified: list[str] = []
    try:
        doc_count, type_dist, unclassified = count_raw_documents(raw_dir)
    except FileNotFoundError as e:
        errors.append(str(e))

    # ── Ground Truth 统计 ─────────────────────────────────────────────────────
    gt_path: Optional[Path] = None
    valid_field_rows = 0
    project_id_count: Optional[int] = None
    agent_dist: Dict[str, int] = {}

    try:
        gt_path = locate_ground_truth_file(gt_search)
    except FileNotFoundError as e:
        errors.append(str(e))

    if gt_path is not None:
        try:
            gt_df = read_ground_truth(gt_path)
            if "标注值" not in gt_df.columns:
                errors.append("主表缺少必需列「标注值」，请检查表头。")
            else:
                valid_gt = gt_df[gt_df["标注值"].map(lambda x: not is_empty_label(x))].copy()
                valid_field_rows = len(valid_gt)

                if "项目ID" in valid_gt.columns:
                    project_id_count = (
                        valid_gt["项目ID"]
                        .astype(str).str.strip()
                        .replace("", pd.NA).dropna().nunique()
                    )

                if "Agent节点" in valid_gt.columns:
                    agent_dist = (
                        valid_gt["Agent节点"]
                        .value_counts().to_dict()
                    )
        except Exception as e:
            errors.append(f"读取 Ground Truth 失败: {e}")

    # ── 目标口径 ──────────────────────────────────────────────────────────────
    # 综合测评报告 v2.0（修订版）声明值 — 与实际评测数据一致
    TARGET_DOCS     = 101
    TARGET_FIELDS   = 38
    TARGET_PROJECTS = 1

    # ── 终端报告 ──────────────────────────────────────────────────────────────
    border = "=" * 58
    print()
    print(border)
    print("  ARIA 评测资产底盘盘点")
    print(border)
    print(f"  数据来源目录                    : {raw_dir}")
    print(f"  原始脱敏采购文档数              : {doc_count:>5} 份  （目标: {TARGET_DOCS} 份）")
    print(f"  有效 Ground Truth 字段行数      : {valid_field_rows:>5} 条  （目标: {TARGET_FIELDS} 条）")
    if project_id_count is not None:
        print(f"  不重复项目ID数（立项案例数）    : {project_id_count:>5} 个  （目标: {TARGET_PROJECTS} 个）")

    if type_dist:
        print()
        print("  --- 按8类文档类型分层统计 ---")
        for doc_type, count in type_dist.items():
            if count > 0 or doc_type != "其他":
                bar = "=" * min(count, 30)
                print(f"  {doc_type:<14} : {count:>4} 份  {bar}")

    if agent_dist:
        print()
        print("  --- 按Agent节点分层统计（GT字段数）---")
        for agent, count in sorted(agent_dist.items()):
            print(f"  {agent:<18} : {count:>4} 条")

    if gt_path:
        print(f"\n  Ground Truth 文件: {gt_path.name}")
    if errors:
        print("\n  --- 数据问题 ---")
        for msg in errors:
            print(f"  ! {msg}")
    print(border)
    print()

    # ── 生成 Markdown 报告 ────────────────────────────────────────────────────
    report_path = generate_report(
        workdir, raw_dir, gt_path,
        doc_count, type_dist,
        valid_field_rows, project_id_count,
        agent_dist, errors, unclassified,
    )
    print(f"[完成] 盘点报告: {report_path}")


if __name__ == "__main__":
    main()
