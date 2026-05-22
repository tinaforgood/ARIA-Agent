/**
 * DocDetailView — 文件详情主视图（Master-Detail 中间面板）
 *
 * 由 MaterialFlowView 根据 selectedDoc 状态条件渲染。
 * 进入时执行 fade-in + slide-from-bottom 动画（useState + rAF 触发）。
 *
 * Props:
 *   doc                — 当前查看的文件对象（来自 MATERIAL_CATEGORIES items）
 *   onBack             — 返回列表回调
 *   onOpenTrace        — 点击字段值触发证据链抽屉，传入 field 对象
 *   docDetailOverrides — 可选：按 doc.id 覆盖内置 DOC_DETAILS（Happy Path 等演示）
 */

import { useState, useEffect } from 'react'
import {
  ArrowLeft, Download, CheckCircle2, AlertTriangle,
  ChevronRight, FileText, Link2, ClipboardList,
} from 'lucide-react'

// ── Mock document detail data ─────────────────────────────────────────────────
// Keys 与 mockData.js MATERIAL_CATEGORIES items[].id 保持一致
const DOC_DETAILS = {
  // ── 院内申报材料 ──────────────────────────────────────────────────────────
  'basic_info': {
    title: '基本情况表',
    filename: 'datasource/a_requirements/基本情况表.xlsx',
    statusLabel: '已上传', statusColor: 'green',
    updatedAt: '2024-05-20 09:15', generatedBy: '需求梳理 Agent',
    basicInfo: [
      { label: '申报医院',   value: '上海市第六人民医院' },
      { label: '申报科室',   value: '放射科' },
      { label: '实际开放床位', value: '1620张' },
      { label: '年门诊量',   value: '约340万人次' },
      { label: '年住院量',   value: '约6.2万人次' },
      { label: '项目阶段',   value: 'Agent 分析中' },
      { label: '当前流程进度', value: 30, type: 'progress' },
    ],
    extractedFields: [
      { label: '医院名称',   status: 'ok' },
      { label: '科室信息',   status: 'ok' },
      { label: '床位数',     status: 'ok' },
      { label: '诊疗量指标', status: 'ok' },
    ],
    relatedFiles: ['基本情况表.xlsx', '论证纪要.docx'],
    hasConflict: false,
    notes: '基本情况表为立项审批核心依据，反映医院整体规模与科室业务量，用于支撑设备需求合理性评估。',
  },

  'budget_list': {
    title: '预算清单',
    filename: 'datasource/a_requirements/预算清单.xlsx',
    statusLabel: '已上传', statusColor: 'green',
    updatedAt: '2024-05-20 09:30', generatedBy: '预算测算 Agent',
    basicInfo: [
      { label: '申请设备',   value: '医用磁共振成像系统（3.0T）' },
      { label: '申请数量',   value: '1台' },
      { label: '设备购置费', value: '约 1,300 万元' },
      { label: '安装调试费', value: '约 65 万元' },
      { label: '机房改造费', value: '约 120 万元（估算）' },
      { label: '合计预算',   value: '约 1,569 万元' },
      { label: '当前流程进度', value: 30, type: 'progress' },
    ],
    extractedFields: [
      { label: '设备名称',   status: 'ok' },
      { label: '预算金额',   status: 'ok' },
      { label: '费用分项',   status: 'ok' },
    ],
    relatedFiles: ['预算清单.xlsx', '基本情况表.xlsx', '论证纪要.docx'],
    hasConflict: false,
    notes: '预算清单已按财政要求分项列示，机房改造费为估算值，需专项勘测后确认。',
  },

  'minutes': {
    title: '论证纪要',
    filename: 'datasource/a_requirements/论证纪要.docx',
    statusLabel: '已上传', statusColor: 'green',
    updatedAt: '2024-05-20 09:45', generatedBy: '需求梳理 Agent',
    basicInfo: [
      { label: '会议时间',   value: '2026-01-13' },
      { label: '主持部门',   value: '医务部 / 设备管理处' },
      { label: '参会科室',   value: '放射科、信息科、财务处、纪检监察室' },
      { label: '论证结论',   value: '同意立项，建议进入采购流程' },
      { label: '签字确认',   value: '已完成' },
      { label: '当前流程进度', value: 30, type: 'progress' },
    ],
    extractedFields: [
      { label: '会议时间',   status: 'ok' },
      { label: '参会人员',   status: 'ok' },
      { label: '论证结论',   status: 'ok' },
      { label: '签字盖章',   status: 'ok' },
    ],
    relatedFiles: ['论证纪要.docx', '基本情况表.xlsx'],
    hasConflict: false,
    notes: '论证纪要为预算论证会议正式记录，已经相关职能部门负责人签字确认。',
  },

  'performance': {
    title: '绩效目标表',
    filename: 'datasource/a_requirements/绩效目标表.xlsx',
    statusLabel: '已上传', statusColor: 'green',
    updatedAt: '2024-05-20 10:00', generatedBy: '收益测算 Agent',
    basicInfo: [
      { label: '绩效类型',   value: '市级财政项目绩效申报' },
      { label: '年度目标',   value: '日均检查量 ≥ 43 人次' },
      { label: '预期年收入', value: '约 731 万元' },
      { label: '投资回收期', value: '≤ 3 年' },
      { label: '科研产出',   value: '年发表论文 ≥ 2 篇（SCI）' },
      { label: '当前流程进度', value: 30, type: 'progress' },
    ],
    extractedFields: [
      { label: '绩效指标',   status: 'ok' },
      { label: '收益测算',   status: 'ok' },
      { label: '科研目标',   status: 'ok' },
    ],
    revenueParams: [
      { label: '日均检查量',   value: '43 人次/日',  conflict: false },
      { label: '年工作天数',   value: '250 天',       conflict: false },
      { label: '单次收费',     value: '800 元/次',    conflict: false },
      { label: '医保报销比例', value: '85%',          conflict: false },
      { label: '年总收入（预估）', value: '731 万元', conflict: false },
      { label: '年维保费',     value: '39 万元',      conflict: false },
      { label: '投资回收期',   value: '≈ 2.27 年',    conflict: false },
      { label: '5 年 ROI',     value: '120.6%',       conflict: false },
    ],
    relatedFiles: ['绩效目标表.xlsx', '预算清单.xlsx'],
    hasConflict: false,
    notes: '绩效目标依据上海市第一人民医院实际运营数据测算，回收期假设在合理区间内。',
  },

  // ── 合规证明材料 ───────────────────────────────────────────────────────────
  'nmpa_cert': {
    title: 'NMPA 注册证',
    filename: 'datasource/c_compliance/国械注准20243061435.pdf',
    statusLabel: '合规通过', statusColor: 'green',
    updatedAt: '2024-05-20 10:15', generatedBy: '合规核验 Agent',
    basicInfo: [
      { label: '注册证号',   value: '国械注准20243061435' },
      { label: '产品名称',   value: '磁共振成像系统（Pilot Performer）' },
      { label: '注册人',     value: '飞利浦（中国）投资有限公司' },
      { label: '批准日期',   value: '2024-03-15' },
      { label: '有效期至',   value: '2029-03-14' },
      { label: '合规结论',   value: '有效期内，核验通过' },
      { label: '当前流程进度', value: 30, type: 'progress' },
    ],
    extractedFields: [
      { label: '证书编号',   status: 'ok' },
      { label: '产品名称',   status: 'ok' },
      { label: '有效期',     status: 'ok' },
      { label: '型号一致性', status: 'conflict' },
    ],
    conflictData: {
      items: ['注册证载明："Pilot Performer"', '采购目标：多核磁共振成像系统'],
      suggestion: '建议：确认注册证是否涵盖多核成像功能模块',
    },
    relatedFiles: ['国械注准20243061435.pdf'],
    hasConflict: true,
    notes: '注册证在有效期内。注意：证件所列型号名称与本次采购目标存在型号一致性待确认问题，建议与厂商核实。',
  },

  'price_proof': {
    title: '价格依据证明',
    filename: 'datasource/b_competitors/飞利浦Elition S报价单.pdf',
    statusLabel: '已上传', statusColor: 'green',
    updatedAt: '2024-05-20 10:30', generatedBy: '预算测算 Agent',
    basicInfo: [
      { label: '供应商',     value: '飞利浦医疗（中国）' },
      { label: '产品型号',   value: 'Ingenia Elition S 3.0T' },
      { label: '含税报价',   value: '13,000,000 元' },
      { label: '报价日期',   value: '2026-Q1' },
      { label: '有效期',     value: '90天' },
      { label: '询价方式',   value: '厂商正式报价单' },
      { label: '当前流程进度', value: 30, type: 'progress' },
    ],
    extractedFields: [
      { label: '供应商名称', status: 'ok' },
      { label: '产品型号',   status: 'ok' },
      { label: '报价金额',   status: 'ok' },
      { label: '询价记录',   status: 'ok' },
    ],
    relatedFiles: ['飞利浦Elition S报价单.pdf', '预算清单.xlsx'],
    hasConflict: false,
    notes: '该报价单为飞利浦官方正式含税报价，是预算测算的主要价格依据，已纳入竞品比较矩阵。',
  },
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ label, color }) {
  const cls = {
    green: 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200',
    amber: 'bg-amber-50  text-amber-700  ring-1 ring-amber-200',
    slate: 'bg-slate-100 text-slate-600',
  }[color] ?? 'bg-slate-100 text-slate-600'

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${cls}`}>
      {label}
    </span>
  )
}

// ── Tab bar ───────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'basic',    label: '基本信息' },
  { id: 'revenue',  label: '收益测算参数' },
  { id: 'agent',    label: 'Agent 处理记录' },
  { id: 'conflict', label: '冲突与裁决记录' },
  { id: 'files',    label: '附件与引用' },
]

function TabBar({ active, onChange }) {
  return (
    <div className="flex border-b border-slate-100">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={[
            'whitespace-nowrap px-4 py-2.5 text-[13px] font-medium transition-colors',
            active === t.id
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-slate-500 hover:text-slate-700',
          ].join(' ')}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ── Info table row ────────────────────────────────────────────────────────────
function InfoRow({ label, value, type }) {
  if (type === 'progress') {
    return (
      <tr className="border-b border-slate-50 last:border-0">
        <td className="w-[160px] py-3 pr-4 text-[13px] text-slate-500">{label}</td>
        <td className="py-3">
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-500"
                style={{ width: `${value}%` }}
              />
            </div>
            <span className="w-9 text-right text-[13px] font-semibold tabular-nums text-slate-700">
              {value}%
            </span>
          </div>
        </td>
      </tr>
    )
  }
  return (
    <tr className="border-b border-slate-50 last:border-0">
      <td className="w-[160px] py-3 pr-4 text-[13px] text-slate-500">{label}</td>
      <td className="py-3 text-[13px] font-medium text-slate-800">{value}</td>
    </tr>
  )
}

// ── Revenue param row (with conflict click) ───────────────────────────────────
function RevenueRow({ row, onOpenTrace }) {
  if (row.verified) {
    return (
      <tr className="border-b border-slate-50 last:border-0">
        <td className="w-[200px] py-3 pr-4 text-[13px] text-slate-500">{row.label}</td>
        <td className="py-3">
          <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-slate-800">
            {row.value}
            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
              <CheckCircle2 className="size-3" strokeWidth={2.5} />
              已核验
            </span>
          </span>
        </td>
      </tr>
    )
  }
  return (
    <tr className="border-b border-slate-50 last:border-0">
      <td className="w-[200px] py-3 pr-4 text-[13px] text-slate-500">{row.label}</td>
      <td className="py-3">
        {row.conflict ? (
          <button
            type="button"
            onClick={() => onOpenTrace({ label: row.label, value: row.value, sources: row.sources })}
            className="group inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[13px] font-semibold text-amber-700 transition-colors hover:bg-amber-50 active:bg-amber-100"
            title="点击查看原始凭证比对"
          >
            <AlertTriangle className="size-3.5 text-amber-500" strokeWidth={2} />
            {row.value}
            <span className="text-[11px] font-normal text-amber-500">（{row.conflictNote}）</span>
            <span className="rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-600 opacity-0 transition-opacity group-hover:opacity-100">
              点击溯源
            </span>
          </button>
        ) : (
          <span className="text-[13px] font-medium text-slate-800">{row.value}</span>
        )}
      </td>
    </tr>
  )
}

// ── Extraction status list ────────────────────────────────────────────────────
function ExtractionStatus({ fields }) {
  return (
    <div className="flex flex-col gap-1.5">
      {fields.map((f) => (
        <div key={f.label} className="flex items-center justify-between">
          <span className="text-[12px] text-slate-600">{f.label}</span>
          {f.status === 'ok' || f.status === 'verified' ? (
            <span className="flex items-center gap-1 text-[11.5px] font-semibold text-emerald-700">
              <CheckCircle2 className="size-3.5" strokeWidth={2.5} />
              {f.status === 'verified' ? '已核验' : '已提取'}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11.5px] font-semibold text-amber-600">
              <AlertTriangle className="size-3.5" strokeWidth={2.5} />
              需人工裁决
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DocDetailView({ doc, onBack, onOpenTrace, docDetailOverrides, caseId, caseIsDone }) {
  const [activeTab, setActiveTab] = useState('basic')
  // Mount animation
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setVisible(true))
    })
    return () => cancelAnimationFrame(id)
  }, [])

  const detail = docDetailOverrides?.[doc.id] ?? DOC_DETAILS[doc.id] ?? {
    title: doc.label,
    filename: `datasource/.../${doc.label}`,
    statusLabel: '已上传', statusColor: 'green',
    updatedAt: '2024-05-20', generatedBy: 'Agent',
    basicInfo: [],
    extractedFields: [],
    relatedFiles: [],
    hasConflict: false,
  }

  return (
    <div
      className={[
        'flex flex-1 flex-col gap-0 rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden',
        'transition-all duration-300 ease-out',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3',
      ].join(' ')}
    >
      {/* ── Sub-header: breadcrumb + export ── */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3">
        <div className="flex items-center gap-2 text-[12.5px] text-slate-500">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 font-medium text-blue-600 hover:text-blue-700"
          >
            <ArrowLeft className="size-3.5" strokeWidth={2} />
            返回
          </button>
          <ChevronRight className="size-3.5 text-slate-300" />
          <span className="hover:text-slate-700 cursor-pointer">全局项目流水线</span>
          <ChevronRight className="size-3.5 text-slate-300" />
          <span className="font-medium text-slate-700">放射科 3.0T MRI 立项项目</span>
        </div>
        {caseIsDone && caseId ? (
          <a
            href={`http://localhost:8000/api/cases/${caseId}/document`}
            download="立项建议书.docx"
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-1.5 text-[12.5px] font-medium text-white hover:bg-emerald-600 transition-colors"
          >
            <Download className="size-3.5" strokeWidth={2} />
            下载立项建议书
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3.5 py-1.5 text-[12.5px] font-medium text-slate-400 cursor-not-allowed"
          >
            <Download className="size-3.5" strokeWidth={2} />
            {caseId && !caseIsDone ? '生成中…' : '导出报告'}
          </button>
        )}
      </div>

      {/* ── Body: 2-column ── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* ── Left: main content ── */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">

          {/* Doc title block */}
          <div className="border-b border-slate-100 px-6 py-4">
            <div className="mb-1 flex items-center gap-2.5">
              <FileText className="size-4 shrink-0 text-blue-400" strokeWidth={1.75} />
              <h2 className="text-[15px] font-semibold text-slate-900">{detail.title}</h2>
              <StatusBadge label={detail.statusLabel} color={detail.statusColor} />
            </div>
            <div className="flex items-center gap-3 text-[11.5px] text-slate-400">
              <span className="font-mono">{detail.filename}</span>
              <span>·</span>
              <span>更新时间：{detail.updatedAt}</span>
              <span>·</span>
              <span>由 <span className="text-blue-500">{detail.generatedBy}</span> 生成</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="shrink-0 px-6">
            <TabBar active={activeTab} onChange={setActiveTab} />
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">

            {/* 基本信息 */}
            {activeTab === 'basic' && (
              <div className="flex flex-col gap-4">
                <div>
                  <h4 className="mb-3 text-[13px] font-semibold text-slate-700">基本信息</h4>
                  <table className="w-full">
                    <tbody>
                      {detail.basicInfo.map((row) => (
                        <InfoRow key={row.label} {...row} />
                      ))}
                    </tbody>
                  </table>
                </div>
                {detail.notes && (
                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <p className="mb-1 text-[12px] font-medium text-slate-500">备注说明</p>
                    <p className="text-[13px] text-slate-700">{detail.notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* 收益测算参数 */}
            {activeTab === 'revenue' && (
              <div>
                <h4 className="mb-3 text-[13px] font-semibold text-slate-700">
                  收益测算参数
                  <span className="ml-2 text-[11.5px] font-normal text-slate-400">（Agent 4 输入）</span>
                </h4>
                {detail.revenueParams ? (
                  <>
                    <table className="w-full">
                      <tbody>
                        {detail.revenueParams.map((row) => (
                          <RevenueRow key={row.label} row={row} onOpenTrace={onOpenTrace} />
                        ))}
                      </tbody>
                    </table>
                    {detail.hasConflict && (
                      <p className="mt-3 text-[12px] text-amber-600">
                        ⚡ 带橙色标注的字段存在数据冲突——点击字段值可呼出原始凭证比对面板
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-[13px] text-slate-400">该文件暂无收益测算参数。</p>
                )}
              </div>
            )}

            {/* Agent 处理记录 */}
            {activeTab === 'agent' && (
              <div className="flex flex-col gap-3">
                <h4 className="text-[13px] font-semibold text-slate-700">Agent 处理时间线</h4>
                {(detail.agentTimeline ?? [
                  { time: '09:02', agent: 'A1 需求梳理', action: '完成文档解析，提取申请科室、设备名称等核心字段', status: 'done' },
                  { time: '09:08', agent: 'A2 竞品归并', action: '完成竞品矩阵构建，3家厂商比对完成', status: 'done' },
                  { time: '09:15', agent: 'A3 预算测算', action: '完成全周期 TCO 测算，机房改造费已人工确认', status: 'done' },
                  { time: '09:24', agent: 'A4 收益测算', action: '检测到收费标准冲突（430 vs 460元），已触发 HITL 挂起', status: 'warn' },
                  { time: '10:12', agent: 'A5 合规核验', action: '证照核验完成，4项合规通过，0项缺失', status: 'active' },
                ]).map((ev) => (
                  <div key={ev.time} className="flex items-start gap-3">
                    <span className="mt-1 w-10 shrink-0 text-[11px] text-slate-400 tabular-nums">{ev.time}</span>
                    <div className={[
                      'size-2 mt-1.5 shrink-0 rounded-full',
                      ev.status === 'done'   ? 'bg-emerald-400' :
                      ev.status === 'warn'   ? 'bg-amber-400' :
                      ev.status === 'active' ? 'bg-blue-400' : 'bg-slate-300',
                    ].join(' ')} />
                    <div>
                      <span className="text-[12.5px] font-semibold text-slate-700">{ev.agent}</span>
                      <p className="text-[12px] text-slate-500">{ev.action}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 冲突与裁决记录 */}
            {activeTab === 'conflict' && (
              <div className="flex flex-col gap-3">
                <h4 className="text-[13px] font-semibold text-slate-700">冲突与裁决记录</h4>
                {detail.hasConflict ? (
                  <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <AlertTriangle className="size-4 text-amber-500" strokeWidth={2} />
                      <span className="text-[13px] font-semibold text-amber-700">单次收费标准数据冲突</span>
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-600">待裁决</span>
                    </div>
                    <p className="mb-2 text-[12.5px] text-slate-600">检测到以下来源存在数值差异：</p>
                    {detail.conflictData?.items.map((item, i) => (
                      <p key={i} className="text-[12.5px] text-slate-700">• {item}</p>
                    ))}
                    <p className="mt-2 text-[12px] text-amber-600">{detail.conflictData?.suggestion}</p>
                    <button
                      type="button"
                      onClick={() => {
                        const rp = detail.revenueParams?.find(r => r.conflict)
                        if (rp) onOpenTrace({ label: rp.label, value: rp.value, sources: rp.sources })
                      }}
                      className="mt-3 rounded-lg bg-amber-500 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-amber-600 transition-colors"
                    >
                      查看原始凭证并裁决
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-4">
                    <CheckCircle2 className="size-4 text-emerald-500" strokeWidth={2} />
                    <span className="text-[13px] text-emerald-600">该文件未检测到数据冲突</span>
                  </div>
                )}
              </div>
            )}

            {/* 附件与引用 */}
            {activeTab === 'files' && (
              <div>
                <h4 className="mb-3 text-[13px] font-semibold text-slate-700">
                  关联文件
                  <span className="ml-1.5 text-[11.5px] font-normal text-slate-400">（{detail.relatedFiles.length} 个）</span>
                </h4>
                <div className="flex flex-col gap-2">
                  {detail.relatedFiles.map((f, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3.5 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <FileText className="size-3.5 text-blue-400" strokeWidth={1.75} />
                        <span className="text-[12.5px] text-slate-700">{i + 1}. {f}</span>
                      </div>
                      <button type="button" className="flex items-center gap-1 text-[12px] text-blue-600 hover:text-blue-700">
                        <Link2 className="size-3.5" strokeWidth={1.75} />
                        查看
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: metadata panel ── */}
        <div className="flex w-[220px] shrink-0 flex-col gap-4 overflow-y-auto border-l border-slate-100 px-4 py-4">

          {/* Agent field extraction status */}
          <div>
            <p className="mb-2.5 text-[12px] font-semibold text-blue-600">Agent 字段提取状态</p>
            <ExtractionStatus fields={detail.extractedFields} />
          </div>

          {/* Conflict warning */}
          {detail.hasConflict && detail.conflictData && (
            <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-amber-700">
                <AlertTriangle className="size-3.5" strokeWidth={2} />
                数据冲突提示
              </p>
              <p className="mb-1.5 text-[11.5px] text-slate-600">检测到单次收费标准存在冲突：</p>
              {detail.conflictData.items.map((item, i) => (
                <p key={i} className="text-[11.5px] text-slate-700">• {item}</p>
              ))}
              <p className="mt-1.5 text-[11px] text-amber-600">{detail.conflictData.suggestion}</p>
            </div>
          )}

          {/* Related files (compact) */}
          <div>
            <p className="mb-2 text-[12px] font-semibold text-slate-600">
              关联文件（{detail.relatedFiles.length}）
            </p>
            <div className="flex flex-col gap-1.5">
              {detail.relatedFiles.slice(0, 4).map((f, i) => (
                <p key={i} className="flex items-center gap-1.5 text-[11.5px] text-slate-500">
                  <FileText className="size-3 shrink-0 text-slate-300" strokeWidth={1.75} />
                  <span className="truncate">{i + 1}. {f}</span>
                </p>
              ))}
              {detail.relatedFiles.length > 4 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('files')}
                  className="text-left text-[11.5px] text-blue-600 hover:text-blue-700"
                >
                  查看全部
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
