/**
 * DecisionTopology — 动态决策路网与实时卡点分析（高保真 SVG + 绝对定位节点）
 *
 * 统一虚拟坐标系：画布 1200×600（viewBox 与节点几何一致）；底层 SVG 连线；顶层按同比例百分比定位节点。
 */

import {
  Database,
  FileText,
  Braces,
  ListChecks,
  GitMerge,
  Calculator,
  ClipboardList,
  TrendingUp,
  Scale,
  MessageSquareReply,
  CircleCheck,
  AlertTriangle,
} from 'lucide-react'

/** 与 SVG viewBox 一致，供节点百分比换算 */
export const TOPOLOGY_VIEWBOX = { w: 1200, h: 700 }

export const DECISION_TOPOLOGY_NODES = [
  // ── 摄取链（横向等距）──────────────────────────────────────────
  { id: 'ingest',   label: '数据源接入', status: 'medium',   heat: 'medium',   tier: 'ingest', Icon: Database,          x: 100, y: 300 },
  { id: 'parse',    label: '文档解析',   status: 'medium',   heat: 'medium',   tier: 'ingest', Icon: FileText,          x: 280, y: 300 },
  { id: 'struct',   label: '结构化转换', status: 'medium',   heat: 'medium',   tier: 'ingest', Icon: Braces,            x: 460, y: 300 },
  // ── 并联 Agent（纵向展开，避免与 report 的入边相互穿插）─────────
  { id: 'req',      label: '需求梳理',   status: 'medium',   heat: 'medium',   tier: 'agent',  Icon: ListChecks,        x: 620, y: 110 },
  { id: 'matrix',   label: '竞品归并',   status: 'overload', heat: 'critical', tier: 'agent',  Icon: GitMerge,          x: 640, y: 300 },
  { id: 'budget',   label: '预算测算',   status: 'medium',   heat: 'medium',   tier: 'agent',  Icon: Calculator,        x: 620, y: 470 },
  // ── 汇聚节点 ─────────────────────────────────────────────────────
  { id: 'report',   label: '立项文书',   status: 'busy',     heat: 'busy',     tier: 'merge',  Icon: ClipboardList,     x: 800, y: 300 },
  // ── 并联核验（纵向展开）──────────────────────────────────────────
  { id: 'roi',      label: '收益测算',   status: 'medium',   heat: 'medium',   tier: 'agent',  Icon: TrendingUp,        x: 960, y: 120 },
  { id: 'comply',   label: '合规核验',   status: 'medium',   heat: 'medium',   tier: 'agent',  Icon: Scale,             x: 960, y: 300 },
  { id: 'approval', label: '审批反馈',   status: 'medium',   heat: 'medium',   tier: 'agent',  Icon: MessageSquareReply,x: 960, y: 465 },
  // ── 落地 ─────────────────────────────────────────────────────────
  { id: 'done',     label: '结果落地',   status: 'idle',     heat: 'low',      tier: 'out',    Icon: CircleCheck,       x: 1110, y: 300 },
]

/** from / to 使用节点 id；kind 控制线型与箭头 */
const DECISION_TOPOLOGY_EDGES = [
  { from: 'ingest', to: 'parse', kind: 'primary' },
  { from: 'parse', to: 'struct', kind: 'primary' },
  { from: 'struct', to: 'req', kind: 'parallel' },
  { from: 'struct', to: 'matrix', kind: 'parallel' },
  { from: 'struct', to: 'budget', kind: 'parallel' },
  { from: 'req', to: 'report', kind: 'merge' },
  { from: 'matrix', to: 'report', kind: 'merge' },
  { from: 'budget', to: 'report', kind: 'merge' },
  { from: 'report', to: 'roi', kind: 'primary' },
  { from: 'report', to: 'comply', kind: 'primary' },
  { from: 'report', to: 'approval', kind: 'primary' },
  { from: 'roi', to: 'done', kind: 'merge' },
  { from: 'comply', to: 'done', kind: 'merge' },
  { from: 'approval', to: 'done', kind: 'merge' },
  { from: 'approval', to: 'report', kind: 'feedback' },
  { from: 'comply', to: 'budget', kind: 'feedback' },
]

const STATUS_LABEL = {
  idle: '空闲',
  medium: '中等',
  busy: '繁忙',
  overload: '高负载',
}

const { w: VB_W, h: VB_H } = TOPOLOGY_VIEWBOX

function nodeCenter(n) {
  return { x: n.x, y: n.y }
}

/**
 * 水平切线 Bezier — 边从节点水平出发、水平到达，减少对角交叉视觉噪声。
 * pull = 控制手柄长度，越大弧度越平缓；对于近垂直的边适当减小 pull 避免回绕。
 */
function cubicBetween(a, b) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const xDist = Math.abs(dx)
  const yDist = Math.abs(dy)
  // 纯水平方向的手柄长度；近垂直边（dx很小）适当压缩避免回绕
  const pull = Math.max(40, xDist * 0.46 - yDist * 0.05)
  const xDir = dx >= 0 ? 1 : -1
  return `M ${a.x} ${a.y} C ${(a.x + pull * xDir).toFixed(1)} ${a.y}, ${(b.x - pull * xDir).toFixed(1)} ${b.y}, ${b.x} ${b.y}`
}

/** 反向/回流边：向下弧绕，避免压在主流程线上 */
function feedbackArc(a, b) {
  const belowY = Math.max(a.y, b.y) + 90
  const cx1 = a.x
  const cx2 = b.x
  return `M ${a.x} ${a.y} C ${cx1} ${belowY}, ${cx2} ${belowY}, ${b.x} ${b.y}`
}

function edgeStyle(kind) {
  if (kind === 'feedback') {
    return { stroke: '#94A3B8', width: 1.1, dash: '7 5', marker: 'url(#arrow-dashed)' }
  }
  if (kind === 'primary') {
    return { stroke: '#2563EB', width: 1.35, dash: undefined, marker: 'url(#arrow-blue)' }
  }
  // parallel / merge
  return { stroke: '#64748b', width: 1.25, dash: undefined, marker: 'url(#arrow-gray)' }
}

function TopologyEdges() {
  const map = Object.fromEntries(DECISION_TOPOLOGY_NODES.map((n) => [n.id, nodeCenter(n)]))
  return (
    <g strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke">
      {DECISION_TOPOLOGY_EDGES.map((e) => {
        const a = map[e.from]
        const b = map[e.to]
        if (!a || !b) return null
        const st = edgeStyle(e.kind)
        const d = e.kind === 'feedback' ? feedbackArc(a, b) : cubicBetween(a, b)
        return (
          <path
            key={`${e.from}-${e.to}-${e.kind}`}
            fill="none"
            d={d}
            stroke={st.stroke}
            strokeWidth={st.width}
            strokeDasharray={st.dash}
            markerEnd={st.marker}
            opacity={e.kind === 'feedback' ? 0.75 : 0.92}
          />
        )
      })}
    </g>
  )
}

function StatusHalo({ status, selected }) {
  if (status === 'overload') {
    return (
      <>
        <span className="pointer-events-none absolute -inset-4 rounded-full bg-red-100/40 animate-pulse" />
        <span className="pointer-events-none absolute -inset-1.5 rounded-full ring-4 ring-red-400/25" />
        <span
          className={[
            'pointer-events-none absolute -inset-0.5 rounded-full bg-gradient-to-br from-red-500 to-rose-600 opacity-85',
            selected ? 'ring-2 ring-blue-500 ring-offset-2' : '',
          ].join(' ')}
        />
      </>
    )
  }
  if (status === 'busy') {
    return (
      <span className="pointer-events-none absolute -inset-2.5 rounded-full bg-orange-50 ring-2 ring-orange-300/50 animate-[pulse_2.4s_ease-in-out_infinite]" />
    )
  }
  if (status === 'medium') {
    // 去掉 blur，改为极淡的米白色晕圈，不抢色
    return <span className="pointer-events-none absolute -inset-1 rounded-full bg-amber-50/50" />
  }
  if (status === 'idle') {
    return <span className="pointer-events-none absolute -inset-1 rounded-full bg-teal-50/60" />
  }
  return null
}

function IconDisc({ status, Icon, selected }) {
  const TONE = {
    // 空闲：清爽青绿，边框轻薄
    idle:     'border-teal-200/80 bg-white text-teal-500 shadow-sm shadow-teal-100/40',
    // 中等：白底浅琥珀边框 + 柔和文字，不再用深 amber-600 避免视觉过重
    medium:   'border-amber-200/90 bg-white text-amber-400 shadow-sm shadow-amber-50/60',
    // 繁忙：浅橙边 + 白底，比 overload 温和一级
    busy:     'border-orange-300/80 bg-white text-orange-500 shadow-md shadow-orange-100/50',
    // 高负载：深红填充保持最醒目
    overload: 'border-red-300/60 bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-lg shadow-red-400/40',
  }
  const tone = TONE[status] ?? TONE.medium
  const base =
    'relative z-10 flex size-[42px] shrink-0 items-center justify-center rounded-full border-2 shadow-md transition-transform duration-200'

  return (
    <div className={`${base} ${tone} ${selected ? 'scale-105 ring-2 ring-blue-500 ring-offset-2' : ''}`}>
      <Icon className="size-[19px]" strokeWidth={status === 'overload' ? 2.25 : 2} />
    </div>
  )
}

function TopologyNode({ node, selected, onSelect }) {
  const { id, label, status, Icon, x, y } = node
  return (
    <button
      type="button"
      onClick={() => onSelect?.(id)}
      className="group absolute z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5 rounded-xl bg-transparent p-0 text-center outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      style={{ left: `${(x / VB_W) * 100}%`, top: `${(y / VB_H) * 100}%` }}
    >
      <div className="relative flex flex-col items-center">
        <StatusHalo status={status} selected={selected} />
        <IconDisc status={status} Icon={Icon} selected={selected} />
      </div>
      <div className="relative z-30 max-w-[104px]">
        <div className="text-[11.5px] font-semibold leading-tight text-slate-800 drop-shadow-sm">{label}</div>
        <div
          className={[
            'mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[9.5px] font-semibold',
            status === 'idle'     && 'bg-teal-50  text-teal-600   ring-1 ring-teal-200/70',
            status === 'medium'   && 'bg-amber-50 text-amber-500  ring-1 ring-amber-200/60',
            status === 'busy'     && 'bg-orange-50 text-orange-600 ring-1 ring-orange-200/70',
            status === 'overload' && 'bg-red-100  text-red-700    ring-1 ring-red-200',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {STATUS_LABEL[status]}
        </div>
      </div>
    </button>
  )
}

function TopologyLegend() {
  return (
    <div className="pointer-events-auto absolute left-4 top-4 z-[40] max-w-[min(92%,400px)] rounded-xl border border-slate-200 bg-white/90 px-3 py-2.5 shadow-sm backdrop-blur-sm">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">节点热力</div>
      <div className="mb-2.5 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-slate-600">
        {[
          ['空闲', 'bg-teal-400'],
          ['中等', 'bg-amber-300'],
          ['繁忙', 'bg-orange-400'],
          ['高负载', 'bg-red-500'],
        ].map(([t, c]) => (
          <span key={t} className="inline-flex items-center gap-1.5">
            <span className={`size-2 rounded-full ${c}`} />
            {t}
          </span>
        ))}
      </div>
      <div className="border-t border-slate-100 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        连线语义
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-7 rounded-full bg-[#2563EB]" />
          主流程
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-7 rounded-full bg-[#475569]" />
          并联/汇入
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0 w-7 border-t border-dashed border-[#94A3B8]" style={{ borderWidth: '2px 0 0' }} />
          协同/回流
        </span>
      </div>
    </div>
  )
}

/**
 * @param {object} props
 * @param {string} [props.selectedId]
 * @param {(id: string) => void} [props.onNodeSelect]
 * @param {{ label: string, sub?: string, deltaPct?: number }} [props.bottleneck]
 * @param {() => void} [props.onViewDetail]
 */
export default function DecisionTopology({
  selectedId,
  onNodeSelect,
  bottleneck = {
    label: '竞品归并 Agent',
    sub: 'P95 186s，底价矩阵对齐 + 抽检比例上升',
    deltaPct: 48,
  },
  onViewDetail,
}) {
  return (
    <div className="relative mx-auto w-full max-w-[1200px] overflow-hidden rounded-xl bg-slate-50" style={{ aspectRatio: '12/7' }}>
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.35]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgb(148 163 184 / 0.35) 1px, transparent 0)`,
          backgroundSize: '22px 22px',
        }}
      />

      <svg
        className="absolute inset-0 z-[1] w-full h-full pointer-events-none"
        viewBox="0 0 1200 700"
        preserveAspectRatio="xMidYMid meet"
        fill="none"
        aria-hidden
      >
        <defs>
          {/* 蓝色主流程箭头 */}
          <marker id="arrow-blue" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto-start-reverse">
            <path d="M 0 0 L 6 3 L 0 6 L 1.5 3 z" fill="#2563EB" />
          </marker>
          {/* 深色并联/汇入箭头 */}
          <marker id="arrow-gray" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto-start-reverse">
            <path d="M 0 0 L 6 3 L 0 6 L 1.5 3 z" fill="#475569" />
          </marker>
          {/* 灰色协同/回流箭头 */}
          <marker id="arrow-dashed" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto-start-reverse">
            <path d="M 0 0 L 6 3 L 0 6 L 1.5 3 z" fill="#94A3B8" />
          </marker>
        </defs>
        <TopologyEdges />
      </svg>

      <div className="absolute inset-0 z-10">
        {DECISION_TOPOLOGY_NODES.map((node) => (
          <TopologyNode
            key={node.id}
            node={node}
            selected={selectedId === node.id}
            onSelect={onNodeSelect}
          />
        ))}
      </div>

      <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-[30] border-t border-amber-200/60 bg-gradient-to-r from-amber-50/95 via-white/95 to-white/95 px-4 py-3 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <AlertTriangle className="size-4 shrink-0 text-amber-500" strokeWidth={2} />
          <div className="min-w-0 flex-1 leading-snug">
            <span className="text-slate-700">当前关键瓶颈：</span>
            <span className="font-semibold text-red-600">{bottleneck.label}</span>
            <span className="text-slate-500">
              （耗时较均值 <strong className="tabular-nums text-amber-800">+{bottleneck.deltaPct ?? 48}%</strong>）
            </span>
            {bottleneck.sub ? <span className="mt-0.5 block text-[11px] text-slate-500">{bottleneck.sub}</span> : null}
          </div>
          <button
            type="button"
            onClick={onViewDetail}
            className="shrink-0 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-[12px] font-medium text-blue-600 shadow-sm hover:bg-blue-50"
          >
            查看路网详情 &gt;
          </button>
        </div>
      </div>

      <TopologyLegend />
    </div>
  )
}
