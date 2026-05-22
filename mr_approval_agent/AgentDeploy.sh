#!/usr/bin/env bash
# =============================================================================
#  AgentDeploy.sh — MriAgent 后端 Agent 引擎一键部署脚本
#  适用版本: MriAgent Research Preview · Python 3.11 · FastAPI · Uvicorn
#
#  用法：
#    ./AgentDeploy.sh              # 常规部署（仅同步代码，跳过 datasource/）
#    ./AgentDeploy.sh --with-data  # 首次部署或更新知识底座时带上数据
# =============================================================================
set -euo pipefail

# ── 参数解析 ──────────────────────────────────────────────────────────────────
WITH_DATA=false
for arg in "$@"; do
  case "$arg" in
    --with-data) WITH_DATA=true ;;
    --help|-h)
      echo "用法: $0 [--with-data]"
      echo "  （无参数）   仅同步代码，跳过 datasource/（秒级完成）"
      echo "  --with-data  同步代码 + datasource/ 知识底座（首次部署或数据更新时使用）"
      exit 0 ;;
    *) echo "未知参数: $arg（使用 --help 查看用法）"; exit 1 ;;
  esac
done

# ── 颜色定义 ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${BLUE}ℹ${NC}  $*"; }
success() { echo -e "${GREEN}✅${NC} $*"; }
warn()    { echo -e "${YELLOW}⚠${NC}  $*"; }
error()   { echo -e "${RED}❌${NC} $*"; exit 1; }
header()  { echo -e "\n${BOLD}${CYAN}$*${NC}"; echo "$(printf '─%.0s' {1..60})"; }

# ── 配置区（按需修改）────────────────────────────────────────────────────────
SSH_HOST="candi"                          # SSH 别名（~/.ssh/config 中配置）
SERVER_BASE="/opt/mriagent"               # 服务器上的项目根目录
SERVER_AGENT_DIR="${SERVER_BASE}/mr_approval_agent"
SERVER_PYTHON="python3.11"               # 服务器上的 Python 可执行文件
UVICORN_PORT=8000                         # API 服务端口
UVICORN_WORKERS=2                         # 生产模式 worker 数量

# 本地路径（相对于脚本所在目录）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── rsync 排除项 ──────────────────────────────────────────────────────────────
# 基础排除：任何情况下都不同步
BASE_EXCLUDES=(
  ".venv/"
  "__pycache__/"
  "*.pyc"
  "*.pyo"
  ".DS_Store"
  "outputs/"
  "cases/"                    # 服务器运行时数据，勿覆盖
  "setup_env.sh"              # 本地密钥绝不上传
  "datasource/user_uploads/"  # 用户上传材料在服务器上单独管理
  ".git/"
)

# 常规部署额外排除：datasource/ 大文件跳过
CODE_ONLY_EXCLUDES=(
  "datasource/"
)
# =============================================================================

build_excludes() {
  local args=()
  for pat in "${BASE_EXCLUDES[@]}"; do
    args+=(--exclude="$pat")
  done
  if [[ "$WITH_DATA" == false ]]; then
    for pat in "${CODE_ONLY_EXCLUDES[@]}"; do
      args+=(--exclude="$pat")
    done
  fi
  echo "${args[@]}"
}

# ── Step 1: 本地前置检查 ──────────────────────────────────────────────────────
header "【1/5】本地前置检查"

cd "$SCRIPT_DIR"
info "工作目录: $SCRIPT_DIR"
if [[ "$WITH_DATA" == true ]]; then
  info "模式: 完整部署（代码 + datasource/ 知识底座）"
  # 估算 datasource 大小供参考
  DS_SIZE=$(du -sh datasource/ 2>/dev/null | cut -f1 || echo "未知")
  warn "datasource/ 大小约 ${DS_SIZE}，同步可能需要较长时间..."
else
  info "模式: 快速代码部署（跳过 datasource/）"
  info "提示: 首次部署或更新知识底座请使用 --with-data 参数"
fi

# 确认关键文件存在
for f in requirements.txt api_server.py agent_ingest.py agent_approval.py config/agent_config.json; do
  if [[ ! -f "$f" ]]; then
    error "关键文件缺失: $f（请确认在 mr_approval_agent/ 目录下运行此脚本）"
  fi
done
success "关键文件检查通过"

# 检查 SSH 连接
info "测试 SSH 连接 → $SSH_HOST ..."
if ! ssh -o ConnectTimeout=8 -o BatchMode=yes "$SSH_HOST" "echo '连接正常'" &>/dev/null; then
  error "SSH 连接失败！请检查 ~/.ssh/config 中是否配置了 Host ${SSH_HOST}"
fi
success "SSH 连接正常"

# ── Step 2: 同步代码到服务器 ─────────────────────────────────────────────────
if [[ "$WITH_DATA" == true ]]; then
  header "【2/5】同步代码 + datasource/ → ${SSH_HOST}:${SERVER_AGENT_DIR}"
else
  header "【2/5】同步代码 → ${SSH_HOST}:${SERVER_AGENT_DIR}（datasource/ 已跳过）"
fi

# 确保服务器目录结构存在
ssh "$SSH_HOST" "mkdir -p \
  ${SERVER_AGENT_DIR}/outputs/{ingest/{results,logs},approval/{results,logs}} \
  ${SERVER_AGENT_DIR}/datasource/user_uploads/{01_requirements,02_competitors,03_compliance,04_operations} \
  ${SERVER_AGENT_DIR}/datasource/agent_corpus"

# 执行 rsync
EXCLUDES=$(build_excludes)
rsync -avz --delete \
  $EXCLUDES \
  "$SCRIPT_DIR/" \
  "${SSH_HOST}:${SERVER_AGENT_DIR}/"

success "文件同步完成"

# 修复文件权限
ssh "$SSH_HOST" "find ${SERVER_AGENT_DIR} -type d -exec chmod 755 {} \; && \
                 find ${SERVER_AGENT_DIR} -type f -name '*.py' -exec chmod 644 {} \; && \
                 find ${SERVER_AGENT_DIR} -type f -name '*.sh' -exec chmod 755 {} \;"
success "文件权限修复完成"

# ── Step 3: 服务器端环境配置 ─────────────────────────────────────────────────
header "【3/5】服务器端 Python 环境"

ssh "$SSH_HOST" bash <<REMOTE
set -euo pipefail

cd "${SERVER_AGENT_DIR}"
echo "📍 服务器工作目录: \$(pwd)"

# 检查 Python 版本
PY_VERSION=\$(${SERVER_PYTHON} --version 2>&1 | awk '{print \$2}')
echo "🐍 Python 版本: \${PY_VERSION}"
MAJOR=\$(echo \$PY_VERSION | cut -d. -f1)
MINOR=\$(echo \$PY_VERSION | cut -d. -f2)
if [[ \$MAJOR -lt 3 ]] || [[ \$MAJOR -eq 3 && \$MINOR -lt 10 ]]; then
  echo "❌ Python 版本过低，需要 3.10–3.12（推荐 3.11）"
  exit 1
fi

# 创建或复用虚拟环境
if [[ ! -d ".venv" ]]; then
  echo "📦 创建 Python 虚拟环境..."
  ${SERVER_PYTHON} -m venv .venv
  echo "✅ 虚拟环境创建完成"
else
  echo "♻️  复用已有虚拟环境"
fi

# 激活并安装依赖
source .venv/bin/activate
echo "📥 安装/更新 Python 依赖..."
pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet
echo "✅ 依赖安装完成"
deactivate
REMOTE

success "Python 环境配置完成"

# ── Step 4: 确认服务器端密钥配置 ─────────────────────────────────────────────
header "【4/5】API 密钥与配置检查"

if ssh "$SSH_HOST" "[[ ! -f '${SERVER_AGENT_DIR}/setup_env.sh' ]]"; then
  warn "服务器上 setup_env.sh 不存在！"
  warn "请手动执行以下命令完成配置："
  echo ""
  echo "  ssh ${SSH_HOST}"
  echo "  cat > ${SERVER_AGENT_DIR}/setup_env.sh << 'EOF'"
  echo "  #!/usr/bin/env bash"
  echo "  export DASHSCOPE_API_KEY=\"sk-your-real-key-here\""
  echo "  export MINERU_API_TOKEN=\"your-mineru-token\""
  echo "  EOF"
  echo "  chmod 600 ${SERVER_AGENT_DIR}/setup_env.sh"
  echo ""
  warn "配置完成后重新运行本脚本以重启 API Server"
else
  success "setup_env.sh 已存在于服务器"
fi

if ssh "$SSH_HOST" "grep -q 'YOUR_DASHSCOPE_API_KEY' ${SERVER_AGENT_DIR}/config/agent_config.json" 2>/dev/null; then
  warn "agent_config.json 中 qwen.api_key 仍为占位符，建议通过 setup_env.sh 配置环境变量"
fi

# ── Step 5: 重启 API Server ────────────────────────────────────────────────
header "【5/5】重启 API Server（端口 ${UVICORN_PORT}）"

ssh "$SSH_HOST" bash <<REMOTE
set -euo pipefail

cd "${SERVER_AGENT_DIR}"

[[ -f setup_env.sh ]] && source ./setup_env.sh

# 停止旧进程
OLD_PID=\$(lsof -ti:${UVICORN_PORT} 2>/dev/null || true)
if [[ -n "\$OLD_PID" ]]; then
  echo "🛑 停止旧进程 (PID: \$OLD_PID)..."
  kill -TERM \$OLD_PID 2>/dev/null || true
  sleep 2
fi

source .venv/bin/activate
nohup uvicorn api_server:app \
  --host 0.0.0.0 \
  --port ${UVICORN_PORT} \
  --workers ${UVICORN_WORKERS} \
  --log-level info \
  > /tmp/mriagent-api.log 2>&1 &

NEW_PID=\$!
echo "🚀 API Server 已启动 (PID: \$NEW_PID)"
sleep 2

if curl -sf "http://127.0.0.1:${UVICORN_PORT}/health" > /dev/null; then
  echo "✅ 健康检查通过：http://127.0.0.1:${UVICORN_PORT}/health"
else
  echo "⚠️  健康检查失败，查看日志："
  tail -20 /tmp/mriagent-api.log
fi
REMOTE

# ── 完成摘要 ──────────────────────────────────────────────────────────────────
header "🎉 部署完成"
echo -e "  API Server : ${GREEN}http://${SSH_HOST}:${UVICORN_PORT}${NC}"
echo -e "  健康检查   : ${GREEN}http://${SSH_HOST}:${UVICORN_PORT}/health${NC}"
echo -e "  快照接口   : ${GREEN}http://${SSH_HOST}:${UVICORN_PORT}/api/snapshot${NC}"
echo -e "  服务器日志 : ${CYAN}ssh ${SSH_HOST} 'tail -f /tmp/mriagent-api.log'${NC}"
if [[ "$WITH_DATA" == false ]]; then
  echo ""
  echo -e "  ${YELLOW}datasource/ 未同步。若需更新知识底座，执行：${NC}"
  echo -e "  ${CYAN}./AgentDeploy.sh --with-data${NC}"
fi
echo ""
