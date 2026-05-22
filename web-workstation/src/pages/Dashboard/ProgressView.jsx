/**
 * ProgressView — 进度跟踪页面
 *
 * 布局：
 *   左侧导航栏（9个子模块 + 当前项目进度环）
 *   右侧主内容：
 *     SubHeader（项目选择 / 数据更新时间 / 日期 / 时间范围）
 *     Section 1  系统级流水线健康总览（Stage流程图 + 3个KPI卡）
 *     Section 2  7大Agent独立效能矩阵
 *     Section 3  动态决策路网与实时卡点分析 + 典型阻断诱因 + 风险分布
 */

import { useState } from 'react'
import {
  LayoutDashboard, GitBranch, Bot, Network, ListTodo,
  ClipboardList, BookOpen, BarChart3, Settings2,
  RefreshCw, Calendar, ChevronDown, ArrowRight,
  AlertTriangle, ExternalLink,
} from 'lucide-react'

import DecisionTopology, { DECISION_TOPOLOGY_NODES as TOPO_NODES } from './components/DecisionTopology'

// ─── Mock data ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'overview',   Icon: LayoutDashboard, label: '监控总览',   sub: '全局健康态势与关键指标总览' },
  { id: 'pipeline',   Icon: GitBranch,       label: '流水线视图', sub: '阶段流转与任务分布' },
  { id: 'agents',     Icon: Bot,             label: 'Agent 矩阵', sub: '7大 Agent 效能监控' },
  { id: 'topology',   Icon: Network,         label: '决策路网',   sub: '动态拓扑与卡点分析' },
  { id: 'tasks',      Icon: ListTodo,        label: '任务中心',   sub: '关键任务与异常追踪' },
  { id: 'logs',       Icon: ClipboardList,   label: '干预记录',   sub: '人工干预历史与统计' },
  { id: 'knowledge',  Icon: BookOpen,        label: '知识资产',   sub: '共享知识与经验沉淀' },
  { id: 'reports',    Icon: BarChart3,       label: '报表中心',   sub: '监控报表与导出' },
  { id: 'settings',   Icon: Settings2,       label: '系统设置',   sub: '监控规则与告警设置' },
]

const PIPELINE_STAGES = [
  {
    id: 1, label: 'Stage 1 文档提取', status: '运行中',
    nodes: ['数据源接入', '文本解析', '结构化转换', '知识抽取'],
  },
  {
    id: 2, label: 'Stage 2 决策编排', status: '运行中',
    nodes: ['意图分析', 'Agent 协同', '决策评估', '结果落地'],
    lastDone: true,
  },
]

const KPI_CARDS = [
  {
    id: 'throughput', label: '流水线直通率',
    value: '82', unit: '%',
    delta: '+1.3%', deltaDir: 'up', deltaSub: '较上周',
    color: '#3B82F6',
    // 近10天略有波动，整体向上，避免末尾重复
    trend: [77, 79, 78, 80, 79, 81, 80, 82, 81, 82],
    yMin: 60, yMax: 100,
  },
  {
    id: 'latency', label: '平均决策延迟',
    value: '4.5', unit: 'min/步骤',   // 每 Agent 步骤耗时，非全流程
    delta: '↓0.8 min', deltaDir: 'down', deltaSub: '较上周',
    color: '#8B5CF6',
    trend: [6.1, 5.9, 5.6, 5.3, 5.1, 4.9, 4.8, 4.6, 4.5, 4.5],
    yMin: 0, yMax: 8,
  },
  {
    id: 'human', label: '人机协同干预频次',
    value: '430', unit: '次',
    // 当前430次 vs 上周均值490次 = 下降12.2%
    delta: '-12%', deltaDir: 'neutral', deltaSub: '较上周均值 490 次',
    color: '#8B5CF6',
    trend: [493, 487, 479, 468, 461, 452, 444, 438, 433, 430],
    yMin: 400, yMax: 510,
  },
]

const AGENTS = [
  // 需求梳理：最先执行，工作量大但任务单纯，幻觉率中等
  { id: 1, name: '需求梳理', status: '运行中',   statusCls: 'bg-emerald-50 text-emerald-600', ring: '#22C55E', score: 92, intercept: '4.8%', today: 124, alerts: 0, quality: 91, dist: [3, 5, 9, 11, 6] },
  // 竞品归并：价格字段敏感 + 多厂商参数对齐，幻觉率最高，当前紧忙
  { id: 2, name: '竞品归并', status: '紧忙',     statusCls: 'bg-orange-50 text-orange-600',   ring: '#F97316', score: 87, intercept: '9.2%', today: 88,  alerts: 5, quality: 83, dist: [2, 4, 6, 17, 10] },
  // 预算测算：依赖竞品输出，偶有数据冲突，稳定运行
  { id: 3, name: '预算测算', status: '稳定',     statusCls: 'bg-blue-50 text-blue-600',       ring: '#3B82F6', score: 93, intercept: '3.9%', today: 119, alerts: 0, quality: 93, dist: [4, 7, 10, 9,  4] },
  // 收益测算：财务假设偏主观，幻觉风险高于平均
  { id: 4, name: '收益测算', status: '稳定',     statusCls: 'bg-blue-50 text-blue-600',       ring: '#3B82F6', score: 90, intercept: '7.1%', today: 97,  alerts: 1, quality: 89, dist: [3, 5, 8, 12,  7] },
  // 合规核验：以事实核查为主，幻觉率全系统最低
  { id: 5, name: '合规核验', status: '运行中',   statusCls: 'bg-emerald-50 text-emerald-600', ring: '#22C55E', score: 96, intercept: '2.8%', today: 141, alerts: 0, quality: 95, dist: [5, 8, 11, 8,  3] },
  // 立项文书：文本生成复杂度高，积压导致极度紧忙，今日产出明显低于其他
  { id: 6, name: '立项文书', status: '极度紧忙', statusCls: 'bg-red-50 text-red-600',         ring: '#EF4444', score: 89, intercept: '5.7%', today: 74,  alerts: 3, quality: 87, dist: [2, 3, 5, 19, 13] },
  // 审批反馈：多为路由与状态同步，耗时最短，产出最高
  { id: 7, name: '审批反馈', status: '稳定',     statusCls: 'bg-blue-50 text-blue-600',       ring: '#3B82F6', score: 97, intercept: '1.9%', today: 158, alerts: 0, quality: 96, dist: [7, 9, 12, 7,  2] },
]

const BLOCKERS = [
  // 占所有阻断事件的比例（与风险甜甜圈独立，避免数字重叠）
  { rank: 1, title: '缺失底层报价证据',   freq: 127, pct: 43, stages: '竞品归并 / 预算测算', risk: '高', riskCls: 'bg-red-500 text-white'   },
  { rank: 2, title: '财务收益假设不合理', freq: 79,  pct: 27, stages: '收益测算',            risk: '中', riskCls: 'bg-orange-400 text-white' },
  { rank: 3, title: '历史基线数据冲突',   freq: 52,  pct: 18, stages: '预算测算 / 合规核验', risk: '中', riskCls: 'bg-orange-400 text-white' },
]

const TOPO_NODE_DETAIL = {
  ingest:    { p95Sec: 12, queue: 2,  sample: 'project_snapshot 增量写入', hint: '院级 API 限流正常' },
  parse:     { p95Sec: 48, queue: 4,  sample: '西门子_MRI_报价单_v3.pdf', hint: '复杂表格 MinerU 版面较多' },
  struct:    { p95Sec: 22, queue: 1,  sample: '8 类材料 → JSON 字段对齐', hint: '等待下游 Agent 取数' },
  req:       { p95Sec: 35, queue: 3,  sample: '放射科 3.0T 申购意向', hint: '临床表述标准化耗时略高' },
  matrix:    { p95Sec: 186, queue: 9, sample: '三家厂家参数矩阵对齐', hint: '底价字段敏感 + 人工抽检比例↑' },
  budget:    { p95Sec: 52, queue: 2,  sample: 'TCO 维保 + 場地改造推算', hint: '与竞品归并价差联动' },
  report:    { p95Sec: 92, queue: 4,  sample: '论证报告章节 V1', hint: '模板段落拼装 + 复核队列' },
  roi:       { p95Sec: 41, queue: 2,  sample: '贴现率与检查量敏感性表', hint: '与合规收费基线可对账' },
  comply:    { p95Sec: 38, queue: 1,  sample: '430 vs 460 收费一致性扫描', hint: '证据链回溯命中率高' },
  approval: { p95Sec: 28, queue: 2,  sample: '院办驳回语义 → V2 补件任务', hint: '回跳文书节点（虚线）' },
  done:      { p95Sec: 8, queue: 0,  sample: '归档快照 + 操作审计', hint: '无积压' },
}

const HEAT_VISUAL = {
  idle:     { bg: '#f8fafc', stroke: '#e2e8f0',   labelBg: '#f1f5f9', text: '#475569', pill: '空闲', pillCls: 'bg-slate-200 text-slate-700' },
  low:      { bg: '#f0fdf4', stroke: '#bbf7d0',   labelBg: '#dcfce7', text: '#166534', pill: '空闲', pillCls: 'bg-emerald-200 text-emerald-900' },
  medium:   { bg: '#fffbeb', stroke: '#fde68a',   labelBg: '#fef3c7', text: '#92400e', pill: '中等', pillCls: 'bg-amber-200 text-amber-900' },
  busy:     { bg: '#fff7ed', stroke: '#fdba74',   labelBg: '#ffedd5', text: '#9a3412', pill: '繁忙', pillCls: 'bg-orange-300 text-orange-950' },
  critical: { bg: '#fef2f2', stroke: '#f87171',   labelBg: '#fecaca', text: '#991b1b', pill: '高负载', pillCls: 'bg-red-400 text-white' },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Sparkline({ data, color, yMin = 0, yMax }) {
  const W = 120, H = 40
  const max = yMax ?? Math.max(...data)
  const min = yMin ?? Math.min(...data)
  const range = max - min || 1
  const step = W / (data.length - 1)
  const pts = data.map((v, i) => [i * step, H - ((v - min) / range) * (H - 4) - 2])
  const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const fill = `${d} L${W},${H} L0,${H} Z`
  const id = `sp-${color.replace('#', '')}-${Math.random().toString(36).slice(2)}`
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function RingProgress({ value, color, size = 72, strokeWidth = 7 }) {
  const R = (size - strokeWidth) / 2
  const C = 2 * Math.PI * R
  const dash = (value / 100) * C
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={R} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
      <circle
        cx={size/2} cy={size/2} r={R} fill="none"
        stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={`${dash} ${C - dash}`}
        strokeDashoffset={C / 4}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
      />
      <text x={size/2} y={size/2 + 5} textAnchor="middle" fontSize={14} fontWeight={700} fill={color}>
        {value}%
      </text>
    </svg>
  )
}

function MiniBar({ vals, color = '#3B82F6' }) {
  const max = Math.max(...vals)
  const labels = ['1', '5', '10', '20', '30+']
  return (
    <div className="flex items-end gap-1">
      {vals.map((v, i) => (
        <div key={i} className="flex flex-col items-center gap-0.5">
          <div
            className="w-4 rounded-sm transition-all"
            style={{ height: `${Math.max(4, (v / max) * 28)}px`, backgroundColor: color + 'cc' }}
          />
          <span className="text-[9px] text-slate-400">{labels[i]}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Donut chart for risk ─────────────────────────────────────────────────────
function RiskDonut() {
  const data = [
    // 风险严重度分布（独立于 BLOCKERS 占比，避免数字巧合重叠）
    { label: '高风险', pct: 34, color: '#EF4444' },
    { label: '中风险', pct: 47, color: '#F97316' },
    { label: '低风险', pct: 19, color: '#3B82F6' },
  ]
  const R = 52, SW = 16, C = 2 * Math.PI * R
  const GAP = 3
  let cum = 0
  const segs = data.map(d => {
    const len = (d.pct / 100) * C - GAP
    const offset = -(cum / 100) * C
    cum += d.pct
    return { ...d, len, offset }
  })
  const size = R * 2 + SW + 4
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`${-SW/2-2} ${-SW/2-2} ${size} ${size}`}>
        <g transform={`rotate(-90 ${R} ${R})`}>
          {segs.map(s => (
            <circle key={s.label} cx={R} cy={R} r={R} fill="none"
              stroke={s.color} strokeWidth={SW}
              strokeDasharray={`${s.len} ${C - s.len}`}
              strokeDashoffset={s.offset}
            />
          ))}
        </g>
        <text x={R} y={R-4} textAnchor="middle" fontSize={18} fontWeight={700} fill="#1e293b">312</text>
        <text x={R} y={R+12} textAnchor="middle" fontSize={10} fill="#94a3b8">总计</text>
      </svg>
      <div className="flex flex-col gap-2">
        {data.map(d => (
          <div key={d.label} className="flex items-center gap-2 text-[12px]">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
            <span className="text-slate-600">{d.label}</span>
            <span className="ml-auto font-medium text-slate-800">{d.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Pipeline flow diagram ────────────────────────────────────────────────────
function PipelineFlow({ stages }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      {stages.map((stage, si) => (
        <div key={stage.id} className="flex items-center gap-2 shrink-0">
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[12px] font-semibold text-slate-700">{stage.label}</span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                {stage.status}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {stage.nodes.map((node, ni) => (
                <div key={ni} className="flex items-center gap-1.5">
                  <div className={[
                    'flex h-8 items-center justify-center rounded-lg px-2.5 text-[11px] font-medium border',
                    stage.lastDone && ni === stage.nodes.length - 1
                      ? 'border-emerald-200 bg-emerald-500 text-white'
                      : 'border-slate-200 bg-white text-slate-600',
                  ].join(' ')}>
                    {node}
                  </div>
                  {ni < stage.nodes.length - 1 && (
                    <div className="h-px w-4 border-t border-dashed border-slate-300" />
                  )}
                </div>
              ))}
            </div>
          </div>
          {si < stages.length - 1 && (
            <ArrowRight className="size-4 shrink-0 text-slate-400" strokeWidth={1.75} />
          )}
        </div>
      ))}
    </div>
  )
}


function bottleneckNode() {
  const rank = { critical: 4, busy: 3, medium: 2, low: 1, idle: 0 }
  return TOPO_NODES.reduce((a, b) => ((rank[b.heat] ?? 0) > (rank[a.heat] ?? 0) ? b : a))
}

function TopologyNodeInspector({ nodeId }) {
  const node = TOPO_NODES.find((n) => n.id === nodeId)
  const detail = node ? TOPO_NODE_DETAIL[node.id] : null
  if (!nodeId || !node || !detail) {
    return (
      <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-3 text-[12px] text-slate-500">
        点击拓扑节点查看 <span className="font-medium text-slate-700">P95 时延</span>、队列深度与代表性任务；虚线表示
        <span className="text-slate-700">协同 / 可回跳链路</span>（如驳回后回到文书）。
      </div>
    )
  }
  const hv = HEAT_VISUAL[node.heat] ?? HEAT_VISUAL.medium
  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-semibold text-slate-900">{node.label}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${hv.pillCls}`}>{hv.pill}</span>
        <span className="text-[11px] text-slate-400">
          tier · {node.tier === 'ingest' ? '摄取' : node.tier === 'merge' ? '汇聚' : node.tier === 'out' ? '落地' : 'Agent'}
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded-md bg-slate-50 px-2.5 py-2">
          <div className="text-[10px] text-slate-400">P95 耗时</div>
          <div className="text-[13px] font-semibold tabular-nums text-slate-800">{detail.p95Sec}s</div>
        </div>
        <div className="rounded-md bg-slate-50 px-2.5 py-2">
          <div className="text-[10px] text-slate-400">队列深度</div>
          <div className="text-[13px] font-semibold tabular-nums text-slate-800">{detail.queue}</div>
        </div>
        <div className="rounded-md bg-slate-50 px-2.5 py-2 sm:col-span-1">
          <div className="text-[10px] text-slate-400">对账/拦截提示</div>
          <div className="text-[11.5px] leading-snug text-slate-700">{detail.hint}</div>
        </div>
      </div>
      <div className="mt-2 text-[11px] text-slate-500">
        <span className="text-slate-400">当前样本：</span>
        <span className="font-medium text-slate-700">{detail.sample}</span>
      </div>
    </div>
  )
}

// ─── Left sidebar ─────────────────────────────────────────────────────────────
function LeftSidebar({ active, onSelect }) {
  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-slate-100 bg-white">
      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {NAV_ITEMS.map(({ id, Icon, label, sub }) => {
          const isActive = id === active
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={[
                'flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                isActive ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50',
              ].join(' ')}
            >
              <Icon className={`mt-0.5 size-4 shrink-0 ${isActive ? 'text-blue-500' : 'text-slate-400'}`} strokeWidth={1.75} />
              <div className="min-w-0">
                <div className={`text-[13px] font-medium leading-tight ${isActive ? 'text-blue-700' : 'text-slate-700'}`}>{label}</div>
                <div className="mt-0.5 truncate text-[11px] text-slate-400">{sub}</div>
              </div>
            </button>
          )
        })}
      </nav>

      {/* Current project progress */}
      <div className="border-t border-slate-100 p-4">
        <div className="mb-3 text-[12px] font-semibold text-slate-500">当前项目进度</div>
        <div className="flex items-center gap-3">
          <RingProgress value={57} color="#3B82F6" size={64} strokeWidth={6} />
          <div className="text-[12px] text-slate-600">
            <div className="font-medium text-slate-800">阶段 4/7</div>
            <div className="text-blue-600">收益测算</div>
            <div className="mt-0.5 text-slate-400">预计剩余 26 min</div>
          </div>
        </div>
        <button
          type="button"
          className="mt-3 w-full rounded-xl border border-blue-200 py-2 text-[12px] font-medium text-blue-600 hover:bg-blue-50"
        >
          查看项目详情
        </button>
      </div>
    </aside>
  )
}

// ─── Sub-header ───────────────────────────────────────────────────────────────
function SubHeader() {
  return (
    <div className="flex items-center gap-4 border-b border-slate-100 bg-white px-6 py-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[12.5px] text-slate-500">项目：</span>
        <button type="button" className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[13px] font-medium text-slate-800 hover:border-slate-300">
          3.0T磁共振购置项目
          <ChevronDown className="size-3.5 text-slate-400" />
        </button>
      </div>
      <div className="flex flex-1 items-center justify-end gap-4 text-[12px] text-slate-400">
        <span className="flex items-center gap-1.5">
          数据更新 · 2 分钟前
          <button type="button" className="rounded-lg p-1 hover:bg-slate-50">
            <RefreshCw className="size-3.5" strokeWidth={1.75} />
          </button>
        </span>
        <span className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5">
          <Calendar className="size-3.5 text-slate-400" strokeWidth={1.75} />
          2026-05-20
        </span>
        <button type="button" className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5">
          近7天 <ChevronDown className="size-3" />
        </button>
      </div>
    </div>
  )
}

// ─── Section 1: Pipeline health ───────────────────────────────────────────────
function PipelineHealthSection() {
  return (
    <div className="flex gap-4">
      {/* Flow diagram card */}
      <div className="flex-1 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-[14px] font-semibold text-slate-900">系统级流水线健康总览</span>
          <span className="text-[12px] text-slate-400">/ Global Pipeline Health</span>
        </div>
        <PipelineFlow stages={PIPELINE_STAGES} />
      </div>

      {/* 3 KPI cards */}
      <div className="flex gap-3">
        {KPI_CARDS.map(kpi => (
          <div key={kpi.id} className="w-[180px] shrink-0 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="mb-1 text-[11.5px] text-slate-500">{kpi.label}</div>
            <div className="flex items-baseline gap-1">
              <span className="text-[28px] font-bold text-slate-900">{kpi.value}</span>
              <span className="text-[12px] text-slate-400">{kpi.unit}</span>
            </div>
            <div className={`mt-0.5 text-[11.5px] ${kpi.deltaDir === 'up' ? 'text-emerald-600' : kpi.deltaDir === 'down' ? 'text-violet-600' : 'text-slate-500'}`}>
              {kpi.delta} <span className="text-slate-400">{kpi.deltaSub}</span>
            </div>
            <div className="mt-3">
              <Sparkline data={kpi.trend} color={kpi.color} yMin={kpi.yMin} yMax={kpi.yMax} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Section 2: Agent matrix ──────────────────────────────────────────────────
function AgentMatrixSection() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-semibold text-slate-900">7大 Agent 独立效能矩阵</span>
          <span className="text-[12px] text-slate-400">/ Agent Fleet Performance Matrix</span>
        </div>
        <button type="button" className="flex items-center gap-1 text-[12px] font-medium text-blue-600 hover:text-blue-700">
          查看全部 Agent <ArrowRight className="size-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {AGENTS.map(ag => (
          <div key={ag.id} className="rounded-xl border border-slate-100 bg-slate-50/40 p-3.5">
            {/* Header */}
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-blue-500 text-[11px] font-bold text-white">
                  {ag.id}
                </span>
                <span className="text-[13px] font-semibold text-slate-800">{ag.name} Agent</span>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${ag.statusCls}`}>
                {ag.status}
              </span>
            </div>

            {/* Ring + stats */}
            <div className="flex items-center gap-3">
              <div className="relative flex flex-col items-center">
                <RingProgress value={ag.score} color={ag.ring} size={68} strokeWidth={6} />
                <span className="mt-0.5 text-[9.5px] text-slate-400">置信度得分</span>
              </div>
              <div className="flex-1 space-y-2">
                <div>
                  <div className="text-[10px] text-slate-400">异常/幻觉拦截率</div>
                  <div className="text-[13px] font-semibold text-slate-800">{ag.intercept}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400">耗时分布（min）</div>
                  <MiniBar vals={ag.dist} color={ag.ring} />
                </div>
              </div>
            </div>

            {/* Footer stats */}
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] text-slate-500">
              <span>今日完成 <strong className="text-slate-800">{ag.today}</strong></span>
              <span className={ag.alerts > 0 ? 'text-orange-500' : ''}>
                告警 <strong>{ag.alerts}</strong>
              </span>
              <span>质量分 <strong className="text-slate-800">{ag.quality}</strong></span>
            </div>
          </div>
        ))}
        {/* 7th card takes full row if needed — already 7 in a 4-col grid = 2 rows (4+3) */}
      </div>
    </div>
  )
}

// ─── Section 3: Decision topology ─────────────────────────────────────────────
function DecisionTopologySection() {
  const [selectedNodeId, setSelectedNodeId] = useState(() => bottleneckNode().id)
  const bn = bottleneckNode()
  const bnDetail = TOPO_NODE_DETAIL[bn.id]

  return (
    <div className="flex gap-4">
      <div className="flex-1 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-slate-900">动态决策路网与实时卡点分析</span>
            <span className="text-[12px] text-slate-400">/ Decision Topology & Bottlenecks</span>
          </div>
        </div>

        <DecisionTopology
          selectedId={selectedNodeId}
          onNodeSelect={setSelectedNodeId}
          bottleneck={{
            label: `${bn.label} Agent`,
            sub: bnDetail?.hint,
            deltaPct: 48,
          }}
        />

        <TopologyNodeInspector nodeId={selectedNodeId} />
      </div>

      {/* Right column */}
      <div className="flex w-[340px] shrink-0 flex-col gap-4">

        {/* Blockers Top 3 */}
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[13.5px] font-semibold text-slate-900">典型阻断诱因 Top 3</span>
            <button type="button" className="flex items-center gap-1 text-[12px] text-blue-600 hover:underline">
              查看全部诱因 <ExternalLink className="size-3" />
            </button>
          </div>
          <div className="space-y-2.5">
            {BLOCKERS.map(b => (
              <div key={b.rank} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold text-white">
                  {b.rank}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-slate-800">{b.title}</div>
                  <div className="mt-0.5 text-[11px] text-slate-400">
                    发生频次 {b.freq}次（占比 {b.pct}%）
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                    <span>影响阶段：{b.stages}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-[10px] text-slate-400">风险等级</span>
                  <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${b.riskCls}`}>
                    {b.risk}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Risk donut */}
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[13.5px] font-semibold text-slate-900">风险等级分布</span>
            <button type="button" className="flex items-center gap-1 text-[12px] text-blue-600 hover:underline">
              查看全部阻断诱因 <ArrowRight className="size-3" />
            </button>
          </div>
          <RiskDonut />
        </div>
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function ProgressView() {
  const [activeNav, setActiveNav] = useState('overview')

  return (
    <div className="flex flex-1 overflow-hidden">
      <LeftSidebar active={activeNav} onSelect={setActiveNav} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <SubHeader />

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          <PipelineHealthSection />
          <AgentMatrixSection />
          <DecisionTopologySection />
        </div>
      </div>
    </div>
  )
}
