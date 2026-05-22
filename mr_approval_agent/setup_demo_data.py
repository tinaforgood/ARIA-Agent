#!/usr/bin/env python3
"""
setup_demo_data.py
──────────────────
MriAgent Demo 现场数据准备脚本

剧本设定：
  ① 数据冲突  — user_uploads 里含 430 元/次 的材料；
                  agent_corpus 保留 设备申购报告表2022版-3T.doc（460元/次）
  ② 合规警告  — 故意不上传飞利浦注册证，触发"飞利浦证件缺失"警告
  ③ 智能过滤  — 1.5T / 内部竞品资料留在 agent_corpus，演示自动过滤

用法：
  cd mr_approval_agent
  python setup_demo_data.py
"""

import shutil
import sys
from pathlib import Path

# ─── ANSI 颜色 ──────────────────────────────────────────────────────────────
GREEN  = "\033[92m"
YELLOW = "\033[93m"
RED    = "\033[91m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

def ok(msg: str)   -> None: print(f"  {GREEN}✓{RESET}  {msg}")
def warn(msg: str) -> None: print(f"  {YELLOW}⚠{RESET}  {msg}")
def err(msg: str)  -> None: print(f"  {RED}✗{RESET}  {msg}")
def info(msg: str) -> None: print(f"  {CYAN}→{RESET}  {msg}")


# ─── 路径配置 ────────────────────────────────────────────────────────────────
SCRIPT_DIR   = Path(__file__).parent.resolve()
DATASOURCE   = SCRIPT_DIR / "datasource"
CORPUS       = DATASOURCE / "agent_corpus"
USER_UPLOADS = DATASOURCE / "user_uploads"

# 目标子目录
UPLOAD_DIRS = ["01_requirements", "02_competitors", "03_compliance", "04_operations"]

# ── 复制清单：(agent_corpus 子目录, 文件名, user_uploads 子目录) ─────────────
COPY_PLAN = [
    # ── 01_requirements：含 430 元/次 → 触发冲突 ──
    (
        "a_requirements",
        "2026年度万元以上设备预算申报论证表3.0T-20260113.docx",
        "01_requirements",
    ),
    (
        "a_requirements",
        "50万元及以上医学装备可行性论证报告.docx",
        "01_requirements",
    ),

    # ── 02_competitors：飞利浦 3.0T 申报材料 ──
    (
        "b_competitors",
        "飞利浦Elition S医用磁共振成像系统-申报材料.docx",
        "02_competitors",
    ),
    (
        "b_competitors",
        "飞利浦Innovation  Ultra磁共振成像系统-申报材料.docx",
        "02_competitors",
    ),

    # ── 03_compliance：故意只传竞品证，不传飞利浦证 → 合规警告 ──
    (
        "c_compliance",
        "Pilot Performer 国械注准20243061435.pdf",
        "03_compliance",
    ),
    (
        "c_compliance",
        "国械注准20213060603-Lumina.pdf",
        "03_compliance",
    ),

    # ── 04_operations：使用效率数据 ──
    (
        "d_operations",
        "MR使用效率数据.xlsx",
        "04_operations",
    ),
]


# ─── Step 1: 清空并重建 user_uploads ────────────────────────────────────────
def reset_upload_dirs() -> None:
    print(f"\n{BOLD}Step 1 — 清空并重建 user_uploads/{RESET}")
    if USER_UPLOADS.exists():
        shutil.rmtree(USER_UPLOADS)
        info(f"已清空 {USER_UPLOADS.relative_to(SCRIPT_DIR)}")
    for d in UPLOAD_DIRS:
        (USER_UPLOADS / d).mkdir(parents=True, exist_ok=True)
        ok(f"创建 user_uploads/{d}/")


# ─── Step 2: 精准复制文件 ────────────────────────────────────────────────────
def copy_files() -> int:
    print(f"\n{BOLD}Step 2 — 精准拷贝文件（模拟用户上传）{RESET}")
    errors = 0
    for corpus_dir, filename, upload_dir in COPY_PLAN:
        src = CORPUS / corpus_dir / filename
        dst = USER_UPLOADS / upload_dir / filename
        if not src.exists():
            err(f"源文件不存在: agent_corpus/{corpus_dir}/{filename}")
            errors += 1
            continue
        shutil.copy2(src, dst)
        ok(f"agent_corpus/{corpus_dir}/{filename}")
        info(f"  → user_uploads/{upload_dir}/{filename}")
    return errors


# ─── Step 3: 打印树状目录 ───────────────────────────────────────────────────
def print_tree(root: Path, prefix: str = "") -> None:
    entries = sorted(root.iterdir(), key=lambda p: (p.is_file(), p.name))
    for i, entry in enumerate(entries):
        connector = "└── " if i == len(entries) - 1 else "├── "
        if entry.is_dir():
            print(f"{prefix}{connector}{CYAN}{entry.name}/{RESET}")
            extension = "    " if i == len(entries) - 1 else "│   "
            print_tree(entry, prefix + extension)
        else:
            print(f"{prefix}{connector}{entry.name}")


def print_summary() -> None:
    print(f"\n{BOLD}Step 3 — user_uploads/ 目录结构{RESET}")
    print(f"\n  {BOLD}{USER_UPLOADS.relative_to(SCRIPT_DIR)}/{RESET}")
    print_tree(USER_UPLOADS, prefix="  ")

    # 剧本提示
    print(f"""
{BOLD}── 剧本验证清单 ────────────────────────────────────────────{RESET}
  {GREEN}✓{RESET}  数据冲突  │ 01_requirements 含 430元/次 申报材料
              │ agent_corpus 保留 设备申购报告表2022版-3T.doc (460元/次)
  {GREEN}✓{RESET}  合规警告  │ 03_compliance 无飞利浦注册证 → 触发证件缺失警告
  {GREEN}✓{RESET}  智能过滤  │ 1.5T/内部竞品留在 agent_corpus/b_competitors
              │ (uMR 660 1.5T、Lumina内部彩页等不会出现在用户视图)
{BOLD}────────────────────────────────────────────────────────────{RESET}
""")


# ─── Main ────────────────────────────────────────────────────────────────────
def main() -> None:
    print(f"\n{BOLD}{GREEN}MriAgent Demo 数据准备脚本{RESET}")
    print(f"  数据根目录: {DATASOURCE}")

    if not CORPUS.exists():
        err(f"agent_corpus 目录不存在: {CORPUS}")
        err("请确认在 mr_approval_agent/ 目录下运行此脚本")
        sys.exit(1)

    reset_upload_dirs()
    error_count = copy_files()
    print_summary()

    if error_count:
        warn(f"完成（{error_count} 个文件未找到，请检查上方错误信息）")
        sys.exit(1)
    else:
        print(f"  {GREEN}{BOLD}✓ Demo 数据准备完毕，可以开始演示！{RESET}\n")


if __name__ == "__main__":
    main()
