/**
 * Dashboard — 应用壳层（Shell）
 *
 * 唯一持有状态的顶层组件。根据 activeTab 渲染不同页面内容：
 *
 *   workbench → WorkbenchView    （全局驾驶舱：甜甜圈 + 3栏 + 流水线表格）
 *   material  → MaterialFlowView （材料流转：LeftSidebar + StageIndicator + KPI + 步骤器）
 *   其他 tab  → 占位文案（待扩展）
 *
 * Header 始终可见，activeTab / todos / 演示场景状态向下传递。
 * 演示场景「Happy Path」数据见 mockHappyPath.js。
 */

import { useState, useCallback, useEffect } from 'react'

import Header           from './components/Header'
import SmartToDo        from './components/SmartToDo'
import ActivePipeline   from './components/ActivePipeline'
import MaterialFlowView from './MaterialFlowView'
import DocsView         from './DocsView'
import ProgressView     from './ProgressView'
import StatsView        from './StatsView'
import SettingsView     from './SettingsView'

import RationalityComparisonTable from '../../components/workstation/RationalityComparisonTable'
import {
  MOCK_RATIONALITY_PASS,
  MOCK_RATIONALITY_CONDITIONAL,
  MOCK_RATIONALITY_REJECT,
  MOCK_RATIONALITY_EXEMPT,
} from '../../data/mockRationality'

// row.id → 展开详情所用的 mock 数据
const RATIONALITY_DETAIL_MAP = {
  p1: MOCK_RATIONALITY_EXEMPT,
  p2: MOCK_RATIONALITY_REJECT,
  p3: MOCK_RATIONALITY_PASS,
  p4: MOCK_RATIONALITY_CONDITIONAL,
  p6: MOCK_RATIONALITY_REJECT,
  hp1: MOCK_RATIONALITY_EXEMPT,
}

import {
  NAV_TABS,
  CURRENT_USER,
  SMART_TODOS,
  PIPELINE_ROWS,
  PIPELINE_NODE_LABELS,
  CURRENT_PROJECT,
  PROJECT_STAGES,
  MATERIAL_CATEGORIES,
  MATERIAL_TOTAL,
  QUICK_METRICS,
  PIPELINE_AGENTS,
  ACTIVE_TASK,
  MATERIAL_FLOW_TODOS,
  RECENT_DYNAMICS,
} from './mockData'

import {
  DEMO_SCENARIO_DEFAULT,
  DEMO_SCENARIO_HAPPY,
  DEMO_SCENARIO_OPTIONS,
  HAPPY_SMART_TODOS,
  HAPPY_PIPELINE_ROWS,
  HAPPY_MATERIAL_CATEGORIES,
  HAPPY_MATERIAL_TOTAL,
  HAPPY_PROJECT_STAGES,
  HAPPY_PIPELINE_AGENTS,
  HAPPY_ACTIVE_TASK,
  HAPPY_MATERIAL_FLOW_TODOS,
  HAPPY_DOC_DETAIL_OVERRIDES,
} from './mockHappyPath'

/**
 * useRationality — 拉取指定 case 的合理性判定结果。
 * 若 caseId 为空或 API 不通，自动降级到 null（由对比表内 mock 详情兜底）。
 */
function useRationality(caseId) {
  const [data,    setData   ] = useState(null)
  const [loading, setLoading] = useState(false)
  const [useMock, setUseMock] = useState(true)

  useEffect(() => {
    if (!caseId) { setUseMock(true); return }
    setLoading(true)
    fetch(`${API_BASE}/api/cases/${caseId}/rationality`)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json() })
      .then(d  => { setData(d); setUseMock(false) })
      .catch(() => { setUseMock(true) })
      .finally(() => setLoading(false))
  }, [caseId])

  return { data, loading, useMock }
}

// ── 工作台视图（全局驾驶舱）────────────────────────────────────────────────────
function WorkbenchView({ todos, pipelineRows, onTodoAction, activeCaseId }) {
  const { data: realRationalityData, useMock } = useRationality(activeCaseId)

  // 将 mock 详情注入到每条 row 的 rationality.detail
  const rowsWithDetail = pipelineRows.map(row => {
    if (!row.rationality) return row
    return {
      ...row,
      rationality: {
        ...row.rationality,
        detail: row._isReal
          ? realRationalityData       // 真实 case 用 API 数据
          : (RATIONALITY_DETAIL_MAP[row.id] ?? null),
      },
    }
  })

  return (
    <main className="mx-auto w-full max-w-[1600px] flex-1 space-y-4 px-6 py-5">

      {/* ── 顶部：合理性判定（主区）+ SmartToDo（右侧栏）───────────────────── */}
      <div className="flex items-stretch gap-4">
        {/* 合理性判定表 */}
        <div style={{ flex: '17 1 0', minWidth: 0 }}>
          <div className="mb-2.5 flex items-end justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-800">申康采购合理性判定</h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                基于申康绩效基准四维评估 · 工作负荷 / 候检时间 / 检查阳性率 / 设备成新率
              </p>
            </div>
          </div>
          <RationalityComparisonTable
            rows={rowsWithDetail}
            realCaseData={realRationalityData}
            useMock={useMock}
          />
        </div>

        {/* SmartToDo 右侧栏 */}
        <div style={{ flex: '9 1 0', minWidth: 0 }}>
          <SmartToDo todos={todos} onAction={onTodoAction} />
        </div>
      </div>

      {/* ── 底部：流水线 ────────────────────────────────────────────────────── */}
      <ActivePipeline
        rows={pipelineRows}
        nodeLabels={PIPELINE_NODE_LABELS}
      />
    </main>
  )
}

// ── 其他 tab 占位 ─────────────────────────────────────────────────────────────
function PlaceholderView({ tab }) {
  const labels = {
    progress: '进度跟踪',
    docs:     '文档中心',
    stats:    '统计分析',
    settings: '系统设置',
  }
  return (
    <main className="flex flex-1 items-center justify-center">
      <div className="text-center">
        <div className="mb-3 text-[44px]">🚧</div>
        <p className="text-[15px] font-medium text-slate-600">{labels[tab] ?? tab}</p>
        <p className="mt-1 text-[13px] text-slate-400">功能建设中，敬请期待</p>
      </div>
    </main>
  )
}

const API_BASE = import.meta.env.VITE_API_BASE ?? ''

/** 把后端 agent-progress 转为 ActivePipeline row 格式 */
function buildRealRow(meta, progress) {
  const { case_status, hospital_name, agents = [], done_count = 0, total = 7 } = progress

  const nodes = agents.map(ag => {
    if (ag.status === 'done')   return 'done'
    if (ag.status === 'active') return 'active'
    return 'pending'
  })
  // 如果数组长度不够（还没跑到 processing），补 pending
  while (nodes.length < 7) nodes.push('pending')

  const progressPct =
    case_status === 'done'       ? 100 :
    case_status === 'processing' ? Math.round(15 + (done_count / total) * 80) :
    case_status === 'ingesting'  ? 10 :
    5

  const stageLabel =
    case_status === 'done'       ? '全部完成' :
    case_status === 'processing' ? `A${done_count + 1} ${agents[done_count]?.label ?? ''}处理中` :
    case_status === 'ingesting'  ? '文件解析中' :
    case_status === 'error'      ? '执行出错' :
    '待启动'

  const updatedAt = (meta.approval_done_at || meta.ingest_done_at || meta.created_at || '')
    .replace('T', ' ').slice(0, 16)

  return {
    id:           meta.case_id,
    name:         hospital_name ? `${hospital_name} 立项` : '当前立项项目',
    dept:         '放射科',
    type:         '新增',
    stage:        stageLabel,
    progress:     progressPct,
    progressTone: case_status === 'error' ? 'red' : 'blue',
    nodes,
    owner:        '—',
    ownerDept:    '',
    updatedAt,
    _isReal:      true,   // 标记为真实数据行，用于去重
  }
}

// ── 主组件 ────────────────────────────────────────────────────────────────────
export default function Dashboard({ currentUser, onLogout }) {
  const [activeTab, setActiveTab] = useState('workbench')
  const [demoScenario, setDemoScenario] = useState(DEMO_SCENARIO_DEFAULT)
  const [todos, setTodos] = useState(SMART_TODOS)
  const [realRow, setRealRow] = useState(null)   // 从后端拉取的真实项目行

  // 轮询最新 case 的 agent-progress，构建 realRow
  useEffect(() => {
    const poll = async () => {
      try {
        const r1 = await fetch(`${API_BASE}/api/cases`)
        if (!r1.ok) return
        const cases = await r1.json()
        if (!cases.length) return
        const latest = cases[0]
        if (!['ingesting','processing','done','error'].includes(latest.status)) return
        const r2 = await fetch(`${API_BASE}/api/cases/${latest.case_id}/agent-progress`)
        if (!r2.ok) return
        const prog = await r2.json()
        setRealRow(buildRealRow(latest, prog))
      } catch (_) {}
    }
    poll()
    const t = setInterval(poll, 6000)
    return () => clearInterval(t)
  }, [])

  const isHappy = demoScenario === DEMO_SCENARIO_HAPPY

  // 真实行插在第一位，mock 行去掉同名占位（如有）
  const baseMockRows = isHappy ? HAPPY_PIPELINE_ROWS : PIPELINE_ROWS
  const pipelineRows = realRow
    ? [realRow, ...baseMockRows.filter(r => !r._isReal)]
    : baseMockRows

  const user = currentUser
    ? { ...CURRENT_USER, name: currentUser.name, role: currentUser.role, notificationCount: currentUser.notificationCount ?? CURRENT_USER.notificationCount }
    : CURRENT_USER

  const handleTodoAction = useCallback((todo) => {
    setTodos((prev) => prev.filter((t) => t.id !== todo.id))
  }, [])

  const handleDemoScenarioChange = useCallback((value) => {
    setDemoScenario(value)
    setTodos(value === DEMO_SCENARIO_HAPPY ? HAPPY_SMART_TODOS : SMART_TODOS)
  }, [])

  function handleUpload(files) {
    // eslint-disable-next-line no-console
    console.log('[Dashboard] files selected:', files)
  }

  function renderContent() {
    switch (activeTab) {
      case 'workbench':
        return (
          <WorkbenchView
            todos={todos}
            pipelineRows={pipelineRows}
            onTodoAction={handleTodoAction}
            activeCaseId={realRow?.id ?? null}
          />
        )
      case 'material':
        return (
          <MaterialFlowView
            key={demoScenario}
            onTodoAction={handleTodoAction}
            onUpload={handleUpload}
            project={CURRENT_PROJECT}
            stages={isHappy ? HAPPY_PROJECT_STAGES : PROJECT_STAGES}
            categories={isHappy ? HAPPY_MATERIAL_CATEGORIES : MATERIAL_CATEGORIES}
            total={isHappy ? HAPPY_MATERIAL_TOTAL : MATERIAL_TOTAL}
            metrics={QUICK_METRICS}
            pipelineAgents={isHappy ? HAPPY_PIPELINE_AGENTS : PIPELINE_AGENTS}
            activeTask={isHappy ? HAPPY_ACTIVE_TASK : ACTIVE_TASK}
            materialTodos={isHappy ? HAPPY_MATERIAL_FLOW_TODOS : MATERIAL_FLOW_TODOS}
            dynamics={RECENT_DYNAMICS}
            docDetailOverrides={isHappy ? HAPPY_DOC_DETAIL_OVERRIDES : null}
            stpStraightThrough={isHappy}
          />
        )
      case 'docs':
        return <DocsView />
      case 'progress':
        return <ProgressView />
      case 'stats':
        return <StatsView />
      case 'settings':
        return <SettingsView />
      default:
        return <PlaceholderView tab={activeTab} />
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50/60 text-slate-900">
      <Header
        navTabs={NAV_TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        user={user}
        onLogout={onLogout}
        demoScenario={demoScenario}
        onDemoScenarioChange={handleDemoScenarioChange}
        demoScenarioOptions={DEMO_SCENARIO_OPTIONS}
      />
      {renderContent()}
    </div>
  )
}
