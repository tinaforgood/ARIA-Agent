/**
 * RationalityGatePanel.jsx
 * 申康 MRI 采购合理性判定 — 四维交通灯评分卡
 *
 * Props:
 *   data        {object}  rationality_result JSON（来自后端或 mock）
 *   loading     {bool}    加载中状态
 *   className   {string}  额外 className
 */

import { AlertTriangle, CheckCircle2, XCircle, HelpCircle, ShieldCheck } from 'lucide-react'

// ── 颜色 & 图标映射 ────────────────────────────────────────────────────────────
const SCORE_CONFIG = {
  green:   { bg: 'bg-emerald-50',  border: 'border-emerald-200', dot: 'bg-emerald-500',  text: 'text-emerald-700', label: '达标',   icon: CheckCircle2   },
  yellow:  { bg: 'bg-amber-50',    border: 'border-amber-200',   dot: 'bg-amber-400',    text: 'text-amber-700',   label: '条件',   icon: AlertTriangle  },
  red:     { bg: 'bg-red-50',      border: 'border-red-200',     dot: 'bg-red-500',      text: 'text-red-700',     label: '不足',   icon: XCircle        },
  unknown: { bg: 'bg-slate-50',    border: 'border-slate-200',   dot: 'bg-slate-400',    text: 'text-slate-500',   label: '待补充', icon: HelpCircle     },
}

const VERDICT_CONFIG = {
  pass:            { bg: 'bg-emerald-600', label: '✅ 合理性通过',         sub: '三维指标均达标，支持立项' },
  conditional:     { bg: 'bg-amber-500',   label: '⚠️ 条件通过',          sub: '部分维度不足或数据缺失，需人工核查' },
  reject:          { bg: 'bg-red-600',     label: '⛔ 建议暂缓立项',       sub: '阳性率过低，存在过度检查，需先整改' },
  exempt_renewal:  { bg: 'bg-blue-600',    label: '🔄 更新场景豁免',       sub: '成新率极低，属设备更新替换，一票通过' },
}

// ── 维度元信息 ──────────────────────────────────────────────────────────────
const DIMENSION_META = {
  workload: {
    title: '工作负荷饱和度',
    subtitle: 'Workload',
    icon: '📊',
    renderMetrics: (d) => [
      { label: '饱和度',    value: d.hospital_saturation   != null ? `${d.hospital_saturation.toFixed(1)}%`  : '—', highlight: true },
      { label: '日台均',    value: d.hospital_daily_volume != null ? `${d.hospital_daily_volume.toFixed(1)}次` : '—' },
      { label: '市级均值',  value: `${d.city_avg_saturation}%` },
      { label: '绿灯阈值',  value: `≥${d.threshold_saturation_green}%` },
    ],
  },
  waiting_time: {
    title: '候检等待时间',
    subtitle: 'Efficiency',
    icon: '⏱️',
    renderMetrics: (d) => [
      { label: '候检天数',   value: d.hospital_waiting_days != null ? `${d.hospital_waiting_days.toFixed(1)}天` : '—', highlight: true },
      { label: '市级均值',   value: `${d.city_avg_waiting_days}天` },
      { label: '绿灯阈值',   value: `>${d.threshold_green_days}天` },
      { label: '黄灯阈值',   value: `>${d.threshold_yellow_days}天` },
    ],
  },
  positive_rate: {
    title: '检查阳性率',
    subtitle: 'Quality',
    icon: '🎯',
    renderMetrics: (d) => [
      { label: '阳性率',    value: d.hospital_positive_rate != null ? `${(d.hospital_positive_rate * 100).toFixed(1)}%` : '—', highlight: true },
      { label: '红灯阈值',  value: `<${(d.threshold_red * 100).toFixed(0)}%` },
      { label: '黄灯阈值',  value: `<${(d.threshold_yellow * 100).toFixed(0)}%` },
      { label: '数据状态',  value: d.data_available ? '已提供' : '缺失' },
    ],
  },
  device_age: {
    title: '设备成新率',
    subtitle: 'Device Age',
    icon: '🔧',
    renderMetrics: (d) => [
      { label: '成新率',    value: d.hospital_chengxin_rate != null ? `${d.hospital_chengxin_rate.toFixed(1)}%` : '—', highlight: true },
      { label: '市级均值',  value: `${d.city_avg_chengxin_rate}%` },
      { label: '更新豁免',  value: `≤${d.exemption_threshold}%` },
      { label: '豁免状态',  value: d.exemption_triggered ? '✅ 已触发' : '未触发' },
    ],
  },
}

// ── 子组件：单维度卡片 ────────────────────────────────────────────────────────
function DimensionCard({ dimKey, data }) {
  const meta   = DIMENSION_META[dimKey]
  const score  = data?.score ?? 'unknown'
  const cfg    = SCORE_CONFIG[score] ?? SCORE_CONFIG.unknown
  const Icon   = cfg.icon
  const metrics = meta.renderMetrics(data ?? {})

  return (
    <div className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4 flex flex-col gap-3`}>
      {/* 卡头 */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{meta.icon}</span>
          <div>
            <p className="text-sm font-semibold text-slate-800 leading-tight">{meta.title}</p>
            <p className="text-xs text-slate-400">{meta.subtitle}</p>
          </div>
        </div>
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.text} border ${cfg.border}`}>
          <Icon size={11} />
          <span>{cfg.label}</span>
        </div>
      </div>

      {/* 指标网格 */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {metrics.map((m) => (
          <div key={m.label}>
            <p className="text-[10px] text-slate-400">{m.label}</p>
            <p className={`text-sm font-semibold ${m.highlight ? cfg.text : 'text-slate-700'}`}>
              {m.value}
            </p>
          </div>
        ))}
      </div>

      {/* 备注说明 */}
      {data?.note && (
        <p className="text-[11px] text-slate-500 leading-relaxed border-t border-dashed border-slate-200 pt-2 mt-1">
          {data.note}
        </p>
      )}
    </div>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────────────────
export default function RationalityGatePanel({ data, loading = false, className = '' }) {

  if (loading) {
    return (
      <div className={`rounded-2xl border border-slate-200 bg-white p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-slate-100 rounded-xl" />
          <div className="grid grid-cols-2 gap-3">
            {[0,1,2,3].map(i => <div key={i} className="h-40 bg-slate-100 rounded-xl" />)}
          </div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className={`rounded-2xl border border-slate-200 bg-white p-6 flex items-center justify-center text-slate-400 text-sm ${className}`}>
        <HelpCircle size={16} className="mr-2" />
        尚未执行合理性判定，请先完成文件解析
      </div>
    )
  }

  const verdict     = data.verdict ?? 'conditional'
  const vCfg        = VERDICT_CONFIG[verdict] ?? VERDICT_CONFIG.conditional
  const dims        = data.dimensions ?? {}
  const isRejected  = verdict === 'reject'
  const isExempt    = verdict === 'exempt_renewal'

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white overflow-hidden ${className}`}>

      {/* ── Verdict Banner ─────────────────────────────────────────────────── */}
      <div className={`${vCfg.bg} px-5 py-3.5 flex items-center justify-between`}>
        <div>
          <p className="text-white font-bold text-base leading-tight">{vCfg.label}</p>
          <p className="text-white/80 text-xs mt-0.5">{vCfg.sub}</p>
        </div>
        <ShieldCheck size={28} className="text-white/60 shrink-0" />
      </div>

      <div className="p-5 space-y-4">

        {/* ── 四维评分卡 ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          {Object.keys(DIMENSION_META).map((key) => (
            <DimensionCard key={key} dimKey={key} data={dims[key]} />
          ))}
        </div>

        {/* ── 阻断原因（仅 reject） ────────────────────────────────────────── */}
        {isRejected && data.blocking_reason && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex gap-3">
            <XCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-red-700 mb-1">否决原因</p>
              <p className="text-xs text-red-600 leading-relaxed">{data.blocking_reason}</p>
            </div>
          </div>
        )}

        {/* ── 更新豁免说明 ─────────────────────────────────────────────────── */}
        {isExempt && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex gap-3">
            <CheckCircle2 size={16} className="text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-blue-700 mb-1">更新场景豁免说明</p>
              <p className="text-xs text-blue-600 leading-relaxed">
                成新率触发豁免阈值，工作负荷/候检/阳性率维度不参与否决。立项文书应重点说明设备老化风险及维修成本趋势。
              </p>
            </div>
          </div>
        )}

        {/* ── 建议 ────────────────────────────────────────────────────────── */}
        {data.recommendation && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold text-slate-600 mb-1">Agent 建议</p>
            <p className="text-xs text-slate-600 leading-relaxed">{data.recommendation}</p>
          </div>
        )}

        {/* ── 数据来源 ─────────────────────────────────────────────────────── */}
        <p className="text-[10px] text-slate-400 text-right">
          基准来源：{data.benchmark_source ?? '申康综合绩效简报'}
        </p>
      </div>
    </div>
  )
}
