#!/bin/bash
# =========================================================
# CareNexus Dashboard 一键打包与部署脚本
# =========================================================
set -e

# ── 配置区 ───────────────────────────────────────────────
SSH_HOST="candi"
SERVER_DIR="/var/www/mriagent"
BUILD_DIR="dist"
# ─────────────────────────────────────────────────────────

# 确保在 web-workstation 目录下执行
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
echo "📁 工作目录: $SCRIPT_DIR"

# ── Step 1: 构建 ─────────────────────────────────────────
echo ""
echo "🚀 [1/4] 开始本地打包..."
npm run build
echo "✅ 打包完成！"

# ── Step 2: 验证构建产物 ──────────────────────────────────
echo ""
echo "🔍 [2/4] 验证构建产物..."
if [ ! -f "$BUILD_DIR/index.html" ]; then
  echo "❌ 错误: $BUILD_DIR/index.html 不存在，构建可能失败！"
  exit 1
fi
FILE_COUNT=$(find "$BUILD_DIR" -type f | wc -l | tr -d ' ')
echo "✅ 构建产物正常，共 $FILE_COUNT 个文件："
ls -lh "$BUILD_DIR"

# ── Step 3: 测试 SSH 连接 ─────────────────────────────────
echo ""
echo "🔌 [3/4] 测试 SSH 连接 ($SSH_HOST)..."
if ! ssh -o ConnectTimeout=5 -o BatchMode=yes "$SSH_HOST" "echo 'SSH连接正常' && ls -la $SERVER_DIR"; then
  echo "❌ SSH 连接失败！请检查:"
  echo "   1. ~/.ssh/config 中是否有 Host candi 的配置"
  echo "   2. SSH 密钥是否正确"
  echo "   3. 服务器 $SERVER_DIR 目录是否存在"
  exit 1
fi

# ── Step 4: 同步文件 ──────────────────────────────────────
echo ""
echo "📦 [4/4] 增量同步到服务器 ($SSH_HOST:$SERVER_DIR)..."
rsync -avz --delete \
  --exclude='.DS_Store' \
  "$BUILD_DIR/" \
  "$SSH_HOST:$SERVER_DIR/"

echo ""
echo "🔑 修复服务器文件权限..."
ssh "$SSH_HOST" "find $SERVER_DIR -type d -exec chmod 755 {} \; && find $SERVER_DIR -type f -exec chmod 644 {} \;"

echo ""
echo "🔍 验证服务器文件..."
ssh "$SSH_HOST" "echo '服务器文件列表:' && ls -lh $SERVER_DIR"

echo ""
echo "🎉 部署成功！访问 http://120.55.247.187/mriagent/ 查看效果"
