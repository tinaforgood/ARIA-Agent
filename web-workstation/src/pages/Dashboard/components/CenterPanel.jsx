/**
 * CenterPanel — 材料流转中栏（完全自包含，不依赖 WorkbenchView 的 QuickMetrics/ActivePipeline）
 *
 * 包含三个内联子模块，代码还原自 commit 0066df5 的原始版本：
 *   1. MetricsStrip   — 3 张 KPI 卡（折线迷你图）
 *   2. UploadHero     — 大蓝圆圈 + 拖拽上传区（ActionCenter 原版）
 *   3. PipelineStepper— 7 Agent 节点横向步骤器 + 进度条（ActivePipeline 原版）
 */

import { useState, useEffect } from 'react'
import {
  Plus, UploadCloud, Sparkles,
  ArrowUp, ArrowDown, Minus,
  Check, Clock3,
} from 'lucide-react'
import GuidedUploadDrawer from './GuidedUploadDrawer'

// ─────────────────────────────────────────────────────────────
// 1. MetricsStrip  (原 QuickMetrics for MaterialFlowView)
// ─────────────────────────────────────────────────────────────
const TONE_MAP = {
  blue:    { iconBg: 'bg-blue-50',    iconText: 'text-blue-500',    stroke: '#3B82F6', fill: 'rgba(59,130,246,0.12)'   },
  emerald: { iconBg: 'bg-emerald-50', iconText: 'text-emerald-500', stroke: '#10B981', fill: 'rgba(16,185,129,0.12)'   },
  violet:  { iconBg: 'bg-violet-50',  iconText: 'text-violet-500',  stroke: '#8B5CF6', fill: 'rgba(139,92,246,0.12)'   },
}

function Sparkline({ data = [], stroke, fill }) {
  if (data.length < 2) return null
  const W = 140, H = 36
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const step = W / (data.length - 1)
  const pts = data.map((v, i) => [i * step, H - ((v - min) / range) * (H - 6) - 3])
  const path = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${path} L${W},${H} L0,${H} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-8 w-[80px] shrink-0" preserveAspectRatio="none">
      <path d={area} fill={fill} />
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function MetricCard({ metric }) {
  const tone = TONE_MAP[metric.tone] ?? TONE_MAP.blue
  const Icon = metric.icon
  let deltaTone = 'text-slate-500 bg-slate-50'
  let DeltaIcon = Minus
  if (metric.deltaDirection === 'up') {
    deltaTone = 'text-emerald-600 bg-emerald-50'; DeltaIcon = ArrowUp
  } else if (metric.deltaDirection === 'down') {
    deltaTone = 'text-emerald-600 bg-emerald-50'; DeltaIcon = ArrowDown
  }
  return (
    <div className="flex-1 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center gap-3">
        <div className={`flex size-10 items-center justify-center rounded-xl ${tone.iconBg}`}>
          <Icon className={`size-5 ${tone.iconText}`} strokeWidth={1.75} />
        </div>
        <div className="text-[13px] text-slate-500">{metric.label}</div>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-1">
          <span className="text-[32px] font-bold leading-none tracking-tight text-slate-900">{metric.value}</span>
          <span className="text-[13px] text-slate-400">{metric.unit}</span>
        </div>
        <Sparkline data={metric.trend ?? []} stroke={tone.stroke} fill={tone.fill} />
      </div>
      <div className="mt-3 flex items-center gap-2 text-[12px]">
        <span className="text-slate-400">{metric.deltaLabel}</span>
        <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium ${deltaTone}`}>
          {metric.deltaDirection !== 'neutral' && (
            <DeltaIcon className="size-3" strokeWidth={2.5} />
          )}
          {metric.deltaValue}
        </span>
      </div>
    </div>
  )
}

function MetricsStrip({ metrics = [] }) {
  return (
    <div className="flex gap-4">
      {metrics.map((m) => <MetricCard key={m.id} metric={m} />)}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 2. UploadHero  (材料流转版 — 与工作台 ActionCenter 行为一致)
// ─────────────────────────────────────────────────────────────
function UploadHero({ onSelectFiles, openDrawer, onDrawerOpenChange, activeCaseId }) {
  const [isDragOver,  setIsDragOver]  = useState(false)
  const [drawerOpen,  setDrawerOpen]  = useState(false)

  // 外部触发（StageIndicator「新建项目」）— activeCaseId 已由父级设为 null
  useEffect(() => {
    if (openDrawer) {
      setDrawerOpen(true)
      onDrawerOpenChange?.(false)   // 重置外部触发标志
    }
  }, [openDrawer])

  // 内部打开（点击大圆圈 / 拖拽）— 通知父级清空 drawerCaseId（新建模式）
  function openAsNew() {
    onDrawerOpenChange?.(false)     // 确保外部 flag 已清零
    setDrawerOpen(true)
  }

  function handleDrop(e) {
    e.preventDefault()
    setIsDragOver(false)
    openAsNew()
  }

  function handleDrawerSubmit(fileMap) {
    const files = Object.values(fileMap).filter(Boolean)
    if (files.length) onSelectFiles?.(files)
    setDrawerOpen(false)
  }

  return (
    <>
      <div
        className={[
          'relative overflow-hidden rounded-2xl border bg-white p-6 shadow-sm transition-all duration-200',
          isDragOver ? 'border-blue-300 bg-blue-50/40 shadow-blue-100' : 'border-slate-100',
        ].join(' ')}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -right-10 -top-12 size-48 rounded-full bg-blue-100/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-10 right-1/3 size-32 rounded-full bg-violet-100/30 blur-3xl" />

        <div className="relative flex items-center gap-6">
          {/* Big + button with ripple → open GuidedUploadDrawer */}
          <button
            type="button"
            onClick={openAsNew}
            aria-label="新建立项论证任务"
            className="group relative flex size-[88px] shrink-0 items-center justify-center"
          >
            <span className="absolute inset-0 animate-ping rounded-full bg-blue-500/15" style={{ animationDuration: '2.4s' }} />
            <span className="absolute inset-2 animate-ping rounded-full bg-blue-500/20" style={{ animationDuration: '2.4s', animationDelay: '0.6s' }} />
            <span className="relative flex size-[68px] items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/40 ring-4 ring-white transition-transform group-hover:scale-105">
              <Plus className="size-8 text-white" strokeWidth={2.5} />
            </span>
          </button>

          {/* Copy */}
          <div className="flex-1">
            <h2 className="flex items-center gap-2 text-[20px] font-semibold text-slate-900">
              <Plus className="size-5 text-blue-500" strokeWidth={2.5} />
              新建立项论证任务
            </h2>
            <p className="mt-1 text-[13px] text-slate-500">
              支持 <span className="font-medium text-slate-700">8 类异构材料</span>
              （申请单、报价单、注册证等）一键拖拽上传
            </p>
            <button
              type="button"
              onClick={openAsNew}
              className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50/70 px-5 py-2.5 text-[13px] font-medium text-blue-700 transition-colors hover:bg-blue-100"
            >
              <UploadCloud className="size-4" strokeWidth={1.75} />
              点击或拖拽文件到这里上传
            </button>
            <div className="mt-3 flex items-center gap-2 text-[11.5px] text-slate-400">
              <Sparkles className="size-3 text-blue-400" strokeWidth={2} />
              支持 PDF / Excel / Word / 图片，单个文件 ≤ 100MB
            </div>
          </div>
        </div>
      </div>

      {/* GuidedUploadDrawer — 与工作台共用同一组件 */}
      <GuidedUploadDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSubmit={handleDrawerSubmit}
        activeCaseId={activeCaseId}
      />
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// 3. PipelineStepper  (原 ActivePipeline for MaterialFlowView)
// ─────────────────────────────────────────────────────────────
function StepNode({ step, isLast, connectorDone, stpComplete }) {
  const isDone   = step.status === 'done'
  const isActive = step.status === 'active'

  const doneRing = stpComplete
    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/35'
    : 'bg-blue-600 text-white shadow-sm shadow-blue-500/30'

  const circleCls = [
    'relative z-10 flex size-9 items-center justify-center rounded-full text-[12px] font-semibold transition-colors',
    isDone
      ? doneRing
      : isActive
      ? 'bg-white text-blue-600 ring-2 ring-blue-500 shadow-md shadow-blue-500/30'
      : 'bg-slate-100 text-slate-400',
  ].join(' ')

  const lineDone = stpComplete ? 'bg-emerald-500' : 'bg-blue-500'

  const labelCls = isDone ? (stpComplete ? 'text-emerald-900' : 'text-slate-700') : isActive ? 'text-blue-600 font-semibold' : 'text-slate-400'
  const agentCls = isDone ? (stpComplete ? 'text-emerald-600' : 'text-slate-400')  : isActive ? 'text-blue-500'              : 'text-slate-300'

  return (
    <div className="relative flex min-w-0 flex-1 flex-col items-center">
      {/* Connector to the right */}
      {!isLast && (
        <span className={[
          'absolute left-[calc(50%+18px)] right-[calc(-50%+18px)] top-[18px] h-[2px]',
          connectorDone ? lineDone : 'bg-slate-200',
        ].join(' ')} />
      )}
      {/* Pulse ring for active */}
      {isActive && (
        <span className="pointer-events-none absolute left-1/2 top-0 flex size-9 -translate-x-1/2 animate-ping rounded-full bg-blue-400/40" />
      )}
      <div className={circleCls}>
        {isDone ? <Check className="size-4" strokeWidth={3} /> : step.id}
      </div>
      <div className="mt-2 text-center">
        <div className={`text-[12.5px] leading-tight ${labelCls}`}>{step.label}</div>
        <div className={`text-[10.5px] leading-tight ${agentCls}`}>{step.agent}</div>
      </div>
    </div>
  )
}

function PipelineStepper({ task, steps = [], stpComplete }) {
  // task 为 null：流水线未启动，显示全灰待机状态
  if (!task) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-5 items-center justify-center rounded-md bg-slate-50">
              <span className="size-1.5 rounded-full bg-slate-300" />
            </span>
            <h3 className="text-[14px] font-semibold text-slate-900">实时执行链路</h3>
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500">
              等待启动
            </span>
          </div>
        </div>
        <p className="mb-5 text-[13px] text-slate-400">上传材料并启动 AI 测算后，7 个 Agent 进度将在此实时显示。</p>
        <div className="flex items-start">
          {steps.map((step, idx) => (
            <StepNode key={step.id} step={step} isLast={idx === steps.length - 1} connectorDone={false} stpComplete={false} />
          ))}
        </div>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-slate-100" />
      </div>
    )
  }
  const progress = (task.completedSteps / task.totalSteps) * 100
  const pulseCls = stpComplete
    ? 'bg-emerald-50'
    : 'bg-blue-50'
  const pulseDot = stpComplete ? 'bg-emerald-500' : 'bg-blue-500'
  const badgeCls = stpComplete
    ? 'bg-emerald-50 text-emerald-700'
    : 'bg-blue-50 text-blue-600'
  const badgeLabel = stpComplete ? '直通完成' : '活跃任务 1'
  const barCls = stpComplete
    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600'
    : 'bg-gradient-to-r from-blue-500 to-blue-600'

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`flex size-5 items-center justify-center rounded-md ${pulseCls}`}>
            <span className={`size-1.5 rounded-full ${stpComplete ? '' : 'animate-pulse'} ${pulseDot}`} />
          </span>
          <h3 className="text-[14px] font-semibold text-slate-900">实时执行链路</h3>
          <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${badgeCls}`}>
            {badgeLabel}
          </span>
        </div>
        <button type="button" className="text-[12px] font-medium text-blue-600 hover:text-blue-700">
          查看详情 ›
        </button>
      </div>

      {/* Active task descriptor */}
      <div className="mb-5 text-[13px] text-slate-600">
        <span className="font-semibold text-slate-900">{task.title}</span>
        <span className="mx-2 text-slate-300">·</span>
        <span>{task.description}</span>
      </div>

      {/* Steps */}
      <div className="flex items-start">
        {steps.map((step, idx) => (
          <StepNode
            key={step.id}
            step={step}
            isLast={idx === steps.length - 1}
            connectorDone={step.status === 'done'}
            stpComplete={stpComplete}
          />
        ))}
      </div>

      {/* Progress + ETA */}
      <div className="mt-5">
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${barCls}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[12px] text-slate-500">
          <span>
            <span className="font-medium text-slate-700">{task.completedSteps}/{task.totalSteps}</span> 阶段已完成
          </span>
          <span className="flex items-center gap-1">
            <Clock3 className="size-3.5" strokeWidth={1.75} />
            {stpComplete ? (
              <span className="font-medium text-emerald-700">链路已闭环</span>
            ) : (
              <>
                预计剩余 <span className="font-medium text-slate-700">{task.etaMinutes} min</span>
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────
export default function CenterPanel({ metrics = [], activeTask, pipelineSteps = [], onUpload, stpComplete, openDrawer, onDrawerOpenChange, activeCaseId }) {
  const allAgentsDone =
    stpComplete &&
    pipelineSteps.length > 0 &&
    pipelineSteps.every((s) => s.status === 'done')

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-4">
      <MetricsStrip  metrics={metrics} />
      <UploadHero    onSelectFiles={onUpload} openDrawer={openDrawer} onDrawerOpenChange={onDrawerOpenChange} activeCaseId={activeCaseId} />
      <PipelineStepper task={activeTask} steps={pipelineSteps} stpComplete={allAgentsDone} />
    </section>
  )
}
