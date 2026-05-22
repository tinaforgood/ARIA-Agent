#!/usr/bin/env python3
"""
api_server.py — MriAgent 后端 API  v0.3  (multi-case)
启动: uvicorn api_server:app --reload --port 8000

Case 目录结构：
  cases/{case_id}/
    metadata.json
    datasource/
      agent_corpus  →  symlink → ../../../../datasource/agent_corpus
      user_uploads/
        01_requirements/ 02_competitors/ 03_compliance/ 04_operations/
        05_budget/ 06_price/ originals/
    outputs/
      ingest/results/project_snapshot.json
      approval/results/

端点列表：
  POST /api/cases                        — 新建 case
  GET  /api/cases                        — 列出所有 case
  GET  /api/cases/{case_id}              — 查询 case 状态
  POST /api/cases/{case_id}/analyze      — 分析 PDF 章节（不保存）
  POST /api/cases/{case_id}/split        — 物理拆分 PDF，写 manifest
  POST /api/cases/{case_id}/upload       — 单文件精准上传
  POST /api/cases/{case_id}/run          — 触发 ingest → 7-agent 流水线
  GET  /api/cases/{case_id}/snapshot     — 获取该 case 的 project_snapshot
  GET  /api/snapshot                     — 兼容旧接口（返回默认 snapshot）
  GET  /api/jobs/{job_id}                — 查询拆分任务
  GET  /health
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# ── 路径 ──────────────────────────────────────────────────────────────────────
ROOT          = Path(__file__).resolve().parent
CASES_DIR     = ROOT / "cases"
SHARED_CORPUS = ROOT / "datasource" / "agent_corpus"   # 所有 case 共享
CONFIG_PATH   = ROOT / "config" / "agent_config.json"

# 兼容旧接口的默认快照路径
LEGACY_SNAPSHOT = ROOT / "outputs" / "ingest" / "results" / "project_snapshot.json"

# ── 分类定义（与前端 item.id 对齐）─────────────────────────────────────────
CATEGORY_FOLDER_MAP: dict[str, tuple[str, str]] = {
    "basic_info":   ("01_requirements", "基本情况表"),
    "budget_list":  ("05_budget",       "预算清单"),
    "minutes":      ("03_compliance",   "论证纪要"),
    "nmpa_cert":    ("02_competitors",  "NMPA证"),
    "price_proof":  ("06_price",        "价格依据证明"),
    "performance":  ("04_operations",   "绩效目标表"),
}

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".doc", ".xlsx", ".xls", ".jpg", ".png", ".pptx"}

# PDF 章节识别规则（越具体越优先）
SECTION_RULES: list[tuple[str, str, list[str]]] = [
    ("price_proof", "价格依据证明", ["价格依据证明材料", "申请设备价格依据证明"]),
    ("nmpa_cert",   "NMPA 证",     ["nmpa证复印件", "注册证复印件", "医疗设备每类均须提供"]),
    ("minutes",     "论证纪要",    ["会议纪要", "会议时间", "管理委员会"]),
    ("budget_list", "预算清单",    ["财政预算项目清单", "拟申请一般医用", "申请单价", "论证排序"]),
    ("basic_info",  "基本情况表",  ["编制床位", "实际开放床位", "床位使用率", "年出院人数"]),
]

# ── Case 状态枚举 ─────────────────────────────────────────────────────────────
class CaseStatus:
    CREATED    = "created"      # 刚建立，尚未上传文件
    UPLOADING  = "uploading"    # 正在上传 / 拆分材料
    READY      = "ready"        # 所有必填材料已上传，可触发流水线
    INGESTING  = "ingesting"    # agent_ingest 运行中
    PROCESSING = "processing"   # agent_approval (7 agents) 运行中
    DONE       = "done"         # 全部完成
    ERROR      = "error"        # 流水线报错

# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(title="MriAgent API", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173",
                   "http://localhost:4173",  "http://127.0.0.1:4173"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 静态文件：挂载 cases 目录，让前端可以直接访问生成的 docx/pdf
CASES_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/cases", StaticFiles(directory=str(CASES_DIR)), name="cases")


# ══════════════════════════════════════════════════════════════════════════════
# Case 目录工具
# ══════════════════════════════════════════════════════════════════════════════

def _case_dir(case_id: str) -> Path:
    return CASES_DIR / case_id

def _uploads_dir(case_id: str) -> Path:
    return _case_dir(case_id) / "datasource" / "user_uploads"

def _metadata_path(case_id: str) -> Path:
    return _case_dir(case_id) / "metadata.json"

def _snapshot_path(case_id: str) -> Path:
    return _case_dir(case_id) / "outputs" / "ingest" / "results" / "project_snapshot.json"

def _approval_dir(case_id: str) -> Path:
    return _case_dir(case_id) / "outputs" / "approval"


def _init_case_dirs(case_id: str) -> None:
    """创建 case 完整目录树，并建立 agent_corpus 软链接。"""
    uploads = _uploads_dir(case_id)
    for folder in CATEGORY_FOLDER_MAP.values():
        (uploads / folder[0]).mkdir(parents=True, exist_ok=True)
    (uploads / "originals").mkdir(parents=True, exist_ok=True)

    # agent_corpus 软链接（让 agent_ingest 扫到共享语料）
    corpus_link = _case_dir(case_id) / "datasource" / "agent_corpus"
    if not corpus_link.exists() and SHARED_CORPUS.exists():
        corpus_link.symlink_to(SHARED_CORPUS.resolve())


def _read_metadata(case_id: str) -> dict:
    p = _metadata_path(case_id)
    if not p.is_file():
        raise HTTPException(status_code=404, detail=f"case_id={case_id} 不存在")
    return json.loads(p.read_text(encoding="utf-8"))


def _write_metadata(case_id: str, data: dict) -> None:
    _metadata_path(case_id).write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def _patch_metadata(case_id: str, **kwargs: Any) -> dict:
    meta = _read_metadata(case_id)
    meta.update(kwargs)
    _write_metadata(case_id, meta)
    return meta


# ══════════════════════════════════════════════════════════════════════════════
# PDF 解析工具（复用原有逻辑）
# ══════════════════════════════════════════════════════════════════════════════

def _extract_pages_text(pdf_bytes: bytes) -> list[str]:
    try:
        from pdfminer.high_level import extract_pages
        from pdfminer.layout import LTTextContainer
        pages: list[str] = []
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(pdf_bytes)
            tmp_path = tmp.name
        try:
            for layout in extract_pages(tmp_path):
                text = "".join(
                    el.get_text() for el in layout
                    if isinstance(el, LTTextContainer)
                )
                pages.append(text.strip())
        finally:
            Path(tmp_path).unlink(missing_ok=True)
        return pages
    except Exception as exc:
        raise RuntimeError(f"PDF 解析失败：{exc}") from exc


def _classify_page(text: str) -> Optional[str]:
    tl = text.lower()
    for item_id, _, keywords in SECTION_RULES:
        if any(kw.lower() in tl for kw in keywords):
            return item_id
    return None


def _analyze_pdf(pdf_bytes: bytes) -> list[dict]:
    pages_text = _extract_pages_text(pdf_bytes)
    total = len(pages_text)
    labels: list[Optional[str]] = [_classify_page(t) for t in pages_text]
    # 向前填充空白页
    for i in range(1, total):
        if labels[i] is None and labels[i - 1]:
            labels[i] = labels[i - 1]
    first = next((l for l in labels if l), "basic_info")
    for i in range(total):
        if labels[i] is None:
            labels[i] = first
        else:
            break
    # 合并连续段落
    sections: list[dict] = []
    i = 0
    while i < total:
        cur = labels[i]
        j = i
        while j < total and labels[j] == cur:
            j += 1
        s, e = i + 1, j
        preview = next(
            (pages_text[k][:80].replace("\n", " ") for k in range(i, j) if pages_text[k]),
            "",
        )
        _, cat_name = CATEGORY_FOLDER_MAP.get(cur, ("", cur))
        sections.append({
            "pages": f"第 {s} 页" if s == e else f"第 {s}–{e} 页",
            "start": s, "end": e,
            "item_id": cur,
            "category_name": cat_name,
            "preview": preview,
        })
        i = j
    return sections


# ══════════════════════════════════════════════════════════════════════════════
# 流水线后台执行
# ══════════════════════════════════════════════════════════════════════════════

def _run_pipeline(case_id: str) -> None:
    """在后台线程中依次运行 agent_ingest → agent_approval，更新 metadata.json 状态。"""
    python = sys.executable  # 用启动 api_server 的同一个 Python（即 .venv 里的）
    case_path = _case_dir(case_id)
    datasource = case_path / "datasource"
    ingest_out  = case_path / "outputs" / "ingest"
    approval_out = case_path / "outputs" / "approval"

    def _ts() -> str:
        return datetime.now(timezone.utc).isoformat()

    # ── Stage 1: agent_ingest ──────────────────────────────────────────────
    _patch_metadata(case_id,
        status=CaseStatus.INGESTING,
        ingest_started_at=_ts(), ingest_done_at=None, error=None)

    ingest_cmd = [
        python, str(ROOT / "agent_ingest.py"),
        "--datasource",  str(datasource),
        "--output-root", str(ingest_out),
        "--config",      str(CONFIG_PATH),
        "--parser-mode", "openpyxl",   # 速度优先；改 mineru 可 OCR
    ]
    r1 = subprocess.run(ingest_cmd, capture_output=True, text=True, cwd=str(ROOT))
    if r1.returncode != 0:
        _patch_metadata(case_id,
            status=CaseStatus.ERROR,
            error=f"agent_ingest failed:\n{r1.stderr[-2000:]}")
        return

    snapshot = _snapshot_path(case_id)
    if not snapshot.is_file():
        _patch_metadata(case_id,
            status=CaseStatus.ERROR,
            error="agent_ingest 完成但未生成 project_snapshot.json")
        return

    _patch_metadata(case_id, ingest_done_at=_ts())

    # ── Stage 2: agent_approval (7 agents) ────────────────────────────────
    _patch_metadata(case_id,
        status=CaseStatus.PROCESSING,
        approval_started_at=_ts(), approval_done_at=None)

    meta = _read_metadata(case_id)
    hospital_name = meta.get("hospital_name") or ""
    approval_cmd = [
        python, str(ROOT / "agent_approval.py"),
        "--snapshot",      str(snapshot),
        "--output-root",   str(approval_out),
        "--config",        str(CONFIG_PATH),
        "--hospital-name", hospital_name,
    ]
    r2 = subprocess.run(approval_cmd, capture_output=True, text=True, cwd=str(ROOT))
    if r2.returncode != 0:
        _patch_metadata(case_id,
            status=CaseStatus.ERROR,
            error=f"agent_approval failed:\n{r2.stderr[-2000:]}")
        return

    _patch_metadata(case_id,
        status=CaseStatus.DONE,
        approval_done_at=_ts())


# ══════════════════════════════════════════════════════════════════════════════
# 路由 — Case 管理
# ══════════════════════════════════════════════════════════════════════════════

@app.post("/api/cases")
def create_case(hospital_name: str = Form(default="")):
    """
    新建 case。返回 case_id 和初始 metadata。
    前端打开「新建立项论证任务」抽屉时调用。
    """
    case_id = str(uuid.uuid4())
    _init_case_dirs(case_id)
    meta = {
        "case_id":            case_id,
        "hospital_name":      hospital_name or None,
        "created_at":         datetime.now(timezone.utc).isoformat(),
        "status":             CaseStatus.CREATED,
        "ingest_started_at":  None,
        "ingest_done_at":     None,
        "approval_started_at": None,
        "approval_done_at":   None,
        "error":              None,
        "uploaded_files":     {},
    }
    _write_metadata(case_id, meta)
    return meta


@app.get("/api/cases")
def list_cases():
    """列出所有 case（按创建时间倒序）。"""
    results = []
    if not CASES_DIR.is_dir():
        return results
    for d in sorted(CASES_DIR.iterdir(), reverse=True):
        mf = d / "metadata.json"
        if mf.is_file():
            try:
                results.append(json.loads(mf.read_text(encoding="utf-8")))
            except Exception:
                pass
    return results


@app.get("/api/cases/{case_id}")
def get_case(case_id: str):
    """查询 case 状态与元数据。"""
    return _read_metadata(case_id)


@app.patch("/api/cases/{case_id}")
def update_case(case_id: str, hospital_name: str = Form(default=None)):
    """更新 case 的可编辑字段（目前支持 hospital_name）。"""
    meta = _read_metadata(case_id)
    if hospital_name is not None:
        meta["hospital_name"] = hospital_name.strip() or None
        _write_metadata(case_id, meta)
    return meta


@app.delete("/api/cases/{case_id}")
def delete_case(case_id: str):
    """删除 case 及其所有文件。流水线运行中不可删除。"""
    meta = _read_metadata(case_id)   # 404 if not found
    if meta.get("status") in (CaseStatus.INGESTING, CaseStatus.PROCESSING):
        raise HTTPException(status_code=409, detail="流水线运行中，无法删除，请等待完成后再操作。")
    case_path = _case_dir(case_id)
    shutil.rmtree(case_path, ignore_errors=True)
    return {"deleted": case_id}


@app.get("/api/cases/{case_id}/agent-progress")
def get_agent_progress(case_id: str):
    """
    返回 7 个业务 Agent 的完成状态，通过检查 results/ 目录下的结果文件推断。
    status: 'done' | 'active' | 'pending'
    """
    meta = _read_metadata(case_id)
    case_status = meta.get("status", "created")
    results_dir = _approval_dir(case_id) / "results"

    # 各 agent 对应的结果文件
    AGENT_FILES = [
        {"id": 1, "label": "需求梳理", "file": "requirements_result.json"},
        {"id": 2, "label": "竞品归并", "file": "competitor_table.json"},
        {"id": 3, "label": "预算测算", "file": "budget_summary.json"},
        {"id": 4, "label": "收益测算", "file": "revenue_roi.json"},
        {"id": 5, "label": "合规核验", "file": "compliance_result.json"},
        {"id": 6, "label": "立项文书", "file": "project_document.md"},
        {"id": 7, "label": "审批反馈", "file": "feedback_result.json"},
    ]

    agents = []
    first_pending = None  # 第一个未完成的 agent 索引
    for i, ag in enumerate(AGENT_FILES):
        file_done = (results_dir / ag["file"]).is_file()
        agents.append({
            "id":     ag["id"],
            "label":  ag["label"],
            "done":   file_done,
        })
        if not file_done and first_pending is None:
            first_pending = i

    # 推断每个 agent 的 status
    for i, ag in enumerate(agents):
        if ag["done"]:
            ag["status"] = "done"
        elif i == first_pending and case_status == "processing":
            ag["status"] = "active"
        elif case_status == "done" and not ag["done"]:
            # 流程已完成但文件还没生成（edge case），视为 done
            ag["status"] = "done"
            ag["done"] = True
        else:
            ag["status"] = "pending"

    done_count = sum(1 for a in agents if a["status"] == "done")
    active_agent = next((a for a in agents if a["status"] == "active"), None)

    # 项目标题
    hospital = meta.get("hospital_name") or ""

    return {
        "case_id":      case_id,
        "case_status":  case_status,
        "hospital_name": hospital,
        "agents":       agents,
        "done_count":   done_count,
        "total":        len(agents),
        "active_agent": active_agent,
    }


@app.get("/api/cases/{case_id}/document")
def get_case_document(case_id: str):
    """下载该 case 生成的立项建议书 docx。"""
    _read_metadata(case_id)   # 确认 case 存在
    docx_path = _approval_dir(case_id) / "results" / "project_document.docx"
    if not docx_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="立项建议书尚未生成，请等待流水线完成后再下载。"
        )
    return FileResponse(
        path=str(docx_path),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename="立项建议书.docx",
    )


# ══════════════════════════════════════════════════════════════════════════════
# 路由 — Case 文件操作
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/cases/{case_id}/files")
def list_case_files(case_id: str):
    """
    返回该 case 各分类目录下已上传的文件，用于前端恢复上传进度。
    结构：{ item_id: { saved_as, size_kb, category_name } }
    """
    _read_metadata(case_id)
    uploads = _uploads_dir(case_id)
    result: dict[str, dict] = {}
    for item_id, (folder_name, cat_name) in CATEGORY_FOLDER_MAP.items():
        folder = uploads / folder_name
        if not folder.is_dir():
            continue
        files = [
            f for f in folder.iterdir()
            if f.is_file() and f.suffix.lower() in SUPPORTED_EXTENSIONS
        ]
        if files:
            # 取最近修改的文件
            latest = max(files, key=lambda f: f.stat().st_mtime)
            result[item_id] = {
                "saved_as":      latest.name,
                "size_kb":       latest.stat().st_size // 1024,
                "category_name": cat_name,
            }
    return result


@app.post("/api/cases/{case_id}/analyze")
async def analyze_case_pdf(case_id: str, file: UploadFile = File(...)):
    """分析 PDF 章节结构（不保存到磁盘）。"""
    _read_metadata(case_id)   # 确认 case 存在
    if Path(file.filename).suffix.lower() != ".pdf":
        raise HTTPException(status_code=400, detail="仅支持 PDF 文件")
    pdf_bytes = await file.read()
    try:
        sections = _analyze_pdf(pdf_bytes)
    except RuntimeError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    total = sections[-1]["end"] if sections else 0
    return {"ok": True, "total_pages": total, "sections": sections}


@app.post("/api/cases/{case_id}/split")
async def split_case_pdf(
    case_id: str,
    file: UploadFile = File(...),
    sections: str = Form(...),
):
    """
    物理拆分 PDF 到 case 对应子目录，保留原始文件，写 manifest.json。
    sections: JSON 字符串 [{item_id, start, end, pages, category_name}, ...]
    """
    _read_metadata(case_id)
    if Path(file.filename).suffix.lower() != ".pdf":
        raise HTTPException(status_code=400, detail="仅支持 PDF 文件拆分")

    try:
        section_list: list[dict] = json.loads(sections)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"sections JSON 解析失败: {exc}") from exc

    pdf_bytes = await file.read()
    orig_name = file.filename
    stem = Path(orig_name).stem
    job_id = str(uuid.uuid4())
    uploads = _uploads_dir(case_id)

    # 保存原始文件
    orig_dir = uploads / "originals" / job_id
    orig_dir.mkdir(parents=True, exist_ok=True)
    (orig_dir / orig_name).write_bytes(pdf_bytes)

    # pypdf 拆分
    try:
        from pypdf import PdfReader, PdfWriter
    except ImportError as exc:
        raise HTTPException(status_code=500, detail="缺少 pypdf，请 pip install pypdf") from exc

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(pdf_bytes)
        tmp_path = tmp.name

    saved_files: list[dict] = []
    try:
        reader = PdfReader(tmp_path)
        total_pages = len(reader.pages)
        for sec in section_list:
            item_id     = sec.get("item_id", "basic_info")
            cat_name    = sec.get("category_name") or CATEGORY_FOLDER_MAP.get(item_id, ("", item_id))[1]
            folder_name = CATEGORY_FOLDER_MAP.get(item_id, (item_id, ""))[0]
            start       = int(sec.get("start", 1))
            end         = int(sec.get("end", total_pages))
            pages_label = sec.get("pages", f"第 {start}–{end} 页")

            writer = PdfWriter()
            for pg in range(start - 1, min(end, total_pages)):
                writer.add_page(reader.pages[pg])

            dest_dir = uploads / folder_name
            dest_dir.mkdir(parents=True, exist_ok=True)
            filename = f"{job_id[:8]}_{stem}_{cat_name}.pdf"
            dest = dest_dir / filename
            c = 1
            while dest.exists():
                dest = dest_dir / f"{job_id[:8]}_{stem}_{cat_name}_{c}.pdf"
                c += 1
            with open(dest, "wb") as fout:
                writer.write(fout)

            saved_files.append({
                "item_id":       item_id,
                "category_name": cat_name,
                "folder":        folder_name,
                "saved_as":      dest.name,
                "pages":         pages_label,
                "start":         start,
                "end":           end,
                "size_kb":       dest.stat().st_size // 1024,
            })
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    # manifest
    manifest = {
        "job_id":        job_id,
        "case_id":       case_id,
        "original_file": orig_name,
        "uploaded_at":   datetime.now(timezone.utc).isoformat(),
        "total_pages":   total_pages,
        "sections":      saved_files,
    }
    (orig_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # 更新 case metadata
    _patch_metadata(case_id, status=CaseStatus.UPLOADING,
                    last_job_id=job_id)

    return {
        "ok":             True,
        "case_id":        case_id,
        "job_id":         job_id,
        "original_saved": f"originals/{job_id}/{orig_name}",
        "manifest":       f"originals/{job_id}/manifest.json",
        "files":          saved_files,
    }


@app.post("/api/cases/{case_id}/upload")
async def upload_to_case(
    case_id: str,
    file: UploadFile = File(...),
    category: Optional[str] = Form(default=""),
):
    """单文件精准上传到指定分类目录。"""
    _read_metadata(case_id)
    ext = Path(file.filename).suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(status_code=415, detail=f"不支持的文件类型 {ext}")

    item_id = (category or "").strip()
    auto_classified = item_id not in CATEGORY_FOLDER_MAP
    if auto_classified:
        item_id = "basic_info"

    folder_name, cat_name = CATEGORY_FOLDER_MAP[item_id]
    dest_dir = _uploads_dir(case_id) / folder_name
    dest_dir.mkdir(parents=True, exist_ok=True)

    file_bytes = await file.read()
    dest = dest_dir / file.filename
    c = 1
    while dest.exists():
        dest = dest_dir / f"{Path(file.filename).stem}_{c}{ext}"
        c += 1
    dest.write_bytes(file_bytes)

    _patch_metadata(case_id, status=CaseStatus.UPLOADING)
    return {
        "ok": True, "case_id": case_id,
        "item_id": item_id, "category_name": cat_name,
        "folder": folder_name, "saved_as": dest.name,
        "auto_classified": auto_classified,
    }


@app.post("/api/cases/{case_id}/run")
def run_pipeline(case_id: str, background_tasks: BackgroundTasks):
    """
    触发 ingest → 7-agent 审批流水线（后台运行，立即返回）。
    轮询 GET /api/cases/{case_id} 的 status 字段跟踪进度：
      ingesting → processing → done | error
    """
    meta = _read_metadata(case_id)
    if meta["status"] in (CaseStatus.INGESTING, CaseStatus.PROCESSING):
        raise HTTPException(status_code=409, detail="流水线已在运行中")

    # 检查是否有可解析的文件
    uploads = _uploads_dir(case_id)
    has_files = any(
        list((uploads / folder).iterdir())
        for folder, _ in CATEGORY_FOLDER_MAP.values()
        if (uploads / folder).is_dir()
    )
    if not has_files:
        raise HTTPException(status_code=422, detail="尚未上传任何材料，请先完成文件上传")

    background_tasks.add_task(_run_pipeline, case_id)
    return {
        "ok": True,
        "case_id": case_id,
        "message": "流水线已启动，请轮询 GET /api/cases/{case_id} 查看进度",
    }


@app.get("/api/cases/{case_id}/snapshot")
def get_case_snapshot(case_id: str):
    """获取该 case 的 project_snapshot.json（ingest 完成后可用）。"""
    p = _snapshot_path(case_id)
    if not p.is_file():
        raise HTTPException(status_code=404,
            detail="快照尚未生成，请先运行 /run 触发 ingest 流水线")
    return json.loads(p.read_text(encoding="utf-8"))


@app.get("/api/cases/{case_id}/rationality")
def get_case_rationality(case_id: str):
    """
    获取该 case 的采购合理性判定结果（rationality_result.json）。

    来源：agent_approval 运行后写入的
      outputs/approval/results/rationality_result.json

    返回字段说明：
      verdict          : pass | conditional | reject | exempt_renewal
      renewal_exemption: bool — 是否触发更新场景豁免
      dimensions       : 四个子维度各自的 score / 指标值 / note
      blocking_reason  : 否决原因（仅 verdict=reject 时非空）
      recommendation   : Agent 建议文字
      benchmark_source : 基准数据来源简报名称
    """
    _read_metadata(case_id)  # 校验 case 存在
    result_path = _approval_dir(case_id) / "results" / "rationality_result.json"
    if not result_path.is_file():
        raise HTTPException(
            status_code=404,
            detail=(
                "合理性判定结果尚未生成。"
                "请先运行 POST /api/cases/{case_id}/run 完成完整流水线。"
            ),
        )
    return json.loads(result_path.read_text(encoding="utf-8"))


@app.get("/api/cases/{case_id}/task_overview")
def get_case_task_overview(case_id: str):
    """
    获取 task_overview.json（含 rationality_verdict 摘要 + 质量评审得分）。
    可用于前端 Dashboard 快速展示 case 的整体评估结论。
    """
    _read_metadata(case_id)
    overview_path = _approval_dir(case_id) / "results" / "task_overview.json"
    if not overview_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="task_overview 尚未生成，请先运行完整流水线。",
        )
    return json.loads(overview_path.read_text(encoding="utf-8"))


# ══════════════════════════════════════════════════════════════════════════════
# 路由 — 兼容旧接口 & 工具
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/snapshot")
def get_snapshot():
    """
    兼容旧接口。
    优先返回最新 done case 的 snapshot；无则回退到 legacy 路径。
    """
    # 找最新 done case
    if CASES_DIR.is_dir():
        cases = sorted(CASES_DIR.iterdir(), reverse=True)
        for d in cases:
            mf = d / "metadata.json"
            if mf.is_file():
                try:
                    meta = json.loads(mf.read_text(encoding="utf-8"))
                    if meta.get("status") == CaseStatus.DONE:
                        snap = _snapshot_path(meta["case_id"])
                        if snap.is_file():
                            return json.loads(snap.read_text(encoding="utf-8"))
                except Exception:
                    pass
    # 回退 legacy
    if LEGACY_SNAPSHOT.is_file():
        return json.loads(LEGACY_SNAPSHOT.read_text(encoding="utf-8"))
    raise HTTPException(status_code=404, detail="暂无可用快照，请先创建 case 并上传材料后运行流水线")


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str):
    """查询拆分任务 manifest（遍历所有 case）。"""
    for case_dir in CASES_DIR.iterdir():
        mf = case_dir / "datasource" / "user_uploads" / "originals" / job_id / "manifest.json"
        if mf.is_file():
            return json.loads(mf.read_text(encoding="utf-8"))
    raise HTTPException(status_code=404, detail=f"job_id={job_id} 不存在")


@app.get("/health")
def health():
    return {"ok": True, "cases_dir": str(CASES_DIR)}


# ══════════════════════════════════════════════════════════════════════════════
# 路由 — 知识库 (agent_corpus)
# ══════════════════════════════════════════════════════════════════════════════

CORPUS_DIRS = {
    "a_requirements": {"title": "设备技术参数库", "label": "技术规格"},
    "b_competitors":  {"title": "品牌竞品分析库", "label": "竞品资料"},
    "c_compliance":   {"title": "合规监管知识库", "label": "法规文件"},
    "d_operations":   {"title": "运营财务基线库", "label": "运营数据"},
}

SUPPORTED_CORPUS_EXTS = {".pdf", ".docx", ".xlsx", ".xls", ".pptx", ".png", ".jpg", ".jpeg"}


@app.get("/api/corpus")
def list_corpus():
    """
    返回 agent_corpus 各子目录的文件统计 + 最近 20 条文件记录。
    Response:
      {
        dirs: { dir_id: { title, count, files: [{name, size_kb, mtime}] } },
        total: int,
        recent: [{name, dir_id, title, label, size_kb, mtime_iso}]
      }
    """
    if not SHARED_CORPUS.is_dir():
        return {"dirs": {}, "total": 0, "recent": []}

    result_dirs = {}
    all_files = []

    for dir_id, meta in CORPUS_DIRS.items():
        folder = SHARED_CORPUS / dir_id
        if not folder.is_dir():
            result_dirs[dir_id] = {**meta, "count": 0, "files": []}
            continue
        files = [f for f in folder.iterdir() if f.is_file() and f.suffix.lower() in SUPPORTED_CORPUS_EXTS]
        file_list = [
            {
                "name":     f.name,
                "size_kb":  f.stat().st_size // 1024,
                "mtime":    f.stat().st_mtime,
                "mtime_iso": datetime.fromtimestamp(f.stat().st_mtime).strftime("%Y-%m-%d %H:%M"),
            }
            for f in files
        ]
        result_dirs[dir_id] = {**meta, "count": len(files), "files": file_list}
        for finfo in file_list:
            all_files.append({**finfo, "dir_id": dir_id, **meta})

    all_files.sort(key=lambda x: x["mtime"], reverse=True)
    total = sum(d["count"] for d in result_dirs.values())

    return {
        "dirs":   result_dirs,
        "total":  total,
        "recent": all_files[:20],
    }


@app.post("/api/corpus/upload")
async def upload_to_corpus(
    dir_id: str       = Form(...),
    file:   UploadFile = File(...),
):
    """
    上传文件到指定知识库子目录。
    dir_id: a_requirements | b_competitors | c_compliance | d_operations
    """
    if dir_id not in CORPUS_DIRS:
        raise HTTPException(status_code=400, detail=f"未知知识库目录: {dir_id}")

    ext = Path(file.filename).suffix.lower()
    if ext not in SUPPORTED_CORPUS_EXTS:
        raise HTTPException(status_code=400, detail=f"不支持的文件格式: {ext}")

    dest_dir = SHARED_CORPUS / dir_id
    dest_dir.mkdir(parents=True, exist_ok=True)

    # 同名文件：加时间戳避免覆盖
    stem = Path(file.filename).stem
    dest_path = dest_dir / file.filename
    if dest_path.exists():
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        dest_path = dest_dir / f"{stem}_{ts}{ext}"

    content = await file.read()
    dest_path.write_bytes(content)

    return {
        "ok":      True,
        "dir_id":  dir_id,
        "saved_as": dest_path.name,
        "size_kb": len(content) // 1024,
    }
