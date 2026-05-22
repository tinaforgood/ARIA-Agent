#!/usr/bin/env python3
"""
server_preflight.py — MriAgent 服务器部署预检工具
=====================================================
在目标服务器上运行，或从本机通过 SSH 远程检查目标服务器。
最终输出：✅ 通过项 / ❌ 不合规项 + 修复指引

用法：
  python3 server_preflight.py                      # 在当前机器上检查
  python3 server_preflight.py --remote candi       # SSH 远程检查（无需提前复制脚本）
  python3 server_preflight.py --remote candi --fix # 远程检查并显示修复命令
  python3 server_preflight.py --json               # 输出 JSON（适合 CI/自动化）
  python3 server_preflight.py --fix                # 显示每项不合规的修复命令
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import shutil
import socket
import subprocess
import sys
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional

# ── ANSI 颜色 ─────────────────────────────────────────────────────────────────
R = "\033[0;31m"; G = "\033[0;32m"; Y = "\033[1;33m"
C = "\033[0;36m"; B = "\033[1m"; N = "\033[0m"

def _no_color():
    return not sys.stdout.isatty() or os.environ.get("NO_COLOR")

def red(s):   return s if _no_color() else f"{R}{s}{N}"
def green(s): return s if _no_color() else f"{G}{s}{N}"
def yellow(s):return s if _no_color() else f"{Y}{s}{N}"
def cyan(s):  return s if _no_color() else f"{C}{s}{N}"
def bold(s):  return s if _no_color() else f"{B}{s}{N}"


# ── 数据结构 ──────────────────────────────────────────────────────────────────
@dataclass
class CheckResult:
    name: str
    passed: bool
    actual: str
    required: str
    severity: str          # "critical" | "recommended" | "optional"
    fix_command: str = ""
    fix_note: str = ""
    category: str = ""

@dataclass
class PreflightReport:
    hostname: str
    os_info: str
    results: list[CheckResult] = field(default_factory=list)

    @property
    def passed(self):   return [r for r in self.results if r.passed]
    @property
    def failed(self):   return [r for r in self.results if not r.passed]
    @property
    def critical_failures(self): return [r for r in self.failed if r.severity == "critical"]
    @property
    def recommended_failures(self): return [r for r in self.failed if r.severity == "recommended"]


# ── 工具函数 ──────────────────────────────────────────────────────────────────
def run(cmd: str, timeout: int = 10) -> tuple[int, str]:
    """执行 shell 命令，返回 (returncode, stdout+stderr)"""
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return r.returncode, (r.stdout + r.stderr).strip()
    except subprocess.TimeoutExpired:
        return 1, "timeout"
    except Exception as e:
        return 1, str(e)

def cmd_output(cmd: str, default: str = "") -> str:
    code, out = run(cmd)
    return out if code == 0 else default

def port_available(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(1)
        return s.connect_ex(("127.0.0.1", port)) != 0  # 不可连接 = 端口空闲


# ── 读取 MinerU 运行模式 ───────────────────────────────────────────────────────

def get_mineru_backend() -> str:
    """
    读取 agent_config.json 中的 mineru.backend。
    返回 'api'（云端）或 'pipeline'（本地）。
    找不到配置时默认返回 'api'（宽松估计，避免误报；
    实际部署后配置文件同步过来会读取真实值）。
    """
    config_path = Path(__file__).resolve().parent / "config" / "agent_config.json"
    try:
        cfg = json.loads(config_path.read_text())
        return cfg.get("mineru", {}).get("backend", "api")
    except Exception:
        return "api"   # 配置文件不存在时保守用宽松阈值，避免假阳性


# ── 各项检查函数 ──────────────────────────────────────────────────────────────

def check_cpu(report: PreflightReport):
    backend = get_mineru_backend()
    is_api = backend == "api"
    # api 模式只做 HTTP 请求，2 核足够；pipeline 本地 OCR 需要多核并行
    min_cores = 2 if is_api else 4
    rec_cores = 4 if is_api else 8
    mode_note = "云端 API 模式，无本地 OCR，2 核即可" if is_api else "本地 pipeline 模式，MinerU OCR 依赖多核并行"
    try:
        count = os.cpu_count() or 0
        passed_min = count >= min_cores
        passed_rec = count >= rec_cores
        report.results.append(CheckResult(
            name="CPU 核心数",
            passed=passed_min,
            actual=f"{count} 核",
            required=f"最低 {min_cores} 核，推荐 {rec_cores} 核以上（{mode_note}）",
            severity="critical",
            fix_note=f"请升级服务器 CPU 或选用更高配置的云主机实例（推荐 {rec_cores}C+）",
            category="硬件"
        ))
        if passed_min and not passed_rec:
            report.results.append(CheckResult(
                name="CPU 核心数（推荐）",
                passed=False,
                actual=f"{count} 核（满足最低，未达推荐）",
                required=f"推荐 {rec_cores} 核以上",
                severity="recommended",
                fix_note=f"当前可运行，建议升级至 {rec_cores}C+",
                category="硬件"
            ))
    except Exception as e:
        report.results.append(CheckResult(
            name="CPU 核心数", passed=False,
            actual=f"检测失败: {e}", required=f"{min_cores} 核+",
            severity="critical", category="硬件"
        ))

def check_memory(report: PreflightReport):
    backend = get_mineru_backend()
    is_api = backend == "api"
    # api 模式无需加载本地模型，2 GB 够用；pipeline 模式模型占 4-8 GB，最低 16 GB
    min_gb  = 2  if is_api else 16
    rec_gb  = 4  if is_api else 32
    min_thr = 1.5 if is_api else 15   # 允许少量系统占用的实际阈值
    rec_thr = 3.5 if is_api else 30
    mode_note = "云端 API 模式，无本地模型加载" if is_api else "本地 pipeline 模式，MinerU 模型占 4–8 GB"

    def _add(total_gb: float):
        passed_min = total_gb >= min_thr
        passed_rec = total_gb >= rec_thr
        report.results.append(CheckResult(
            name="系统内存",
            passed=passed_min,
            actual=f"{total_gb:.1f} GB",
            required=f"最低 {min_gb} GB，推荐 {rec_gb} GB（{mode_note}）",
            severity="critical",
            fix_note=("" if is_api else "MinerU pipeline 模式加载 PDF 解析模型约占 4–8 GB，不足将 OOM 崩溃"),
            category="硬件"
        ))
        if passed_min and not passed_rec:
            report.results.append(CheckResult(
                name="系统内存（推荐）",
                passed=False,
                actual=f"{total_gb:.1f} GB（满足最低，未达推荐）",
                required=f"推荐 {rec_gb} GB+",
                severity="recommended",
                fix_note=f"建议升级至 {rec_gb} GB，提升并发稳定性",
                category="硬件"
            ))

    try:
        mem_info = Path("/proc/meminfo").read_text()
        total_kb = int(next(l for l in mem_info.splitlines() if "MemTotal" in l).split()[1])
        _add(total_kb / 1024 / 1024)
    except Exception:
        code, out = run("sysctl -n hw.memsize")
        if code == 0:
            _add(int(out) / 1024 / 1024 / 1024)

def check_disk(report: PreflightReport):
    backend = get_mineru_backend()
    is_api = backend == "api"
    # pipeline 模式需额外 5 GB 存模型；api 模式不需要
    min_gb = 10 if is_api else 20
    rec_gb = 30 if is_api else 50
    disk_note = ("datasource + outputs 随材料量增长" if is_api
                 else "MinerU 本地模型约 5 GB，datasource + outputs 随材料量增长")
    try:
        stat = shutil.disk_usage("/")
        free_gb = stat.free / 1024 / 1024 / 1024
        total_gb = stat.total / 1024 / 1024 / 1024
        passed_min = free_gb >= min_gb
        passed_rec = free_gb >= rec_gb
        report.results.append(CheckResult(
            name="磁盘可用空间",
            passed=passed_min,
            actual=f"{free_gb:.1f} GB 可用（共 {total_gb:.1f} GB）",
            required=f"最低 {min_gb} GB 可用，推荐 {rec_gb} GB+",
            severity="critical",
            fix_command="df -h /  # 查看磁盘使用情况\ndu -sh /var/log/* 2>/dev/null | sort -rh | head -10  # 找大文件",
            fix_note=disk_note,
            category="硬件"
        ))
        if passed_min and not passed_rec:
            report.results.append(CheckResult(
                name="磁盘可用空间（推荐）",
                passed=False,
                actual=f"{free_gb:.1f} GB 可用",
                required=f"推荐 {rec_gb} GB+（长期运行输出文件持续增长）",
                severity="recommended",
                fix_note="建议扩容或定期清理 outputs/ 目录",
                category="硬件"
            ))
    except Exception as e:
        report.results.append(CheckResult(
            name="磁盘可用空间", passed=False,
            actual=f"检测失败: {e}", required=f"{min_gb} GB+",
            severity="critical", category="硬件"
        ))

def check_gpu(report: PreflightReport):
    backend = get_mineru_backend()
    is_api = backend == "api"
    # api 模式完全不需要 GPU
    if is_api:
        report.results.append(CheckResult(
            name="GPU（NVIDIA）",
            passed=True,
            actual="云端 API 模式，无需本地 GPU",
            required="不需要（MinerU 运行在云端）",
            severity="optional",
            category="硬件"
        ))
        return
    code, out = run("nvidia-smi --query-gpu=name,memory.total --format=csv,noheader")
    if code == 0 and out:
        lines = [l.strip() for l in out.splitlines() if l.strip()]
        gpu_info = []
        all_ok = True
        for line in lines:
            parts = line.split(",")
            name = parts[0].strip() if parts else "Unknown"
            try:
                vram_mib = int(parts[1].strip().split()[0]) if len(parts) > 1 else 0
                vram_gb = vram_mib / 1024
                if vram_gb < 8:
                    all_ok = False
                gpu_info.append(f"{name} ({vram_gb:.1f} GB VRAM)")
            except Exception:
                gpu_info.append(name)
                all_ok = False
        report.results.append(CheckResult(
            name="GPU（NVIDIA）",
            passed=all_ok,
            actual="; ".join(gpu_info),
            required="推荐 NVIDIA GPU，VRAM ≥ 8 GB（MinerU OCR 速度提升 5-10×）",
            severity="recommended",
            fix_note="无 GPU 时 MinerU 使用 CPU 模式，OCR 速度慢 5-10 倍，功能不受影响",
            category="硬件"
        ))
    else:
        report.results.append(CheckResult(
            name="GPU（NVIDIA）",
            passed=False,
            actual="未检测到 NVIDIA GPU 或 nvidia-smi 不可用",
            required="推荐 NVIDIA GPU（VRAM ≥ 8 GB）",
            severity="optional",
            fix_note="无 GPU 可正常运行，仅影响 MinerU OCR 处理速度",
            category="硬件"
        ))

def check_python(report: PreflightReport):
    for py_cmd in ["python3.11", "python3.12", "python3.10", "python3"]:
        code, out = run(f"{py_cmd} --version")
        if code == 0 and "Python 3" in out:
            ver_str = out.split()[-1]
            parts = ver_str.split(".")
            major, minor = int(parts[0]), int(parts[1])
            passed = major == 3 and 10 <= minor <= 12
            is_recommended = minor == 11
            report.results.append(CheckResult(
                name="Python 版本",
                passed=passed,
                actual=f"{ver_str}（命令: {py_cmd}）" + ("" if is_recommended else "  [推荐 3.11]"),
                required="Python 3.10–3.12，推荐 3.11",
                severity="critical",
                fix_command="# Ubuntu/Debian:\napt install python3.11 python3.11-venv -y\n"
                            "# 或使用 pyenv:\ncurl https://pyenv.run | bash && pyenv install 3.11",
                fix_note="Python 版本不在支持范围内会导致依赖安装失败",
                category="软件"
            ))
            return
    report.results.append(CheckResult(
        name="Python 版本", passed=False,
        actual="未找到可用的 Python 3.x",
        required="Python 3.10–3.12，推荐 3.11",
        severity="critical",
        fix_command="apt install python3.11 python3.11-venv -y",
        category="软件"
    ))

def check_pip(report: PreflightReport):
    code, out = run("pip3 --version || pip --version")
    if code == 0:
        try:
            ver = out.split()[1]
            major = int(ver.split(".")[0])
            passed = major >= 23
            report.results.append(CheckResult(
                name="pip 版本",
                passed=passed,
                actual=ver,
                required="pip 23+",
                severity="recommended",
                fix_command="python3 -m pip install --upgrade pip",
                category="软件"
            ))
        except Exception:
            report.results.append(CheckResult(
                name="pip 版本", passed=True,
                actual=out.split()[1] if len(out.split()) > 1 else out,
                required="pip 23+", severity="recommended", category="软件"
            ))
    else:
        report.results.append(CheckResult(
            name="pip 版本", passed=False,
            actual="pip 未找到",
            required="pip 23+",
            severity="recommended",
            fix_command="python3 -m ensurepip --upgrade",
            category="软件"
        ))

def check_nodejs(report: PreflightReport):
    code, out = run("node --version")
    if code == 0:
        ver = out.lstrip("v")
        major = int(ver.split(".")[0])
        passed = major >= 20
        report.results.append(CheckResult(
            name="Node.js 版本",
            passed=passed,
            actual=out,
            required="Node.js 20 LTS+（前端构建用）",
            severity="recommended",
            fix_command="# 使用 nvm 安装:\ncurl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash\nnvm install 20 && nvm use 20",
            fix_note="仅前端构建需要，若只部署后端 API 可忽略",
            category="软件"
        ))
    else:
        report.results.append(CheckResult(
            name="Node.js 版本", passed=False,
            actual="Node.js 未安装",
            required="Node.js 20 LTS+",
            severity="recommended",
            fix_command="curl -fsSL https://deb.nodesource.com/setup_20.x | bash -\napt install -y nodejs",
            fix_note="仅前端构建需要，若只部署后端 API 可忽略",
            category="软件"
        ))

def check_git(report: PreflightReport):
    code, out = run("git --version")
    if code == 0:
        ver = out.split()[-1]
        parts = ver.split(".")
        passed = int(parts[0]) > 2 or (int(parts[0]) == 2 and int(parts[1]) >= 38)
        report.results.append(CheckResult(
            name="Git 版本",
            passed=passed,
            actual=ver,
            required="Git 2.38+",
            severity="recommended",
            fix_command="apt install git -y  # 或 yum install git -y",
            category="软件"
        ))
    else:
        report.results.append(CheckResult(
            name="Git 版本", passed=False,
            actual="Git 未安装",
            required="Git 2.38+",
            severity="recommended",
            fix_command="apt install git -y",
            category="软件"
        ))

def check_nginx(report: PreflightReport):
    code, out = run("nginx -v 2>&1 || nginx -V 2>&1")
    installed = code == 0 and "nginx" in out.lower()
    report.results.append(CheckResult(
        name="Nginx",
        passed=installed,
        actual=out.strip() if installed else "Nginx 未安装",
        required="Nginx（静态文件托管 + API 反向代理）",
        severity="recommended",
        fix_command="apt install nginx -y\nsystemctl enable nginx && systemctl start nginx",
        fix_note="用于将前端静态文件托管及将 /api/ 反向代理到 Uvicorn:8000",
        category="软件"
    ))

def check_curl(report: PreflightReport):
    code, _ = run("curl --version")
    report.results.append(CheckResult(
        name="curl",
        passed=(code == 0),
        actual="已安装" if code == 0 else "未安装",
        required="curl（健康检查与 API 测试用）",
        severity="recommended",
        fix_command="apt install curl -y",
        category="软件"
    ))

def check_lsof(report: PreflightReport):
    code, _ = run("lsof --version || which lsof")
    report.results.append(CheckResult(
        name="lsof",
        passed=(code == 0),
        actual="已安装" if code == 0 else "未安装",
        required="lsof（端口占用检查用）",
        severity="optional",
        fix_command="apt install lsof -y",
        category="软件"
    ))

def check_port(report: PreflightReport, port: int, desc: str, severity: str):
    free = port_available(port)
    report.results.append(CheckResult(
        name=f"端口 {port}（{desc}）",
        passed=free,
        actual="空闲" if free else f"已被占用",
        required=f"端口 {port} 需空闲",
        severity=severity,
        fix_command=f"lsof -i:{port}           # 查看占用进程\nkill -9 $(lsof -t -i:{port})  # 强制释放（谨慎操作）",
        fix_note=f"端口 {port} 被占用将导致 {desc} 无法启动",
        category="网络"
    ))

def check_dashscope_connectivity(report: PreflightReport):
    code, out = run("curl -sf --max-time 8 https://dashscope.aliyuncs.com -o /dev/null -w '%{http_code}'")
    # 任何 HTTP 响应码（包括 404）都说明网络可达，只有 000/超时 才是真正不通
    reachable = out not in ("", "000") and out.isdigit()
    report.results.append(CheckResult(
        name="DashScope API 可达性",
        passed=reachable,
        actual=f"可访问（HTTP {out}）" if reachable else f"无法访问（{out or '连接超时'}）",
        required="https://dashscope.aliyuncs.com 网络可达（Qwen LLM 必须）",
        severity="critical",
        fix_note="如服务器有出站防火墙，需开放对 dashscope.aliyuncs.com:443 的访问",
        fix_command="# 检查防火墙规则:\niptables -L OUTPUT -n\n# 或检查安全组出站规则（阿里云/腾讯云等云平台控制台）",
        category="网络"
    ))

def check_mineru_connectivity(report: PreflightReport):
    code, out = run("curl -sf --max-time 5 https://mineru.net -o /dev/null -w '%{http_code}'")
    reachable = code == 0 and out not in ("", "000")
    report.results.append(CheckResult(
        name="MinerU API 可达性",
        passed=reachable,
        actual="可访问" if reachable else "无法访问（本地模式可忽略）",
        required="https://mineru.net 可达（SaaS 模式需要，本地 pipeline 模式可忽略）",
        severity="optional",
        fix_note="本地 pipeline 模式（默认）无需此连接；SaaS 模式才需要",
        category="网络"
    ))

def check_env_key(report: PreflightReport):
    key = os.environ.get("DASHSCOPE_API_KEY", "")
    has_key = bool(key) and key != "YOUR_DASHSCOPE_API_KEY" and key.startswith("sk-")
    report.results.append(CheckResult(
        name="DASHSCOPE_API_KEY 环境变量",
        passed=has_key,
        actual="已配置" if has_key else ("未设置" if not key else "仍为占位符值"),
        required="有效的 DashScope API Key（sk- 开头）",
        severity="critical",
        fix_command="# 在 mr_approval_agent/ 目录下创建 setup_env.sh：\ncat > setup_env.sh << 'EOF'\nexport DASHSCOPE_API_KEY=\"sk-your-real-key\"\nEOF\nchmod 600 setup_env.sh\nsource ./setup_env.sh",
        fix_note="未配置将导致所有 Qwen LLM 调用报 AuthenticationError",
        category="配置"
    ))

def check_mineru_models(report: PreflightReport):
    """检查 MinerU 本地模型是否已下载（仅 pipeline 本地模式需要）"""
    backend = get_mineru_backend()
    if backend == "api":
        report.results.append(CheckResult(
            name="MinerU 本地模型",
            passed=True,
            actual="云端 API 模式，无需下载本地模型",
            required="不需要（MinerU 运行在云端）",
            severity="optional",
            category="配置"
        ))
        return
    model_dirs = [
        Path.home() / ".cache" / "huggingface",
        Path.home() / ".cache" / "modelscope",
        Path("/root/.cache/huggingface"),
        Path("/root/.cache/modelscope"),
    ]
    found = False
    for d in model_dirs:
        try:
            if d.is_dir() and any(d.rglob("*.bin")):
                found = True
                break
        except PermissionError:
            # 无权限访问的目录跳过（不代表没有模型）
            found = True  # 存在但无权访问，保守认为已下载
            break

    # 尝试在项目 venv 中检测 mineru-models-download 是否已运行过
    script_dir = Path(__file__).resolve().parent
    venv_mineru = script_dir / ".venv" / "bin" / "mineru-models-download"
    mineru_installed = venv_mineru.is_file()

    report.results.append(CheckResult(
        name="MinerU 本地模型",
        passed=found,
        actual="已下载（或检测到缓存目录）" if found else "未检测到模型文件",
        required="首次运行需执行 mineru-models-download（模型约 5 GB）",
        severity="critical",
        fix_command="# 激活 venv 后执行（需联网，约 5 GB，选 modelscope 源）：\nsource .venv/bin/activate\nmineru-models-download\n# 提示选择源时输入：modelscope",
        fix_note="模型未下载时 pipeline 模式会直接崩溃；下载完成后此项即通过",
        category="配置"
    ))

def check_project_dirs(report: PreflightReport):
    """检查项目关键目录是否存在"""
    script_dir = Path(__file__).resolve().parent
    critical_dirs = [
        ("datasource/agent_corpus", "静态知识底座"),
        ("config", "配置目录"),
        ("assets/fonts_pkg", "中文字体包"),
    ]
    optional_dirs = [
        ("outputs/ingest/results", "Stage1 输出目录"),
        ("outputs/approval/results", "Stage2 输出目录"),
        ("datasource/user_uploads", "用户上传目录"),
    ]
    for rel, desc in critical_dirs:
        p = script_dir / rel
        report.results.append(CheckResult(
            name=f"目录: {rel}",
            passed=p.is_dir(),
            actual="存在" if p.is_dir() else "缺失",
            required=f"{desc}（{rel}/）",
            severity="critical",
            fix_command=f"mkdir -p {rel}",
            category="目录结构"
        ))
    for rel, desc in optional_dirs:
        p = script_dir / rel
        if not p.is_dir():
            report.results.append(CheckResult(
                name=f"目录: {rel}",
                passed=False,
                actual="缺失（自动创建即可）",
                required=f"{desc}",
                severity="recommended",
                fix_command=f"mkdir -p {rel}",
                category="目录结构"
            ))

def check_agent_config(report: PreflightReport):
    config_path = Path(__file__).resolve().parent / "config" / "agent_config.json"
    if not config_path.is_file():
        report.results.append(CheckResult(
            name="agent_config.json",
            passed=False,
            actual="文件不存在",
            required="config/agent_config.json（主配置文件）",
            severity="critical",
            fix_note="此文件应随代码一同部署，请检查 rsync 是否正常",
            category="配置"
        ))
        return
    try:
        cfg = json.loads(config_path.read_text())
        api_key = cfg.get("qwen", {}).get("api_key", "")
        key_placeholder = api_key == "YOUR_DASHSCOPE_API_KEY" or not api_key
        report.results.append(CheckResult(
            name="agent_config.json → qwen.api_key",
            passed=not key_placeholder,
            actual="已填写" if not key_placeholder else "仍为占位符（推荐改用环境变量）",
            required="填写真实 DashScope API Key 或通过 DASHSCOPE_API_KEY 环境变量覆盖",
            severity="recommended",
            fix_note="建议使用 setup_env.sh + 环境变量方式，避免密钥写入文件",
            category="配置"
        ))
        backend = cfg.get("mineru", {}).get("backend", "pipeline")
        report.results.append(CheckResult(
            name="agent_config.json → mineru.backend",
            passed=True,
            actual=f"{backend}（{'本地模式' if backend == 'pipeline' else 'SaaS 模式'}）",
            required="pipeline（本地）或 api（SaaS）",
            severity="optional",
            fix_note="本地 pipeline 模式需下载模型；SaaS 模式需配置 MINERU_API_TOKEN",
            category="配置"
        ))
    except json.JSONDecodeError as e:
        report.results.append(CheckResult(
            name="agent_config.json",
            passed=False,
            actual=f"JSON 解析失败: {e}",
            required="合法的 JSON 格式",
            severity="critical",
            fix_command="python3 -m json.tool config/agent_config.json  # 检查语法",
            category="配置"
        ))


# ── 渲染报告 ──────────────────────────────────────────────────────────────────

CATEGORY_ORDER = ["硬件", "软件", "网络", "配置", "目录结构"]

def render_report(report: PreflightReport, show_fix: bool = False):
    print()
    print(bold("=" * 62))
    print(bold(f"  MriAgent 服务器部署预检报告"))
    print(bold("=" * 62))
    print(f"  主机: {report.hostname}")
    print(f"  系统: {report.os_info}")
    print()

    # 按分类分组输出
    by_category: dict[str, list[CheckResult]] = {}
    for r in report.results:
        by_category.setdefault(r.category or "其他", []).append(r)

    for cat in CATEGORY_ORDER + [k for k in by_category if k not in CATEGORY_ORDER]:
        items = by_category.get(cat, [])
        if not items:
            continue
        print(bold(f"  ── {cat} ─────────────────────────────────────"))
        for item in items:
            icon = green("✅") if item.passed else (
                red("❌") if item.severity == "critical" else
                yellow("⚠ ") if item.severity == "recommended" else
                cyan("ℹ ")
            )
            status = green("通过") if item.passed else (
                red("不合规") if item.severity == "critical" else
                yellow("建议改进") if item.severity == "recommended" else
                cyan("可选")
            )
            print(f"  {icon}  {item.name:<32} {status}")
            print(f"       当前: {item.actual}")
            if not item.passed:
                print(f"       要求: {item.required}")
                if show_fix and item.fix_command:
                    print(f"       {yellow('修复命令')}:")
                    for line in item.fix_command.strip().splitlines():
                        print(f"         {cyan(line)}")
                if item.fix_note:
                    print(f"       {yellow('说明')}: {item.fix_note}")
            print()

    # 汇总
    total = len(report.results)
    passed = len(report.passed)
    critical = len(report.critical_failures)
    recommended = len(report.recommended_failures)

    print(bold("=" * 62))
    print(bold("  检查汇总"))
    print(bold("=" * 62))
    print(f"  总计: {total} 项  {green(f'通过: {passed}')}  {red(f'严重不合规: {critical}')}  {yellow(f'建议改进: {recommended}')}")
    print()

    if critical > 0:
        print(red(bold("  ❌ 存在严重不合规项，部署前必须解决：")))
        for r in report.critical_failures:
            print(red(f"     • {r.name}: {r.actual}"))
        print()
    if recommended > 0:
        print(yellow(bold("  ⚠  存在建议改进项（不影响运行，但影响性能或稳定性）：")))
        for r in report.recommended_failures:
            print(yellow(f"     • {r.name}: {r.actual}"))
        print()

    if critical == 0:
        if recommended == 0:
            print(green(bold("  🎉 全部检查通过！服务器满足部署要求。")))
        else:
            print(green(bold("  ✅ 必要条件满足，可以部署（建议改进项不影响基本运行）。")))
    else:
        print(red(bold("  🚫 请先修复上述严重不合规项，再执行 AgentDeploy.sh。")))

    if not show_fix and report.failed:
        print()
        print(f"  {cyan('提示: 运行 python3 server_preflight.py --fix 可查看每项的修复命令')}")
    print()


def render_json(report: PreflightReport):
    output = {
        "hostname": report.hostname,
        "os_info": report.os_info,
        "summary": {
            "total": len(report.results),
            "passed": len(report.passed),
            "critical_failures": len(report.critical_failures),
            "recommended_failures": len(report.recommended_failures),
            "deployable": len(report.critical_failures) == 0,
        },
        "results": [asdict(r) for r in report.results],
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))


# ── 远程模式 ──────────────────────────────────────────────────────────────────

def run_remote(host: str, show_fix: bool = False):
    """
    将本脚本通过 SSH 管道传给远端 python3 执行，接收 JSON 结果后在本地渲染。
    无需提前把文件复制到远端服务器。
    """
    script_path = Path(__file__).resolve()

    print(f"\n{bold(cyan(f'正在通过 SSH 连接 {host}，执行远端预检...'))} ", end="", flush=True)

    # 先测试 SSH 连通性
    conn_test = subprocess.run(
        ["ssh", "-o", "ConnectTimeout=8", "-o", "BatchMode=yes",
         "-o", "StrictHostKeyChecking=accept-new", host, "echo ok"],
        capture_output=True, text=True
    )
    if conn_test.returncode != 0 or "ok" not in conn_test.stdout:
        print("失败\n")
        print(red(f"❌ 无法 SSH 连接到 {host}"))
        print(red(f"   错误: {conn_test.stderr.strip() or '连接超时'}"))
        print(yellow(f"\n   请检查 ~/.ssh/config 是否配置了 Host {host}"))
        print(yellow(f"   或直接使用 IP: python3 server_preflight.py --remote root@120.55.247.187"))
        sys.exit(2)

    # 探测远端可用的 Python 3.7+ 版本（from __future__ import annotations 需要 3.7+）
    # 直接逐个路径尝试运行，避免 command -v 在 SSH 非交互 shell 下的 PATH 问题
    detect_script = (
        "for py in "
        "/usr/bin/python3.11 /usr/bin/python3.12 /usr/bin/python3.10 "
        "/usr/bin/python3.9 /usr/bin/python3.8 /usr/bin/python3.7 "
        "/usr/local/bin/python3.11 /usr/local/bin/python3.10 /usr/local/bin/python3 "
        "/opt/rh/python311/root/usr/bin/python3.11 "
        "/opt/rh/python39/root/usr/bin/python3.9 "
        "python3.11 python3.10 python3.9 python3.8 python3; do "
        '$py -c "import sys; assert sys.version_info>=(3,7); print(\'$py\')" 2>/dev/null && break; '
        "done"
    )
    detect = subprocess.run(
        ["ssh", "-o", "ConnectTimeout=10",
         "-o", "StrictHostKeyChecking=accept-new", host, detect_script],
        capture_output=True, text=True, timeout=20
    )
    python_cmd = detect.stdout.strip()
    if not python_cmd:
        print("失败\n")
        print(red("❌ 远端服务器未找到 Python 3.7+，无法执行预检"))
        print(yellow("\n   诊断：在本机运行以下命令查看远端实际安装情况："))
        print(cyan(f"   ssh {host} \"find /usr /opt /usr/local -name 'python3*' -type f 2>/dev/null | head -10\""))
        print(yellow("\n   安装（CentOS/RHEL）："))
        print(cyan("   ssh " + host + " 'yum install python3.11 -y'"))
        print(yellow("   安装（Debian/Ubuntu）："))
        print(cyan("   ssh " + host + " 'apt install python3.11 -y'"))
        sys.exit(2)
    print(f"（远端 {python_cmd}）", end=" ", flush=True)

    # 把脚本内容通过 stdin 管道发给远端，加 --json 让远端只输出纯 JSON
    try:
        script_bytes = script_path.read_bytes()
        result = subprocess.run(
            ["ssh", "-o", "ConnectTimeout=10",
             "-o", "StrictHostKeyChecking=accept-new", host,
             f"{python_cmd} - --json"],
            input=script_bytes,
            capture_output=True,
            timeout=120
        )
    except subprocess.TimeoutExpired:
        print("超时\n")
        print(red("❌ 远端检查超时（>120s），服务器响应慢或网络不稳定"))
        sys.exit(2)
    except Exception as e:
        print("失败\n")
        print(red(f"❌ SSH 执行异常: {e}"))
        sys.exit(2)

    # returncode 0 = 全部通过，1 = 有严重不合规（均属正常）
    if result.returncode not in (0, 1):
        print("失败\n")
        stderr = result.stderr.decode(errors="replace").strip()
        print(red(f"❌ 远端脚本执行异常（exit {result.returncode}）:"))
        print(red(f"   {stderr[:400]}"))
        print(yellow("\n   可能原因: 远端 python3 未安装，或版本过低（需 3.6+）"))
        sys.exit(2)

    print("完成\n")

    # 解析远端返回的 JSON
    stdout = result.stdout.decode(errors="replace").strip()
    try:
        data = json.loads(stdout)
    except json.JSONDecodeError:
        print(red("❌ 远端返回数据不是合法 JSON，原始输出："))
        print(stdout[:600])
        stderr = result.stderr.decode(errors="replace").strip()
        if stderr:
            print(yellow("stderr:"), stderr[:300])
        sys.exit(2)

    # 重建 PreflightReport 并本地渲染
    report = PreflightReport(
        hostname=f"{data.get('hostname', host)}  (远端 via SSH: {host})",
        os_info=data.get("os_info", "未知"),
    )
    for r in data.get("results", []):
        report.results.append(CheckResult(**r))

    render_report(report, show_fix=show_fix)
    sys.exit(0 if not report.critical_failures else 1)


# ── 主入口 ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="MriAgent 服务器部署预检工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument("--remote", "-H", metavar="HOST",
                        help="SSH 远端主机（支持 ~/.ssh/config 别名或 user@ip 格式），从本机检查远端服务器")
    parser.add_argument("--json", action="store_true", help="输出 JSON 报告（远端模式下由远端输出，本地解析）")
    parser.add_argument("--fix",  action="store_true", help="显示每项不合规的修复命令")
    args = parser.parse_args()

    # ── 远程模式：通过 SSH 检查远端服务器 ──────────────────────────────────────
    if args.remote:
        run_remote(args.remote, show_fix=args.fix)
        return  # run_remote 内部会 sys.exit，这里不会执行

    report = PreflightReport(
        hostname=platform.node() or socket.gethostname(),
        os_info=f"{platform.system()} {platform.release()} ({platform.machine()})",
    )

    checks = [
        # 硬件
        check_cpu, check_memory, check_disk, check_gpu,
        # 软件
        check_python, check_pip, check_nodejs, check_git, check_nginx, check_curl, check_lsof,
        # 网络
        check_dashscope_connectivity, check_mineru_connectivity,
        # 配置
        check_env_key, check_agent_config, check_mineru_models,
        # 目录
        check_project_dirs,
        # 端口
        lambda r: check_port(r, 8000, "Uvicorn API Server", "critical"),
        lambda r: check_port(r, 5173, "Vite 开发服务器", "optional"),
    ]

    if not args.json:
        print(f"\n{bold(cyan('正在检查服务器配置，请稍候...'))} ", end="", flush=True)

    for check_fn in checks:
        try:
            check_fn(report)
        except Exception as e:
            report.results.append(CheckResult(
                name=getattr(check_fn, "__name__", str(check_fn)),
                passed=False,
                actual=f"检查异常: {e}",
                required="—",
                severity="recommended",
                category="其他"
            ))

    if not args.json:
        print("完成\n")

    if args.json:
        render_json(report)
    else:
        render_report(report, show_fix=args.fix)

    # 退出码：有严重不合规项时返回 1
    sys.exit(0 if not report.critical_failures else 1)


if __name__ == "__main__":
    main()
