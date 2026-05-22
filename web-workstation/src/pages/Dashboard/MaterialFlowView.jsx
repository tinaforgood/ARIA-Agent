/**
 * MaterialFlowView — 材料流转页面（Master-Detail 双屏联动版）
 *
 * 状态树：
 *   selectedDoc      — null | item 对象  → null=默认工作区，非null=文件详情视图
 *   isTracePanelOpen — boolean           → 证据链溯源抽屉开关
 *   traceField       — null | field 对象 → 当前溯源的字段（传给 TraceDrawer）
 *   agentProgress    — 来自后端 /api/cases/{id}/agent-progress 的真实进度
 */

import { useState, useCallback, useEffect } from 'react'

import StageIndicator from './components/StageIndicator'
import LeftSidebar    from './components/LeftSidebar'
import CenterPanel    from './components/CenterPanel'
import RightSidebar   from './components/RightSidebar'
import ModuleOverview from './components/ModuleOverview'
import DocDetailView  from './components/DocDetailView'
import TraceDrawer    from './components/TraceDrawer'

import {
  CURRENT_PROJECT,
  PROJECT_STAGES,
  MATERIAL_CATEGORIES,
  MATERIAL_TOTAL,
  QUICK_METRICS,
  PIPELINE_AGENTS,
  ACTIVE_TASK,
  RECENT_DYNAMICS,
  MODULE_OVERVIEW,
  MATERIAL_FLOW_TODOS,
} from './mockData'

const API_BASE = import.meta.env.VITE_API_BASE ?? ''

// ── 根据 agent-progress 推导 StageIndicator 所需 stages + project ─────────────
function deriveStagesAndProject(progress, fallbackProject, fallbackStages) {
  if (!progress) return { project: fallbackProject, stages: fallbackStages }

  const { agents, hospital_name } = progress

  const stages = agents.map(ag => ({
    id:     `A${ag.id}`,
    label:  ag.label,
    status: ag.status,   // 'done' | 'active' | 'pending'
  }))

  const projectName = hospital_name
    ? `${hospital_name} MRI 立项`
    : fallbackProject.name

  return {
    project: { ...fallbackProject, name: projectName },
    stages,
  }
}

// ── 根据 agent-progress 接口数据推导 CenterPanel 所需 props ────────────────────
function deriveTaskAndSteps(progress) {
  if (!progress) return { task: null, steps: [] }

  const { agents, done_count, total, active_agent, case_status, hospital_name } = progress

  // pipelineSteps 格式（CenterPanel/StepNode 期望的结构）
  const steps = agents.map(ag => ({
    id:     ag.id,
    label:  ag.label,
    agent:  'Agent',
    status: ag.status,   // 'done' | 'active' | 'pending'
  }))

  // 状态描述文字
  const statusDesc =
    case_status === 'ingesting'  ? '正在解析上传材料，提取文档内容…' :
    case_status === 'processing' ? (active_agent ? `正在进行「${active_agent.label} Agent」处理` : '流水线运行中…') :
    case_status === 'done'       ? '全部 Agent 已完成，立项建议书已生成' :
    case_status === 'error'      ? '流水线执行出错，请重新运行' :
    '等待流水线启动…'

  // 项目标题
  const title = hospital_name
    ? `【${hospital_name}】`
    : '【当前立项项目】'

  // ETA 估算（每个 agent 约 2 min）
  const remaining = total - done_count
  const etaMinutes = Math.max(1, remaining * 2)

  const task = {
    title,
    description: statusDesc,
    completedSteps: done_count,
    totalSteps: total,
    etaMinutes,
  }

  return { task, steps }
}

export default function MaterialFlowView({
  onTodoAction,
  onUpload,
  project = CURRENT_PROJECT,
  stages = PROJECT_STAGES,
  categories = MATERIAL_CATEGORIES,
  total = MATERIAL_TOTAL,
  metrics = QUICK_METRICS,
  // pipelineAgents / activeTask 保留为 fallback，真实数据来自后端轮询
  pipelineAgents = PIPELINE_AGENTS,
  activeTask = ACTIVE_TASK,
  materialTodos = MATERIAL_FLOW_TODOS,
  dynamics = RECENT_DYNAMICS,
  docDetailOverrides = null,
  stpStraightThrough = false,
}) {
  const [selectedDoc,      setSelectedDoc]      = useState(null)
  const [isTracePanelOpen, setIsTracePanelOpen] = useState(false)
  const [traceField,       setTraceField]       = useState(null)
  const [latestCaseId,     setLatestCaseId]     = useState(null)
  const [caseIsDone,       setCaseIsDone]       = useState(false)
  const [agentProgress,    setAgentProgress]    = useState(null)
  const [allCases,         setAllCases]         = useState([])     // 全部项目列表
  const [selectedCaseId,   setSelectedCaseId]   = useState(null)   // 当前选中项目
  const [openDrawer,       setOpenDrawer]       = useState(false)  // 由 StageIndicator「新建项目」触发
  // drawerCaseId 始终为 null：抽屉只作为「新建项目」入口，不加载已有项目

  // 轮询：拉取全部 cases + 选中项目的 agent-progress
  useEffect(() => {
    const poll = async () => {
      try {
        const r1 = await fetch(`${API_BASE}/api/cases`)
        if (!r1.ok) return
        const cases = await r1.json()
        setAllCases(cases)
        if (!cases.length) return

        // 选中项目：若 selectedCaseId 在列表中则保留，否则默认最新
        const target = cases.find(c => c.case_id === selectedCaseId) ?? cases[0]
        if (!selectedCaseId) setSelectedCaseId(target.case_id)

        setLatestCaseId(target.case_id)
        setCaseIsDone(target.status === 'done')

        // 获取 agent 进度（ingesting 及以上才有意义）
        if (['ingesting', 'processing', 'done', 'error'].includes(target.status)) {
          const r2 = await fetch(`${API_BASE}/api/cases/${target.case_id}/agent-progress`)
          if (r2.ok) {
            const prog = await r2.json()
            setAgentProgress(prog)
          }
        } else {
          setAgentProgress(null)
        }
      } catch (_) {}
    }

    poll()
    const t = setInterval(poll, 5000)
    return () => clearInterval(t)
  }, [selectedCaseId])   // selectedCaseId 变化时立刻重新拉取

  // 重命名项目（乐观更新本地列表，PATCH 由 StageIndicator 内部发出）
  const handleRenameCase = useCallback((caseId, newName) => {
    setAllCases(prev => prev.map(c =>
      c.case_id === caseId ? { ...c, hospital_name: newName } : c
    ))
  }, [])

  // 切换项目：清空旧进度，等下一次轮询填充
  const handleSelectCase = useCallback((caseId) => {
    setSelectedCaseId(caseId)
    setAgentProgress(null)
    setSelectedDoc(null)
    setIsTracePanelOpen(false)
  }, [])

  // 删除项目（乐观更新：先从本地列表移除，再调接口）
  const handleDeleteCase = useCallback(async (caseId) => {
    // 立即从列表中移除，避免等待网络
    setAllCases(prev => {
      const next = prev.filter(c => c.case_id !== caseId)
      return next
    })
    // 若删的是当前选中项，立即切换到剩余第一项
    if (caseId === selectedCaseId) {
      setAllCases(prev => {
        const remaining = prev.filter(c => c.case_id !== caseId)
        const nextId = remaining[0]?.case_id ?? null
        setSelectedCaseId(nextId)
        setAgentProgress(null)
        setLatestCaseId(nextId)
        setCaseIsDone(remaining[0]?.status === 'done')
        setSelectedDoc(null)
        return remaining
      })
    }
    // 后台实际删除（失败时下次轮询会自然纠正）
    try {
      await fetch(`${API_BASE}/api/cases/${caseId}`, { method: 'DELETE' })
    } catch (_) {}
  }, [selectedCaseId])

  // 当前选中案例的状态
  const selectedCaseMeta2 = allCases.find(c => c.case_id === selectedCaseId)
  // 材料上传阶段：案例存在但流水线尚未启动
  const isUploadPending = Boolean(
    selectedCaseId &&
    selectedCaseMeta2 &&
    ['created', 'uploading'].includes(selectedCaseMeta2.status)
  )

  // 真实数据 or fallback
  const { task: realTask, steps: realSteps } = deriveTaskAndSteps(agentProgress)

  // 是否连接到了真实后端项目（决定用真实空状态还是 mock）
  const hasRealCase = Boolean(selectedCaseId && allCases.some(c => c.case_id === selectedCaseId))

  // 全灰占位步骤：后端在线但流水线尚未启动时使用
  const IDLE_STEPS = [
    { id: 1, label: '需求梳理', agent: 'Agent', status: 'pending' },
    { id: 2, label: '竞品归并', agent: 'Agent', status: 'pending' },
    { id: 3, label: '预算测算', agent: 'Agent', status: 'pending' },
    { id: 4, label: '收益测算', agent: 'Agent', status: 'pending' },
    { id: 5, label: '合规核验', agent: 'Agent', status: 'pending' },
    { id: 6, label: '立项文书', agent: 'Agent', status: 'pending' },
    { id: 7, label: '审批反馈', agent: 'Agent', status: 'pending' },
  ]

  const effectiveSteps = realSteps.length
    ? realSteps                        // 后端有真实进度 → 用真实数据
    : hasRealCase
      ? IDLE_STEPS                     // 有真实项目但流水线未启动 → 全灰
      : pipelineAgents                 // 后端不可达 → fallback mock

  const effectiveTask = realTask
    ?? (hasRealCase ? null : activeTask)  // 有真实项目未启动时不显示 task 描述

  const effectiveStp = agentProgress
    ? agentProgress.case_status === 'done'
    : stpStraightThrough

  // StageIndicator 所需的真实 stages + project（fallback 到 mock）
  // 即使 agentProgress 还未返回，也优先用 allCases 中选中项目的 hospital_name
  const selectedCaseMeta = allCases.find(c => c.case_id === selectedCaseId)
  const { project: derivedProject, stages: derivedStages } =
    deriveStagesAndProject(agentProgress, project, stages)
  // 材料未上传时，所有阶段强制显示为 pending（灰色锁定态）
  const effectiveStages = isUploadPending
    ? derivedStages.map(s => ({ ...s, status: 'pending' }))
    : derivedStages
  const effectiveProject = {
    ...derivedProject,
    name: agentProgress?.hospital_name?.trim()
      || selectedCaseMeta?.hospital_name?.trim()
      || derivedProject.name,
  }

  const handleView = useCallback((item) => {
    setSelectedDoc(item)
    setIsTracePanelOpen(false)
    setTraceField(null)
  }, [])

  const handleBack = useCallback(() => {
    setSelectedDoc(null)
    setIsTracePanelOpen(false)
    setTraceField(null)
  }, [])

  const handleOpenTrace = useCallback((field) => {
    setTraceField(field)
    setIsTracePanelOpen(true)
  }, [])

  const handleCloseTrace = useCallback(() => {
    setIsTracePanelOpen(false)
  }, [])

  return (
    <>
      <StageIndicator
        project={effectiveProject}
        stages={effectiveStages}
        allCases={allCases}
        selectedCaseId={selectedCaseId}
        onSelectCase={handleSelectCase}
        onDeleteCase={handleDeleteCase}
        onRenameCase={handleRenameCase}
        onNewProject={() => setOpenDrawer(true)}
      />

      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4 px-6 py-5">
        <div className="flex min-h-0 flex-1 gap-4">

          <LeftSidebar
            categories={categories}
            total={total}
            selectedDocId={selectedDoc?.id ?? null}
            onView={handleView}
            activeCaseId={selectedCaseId}
          />

          {selectedDoc ? (
            <DocDetailView
              key={selectedDoc.id}
              doc={selectedDoc}
              onBack={handleBack}
              onOpenTrace={handleOpenTrace}
              docDetailOverrides={docDetailOverrides}
              caseId={latestCaseId}
              caseIsDone={caseIsDone}
            />
          ) : (
            <>
              <CenterPanel
                metrics={metrics}
                activeTask={effectiveTask}
                pipelineSteps={effectiveSteps}
                onUpload={onUpload}
                stpComplete={effectiveStp}
                openDrawer={openDrawer}
                onDrawerOpenChange={setOpenDrawer}
                activeCaseId={null}
              />
              <RightSidebar
                todos={materialTodos}
                dynamics={dynamics}
                onTodoAction={onTodoAction}
                stpStraightThrough={effectiveStp}
                isUploadPending={isUploadPending}
                categories={categories}
                onUpload={() => setOpenDrawer(true)}
              />
            </>
          )}
        </div>

        {!selectedDoc && <ModuleOverview modules={MODULE_OVERVIEW} />}
      </main>

      <TraceDrawer
        isOpen={isTracePanelOpen}
        field={traceField}
        onClose={handleCloseTrace}
      />
    </>
  )
}
