# ARIA API 文档

> **系统名称**：ARIA — 医疗设备采购立项智能体  
> **版本**：v0.3.0  
> **服务框架**：FastAPI (uvicorn)

---

## 🌐 服务地址

| 用途 | 地址 |
|------|------|
| **API Base URL** | `http://120.55.247.187:8000` |
| **交互式接口文档（Swagger UI）** | `http://120.55.247.187:8000/docs` |
| **接口元数据（OpenAPI JSON）** | `http://120.55.247.187:8000/openapi.json` |
| **健康检查** | `http://120.55.247.187:8000/health` |

> 💡 推荐直接访问 `/docs` 页面，可在浏览器中实时调用每个接口，无需额外工具。

---

## 目录

1. [概述](#概述)
2. [Case 状态流转](#case-状态流转)
3. [接口列表](#接口列表)
   - [健康检查](#健康检查)
   - [Case 管理](#case-管理)
   - [文件上传与分析](#文件上传与分析)
   - [流水线执行](#流水线执行)
   - [结果查询](#结果查询)
   - [知识库管理](#知识库管理)
   - [兼容旧接口](#兼容旧接口)
4. [文件分类说明](#文件分类说明)
5. [错误码说明](#错误码说明)
6. [快速上手示例](#快速上手示例以-curl-为例)

---

## 概述

ARIA 是一套医疗设备采购立项审批辅助系统，后端通过 REST API 提供：

- **Case 管理**：创建、查询、更新、删除立项审批任务（Case）
- **文件处理**：支持 PDF 智能章节分析与拆分、单文件精准上传
- **Agent 流水线**：触发 `agent_ingest → 7-Agent 审批` 两阶段流水线
- **结果查询**：获取快照、合理性判定、Agent 进度、立项文书等
- **知识库管理**：管理 agent_corpus 共享知识库文件

---

## Case 状态流转

```
created → uploading → ready → ingesting → processing → done
                                                      ↘ error
```

| 状态 | 说明 |
|------|------|
| `created` | 刚建立，尚未上传文件 |
| `uploading` | 正在上传 / 拆分材料 |
| `ready` | 所有必填材料已上传，可触发流水线 |
| `ingesting` | agent_ingest 运行中（阶段一）|
| `processing` | 7-Agent 审批流水线运行中（阶段二）|
| `done` | 全部完成 |
| `error` | 流水线报错 |

---

## 接口列表

---

### 健康检查

#### `GET /health`

检查服务是否正常运行。

**完整地址**：`http://120.55.247.187:8000/health`

**请求参数**：无

**响应示例**：

```json
{
  "ok": true,
  "cases_dir": "/opt/mriagent/mr_approval_agent/cases"
}
```

---

### Case 管理

#### `POST /api/cases`

新建立项审批任务（Case）。

**完整地址**：`http://120.55.247.187:8000/api/cases`

**请求类型**：`multipart/form-data`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `hospital_name` | string | 否 | 医院名称 |

**响应示例**：

```json
{
  "case_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "hospital_name": "某三甲医院",
  "created_at": "2026-05-21T01:41:13.726490+00:00",
  "status": "created",
  "ingest_started_at": null,
  "ingest_done_at": null,
  "approval_started_at": null,
  "approval_done_at": null,
  "error": null,
  "uploaded_files": {}
}
```

---

#### `GET /api/cases`

列出所有 Case（按创建时间倒序）。

**完整地址**：`http://120.55.247.187:8000/api/cases`

**请求参数**：无

**响应示例**：

```json
[
  {
    "case_id": "c7a88a86-e40d-459b-b83d-f7fdc1fd5eae",
    "hospital_name": "某三甲医院",
    "status": "done",
    "created_at": "2026-05-20T08:00:00+00:00"
  }
]
```

---

#### `GET /api/cases/{case_id}`

查询单个 Case 的状态与元数据。

**完整地址**：`http://120.55.247.187:8000/api/cases/{case_id}`

**路径参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `case_id` | string (UUID) | Case ID |

**响应**：同 `POST /api/cases` 的响应结构。

**错误**：
- `404` — case_id 不存在

---

#### `PATCH /api/cases/{case_id}`

更新 Case 的可编辑字段。

**完整地址**：`http://120.55.247.187:8000/api/cases/{case_id}`

**请求类型**：`multipart/form-data`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `hospital_name` | string | 否 | 更新医院名称（传空字符串置为 null）|

**响应**：更新后的 Case metadata。

---

#### `DELETE /api/cases/{case_id}`

删除 Case 及其所有文件。

**完整地址**：`http://120.55.247.187:8000/api/cases/{case_id}`

> ⚠️ 流水线运行中（`ingesting` / `processing`）不可删除。

**响应示例**：

```json
{
  "deleted": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**错误**：
- `404` — case 不存在
- `409` — 流水线运行中，无法删除

---

### 文件上传与分析

#### `POST /api/cases/{case_id}/analyze`

分析 PDF 的章节结构（**不保存到磁盘**，仅返回分析结果供前端预览）。

**完整地址**：`http://120.55.247.187:8000/api/cases/{case_id}/analyze`

**请求类型**：`multipart/form-data`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `file` | file (PDF) | 是 | 待分析的 PDF 文件 |

**响应示例**：

```json
{
  "ok": true,
  "total_pages": 8,
  "sections": [
    {
      "pages": "第 1–3 页",
      "start": 1,
      "end": 3,
      "item_id": "basic_info",
      "category_name": "基本情况表",
      "preview": "编制床位数 2556 张..."
    },
    {
      "pages": "第 4–5 页",
      "start": 4,
      "end": 5,
      "item_id": "budget_list",
      "category_name": "预算清单",
      "preview": "财政预算项目清单..."
    }
  ]
}
```

**错误**：
- `400` — 非 PDF 文件
- `422` — PDF 解析失败

---

#### `POST /api/cases/{case_id}/split`

物理拆分 PDF，按章节写入对应分类目录，并保存原始文件与 manifest。

**完整地址**：`http://120.55.247.187:8000/api/cases/{case_id}/split`

**请求类型**：`multipart/form-data`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `file` | file (PDF) | 是 | 待拆分的 PDF 文件 |
| `sections` | string (JSON) | 是 | 拆分方案 JSON，见下方格式 |

`sections` JSON 格式：

```json
[
  {
    "item_id": "basic_info",
    "start": 1,
    "end": 3,
    "pages": "第 1–3 页",
    "category_name": "基本情况表"
  },
  {
    "item_id": "budget_list",
    "start": 4,
    "end": 5,
    "pages": "第 4–5 页",
    "category_name": "预算清单"
  }
]
```

**响应示例**：

```json
{
  "ok": true,
  "case_id": "a1b2c3d4-...",
  "job_id": "uuid",
  "original_saved": "originals/uuid/原始文件.pdf",
  "manifest": "originals/uuid/manifest.json",
  "files": [
    {
      "item_id": "basic_info",
      "category_name": "基本情况表",
      "folder": "01_requirements",
      "saved_as": "abc12345_原始文件_基本情况表.pdf",
      "pages": "第 1–3 页",
      "start": 1,
      "end": 3,
      "size_kb": 128
    }
  ]
}
```

**错误**：
- `400` — 非 PDF 文件 或 sections JSON 格式错误
- `500` — 缺少 pypdf 依赖

---

#### `POST /api/cases/{case_id}/upload`

单文件精准上传到指定分类目录。

**完整地址**：`http://120.55.247.187:8000/api/cases/{case_id}/upload`

**请求类型**：`multipart/form-data`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `file` | file | 是 | 待上传文件 |
| `category` | string | 否 | 分类 ID（见[文件分类说明](#文件分类说明)），未指定则自动归入 `basic_info` |

**支持的文件格式**：`.pdf` `.docx` `.doc` `.xlsx` `.xls` `.jpg` `.png` `.pptx`

**响应示例**：

```json
{
  "ok": true,
  "case_id": "a1b2c3d4-...",
  "item_id": "budget_list",
  "category_name": "预算清单",
  "folder": "05_budget",
  "saved_as": "预算清单.pdf",
  "auto_classified": false
}
```

**错误**：
- `415` — 不支持的文件类型

---

#### `GET /api/cases/{case_id}/files`

查询该 Case 各分类目录下已上传的文件（用于前端恢复上传进度）。

**完整地址**：`http://120.55.247.187:8000/api/cases/{case_id}/files`

**响应示例**：

```json
{
  "basic_info": {
    "saved_as": "基本情况表.pdf",
    "size_kb": 256,
    "category_name": "基本情况表"
  },
  "budget_list": {
    "saved_as": "预算清单.pdf",
    "size_kb": 64,
    "category_name": "预算清单"
  }
}
```

---

### 流水线执行

#### `POST /api/cases/{case_id}/run`

触发 `agent_ingest → 7-Agent 审批` 两阶段流水线（**后台异步执行，立即返回**）。

**完整地址**：`http://120.55.247.187:8000/api/cases/{case_id}/run`

> 通过轮询 `GET /api/cases/{case_id}` 的 `status` 字段跟踪进度：  
> `ingesting` → `processing` → `done` | `error`

**请求参数**：无

**响应示例**：

```json
{
  "ok": true,
  "case_id": "a1b2c3d4-...",
  "message": "流水线已启动，请轮询 GET /api/cases/{case_id} 查看进度"
}
```

**错误**：
- `409` — 流水线已在运行中
- `422` — 尚未上传任何材料

---

### 结果查询

#### `GET /api/cases/{case_id}/agent-progress`

查询 7 个业务 Agent 的逐一完成状态。

**完整地址**：`http://120.55.247.187:8000/api/cases/{case_id}/agent-progress`

**响应示例**：

```json
{
  "case_id": "a1b2c3d4-...",
  "case_status": "processing",
  "hospital_name": "某三甲医院",
  "agents": [
    { "id": 1, "label": "需求梳理", "done": true,  "status": "done" },
    { "id": 2, "label": "竞品归并", "done": true,  "status": "done" },
    { "id": 3, "label": "预算测算", "done": false, "status": "active" },
    { "id": 4, "label": "收益测算", "done": false, "status": "pending" },
    { "id": 5, "label": "合规核验", "done": false, "status": "pending" },
    { "id": 6, "label": "立项文书", "done": false, "status": "pending" },
    { "id": 7, "label": "审批反馈", "done": false, "status": "pending" }
  ],
  "done_count": 2,
  "total": 7,
  "active_agent": { "id": 3, "label": "预算测算", "done": false, "status": "active" }
}
```

Agent 状态值：`"done"` | `"active"` | `"pending"`

---

#### `GET /api/cases/{case_id}/snapshot`

获取该 Case 的 `project_snapshot.json`（SSOT，ingest 阶段完成后可用）。

**完整地址**：`http://120.55.247.187:8000/api/cases/{case_id}/snapshot`

**响应**：project_snapshot JSON 对象（内容由 agent_ingest 生成，结构随材料而定）。

**错误**：
- `404` — 快照尚未生成（请先 `/run`）

---

#### `GET /api/cases/{case_id}/rationality`

获取该 Case 的采购合理性判定结果（流水线完成后可用）。

**完整地址**：`http://120.55.247.187:8000/api/cases/{case_id}/rationality`

**响应示例**：

```json
{
  "verdict": "pass",
  "renewal_exemption": false,
  "dimensions": {
    "workload":      { "score": "green", "value": "62.3次/日台", "note": "高于市均49.64次" },
    "waiting_time":  { "score": "green", "value": "6.2天",       "note": "候检时间较长" },
    "positive_rate": { "score": "green", "value": "89.1%",       "note": "高于市均" },
    "device_age":    { "score": "green", "exemption_triggered": false }
  },
  "blocking_reason": "",
  "recommendation": "建议批准采购申请",
  "benchmark_source": "2025年四季度上海市级医院综合绩效简报（总第71期）"
}
```

`verdict` 取值：

| 值 | 含义 |
|----|------|
| `pass` | 合理性通过，建议批准 |
| `conditional` | 条件通过，需人工复核 |
| `reject` | 合理性否决 |
| `exempt_renewal` | 触发更新场景豁免 |

**错误**：
- `404` — 判定结果尚未生成

---

#### `GET /api/cases/{case_id}/task_overview`

获取 task_overview.json，含 rationality_verdict 摘要与质量评审得分，适用于 Dashboard 快速展示。

**完整地址**：`http://120.55.247.187:8000/api/cases/{case_id}/task_overview`

**错误**：
- `404` — 尚未生成

---

#### `GET /api/cases/{case_id}/document`

下载该 Case 生成的立项建议书（`.docx` 文件）。

**完整地址**：`http://120.55.247.187:8000/api/cases/{case_id}/document`

**响应**：二进制文件流，`Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document`，文件名为 `立项建议书.docx`。

**错误**：
- `404` — 立项建议书尚未生成

---

### 知识库管理

#### `GET /api/corpus`

查看共享知识库（agent_corpus）各子目录的文件统计与最近文件列表。

**完整地址**：`http://120.55.247.187:8000/api/corpus`

**响应示例**：

```json
{
  "dirs": {
    "a_requirements": {
      "title": "设备技术参数库",
      "label": "技术规格",
      "count": 5,
      "files": [
        { "name": "3.0T磁共振配置可行性报告.docx", "size_kb": 128, "mtime_iso": "2026-05-10 14:30" }
      ]
    },
    "b_competitors": { "title": "品牌竞品分析库", "label": "竞品资料", "count": 12, "files": [] },
    "c_compliance":  { "title": "合规监管知识库", "label": "法规文件", "count": 4,  "files": [] },
    "d_operations":  { "title": "运营财务基线库", "label": "运营数据", "count": 3,  "files": [] }
  },
  "total": 24,
  "recent": [
    {
      "name": "最新文件.pdf",
      "dir_id": "a_requirements",
      "title": "设备技术参数库",
      "label": "技术规格",
      "size_kb": 64,
      "mtime_iso": "2026-05-21 09:00"
    }
  ]
}
```

---

#### `POST /api/corpus/upload`

上传文件到指定知识库子目录。

**完整地址**：`http://120.55.247.187:8000/api/corpus/upload`

**请求类型**：`multipart/form-data`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `dir_id` | string | 是 | 目标子目录 ID（见下表）|
| `file` | file | 是 | 待上传文件 |

`dir_id` 可选值：

| dir_id | 知识库名称 |
|--------|-----------|
| `a_requirements` | 设备技术参数库 |
| `b_competitors` | 品牌竞品分析库 |
| `c_compliance` | 合规监管知识库 |
| `d_operations` | 运营财务基线库 |

**支持格式**：`.pdf` `.docx` `.xlsx` `.xls` `.pptx` `.png` `.jpg` `.jpeg`

**响应示例**：

```json
{
  "ok": true,
  "dir_id": "a_requirements",
  "saved_as": "技术规格文件.pdf",
  "size_kb": 256
}
```

**错误**：
- `400` — 未知 dir_id 或不支持的文件格式

---

### 兼容旧接口

#### `GET /api/snapshot`

返回最新 `done` 状态 Case 的 project_snapshot（供 ECTM 评测客户端调用）。若无 done 的 Case，则回退到 legacy 路径。

**完整地址**：`http://120.55.247.187:8000/api/snapshot`

**响应**：project_snapshot JSON 对象，包含字段：`generated_at`、`parser_mode`、`categories`、`key_params`、`excluded_non_mr`、`excluded_internal_promo`、`reference_only_competitors`、`missing_price_competitors`。

**错误**：
- `404` — 暂无可用快照

---

#### `GET /api/jobs/{job_id}`

查询 PDF 拆分任务的 manifest（遍历所有 Case 查找）。

**完整地址**：`http://120.55.247.187:8000/api/jobs/{job_id}`

**路径参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `job_id` | string (UUID) | 拆分任务 ID，由 `POST /split` 返回 |

**响应**：manifest.json 内容，包含原始文件信息与各章节拆分结果。

**错误**：
- `404` — job_id 不存在

---

## 文件分类说明

上传文件时使用的 `category` / `item_id` 对照表：

| item_id | 目录 | 材料名称 |
|---------|------|---------|
| `basic_info` | `01_requirements` | 基本情况表 |
| `nmpa_cert` | `02_competitors` | NMPA 注册证 |
| `minutes` | `03_compliance` | 论证纪要 |
| `performance` | `04_operations` | 绩效目标表 |
| `budget_list` | `05_budget` | 预算清单 |
| `price_proof` | `06_price` | 价格依据证明 |

---

## 错误码说明

| HTTP 状态码 | 含义 |
|------------|------|
| `400` | 请求参数错误（如文件类型不支持、JSON 格式错误）|
| `404` | 资源不存在（case_id / job_id 无效，或结果尚未生成）|
| `409` | 操作冲突（如流水线运行中重复触发或删除）|
| `415` — 不支持的媒体类型 |
| `422` | 语义错误（如未上传材料即触发流水线、PDF 解析失败）|
| `500` | 服务器内部错误（如缺少依赖）|

---

## 快速上手示例（以 curl 为例）

```bash
BASE="http://120.55.247.187:8000"

# 1. 健康检查
curl "$BASE/health"

# 2. 新建 Case
curl -X POST "$BASE/api/cases" -F "hospital_name=某三甲医院"

# 3. 上传 PDF 并分析章节
curl -X POST "$BASE/api/cases/{case_id}/analyze" -F "file=@采购包.pdf"

# 4. 拆分 PDF
curl -X POST "$BASE/api/cases/{case_id}/split" \
  -F "file=@采购包.pdf" \
  -F 'sections=[{"item_id":"basic_info","start":1,"end":3},{"item_id":"budget_list","start":4,"end":5}]'

# 5. 触发 Agent 流水线
curl -X POST "$BASE/api/cases/{case_id}/run"

# 6. 轮询进度
curl "$BASE/api/cases/{case_id}"

# 7. 查询 Agent 节点进度
curl "$BASE/api/cases/{case_id}/agent-progress"

# 8. 获取合理性判定结果
curl "$BASE/api/cases/{case_id}/rationality"

# 9. 下载立项建议书
curl -O "$BASE/api/cases/{case_id}/document"

# 10. 查看知识库
curl "$BASE/api/corpus"
```

---

*文档基于 `api_server.py v0.3.0` 及实测结果生成 · 更新时间：2026-05-21*
