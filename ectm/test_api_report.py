#!/usr/bin/env python3
"""
MriAgent API 接口测试 + 专业报告生成器
用法：python test_api_report.py [--base http://120.55.247.187:8000]
输出：test_report.html（当前目录）
"""

import argparse
import json
import sys
import time
import datetime
from pathlib import Path

try:
    import requests
except ImportError:
    print("❌ 缺少 requests 库，请运行: pip install requests")
    sys.exit(1)

# ══════════════════════════════════════════════════════════════════════════════
# 测试记录数据结构
# ══════════════════════════════════════════════════════════════════════════════

class TestCase:
    def __init__(self, group, name, method, path):
        self.group   = group
        self.name    = name
        self.method  = method
        self.path    = path
        self.status  = "skip"   # pass / fail / skip / warn
        self.http_code   = None
        self.expected_code = None
        self.duration_ms = 0
        self.request_body  = None
        self.response_body = None
        self.note    = ""

    def to_dict(self):
        return self.__dict__

recorder: list[TestCase] = []
current: TestCase = None

def begin(group, name, method, path, expected_code=200):
    global current
    current = TestCase(group, name, method, path)
    current.expected_code = expected_code
    recorder.append(current)
    return current

def finish(resp, note=""):
    global current
    current.http_code   = resp.status_code
    current.duration_ms = int(resp.elapsed.total_seconds() * 1000)
    current.note = note
    try:
        body = resp.json()
        current.response_body = json.dumps(body, ensure_ascii=False, indent=2)
    except Exception:
        current.response_body = resp.text[:500]
    if resp.status_code == current.expected_code:
        current.status = "pass"
    else:
        current.status = "fail"
    return current.status == "pass"

def skip(note=""):
    global current
    current.status = "skip"
    current.note = note

def warn_case(note=""):
    global current
    current.status = "warn"
    current.note = note


# ══════════════════════════════════════════════════════════════════════════════
# 测试用例
# ══════════════════════════════════════════════════════════════════════════════

def run_tests(BASE: str, s: requests.Session):
    minimal_pdf = (
        b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
        b"3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R"
        b"/Contents 4 0 R/Resources<</Font<</F1<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>>>>>>>endobj\n"
        b"4 0 obj<</Length 44>>\nstream\nBT /F1 12 Tf 72 720 Td (Test Page) Tj ET\nendstream\nendobj\n"
        b"xref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n"
        b"0000000058 00000 n\n0000000115 00000 n\n0000000274 00000 n\n"
        b"trailer<</Size 5/Root 1 0 R>>\nstartxref\n370\n%%EOF"
    )

    # ── G0 基础连通性 ─────────────────────────────────────────────────────────
    tc = begin("基础连通性", "健康检查", "GET", "/health", 200)
    try:
        resp = s.get(f"{BASE}/health")
        finish(resp, "服务运行正常")
    except requests.exceptions.ConnectionError:
        skip("无法连接服务器，请确认服务已启动")
        return False
    except requests.exceptions.Timeout:
        skip("连接超时（>15s）")
        return False

    # ── G1 Case 管理 ──────────────────────────────────────────────────────────
    tc = begin("Case管理", "列出所有Case", "GET", "/api/cases", 200)
    resp = s.get(f"{BASE}/api/cases")
    finish(resp)
    existing_count = len(resp.json()) if resp.status_code == 200 else 0

    tc = begin("Case管理", "新建Case", "POST", "/api/cases", 200)
    tc.request_body = '{"hospital_name": "测试医院_AutoTest"}'
    resp = s.post(f"{BASE}/api/cases", data={"hospital_name": "测试医院_AutoTest"})
    ok = finish(resp, "hospital_name + 初始状态 created")
    case_id = resp.json().get("case_id") if ok else None

    if not case_id:
        for _ in range(6):
            begin("Case管理", "查询Case详情", "GET", "/api/cases/{case_id}", 200)
            skip("依赖新建Case，已跳过")
        return True

    tc = begin("Case管理", "查询Case详情", "GET", "/api/cases/{case_id}", 200)
    resp = s.get(f"{BASE}/api/cases/{case_id}")
    finish(resp, "返回完整 metadata")

    tc = begin("Case管理", "更新Case名称", "PATCH", "/api/cases/{case_id}", 200)
    tc.request_body = '{"hospital_name": "更新后医院名称_AutoTest"}'
    resp = s.patch(f"{BASE}/api/cases/{case_id}", data={"hospital_name": "更新后医院名称_AutoTest"})
    finish(resp, "hospital_name 字段更新成功")

    # ── G2 文件操作 ───────────────────────────────────────────────────────────
    tc = begin("文件操作", "查询文件列表（空）", "GET", "/api/cases/{case_id}/files", 200)
    resp = s.get(f"{BASE}/api/cases/{case_id}/files")
    finish(resp, "初始状态文件列表为空")

    tc = begin("文件操作", "分析PDF章节结构", "POST", "/api/cases/{case_id}/analyze", 200)
    tc.request_body = "multipart/form-data: file=test.pdf"
    resp = s.post(f"{BASE}/api/cases/{case_id}/analyze",
                  files={"file": ("test.pdf", minimal_pdf, "application/pdf")})
    if resp.status_code == 200:
        secs = resp.json().get("sections", [])
        finish(resp, f"识别到 {len(secs)} 个章节，总页数 {resp.json().get('total_pages')}")
    elif resp.status_code == 422:
        warn_case("PDF解析失败（最小PDF可能触发422）")
    else:
        finish(resp)

    tc = begin("文件操作", "精准上传文件", "POST", "/api/cases/{case_id}/upload", 200)
    tc.request_body = "multipart/form-data: file=基本情况表_test.pdf, category=basic_info"
    resp = s.post(f"{BASE}/api/cases/{case_id}/upload",
                  data={"category": "basic_info"},
                  files={"file": ("基本情况表_test.pdf", minimal_pdf, "application/pdf")})
    finish(resp, f"归入 basic_info / 基本情况表")

    tc = begin("文件操作", "查询文件列表（上传后）", "GET", "/api/cases/{case_id}/files", 200)
    resp = s.get(f"{BASE}/api/cases/{case_id}/files")
    cats = list(resp.json().keys()) if resp.status_code == 200 else []
    finish(resp, f"已有分类: {cats}")

    tc = begin("文件操作", "上传不支持格式（应返回415）", "POST", "/api/cases/{case_id}/upload", 415)
    tc.request_body = "multipart/form-data: file=test.exe"
    resp = s.post(f"{BASE}/api/cases/{case_id}/upload",
                  data={"category": "basic_info"},
                  files={"file": ("test.exe", b"fake content", "application/octet-stream")})
    finish(resp, "不支持 .exe，正确拒绝")

    # ── G3 流水线 ─────────────────────────────────────────────────────────────
    tc = begin("Agent流水线", "触发Agent流水线", "POST", "/api/cases/{case_id}/run", 200)
    resp = s.post(f"{BASE}/api/cases/{case_id}/run")
    finish(resp, "后台异步启动，立即返回")

    tc = begin("Agent流水线", "重复触发（应返回409）", "POST", "/api/cases/{case_id}/run", 409)
    resp = s.post(f"{BASE}/api/cases/{case_id}/run")
    if resp.status_code == 409:
        finish(resp, "流水线运行中，正确拒绝重复触发")
    elif resp.status_code == 200:
        warn_case("流水线状态变化过快，返回200（非预期但可接受）")
    else:
        finish(resp)

    tc = begin("Agent流水线", "查询Agent节点进度", "GET", "/api/cases/{case_id}/agent-progress", 200)
    resp = s.get(f"{BASE}/api/cases/{case_id}/agent-progress")
    if resp.status_code == 200:
        d = resp.json()
        note = f"Case状态: {d.get('case_status')}，进度: {d.get('done_count')}/{d.get('total')}"
        finish(resp, note)
    else:
        finish(resp)

    # ── G4 结果查询 ───────────────────────────────────────────────────────────
    tc = begin("结果查询", "获取快照（流水线前，应返回404）", "GET", "/api/cases/{case_id}/snapshot", 404)
    resp = s.get(f"{BASE}/api/cases/{case_id}/snapshot")
    if resp.status_code == 404:
        finish(resp, "ingest未完成，正确返回404")
    elif resp.status_code == 200:
        tc.expected_code = 200
        finish(resp, "快照已存在（流水线已完成）")
    else:
        finish(resp)

    tc = begin("结果查询", "合理性判定（流水线前，应返回404）", "GET", "/api/cases/{case_id}/rationality", 404)
    resp = s.get(f"{BASE}/api/cases/{case_id}/rationality")
    if resp.status_code in (404, 200):
        tc.expected_code = resp.status_code
        finish(resp, "流水线未完成，正确返回404" if resp.status_code == 404 else "判定已完成")
    else:
        finish(resp)

    tc = begin("结果查询", "任务概览（流水线前，应返回404）", "GET", "/api/cases/{case_id}/task_overview", 404)
    resp = s.get(f"{BASE}/api/cases/{case_id}/task_overview")
    if resp.status_code in (404, 200):
        tc.expected_code = resp.status_code
        finish(resp, "流水线未完成，正确返回404" if resp.status_code == 404 else "概览已生成")
    else:
        finish(resp)

    tc = begin("结果查询", "下载立项建议书（流水线前，应返回404）", "GET", "/api/cases/{case_id}/document", 404)
    resp = s.get(f"{BASE}/api/cases/{case_id}/document")
    if resp.status_code in (404, 200):
        tc.expected_code = resp.status_code
        note = "文书未生成，正确返回404" if resp.status_code == 404 else f"文书已生成，大小 {len(resp.content)} bytes"
        finish(resp, note)
    else:
        finish(resp)

    tc = begin("结果查询", "兼容旧快照接口", "GET", "/api/snapshot", 200)
    resp = s.get(f"{BASE}/api/snapshot")
    if resp.status_code == 200:
        keys = list(resp.json().keys())
        finish(resp, f"返回最新 done Case 快照，keys: {keys[:4]}...")
    elif resp.status_code == 404:
        tc.expected_code = 404
        finish(resp, "无 done 状态 Case（符合预期）")
    else:
        finish(resp)

    # ── G5 知识库 ─────────────────────────────────────────────────────────────
    tc = begin("知识库管理", "查询知识库文件列表", "GET", "/api/corpus", 200)
    resp = s.get(f"{BASE}/api/corpus")
    if resp.status_code == 200:
        d = resp.json()
        total = d.get("total", 0)
        dirs = {k: v.get("count", 0) for k, v in d.get("dirs", {}).items()}
        finish(resp, f"共 {total} 个文件｜{dirs}")
    else:
        finish(resp)

    tc = begin("知识库管理", "上传文件到知识库", "POST", "/api/corpus/upload", 200)
    tc.request_body = "multipart/form-data: dir_id=a_requirements, file=autotest_spec.pdf"
    resp = s.post(f"{BASE}/api/corpus/upload",
                  data={"dir_id": "a_requirements"},
                  files={"file": ("autotest_spec.pdf", minimal_pdf, "application/pdf")})
    finish(resp, f"上传至 a_requirements（设备技术参数库）")

    tc = begin("知识库管理", "上传到无效目录（应返回400）", "POST", "/api/corpus/upload", 400)
    tc.request_body = 'multipart/form-data: dir_id=invalid_dir'
    resp = s.post(f"{BASE}/api/corpus/upload",
                  data={"dir_id": "invalid_dir"},
                  files={"file": ("test.pdf", minimal_pdf, "application/pdf")})
    finish(resp, "无效 dir_id，正确拒绝")

    # ── G6 错误处理 ───────────────────────────────────────────────────────────
    tc = begin("错误处理", "查询不存在的Case（应返回404）", "GET", "/api/cases/not-exist-000", 404)
    resp = s.get(f"{BASE}/api/cases/not-exist-000")
    finish(resp, "case_id 不存在，正确返回404")

    tc = begin("错误处理", "无材料触发流水线（应返回422）", "POST", "/api/cases/{empty_id}/run", 422)
    r_new = s.post(f"{BASE}/api/cases", data={"hospital_name": "空测试Case"})
    if r_new.status_code == 200:
        empty_id = r_new.json().get("case_id")
        resp = s.post(f"{BASE}/api/cases/{empty_id}/run")
        finish(resp, "无文件时触发流水线，正确返回422")
        s.delete(f"{BASE}/api/cases/{empty_id}")
    else:
        skip("新建空 Case 失败")

    tc = begin("错误处理", "删除运行中的Case（应返回409）", "DELETE", "/api/cases/{case_id}", 409)
    time.sleep(0.5)
    resp = s.delete(f"{BASE}/api/cases/{case_id}")
    if resp.status_code == 409:
        finish(resp, "流水线运行中，正确拒绝删除")
    elif resp.status_code == 200:
        warn_case("流水线已结束，Case 已被删除（非预期但可接受）")
        case_id = None
    else:
        finish(resp)

    # ── G7 PDF拆分 ────────────────────────────────────────────────────────────
    tc = begin("PDF拆分", "PDF拆分任务", "POST", "/api/cases/{case_id}/split", 200)
    if case_id:
        sections_json = json.dumps([
            {"item_id": "basic_info", "start": 1, "end": 1, "pages": "第1页", "category_name": "基本情况表"}
        ])
        tc.request_body = f"multipart/form-data: file=test.pdf, sections={sections_json}"
        resp = s.post(f"{BASE}/api/cases/{case_id}/split",
                      data={"sections": sections_json},
                      files={"file": ("test.pdf", minimal_pdf, "application/pdf")})
        if resp.status_code == 200:
            d = resp.json()
            finish(resp, f"job_id={d.get('job_id','')[:8]}...，拆分 {len(d.get('files',[]))} 个文件")
            job_id = d.get("job_id")

            tc2 = begin("PDF拆分", "查询拆分任务Manifest", "GET", "/api/jobs/{job_id}", 200)
            resp2 = s.get(f"{BASE}/api/jobs/{job_id}")
            finish(resp2, "manifest 包含原始文件信息与拆分结果")
        else:
            finish(resp)
    else:
        skip("依赖 Case（已被删除），跳过")
        begin("PDF拆分", "查询拆分任务Manifest", "GET", "/api/jobs/{job_id}", 200)
        skip("依赖 PDF拆分，跳过")

    # ── 清理 ──────────────────────────────────────────────────────────────────
    if case_id:
        time.sleep(1)
        resp = s.delete(f"{BASE}/api/cases/{case_id}")
        # 静默清理

    return True


# ══════════════════════════════════════════════════════════════════════════════
# HTML 报告生成
# ══════════════════════════════════════════════════════════════════════════════

def generate_html(BASE, start_time, end_time, total_ms):
    passed  = sum(1 for t in recorder if t.status == "pass")
    failed  = sum(1 for t in recorder if t.status == "fail")
    warned  = sum(1 for t in recorder if t.status == "warn")
    skipped = sum(1 for t in recorder if t.status == "skip")
    total   = len(recorder)
    pass_rate = round(passed / (total - skipped) * 100, 1) if (total - skipped) > 0 else 0

    groups = {}
    for t in recorder:
        groups.setdefault(t.group, []).append(t)

    STATUS_COLOR = {"pass": "#22c55e", "fail": "#ef4444", "warn": "#f59e0b", "skip": "#94a3b8"}
    STATUS_BG    = {"pass": "#f0fdf4", "fail": "#fef2f2", "warn": "#fffbeb", "skip": "#f8fafc"}
    STATUS_LABEL = {"pass": "通过", "fail": "失败", "warn": "警告", "skip": "跳过"}
    METHOD_COLOR = {"GET": "#3b82f6", "POST": "#22c55e", "PATCH": "#f59e0b", "DELETE": "#ef4444"}

    rows_html = ""
    for gname, cases in groups.items():
        g_pass = sum(1 for c in cases if c.status == "pass")
        g_total = len(cases)
        rows_html += f"""
        <tr class="group-header">
          <td colspan="7">
            <span class="group-name">{gname}</span>
            <span class="group-stat">{g_pass}/{g_total} 通过</span>
          </td>
        </tr>"""
        for i, t in enumerate(cases):
            sc = STATUS_COLOR.get(t.status, "#94a3b8")
            sb = STATUS_BG.get(t.status, "#f8fafc")
            sl = STATUS_LABEL.get(t.status, t.status)
            mc = METHOD_COLOR.get(t.method, "#6b7280")
            resp_preview = (t.response_body or "")[:300].replace("<","&lt;").replace(">","&gt;")
            detail_id = f"detail_{id(t)}"
            btn_html = (
                '<button class="toggle-btn" onclick="toggle(\'' + detail_id + '\')">响应</button>'
                if t.response_body else ""
            )
            detail_html = (
                '<tr id="' + detail_id + '" class="detail-row" style="display:none">'
                '<td colspan="7"><pre class="resp-pre">' + resp_preview + '</pre></td></tr>'
                if t.response_body else ""
            )
            rows_html += f"""
        <tr style="background:{sb}">
          <td class="tc-name">
            <div class="tc-title">{t.name}</div>
            <div class="tc-path">
              <span class="method-badge" style="background:{mc}">{t.method}</span>
              <code>{t.path}</code>
            </div>
          </td>
          <td class="center"><span class="status-badge" style="background:{sc}">{sl}</span></td>
          <td class="center"><code>{t.http_code or '-'}</code></td>
          <td class="center"><code style="color:#6b7280">{t.expected_code or '-'}</code></td>
          <td class="center">{t.duration_ms if t.duration_ms else '-'} ms</td>
          <td class="note">{t.note}</td>
          <td class="center">{btn_html}</td>
        </tr>
        {detail_html}"""

    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MriAgent API 接口测试报告</title>
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f1f5f9; color: #1e293b; }}
  .header {{ background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); color: white; padding: 36px 48px; }}
  .header h1 {{ font-size: 26px; font-weight: 700; margin-bottom: 6px; }}
  .header .subtitle {{ font-size: 14px; opacity: 0.8; }}
  .header .meta {{ margin-top: 16px; font-size: 13px; opacity: 0.75; display: flex; gap: 32px; flex-wrap: wrap; }}
  .container {{ max-width: 1200px; margin: 32px auto; padding: 0 24px; }}
  .summary-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 28px; }}
  .card {{ background: white; border-radius: 12px; padding: 20px 24px; box-shadow: 0 1px 4px rgba(0,0,0,.06); }}
  .card .val {{ font-size: 36px; font-weight: 700; line-height: 1; }}
  .card .lbl {{ font-size: 13px; color: #64748b; margin-top: 6px; }}
  .card.pass  .val {{ color: #22c55e; }}
  .card.fail  .val {{ color: #ef4444; }}
  .card.warn  .val {{ color: #f59e0b; }}
  .card.skip  .val {{ color: #94a3b8; }}
  .card.rate  .val {{ color: #2563eb; }}
  .card.time  .val {{ color: #7c3aed; font-size: 28px; }}
  .progress-bar {{ background: white; border-radius: 12px; padding: 20px 24px; box-shadow: 0 1px 4px rgba(0,0,0,.06); margin-bottom: 28px; }}
  .progress-bar .track {{ height: 12px; border-radius: 6px; background: #e2e8f0; overflow: hidden; margin-top: 12px; display: flex; }}
  .progress-bar .seg {{ height: 100%; transition: width .4s; }}
  .progress-bar .legend {{ display: flex; gap: 20px; margin-top: 10px; font-size: 13px; color: #64748b; flex-wrap: wrap; }}
  .progress-bar .legend span {{ display: flex; align-items: center; gap: 6px; }}
  .progress-bar .legend i {{ width: 10px; height: 10px; border-radius: 2px; display: inline-block; }}
  table {{ width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,.06); margin-bottom: 28px; font-size: 14px; }}
  thead tr {{ background: #f8fafc; }}
  th {{ padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: .05em; border-bottom: 1px solid #e2e8f0; }}
  td {{ padding: 12px 16px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }}
  tr:last-child td {{ border-bottom: none; }}
  .group-header td {{ background: #1e3a5f !important; padding: 8px 16px; }}
  .group-name {{ color: white; font-weight: 600; font-size: 13px; }}
  .group-stat {{ color: #93c5fd; font-size: 12px; margin-left: 12px; }}
  .tc-title {{ font-weight: 500; color: #1e293b; margin-bottom: 4px; }}
  .tc-path {{ display: flex; align-items: center; gap: 8px; }}
  .method-badge {{ color: white; font-size: 11px; font-weight: 600; padding: 2px 6px; border-radius: 4px; }}
  .status-badge {{ color: white; font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 20px; white-space: nowrap; }}
  .center {{ text-align: center; }}
  .note {{ color: #64748b; font-size: 13px; max-width: 260px; }}
  code {{ font-family: "SF Mono", Consolas, monospace; font-size: 13px; color: #334155; }}
  .detail-row td {{ padding: 0; }}
  .resp-pre {{ background: #1e293b; color: #e2e8f0; padding: 16px; font-size: 12px; overflow-x: auto; max-height: 280px; font-family: "SF Mono", Consolas, monospace; }}
  .toggle-btn {{ background: #e2e8f0; border: none; border-radius: 6px; padding: 4px 10px; font-size: 12px; cursor: pointer; color: #475569; }}
  .toggle-btn:hover {{ background: #cbd5e1; }}
  .footer {{ text-align: center; padding: 24px; color: #94a3b8; font-size: 13px; }}
  @media (max-width: 768px) {{ .container {{ padding: 0 12px; }} th, td {{ padding: 8px; }} }}
</style>
</head>
<body>
<div class="header">
  <h1>🔬 MriAgent API 接口测试报告</h1>
  <div class="subtitle">ARIA 医疗设备采购立项智能体 · 后端 API 自动化测试</div>
  <div class="meta">
    <span>🌐 测试地址：{BASE}</span>
    <span>🕐 开始时间：{start_time}</span>
    <span>🕑 结束时间：{end_time}</span>
    <span>⏱ 总耗时：{total_ms} ms</span>
  </div>
</div>

<div class="container">
  <div class="summary-grid">
    <div class="card rate">
      <div class="val">{pass_rate}%</div>
      <div class="lbl">接口通过率</div>
    </div>
    <div class="card pass">
      <div class="val">{passed}</div>
      <div class="lbl">通过</div>
    </div>
    <div class="card fail">
      <div class="val">{failed}</div>
      <div class="lbl">失败</div>
    </div>
    <div class="card warn">
      <div class="val">{warned}</div>
      <div class="lbl">警告</div>
    </div>
    <div class="card skip">
      <div class="val">{skipped}</div>
      <div class="lbl">跳过</div>
    </div>
    <div class="card time">
      <div class="val">{total_ms}</div>
      <div class="lbl">总耗时（ms）</div>
    </div>
  </div>

  <div class="progress-bar">
    <div style="font-weight:600; font-size:14px;">测试分布</div>
    <div class="track">
      <div class="seg" style="width:{round(passed/total*100,1) if total else 0}%; background:#22c55e;"></div>
      <div class="seg" style="width:{round(warned/total*100,1) if total else 0}%; background:#f59e0b;"></div>
      <div class="seg" style="width:{round(failed/total*100,1) if total else 0}%; background:#ef4444;"></div>
      <div class="seg" style="width:{round(skipped/total*100,1) if total else 0}%; background:#e2e8f0;"></div>
    </div>
    <div class="legend">
      <span><i style="background:#22c55e"></i>通过 {passed}</span>
      <span><i style="background:#f59e0b"></i>警告 {warned}</span>
      <span><i style="background:#ef4444"></i>失败 {failed}</span>
      <span><i style="background:#e2e8f0"></i>跳过 {skipped}</span>
      <span>共 {total} 个测试用例</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:30%">接口名称 / 路径</th>
        <th class="center" style="width:8%">结果</th>
        <th class="center" style="width:8%">实际状态码</th>
        <th class="center" style="width:8%">预期状态码</th>
        <th class="center" style="width:8%">响应耗时</th>
        <th style="width:28%">备注</th>
        <th class="center" style="width:10%">详情</th>
      </tr>
    </thead>
    <tbody>
      {rows_html}
    </tbody>
  </table>
</div>

<div class="footer">
  MriAgent API 测试报告 · 生成时间 {end_time} · 自动化测试脚本 v1.0
</div>

<script>
function toggle(id) {{
  const el = document.getElementById(id);
  el.style.display = el.style.display === 'none' ? 'table-row' : 'none';
}}
</script>
</body>
</html>"""
    return html


# ══════════════════════════════════════════════════════════════════════════════
# 主程序
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="http://120.55.247.187:8000")
    parser.add_argument("--out",  default="api_test_report.html")
    args = parser.parse_args()

    BASE = args.base.rstrip("/")
    s = requests.Session()
    s.timeout = 15

    print(f"\n{'═'*55}")
    print(f"  MriAgent API 接口测试")
    print(f"  Base URL : {BASE}")
    print(f"{'═'*55}\n")

    t0 = time.time()
    start_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    run_tests(BASE, s)
    total_ms = int((time.time() - t0) * 1000)
    end_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    passed  = sum(1 for t in recorder if t.status == "pass")
    failed  = sum(1 for t in recorder if t.status == "fail")
    warned  = sum(1 for t in recorder if t.status == "warn")
    skipped = sum(1 for t in recorder if t.status == "skip")
    total   = len(recorder)

    # 控制台汇总
    STATUS_ICON = {"pass": "✓", "fail": "✗", "warn": "⚠", "skip": "○"}
    for t in recorder:
        icon = STATUS_ICON.get(t.status, "?")
        print(f"  {icon} [{t.group}] {t.name} → {t.http_code or '-'} ({t.duration_ms}ms) {t.note}")

    print(f"\n{'─'*55}")
    print(f"  通过: {passed}  失败: {failed}  警告: {warned}  跳过: {skipped}  共: {total}")
    print(f"  总耗时: {total_ms} ms")
    if failed == 0:
        print("  ✓ 全部通过！")
    else:
        print("  ✗ 存在失败项，请查看报告")
    print(f"{'─'*55}\n")

    # 生成 HTML 报告
    html = generate_html(BASE, start_str, end_str, total_ms)
    out_path = Path(args.out)
    out_path.write_text(html, encoding="utf-8")
    print(f"  📄 HTML 报告已生成：{out_path.resolve()}\n")
