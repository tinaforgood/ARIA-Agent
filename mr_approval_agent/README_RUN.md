# 运行手册（每次新开终端请先照做）

本文件约定 **日常开发／跑流水线** 时重复执行的顺序。细则与名词解释仍以根目录 [`README.md`](./README.md) 为准。

---

## 一、新开终端后的固定三步

在 **每一个** 用来跑 Python 流水线或本目录脚本的终端里，按顺序执行：

```bash
cd /Users/tina/Desktop/MriAgent/mr_approval_agent

# 1) 载入密钥与环境变量（你本地的 setup_env.sh，勿提交仓库）
source ./setup_env.sh

# 2) 启用项目虚拟环境
source ./.venv/bin/activate

# 3)（可选）检查环境是否能连上 Qwen / MinerU
#    在仓库根目录 MriAgent 下执行（需已 source 上一步的 env）：
#    cd /Users/tina/Desktop/MriAgent && python test_env.py
```

说明：

- `setup_env.sh` 位于 **`mr_approval_agent/setup_env.sh`**，已被 `.gitignore` 忽略，每人本机维护自己的一份。
- `source` 与 `chmod +x` 无关：**必须写成 `source ./setup_env.sh`**，不要用 `./setup_env.sh` 裸执行（那样变量进不了当前 shell）。
- 若尚未创建虚拟环境，只需做一次：`python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`（见 [`README.md`](./README.md) 环境准备）。

---

## 二、`setup_env.sh` 里建议包含的内容（示例）

按你实际密钥填写，文件名与路径保持为 `mr_approval_agent/setup_env.sh`：

```bash
#!/usr/bin/env bash
# MinerU 使用 backend=api 时必填
export MINERU_API_TOKEN='你的MinerU令牌'
# 若有自建或官方网关再取消注释：
# export MINERU_API_URL='https://你的网关'

# 运行仓库根目录 test_env.py 做连通性自检时用（与 agent_config 里的 qwen.api_key 可保持一致）
export DASHSCOPE_API_KEY='你的DashScope密钥'
```

`config/agent_config.json` 中的 **`qwen.api_key`** 仍须正确配置，`agent_ingest.py` / `agent_approval.py` 会读取该文件；上面 `DASHSCOPE_API_KEY` 主要方便 `test_env.py` 自检。

---

## 三、常见任务命令（均需先完成「第一节」）

### Stage 1：生成快照 `project_snapshot.json`

```bash
python agent_ingest.py \
  --datasource ./datasource \
  --output-root ./outputs/ingest \
  --config ./config/agent_config.json \
  --parser-mode mineru
```

快速仅 xlsx：`python agent_ingest.py --parser-mode openpyxl`

### Stage 2：业务 Agent（依赖 Stage 1 产物）

```bash
python agent_approval.py \
  --snapshot   ./outputs/ingest/results/project_snapshot.json \
  --output-root ./outputs/approval \
  --config      ./config/agent_config.json
```

### 给前端提供快照 API（可与 Stage 并行占一个终端）

```bash
uvicorn api_server:app --reload --host 0.0.0.0 --port 8000
```

### 前端（另一个终端，无需 source 本仓库的 `setup_env.sh`）

```bash
cd /Users/tina/Desktop/MriAgent/web-workstation
npm run dev
```

浏览器访问 Vite 提示的地址（一般为 `http://localhost:5173`），前端会从 `http://localhost:8000/api/snapshot` 拉取快照。

---

## 四、推荐终端分工

| 终端 | 目录 | 做什么 |
|------|------|--------|
| A | `mr_approval_agent` | `source setup_env.sh` → `source .venv/bin/activate` → 跑 `agent_ingest` / `agent_approval` |
| B | `mr_approval_agent` | 同上环境 → `uvicorn api_server:app --reload --port 8000` |
| C | `web-workstation` | `npm run dev` |

---

## 五、遇到问题先核对

1. 是否 **先 `cd` 到 `mr_approval_agent` 再 `source ./setup_env.sh`**？
2. 是否 **`source .venv/bin/activate`** 后再 `python …`？
3. `mineru.backend` 为 `api` 时，环境里是否真有 `MINERU_API_TOKEN`？
4. 前端报「找不到快照」时，是否已跑完 Stage 1 且存在 `outputs/ingest/results/project_snapshot.json`？

仍搞不定时，把 **完整报错** 与 **当时执行的三条命令**（cd / source / python）一并记录，便于排查。
