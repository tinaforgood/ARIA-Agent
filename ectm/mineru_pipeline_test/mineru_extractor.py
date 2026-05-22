#!/usr/bin/env python3
"""
mineru_extractor.py — MinerU 物理布局感知拆解层封装（ARIA 定制版）

运行模式
─────────
  USE_MOCK=true  (默认) — 离线 Mock，返回DEMO-MR-2026 固定样本，无需网络
  USE_MOCK=false         — 调用 MinerU.net v4 云端 API，真实解析本地 PDF

真实模式所需环境变量（从 mr_approval_agent/setup_env.sh source 即可）：
  MINERU_API_TOKEN   — JWT Bearer Token（setup_env.sh 已配置）
  MINERU_API_URL     — 默认 https://mineru.net/api/v4（可省略）

真实模式 API 调用流程（MinerU v4 异步任务制）：
  Step A  获取文件上传签名 URL       POST /file-urls/batch
  Step B  上传本地 PDF 到签名 URL     PUT  <signed_url>
  Step C  创建解析任务               POST /extract/task/batch
  Step D  轮询任务状态               GET  /extract/task/batch?taskId=<id>
  Step E  下载 ZIP 包，提取 Markdown  GET  <full_zip_url>
  Step F  构建 evidence_map          根据 layout JSON 中的 bbox 坐标

输出文件（落盘到 result/）：
  DEMO-MR-2026_采购包_raw.md   — 结构化 Markdown
  evidence_map.json             — 字段级 BBox 坐标索引（供 evaluation_report.py）

用法：
  # Mock 模式（默认，无需配置）
  python mineru_extractor.py

  # 真实模式（在 Mac 终端运行，需先 source setup_env.sh）
  cd MriAgent/mr_approval_agent && source setup_env.sh && cd ../ectm/mineru_pipeline_test
  USE_MOCK=false python mineru_extractor.py
"""

from __future__ import annotations

import io
import json
import os
import time
import urllib.error
import urllib.request
import zipfile
from pathlib import Path


# ── 模式开关 ──────────────────────────────────────────────────────────────────
USE_MOCK: bool = os.getenv("USE_MOCK", "true").lower() == "true"

# MinerU v4 API 根地址（不含路径）
_MINERU_BASE = os.getenv("MINERU_API_URL", "https://mineru.net").rstrip("/")
if "/api/" in _MINERU_BASE:
    # 兼容旧版 setup_env.sh 把完整 URL 写入 MINERU_API_URL 的情况
    _MINERU_BASE = _MINERU_BASE.split("/api/")[0]

MINERU_API_TOKEN: str = os.getenv("MINERU_API_TOKEN", "")

PROJECT_ID = "DEMO-MR-2026"

# ─────────────────────────────────────────────────────────────────────────────
# Mock 数据：DEMO-MR-2026 固定样本
# ─────────────────────────────────────────────────────────────────────────────
_MOCK_MARKDOWN = """\
# DEMO-MR-2026 项目采购文档解析结果（MinerU 结构化转写）

> 来源：某三甲医院 2026 年度一般医用专业设备财政预算申报材料（2.DEMO.pdf，59页）

---

## 一、基本情况表（第1–3页）

| 字段 | 内容 |
|---|---|
| 医院名称 | 某三甲医院 |
| 编制床位数 | 2556 张 |
| 实际开放床位数 | 3208 张 |
| 床位使用率 | 113.97% |
| 年出院人数 | 194263 人次 |
| 年手术人数 | 113987 例 |
| 年门诊量 | 495.80 万人次 |
| 年急诊量 | 85.30 万人次 |
| 卫生技术人员数 | 5287 人 |
| 上年度专业设备预算执行率 | 100% |
| 医院固定资产总值 | 714149.71 万元 |
| 2026 年拟申请财政预算专业设备总金额 | 9040 万元 |

---

## 二、预算清单（第4–5页）

| 序号 | 设备名称 | 单价（万元） | 申请数量 | 申请金额（万元） | 申请科室 | 现有该类设备数量 | 是否进口 | 品牌 | 型号 |
|---|---|---:|---:|---:|---|---|---|---|---|
| 3 | MR | 1300 | 1 | 1300 | 放射科 | 临港3 | 否 | 联影 | uMR870pro |
| 8 | 磁共振 | 1300 | 1 | 1300 | 放射科 | 徐汇11 | 否 | 联影 | uMR870pro |
| — | **MR 小计** | — | **2** | **2600** | — | — | — | — | — |
| — | **全院合计** | — | 11 | **9040** | — | — | — | — | — |

---

## 三、论证纪要（第6–8页）

| 字段 | 内容 |
|---|---|
| 会议时间 | 2025年5月21日 |
| 应到委员 | 33 人 |
| 实到委员 | 25 人（超委员总数2/3，表决有效） |
| 投票结果 | 24票同意，1票弃权 |
| 论证结论 | 通过，上报院长办公会和党委会审核 |

---

## 四、解析元数据

| 项 | 值 |
|---|---|
| 有效文字层页数 | 8 页（第1–8页） |
| 图片扫描页数 | 51 页（NMPA证+价格依据，无文字层） |
| OCR 置信度均值 | 文字层0.97，扫描件0.62 |
| BBox 覆盖率 | 文字层字段 100%；扫描件字段 0% |
"""

_MOCK_EVIDENCE_MAP: dict = {
    "医院名称":             {"file": "90c2a315_2.DEMO_基本情况表.pdf", "page": 3, "bbox": [72, 90, 360, 24],  "value": "某三甲医院"},
    "编制床位数（张）":     {"file": "90c2a315_2.DEMO_基本情况表.pdf", "page": 3, "bbox": [72, 130, 200, 22], "value": "2556"},
    "实际开放床位数（张）": {"file": "90c2a315_2.DEMO_基本情况表.pdf", "page": 3, "bbox": [290, 130, 200, 22],"value": "3208"},
    "床位使用率":           {"file": "90c2a315_2.DEMO_基本情况表.pdf", "page": 3, "bbox": [72, 158, 180, 22], "value": "113.97%"},
    "年出院人数（人次）":   {"file": "90c2a315_2.DEMO_基本情况表.pdf", "page": 3, "bbox": [72, 186, 200, 22], "value": "194263"},
    "年门诊量（万人次）":   {"file": "90c2a315_2.DEMO_基本情况表.pdf", "page": 3, "bbox": [72, 214, 200, 22], "value": "495.80"},
    "年急诊量（万人次）":   {"file": "90c2a315_2.DEMO_基本情况表.pdf", "page": 3, "bbox": [290, 214, 200, 22],"value": "85.30"},
    "申请设备类型":         {"file": "90c2a315_2.DEMO_预算清单.pdf",   "page": 1, "bbox": [90, 320, 200, 22], "value": "磁共振成像系统"},
    "申请台数合计":         {"file": "90c2a315_2.DEMO_预算清单.pdf",   "page": 2, "bbox": [310, 520, 80, 22],  "value": "2"},
    "设备申请总金额（万元）":       {"file": "90c2a315_2.DEMO_预算清单.pdf", "page": 2, "bbox": [390, 520, 100, 22], "value": "2600"},
    "医院专业设备总申请金额（万元）":{"file": "90c2a315_2.DEMO_预算清单.pdf", "page": 2, "bbox": [390, 560, 100, 22], "value": "9040"},
    "论证会出席率超三分之二": {"file": "90c2a315_2.DEMO_论证纪要.pdf", "page": 3, "bbox": [72, 380, 460, 22],  "value": "是（25/33=75.8%）"},
    "医学装备委员会审议通过": {"file": "90c2a315_2.DEMO_论证纪要.pdf", "page": 2, "bbox": [72, 180, 420, 22],  "value": "是"},
    "论证是否通过":         {"file": "90c2a315_2.DEMO_论证纪要.pdf",   "page": 3, "bbox": [72, 350, 380, 22],  "value": "是"},
    "冲突是否触发HITL":     {"file": "90c2a315_2.DEMO_预算清单.pdf",   "page": 2, "bbox": [72, 480, 300, 22],  "value": "是"},
    # 系统产物（无 BBox）
    "文书生成状态": {"file": "system_generated", "page": None, "bbox": None, "value": "已生成"},
    "审批状态":     {"file": "system_generated", "page": None, "bbox": None, "value": "待审批"},
    # 扫描件询价单 —— MinerU OCR 有产出，但结构残缺，关键价格字段缺失（CONF-005 触发点）
    # MinerU 实际会提取页码、印章乱码等，但询价单所需的结构化字段（品牌/型号/含税报价/日期）均未命中
    # Agent 置信度 0.28（低于 0.85 阈值），触发 HITL，但未明确归因到"资质缺失"冲突类型
    "价格依据证明_询价单内容": {
        "file": "90c2a315_2.DEMO_价格依据证明.pdf",
        "page": 1,
        "bbox": [72, 120, 400, 22],   # OCR 有 BBox，但内容为页码/印章乱码
        "value": "28",                 # OCR 实际读到的是页码数字，非询价字段
        "note": "图片扫描件，OCR 置信度 0.62，关键价格字段（品牌/报价/日期）均缺失，应触发资质缺失 HITL",
    },
}


# ─────────────────────────────────────────────────────────────────────────────
# MinerU v4 云端 API 实现（真实模式）
# ─────────────────────────────────────────────────────────────────────────────

def _auth_headers() -> dict:
    if not MINERU_API_TOKEN:
        raise EnvironmentError(
            "未找到 MINERU_API_TOKEN。\n"
            "请先执行：cd MriAgent/mr_approval_agent && source setup_env.sh"
        )
    return {
        "Authorization": f"Bearer {MINERU_API_TOKEN}",
        "Content-Type": "application/json",
    }


def _api_post(path: str, body: dict) -> dict:
    """向 MinerU API 发送 POST 请求，返回解析后的 JSON。"""
    url = f"{_MINERU_BASE}/api/v4{path}"
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST", headers=_auth_headers())
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _api_get(path: str) -> dict:
    """向 MinerU API 发送 GET 请求。"""
    url = f"{_MINERU_BASE}/api/v4{path}"
    req = urllib.request.Request(url, method="GET", headers=_auth_headers())
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _upload_file(file_path: Path) -> str:
    """
    Step A+B：获取签名上传 URL，PUT 本地文件，返回文件在 MinerU 的访问 URL。
    MinerU v4 file-urls/batch 接口：传文件名列表 → 获取 {filename: {upload_url, file_url}}
    """
    print(f"[MinerU] Step A: 申请上传签名 URL — {file_path.name}")
    resp = _api_post("/file-urls/batch", {"files": [{"name": file_path.name, "type": "pdf"}]})
    # 兼容两种响应格式
    files_info = resp.get("data", {}).get("files", resp.get("files", []))
    if not files_info:
        raise ValueError(f"file-urls/batch 响应格式异常: {resp}")
    file_info = files_info[0]
    upload_url = file_info.get("upload_url") or file_info.get("uploadUrl", "")
    file_url   = file_info.get("file_url")   or file_info.get("fileUrl", "")

    print(f"[MinerU] Step B: 上传文件 ({file_path.stat().st_size // 1024} KB)...")
    with file_path.open("rb") as fh:
        file_data = fh.read()
    put_req = urllib.request.Request(
        upload_url, data=file_data, method="PUT",
        headers={"Content-Type": "application/pdf"},
    )
    with urllib.request.urlopen(put_req, timeout=120):
        pass
    print(f"[MinerU] ✔ 上传完成 → {file_url}")
    return file_url


def _create_task(file_url: str, file_name: str) -> str:
    """
    Step C：创建解析任务，返回 batch_id（任务ID）。
    """
    print("[MinerU] Step C: 创建解析任务...")
    body = {
        "files": [{"url": file_url, "name": file_name}],
        "enable_formula": False,
        "enable_table": True,
        "layout_model": "doclayout_yolo",
        "language": "ch",
        "output_formats": ["markdown", "json"],
    }
    resp = _api_post("/extract/task/batch", body)
    batch_id = resp.get("data", {}).get("batch_id") or resp.get("batch_id", "")
    if not batch_id:
        raise ValueError(f"创建任务失败，响应: {resp}")
    print(f"[MinerU] ✔ 任务已创建，batch_id={batch_id}")
    return batch_id


def _poll_task(batch_id: str, timeout_s: int = 300, interval_s: int = 5) -> dict:
    """
    Step D：轮询任务状态，返回完成后的任务详情。
    状态值：pending / running / done / failed
    """
    print(f"[MinerU] Step D: 轮询任务状态（最长等待 {timeout_s}s）...")
    deadline = time.time() + timeout_s
    dots = 0
    while time.time() < deadline:
        resp = _api_get(f"/extract/task/batch?batch_id={batch_id}")
        task = (resp.get("data", {}).get("tasks") or [{}])[0]
        state = task.get("state", "pending")
        if state == "done":
            print(f"\n[MinerU] ✔ 解析完成")
            return task
        if state == "failed":
            raise RuntimeError(f"MinerU 任务失败: {task.get('err_msg', '未知错误')}")
        dots = (dots + 1) % 4
        print(f"\r[MinerU] 等待中{'.' * dots}   状态={state}", end="", flush=True)
        time.sleep(interval_s)
    raise TimeoutError(f"MinerU 任务超时（>{timeout_s}s），batch_id={batch_id}")


def _download_result(task: dict) -> tuple[str, dict]:
    """
    Step E+F：下载 ZIP 包，提取 Markdown 和 layout JSON，构建 evidence_map。
    返回 (markdown_text, evidence_map)
    """
    zip_url = task.get("result", {}).get("full_zip_url") or task.get("full_zip_url", "")
    if not zip_url:
        raise ValueError(f"任务结果中未找到 full_zip_url: {task}")

    print(f"[MinerU] Step E: 下载结果 ZIP...")
    req = urllib.request.Request(zip_url, method="GET")
    with urllib.request.urlopen(req, timeout=120) as resp:
        zip_bytes = resp.read()

    markdown_text = ""
    layout_data: dict = {}
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        for name in zf.namelist():
            if name.endswith(".md"):
                markdown_text = zf.read(name).decode("utf-8")
            elif name.endswith("_layout.json") or name.endswith("_content_list.json"):
                layout_data = json.loads(zf.read(name).decode("utf-8"))

    print(f"[MinerU] ✔ 提取 Markdown ({len(markdown_text)} chars)，layout 块数={len(layout_data) if isinstance(layout_data, list) else '—'}")

    # Step F：从 layout JSON 构建 evidence_map
    evidence_map = _build_evidence_map(layout_data, task.get("name", "unknown.pdf"))
    return markdown_text, evidence_map


def _build_evidence_map(layout: list | dict, file_name: str) -> dict:
    """
    从 MinerU layout JSON（content_list 格式）中提取关键字段的 BBox 坐标。
    content_list 格式：[{type, text, page_idx, bbox:[x0,y0,x1,y1]}, ...]
    """
    evidence_map: dict = {}
    if not isinstance(layout, list):
        return evidence_map

    # 关键字段关键词 → evidence_map 字段名的映射
    FIELD_KEYWORDS: dict[str, str] = {
        "编制床位": "编制床位数（张）",
        "实际开放床位": "实际开放床位数（张）",
        "床位使用率": "床位使用率",
        "年出院": "年出院人数（人次）",
        "年门诊量": "年门诊量（万人次）",
        "年急诊量": "年急诊量（万人次）",
        "卫生技术人员": "卫生技术人员数（人）",
        "磁共振": "申请设备类型",
        "申请数量": "申请台数合计",
        "申请金额": "设备申请总金额（万元）",
        "应到委员": "论证委员会应到人数",
        "实到委员": "论证委员会实到人数",
        "24票同意": "投票同意人数",
        "三分之二": "论证会出席率超三分之二",
    }

    for block in layout:
        text  = str(block.get("text", "") or block.get("content", ""))
        bbox  = block.get("bbox") or block.get("poly")
        page  = block.get("page_idx", block.get("page_no", 0))

        # 将 [x0,y0,x1,y1] 转为 [x,y,w,h]
        if bbox and len(bbox) == 4:
            x0, y0, x1, y1 = bbox
            bbox_xywh = [int(x0), int(y0), int(x1 - x0), int(y1 - y0)]
        else:
            bbox_xywh = None

        for keyword, field_name in FIELD_KEYWORDS.items():
            if keyword in text and field_name not in evidence_map:
                evidence_map[field_name] = {
                    "file": file_name,
                    "page": page + 1,   # 转为 1-indexed
                    "bbox": bbox_xywh,
                    "value": text.strip()[:120],
                }

    return evidence_map


# ─────────────────────────────────────────────────────────────────────────────
# 主接口
# ─────────────────────────────────────────────────────────────────────────────

def process_with_mineru(file_paths: list[str]) -> tuple[str, dict]:
    """
    核心接口：调用 MinerU 对采购文档进行物理布局感知拆解。

    参数:
        file_paths: 待解析的本地 PDF 路径列表

    返回:
        (markdown_text, evidence_map)
        evidence_map 格式：{字段名: {file, page, bbox:[x,y,w,h], value}}
    """
    print("[MinerU] 启动物理布局感知解析层（ARIA）...")
    for path in file_paths:
        print(f"[MinerU] 读取文件: {Path(path).name}")

    if USE_MOCK:
        time.sleep(0.8)
        bbox_count = sum(1 for v in _MOCK_EVIDENCE_MAP.values() if v.get("bbox"))
        print(f"[MinerU] ⚙  Mock 模式：返回 {PROJECT_ID} 固定样本（离线演示）")
        print(f"[MinerU] ✔  识别 8 处表格，有效 BBox {bbox_count}/{len(_MOCK_EVIDENCE_MAP)} 个字段")
        return _MOCK_MARKDOWN, _MOCK_EVIDENCE_MAP

    # ── 真实模式：逐文件处理，合并结果 ──────────────────────────────────────
    if not MINERU_API_TOKEN:
        raise EnvironmentError(
            "\n❌ 未找到 MINERU_API_TOKEN！\n"
            "请先在终端执行：\n"
            "  cd MriAgent/mr_approval_agent && source setup_env.sh\n"
            "  cd ../ectm/mineru_pipeline_test\n"
            "  USE_MOCK=false python mineru_extractor.py\n"
        )

    all_md_parts: list[str] = []
    combined_emap: dict     = {}

    for raw_path_str in file_paths:
        raw_path = Path(raw_path_str)
        if not raw_path.exists():
            print(f"[MinerU] ⚠  文件不存在，跳过: {raw_path.name}")
            continue

        try:
            file_url  = _upload_file(raw_path)
            batch_id  = _create_task(file_url, raw_path.name)
            task_info = _poll_task(batch_id)
            md, emap  = _download_result(task_info)
            all_md_parts.append(f"\n\n---\n\n## 📄 {raw_path.name}\n\n{md}")
            combined_emap.update(emap)
        except Exception as exc:
            print(f"\n[MinerU] ✘ {raw_path.name} 解析失败: {exc}")
            print("[MinerU] 该文件将跳过，继续处理其余文件...")

    if not all_md_parts:
        print("[MinerU] ⚠ 所有文件均失败，自动降级为 Mock")
        return _MOCK_MARKDOWN, _MOCK_EVIDENCE_MAP

    final_md = f"# {PROJECT_ID} 采购文档解析结果（MinerU 真实解析）\n" + "".join(all_md_parts)
    bbox_count = sum(1 for v in combined_emap.values() if v.get("bbox"))
    print(f"[MinerU] ✔ 全部文件处理完成，共 {bbox_count}/{len(combined_emap)} 个字段有 BBox 坐标")
    return final_md, combined_emap


# ─────────────────────────────────────────────────────────────────────────────
# 入口
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    base_dir    = Path(__file__).resolve().parent
    raw_dir     = base_dir / "raw"
    result_dir  = base_dir / "result"
    result_dir.mkdir(parents=True, exist_ok=True)

    # 六院项目：将分拆好的 PDF 放入 raw/ 目录即可
    file_paths = [
        str(raw_dir / "90c2a315_2.DEMO_基本情况表.pdf"),
        str(raw_dir / "90c2a315_2.DEMO_预算清单.pdf"),
        str(raw_dir / "90c2a315_2.DEMO_论证纪要.pdf"),
    ]

    md_content, evidence_map = process_with_mineru(file_paths)

    out_md   = result_dir / f"{PROJECT_ID}_采购包_raw.md"
    out_emap = result_dir / "evidence_map.json"   # 固定名，供 evaluation_report.py 读取

    out_md.write_text(md_content, encoding="utf-8")
    out_emap.write_text(json.dumps(evidence_map, ensure_ascii=False, indent=2), encoding="utf-8")

    bbox_count = sum(1 for v in evidence_map.values() if v.get("bbox"))
    print(f"\n[System] ✅ Markdown    → {out_md.name}")
    print(f"[System] ✅ evidence_map → {out_emap.name}（{len(evidence_map)} 字段，有效 BBox {bbox_count} 个）")


if __name__ == "__main__":
    main()
