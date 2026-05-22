#!/usr/bin/env python3
"""
test_env.py — 连通性自检（Qwen + MinerU CLI）
独立运行，不依赖业务代码。建议先: source mr_approval_agent/setup_env.sh
"""

from __future__ import annotations

import os
import subprocess
import sys
import time
import traceback
from typing import Optional

# ── ANSI ─────────────────────────────────────────────────────
class C:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    CYAN = "\033[96m"
    DIM = "\033[2m"
    RESET = "\033[0m"
    BOLD = "\033[1m"


def mask_secret(value: Optional[str]) -> str:
    """仅展示前 4 + *** + 后 4 位，过短则尽量不暴露全长。"""
    if not value:
        return "(空)"
    v = value.strip()
    if len(v) <= 8:
        return v[:2] + "***" + v[-2:] if len(v) > 4 else "***"
    return f"{v[:4]}***{v[-4:]}"


def ok(msg: str) -> None:
    print(f"{C.GREEN}✓{C.RESET} {msg}")


def fail(msg: str) -> None:
    print(f"{C.RED}✗{C.RESET} {msg}")


def info(msg: str) -> None:
    print(f"{C.CYAN}▸{C.RESET} {msg}")


def header(title: str) -> None:
    print()
    print(f"{C.BOLD}{C.CYAN}{'─' * 4} {title}{C.RESET}")


def main() -> int:
    print(f"{C.BOLD}MriAgent 环境连通性检查{C.RESET}")
    print(f"{C.DIM}工作目录: {os.getcwd()}{C.RESET}")

    # ── 1. 环境变量 ──────────────────────────────────────────
    header("1. 环境变量")
    ds = os.getenv("DASHSCOPE_API_KEY", "").strip()
    mu = os.getenv("MINERU_API_TOKEN", "").strip()

    info(f"DASHSCOPE_API_KEY → {mask_secret(ds)}")
    info(f"MINERU_API_TOKEN → {mask_secret(mu)}")

    if not ds:
        fail("DASHSCOPE_API_KEY 为空，请先 export 或 source setup_env.sh")
        raise ValueError("DASHSCOPE_API_KEY 未设置，无法进行 Qwen 连通性测试")
    ok("DASHSCOPE_API_KEY 已加载")
    if mu:
        ok("MINERU_API_TOKEN 已加载（MinerU API 模式时需要）")
    else:
        print(
            f"{C.YELLOW}△{C.RESET} MINERU_API_TOKEN 未设置"
            f"{C.DIM}（仅在使用 MinerU backend=api 时需要）{C.RESET}"
        )

    # ── 2. Qwen ───────────────────────────────────────────────
    header("2. Qwen (DashScope OpenAI 兼容) 连通性")
    try:
        from openai import OpenAI
    except ImportError:
        fail("未安装 openai 库，请执行: pip install openai")
        return 1

    base_url = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    client = OpenAI(api_key=ds, base_url=base_url)
    t0 = time.perf_counter()
    try:
        resp = client.chat.completions.create(
            model="qwen3-max",
            messages=[
                {"role": "system", "content": "你是一个连通性测试助手"},
                {
                    "role": "user",
                    "content": "请回复'Qwen 连通性测试成功！'",
                },
            ],
            max_tokens=64,
            timeout=60,
        )
        elapsed = time.perf_counter() - t0
        text = (resp.choices[0].message.content or "").strip()
        ok(f"请求成功，耗时 {elapsed:.2f}s")
        info(f"模型返回: {text!r}")
    except Exception:
        elapsed = time.perf_counter() - t0
        fail(f"Qwen 调用失败（已等待约 {elapsed:.2f}s）")
        print(f"{C.RED}", end="")
        traceback.print_exc()
        print(f"{C.RESET}", end="")
        return 1

    # ── 3. MinerU CLI ───────────────────────────────────────
    header("3. MinerU CLI")
    for argv in (["mineru", "--version"], ["mineru", "-h"]):
        try:
            proc = subprocess.run(
                argv,
                capture_output=True,
                text=True,
                timeout=60,
            )
        except FileNotFoundError:
            fail(
                "无法找到 mineru 命令，请确认是否已安装并在本地环境激活"
            )
            print(
                f"{C.DIM}  提示: 将 MinerU 可执行文件所在目录加入 PATH，"
                f"或先在当前 shell 激活安装该 CLI 的虚拟环境。{C.RESET}"
            )
            return 1
        except subprocess.TimeoutExpired:
            fail(f"{' '.join(argv)} 执行超时 (>60s)")
            return 1

        if proc.returncode == 0:
            ok("MinerU CLI 已安装且可被调用")
            out = (proc.stdout or proc.stderr or "").strip()
            snippet = out.replace("\n", " ")[:200]
            if len(out) > 200:
                snippet += " …"
            info(f"输出节选: {snippet or '(无文本输出)'}")
            break
    else:
        fail("mineru --version 与 mineru -h 均未返回 0")
        info(f"stderr: {(proc.stderr or '')[:500]}")
        return 1

    print()
    print(f"{C.GREEN}{C.BOLD}全部检查项通过。{C.RESET}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except ValueError as e:
        print(f"{C.RED}终止: {e}{C.RESET}")
        sys.exit(1)
