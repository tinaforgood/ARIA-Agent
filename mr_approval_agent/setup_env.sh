#!/bin/bash
# MriAgent 本地环境变量加载脚本
# 注意：此文件包含敏感信息，切勿提交至代码仓库！

# 通义千问 / DashScope（请将 sk-xxxx 替换为你的真实 Key）
export DASHSCOPE_API_KEY="sk-8e11570454b243e59c7c184b7cea8a14"

# MinerU 文档解析（请将下方 Token / URL 替换为官方提供的值）
export MINERU_API_TOKEN="eyJ0eXBlIjoiSldUIiwiYWxnIjoiSFM1MTIifQ.eyJqdGkiOiIyODMwMDA4MSIsInJvbCI6IlJPTEVfUkVHSVNURVIiLCJpc3MiOiJPcGVuWExhYiIsImlhdCI6MTc3ODYzOTM4OCwiY2xpZW50SWQiOiJsa3pkeDU3bnZ5MjJqa3BxOXgydyIsInBob25lIjoiIiwib3BlbklkIjpudWxsLCJ1dWlkIjoiYTQzNDZkNTAtOTA1Ny00YjUyLTg1YzgtNzk3NGU5YTQyOWFiIiwiZW1haWwiOiIiLCJleHAiOjE3ODY0MTUzODh9.JiE_-rqAKgG1GJxk04T1OLlllR-dQm49zmxrEbKfD19XSdR4Qdcrn9anHzt0TXM3e5J-aNedoYjWbg_X_xFrXA"
export MINERU_API_URL="https://mineru.net/api/v4/extract/task"

echo "✅ MriAgent 环境变量已加载！"
