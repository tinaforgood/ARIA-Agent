#!/usr/bin/env python3
"""
MriAgent API 测试脚本
用法：python test_api.py [--base http://120.55.247.187:8000]
"""

import argparse
import json
import sys
import tempfile
import os
import time
from pathlib import Path

try:
    import requests
except ImportError:
    print("❌ 缺少 requests 库，请运行: pip install requests")
    sys.exit(1)

# ── 颜色输出 ─────────────────────────────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
RESET  = "\033[0m"
BOLD   = "\033[1m"

def ok(msg):    print(f"  {GREEN}✓{RESET} {msg}")
def fail(msg):  print(f"  {RED}✗{RESET} {msg}")
def warn(msg):  print(f"  {YELLOW}⚠{RESET} {msg}")
def info(msg):  print(f"  {CYAN}→{RESET} {msg}")
def section(title): print(f"\n{BOLD}{'─'*50}{RESET}\n{BOLD}{title}{RESET}")

# ── 测试状态统计 ──────────────────────────────────────────────────────────────
results = {"pass": 0, "fail": 0, "skip": 0}

def assert_status(resp, expected, label=""):
    if resp.status_code == expected:
        ok(f"{label} → HTTP {resp.status_code}")
        results["pass"] += 1
        return True
    else:
        fail(f"{label} → 期望 HTTP {expected}，实际 HTTP {resp.status_code}")
        try:
            detail = resp.json().get("detail", resp.text[:200])
        except Exception:
            detail = resp.text[:200]
        info(f"响应: {detail}")
        results["fail"] += 1
        return False

def print_json(data, indent=4):
    print(json.dumps(data, ensure_ascii=False, indent=indent))


# ═════════════════════════════════════════════════════════════════════════════
def run_tests(BASE: str):
    s = requests.Session()
    s.timeout = 15

    # ── 0. 连通性 ─────────────────────────────────────────────────────────────
    section("0. 连通性检查")
    try:
        resp = s.get(f"{BASE}/health")
        assert_status(resp, 200, "GET /health")
        ok(f"响应内容: {resp.json()}")
    except requests.exceptions.ConnectionError:
        fail(f"无法连接到 {BASE}，请确认服务已启动！")
        sys.exit(1)
    except requests.exceptions.Timeout:
        fail("连接超时（>15s）")
        sys.exit(1)

    # ── 1. Case 列表（初始状态）───────────────────────────────────────────────
    section("1. GET /api/cases（列出所有 Case）")
    resp = s.get(f"{BASE}/api/cases")
    if assert_status(resp, 200, "GET /api/cases"):
        cases = resp.json()
        info(f"当前已有 Case 数量: {len(cases)}")
        if cases:
            info(f"最新一条: case_id={cases[0].get('case_id')}, status={cases[0].get('status')}")

    # ── 2. 新建 Case ──────────────────────────────────────────────────────────
    section("2. POST /api/cases（新建 Case）")
    resp = s.post(f"{BASE}/api/cases", data={"hospital_name": "测试医院_AutoTest"})
    case_id = None
    if assert_status(resp, 200, "POST /api/cases"):
        data = resp.json()
        case_id = data.get("case_id")
        ok(f"新建 case_id: {case_id}")
        ok(f"状态: {data.get('status')}")
        ok(f"医院名称: {data.get('hospital_name')}")
        print_json(data)

    if not case_id:
        fail("无法获取 case_id，后续测试跳过")
        results["skip"] += 5
        return summarize()

    # ── 3. 查询单个 Case ──────────────────────────────────────────────────────
    section(f"3. GET /api/cases/{{case_id}}（查询 Case 详情）")
    resp = s.get(f"{BASE}/api/cases/{case_id}")
    assert_status(resp, 200, f"GET /api/cases/{case_id}")
    if resp.status_code == 200:
        print_json(resp.json())

    # ── 4. 更新 Case ──────────────────────────────────────────────────────────
    section("4. PATCH /api/cases/{case_id}（更新医院名称）")
    resp = s.patch(f"{BASE}/api/cases/{case_id}", data={"hospital_name": "更新后医院名称_AutoTest"})
    if assert_status(resp, 200, "PATCH /api/cases/{case_id}"):
        ok(f"更新后医院名称: {resp.json().get('hospital_name')}")

    # ── 5. 文件列表（空）─────────────────────────────────────────────────────
    section("5. GET /api/cases/{case_id}/files（查询文件列表，应为空）")
    resp = s.get(f"{BASE}/api/cases/{case_id}/files")
    if assert_status(resp, 200, "GET /api/cases/{case_id}/files"):
        files = resp.json()
        if files:
            ok(f"已有文件分类: {list(files.keys())}")
        else:
            ok("文件列表为空（符合预期）")

    # ── 6. 分析 PDF（构造最小合法 PDF）───────────────────────────────────────
    section("6. POST /api/cases/{case_id}/analyze（分析 PDF 章节）")
    minimal_pdf = (
        b"%PDF-1.4\n"
        b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
        b"3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R"
        b"/Contents 4 0 R/Resources<</Font<</F1<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>>>>>>>endobj\n"
        b"4 0 obj<</Length 44>>\nstream\nBT /F1 12 Tf 72 720 Td (Test Page) Tj ET\nendstream\nendobj\n"
        b"xref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n"
        b"0000000058 00000 n\n0000000115 00000 n\n0000000274 00000 n\n"
        b"trailer<</Size 5/Root 1 0 R>>\nstartxref\n370\n%%EOF"
    )
    resp = s.post(
        f"{BASE}/api/cases/{case_id}/analyze",
        files={"file": ("test.pdf", minimal_pdf, "application/pdf")},
    )
    if resp.status_code == 200:
        assert_status(resp, 200, "POST /api/cases/{case_id}/analyze")
        data = resp.json()
        ok(f"总页数: {data.get('total_pages')}")
        ok(f"识别章节数: {len(data.get('sections', []))}")
        for sec in data.get("sections", []):
            info(f"  {sec.get('pages')} → {sec.get('category_name')} ({sec.get('item_id')})")
    elif resp.status_code == 422:
        warn(f"PDF 解析失败（最小 PDF 可能被拒绝）: {resp.json().get('detail', '')}")
        results["skip"] += 1
    else:
        assert_status(resp, 200, "POST /api/cases/{case_id}/analyze")

    # ── 7. 精准上传文件（上传最小 PDF）───────────────────────────────────────
    section("7. POST /api/cases/{case_id}/upload（精准上传文件）")
    resp = s.post(
        f"{BASE}/api/cases/{case_id}/upload",
        data={"category": "basic_info"},
        files={"file": ("基本情况表_test.pdf", minimal_pdf, "application/pdf")},
    )
    if assert_status(resp, 200, "POST /api/cases/{case_id}/upload"):
        data = resp.json()
        ok(f"保存为: {data.get('saved_as')}")
        ok(f"分类: {data.get('category_name')} ({data.get('item_id')})")
        ok(f"自动分类: {data.get('auto_classified')}")

    # ── 8. 文件列表（上传后）─────────────────────────────────────────────────
    section("8. GET /api/cases/{case_id}/files（上传后再次查询）")
    resp = s.get(f"{BASE}/api/cases/{case_id}/files")
    if assert_status(resp, 200, "GET /api/cases/{case_id}/files（上传后）"):
        files = resp.json()
        ok(f"已有文件分类: {list(files.keys())}")
        print_json(files)

    # ── 9. 触发流水线 ─────────────────────────────────────────────────────────
    section("9. POST /api/cases/{case_id}/run（触发 Agent 流水线）")
    resp = s.post(f"{BASE}/api/cases/{case_id}/run")
    pipeline_started = False
    if assert_status(resp, 200, "POST /api/cases/{case_id}/run"):
        ok(resp.json().get("message", ""))
        pipeline_started = True

    # ── 10. 重复触发（应返回 409）────────────────────────────────────────────
    section("10. POST /api/cases/{case_id}/run（重复触发，应返回 409 或 200）")
    resp2 = s.post(f"{BASE}/api/cases/{case_id}/run")
    if resp2.status_code == 409:
        ok(f"HTTP 409 冲突（符合预期，流水线已在运行）")
        results["pass"] += 1
    elif resp2.status_code == 200:
        warn("HTTP 200（流水线状态变化太快，已完成或尚未启动）")
        results["skip"] += 1
    else:
        fail(f"期望 409，实际 {resp2.status_code}")
        results["fail"] += 1

    # ── 11. Agent 进度 ────────────────────────────────────────────────────────
    section("11. GET /api/cases/{case_id}/agent-progress（Agent 完成进度）")
    resp = s.get(f"{BASE}/api/cases/{case_id}/agent-progress")
    if assert_status(resp, 200, "GET /api/cases/{case_id}/agent-progress"):
        data = resp.json()
        ok(f"Case 状态: {data.get('case_status')}")
        ok(f"完成进度: {data.get('done_count')}/{data.get('total')}")
        for ag in data.get("agents", []):
            status_icon = "✓" if ag["status"] == "done" else ("▶" if ag["status"] == "active" else "○")
            info(f"  {status_icon} A{ag['id']} {ag['label']}: {ag['status']}")

    # ── 12. Snapshot（流水线完成前应为 404）──────────────────────────────────
    section("12. GET /api/cases/{case_id}/snapshot（快照，流水线完成前应 404）")
    resp = s.get(f"{BASE}/api/cases/{case_id}/snapshot")
    if resp.status_code == 404:
        ok(f"HTTP 404（符合预期，ingest 尚未完成）: {resp.json().get('detail', '')}")
        results["pass"] += 1
    elif resp.status_code == 200:
        ok("HTTP 200（快照已存在）")
        results["pass"] += 1
        info(f"Snapshot keys: {list(resp.json().keys())}")
    else:
        fail(f"意外状态码: {resp.status_code}")
        results["fail"] += 1

    # ── 13. 合理性判定（流水线完成前应为 404）────────────────────────────────
    section("13. GET /api/cases/{case_id}/rationality（合理性判定）")
    resp = s.get(f"{BASE}/api/cases/{case_id}/rationality")
    if resp.status_code == 404:
        ok(f"HTTP 404（符合预期，流水线未完成）")
        results["pass"] += 1
    elif resp.status_code == 200:
        ok("HTTP 200（判定结果已存在）")
        results["pass"] += 1
        print_json(resp.json())
    else:
        fail(f"意外状态码: {resp.status_code}")
        results["fail"] += 1

    # ── 14. 任务概览（流水线完成前应为 404）──────────────────────────────────
    section("14. GET /api/cases/{case_id}/task_overview（任务概览）")
    resp = s.get(f"{BASE}/api/cases/{case_id}/task_overview")
    if resp.status_code == 404:
        ok(f"HTTP 404（符合预期，流水线未完成）")
        results["pass"] += 1
    elif resp.status_code == 200:
        ok("HTTP 200")
        results["pass"] += 1
        print_json(resp.json())
    else:
        fail(f"意外状态码: {resp.status_code}")
        results["fail"] += 1

    # ── 15. 文档下载（流水线完成前应为 404）──────────────────────────────────
    section("15. GET /api/cases/{case_id}/document（下载立项建议书）")
    resp = s.get(f"{BASE}/api/cases/{case_id}/document")
    if resp.status_code == 404:
        ok(f"HTTP 404（符合预期，文书尚未生成）")
        results["pass"] += 1
    elif resp.status_code == 200:
        ok(f"HTTP 200，文件大小: {len(resp.content)} bytes")
        results["pass"] += 1
    else:
        fail(f"意外状态码: {resp.status_code}")
        results["fail"] += 1

    # ── 16. 兼容旧 Snapshot 接口 ─────────────────────────────────────────────
    section("16. GET /api/snapshot（兼容旧接口）")
    resp = s.get(f"{BASE}/api/snapshot")
    if resp.status_code == 200:
        ok("HTTP 200，有已完成的 Case 快照")
        data = resp.json()
        info(f"Snapshot keys: {list(data.keys())}")
        results["pass"] += 1
    elif resp.status_code == 404:
        ok(f"HTTP 404（无 done 状态 Case，符合预期）")
        results["pass"] += 1
    else:
        fail(f"意外状态码: {resp.status_code}")
        results["fail"] += 1

    # ── 17. 知识库列表 ────────────────────────────────────────────────────────
    section("17. GET /api/corpus（知识库文件列表）")
    resp = s.get(f"{BASE}/api/corpus")
    if assert_status(resp, 200, "GET /api/corpus"):
        data = resp.json()
        ok(f"知识库文件总数: {data.get('total')}")
        for dir_id, d in data.get("dirs", {}).items():
            info(f"  {dir_id}: {d.get('title')} — {d.get('count')} 个文件")

    # ── 18. 知识库上传（上传同一个测试 PDF）─────────────────────────────────
    section("18. POST /api/corpus/upload（上传到知识库）")
    resp = s.post(
        f"{BASE}/api/corpus/upload",
        data={"dir_id": "a_requirements"},
        files={"file": ("autotest_spec.pdf", minimal_pdf, "application/pdf")},
    )
    if assert_status(resp, 200, "POST /api/corpus/upload"):
        data = resp.json()
        ok(f"保存为: {data.get('saved_as')}")
        ok(f"目录: {data.get('dir_id')}")

    # ── 19. 错误场景：查询不存在的 Case ──────────────────────────────────────
    section("19. GET /api/cases/不存在的ID（应返回 404）")
    resp = s.get(f"{BASE}/api/cases/not-exist-000")
    if resp.status_code == 404:
        ok("HTTP 404（符合预期）")
        results["pass"] += 1
    else:
        fail(f"期望 404，实际 {resp.status_code}")
        results["fail"] += 1

    # ── 20. 错误场景：无材料触发流水线（应返回 422 或 409）──────────────────
    section("20. POST /api/cases（新建空 Case）→ POST /run（无材料，应返回 422）")
    resp_new = s.post(f"{BASE}/api/cases", data={"hospital_name": "空测试Case"})
    if resp_new.status_code == 200:
        empty_case_id = resp_new.json().get("case_id")
        resp_run = s.post(f"{BASE}/api/cases/{empty_case_id}/run")
        if resp_run.status_code == 422:
            ok("HTTP 422（符合预期，无材料不可运行）")
            results["pass"] += 1
        else:
            fail(f"期望 422，实际 {resp_run.status_code}: {resp_run.text[:100]}")
            results["fail"] += 1
        # 清理空 Case
        s.delete(f"{BASE}/api/cases/{empty_case_id}")
        ok(f"已清理空 Case: {empty_case_id}")
    else:
        warn("新建空 Case 失败，跳过本测试")
        results["skip"] += 1

    # ── 21. 清理测试 Case ─────────────────────────────────────────────────────
    section("21. DELETE /api/cases/{case_id}（清理测试数据）")
    # 先等一会儿，避免流水线还在跑
    time.sleep(1)
    resp = s.delete(f"{BASE}/api/cases/{case_id}")
    if resp.status_code == 200:
        ok(f"已删除 case_id: {resp.json().get('deleted')}")
        results["pass"] += 1
    elif resp.status_code == 409:
        warn("流水线仍在运行，无法删除（可手动清理）")
        info(f"case_id: {case_id}")
        results["skip"] += 1
    else:
        fail(f"删除失败: {resp.status_code} {resp.text[:100]}")
        results["fail"] += 1

    summarize()


def summarize():
    total = results["pass"] + results["fail"] + results["skip"]
    section("═" * 50)
    print(f"\n{BOLD}测试结果汇总{RESET}")
    print(f"  {GREEN}通过: {results['pass']}{RESET}")
    print(f"  {RED}失败: {results['fail']}{RESET}")
    print(f"  {YELLOW}跳过: {results['skip']}{RESET}")
    print(f"  总计: {total}")
    if results["fail"] == 0:
        print(f"\n{GREEN}{BOLD}✓ 全部通过！{RESET}")
    else:
        print(f"\n{RED}{BOLD}✗ 存在失败项，请检查上方输出{RESET}")
    print()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MriAgent API 测试脚本")
    parser.add_argument("--base", default="http://120.55.247.187:8000", help="API Base URL")
    args = parser.parse_args()

    print(f"\n{BOLD}MriAgent API 接口测试{RESET}")
    print(f"Base URL: {CYAN}{args.base}{RESET}")
    print(f"开始时间: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")

    run_tests(args.base)
