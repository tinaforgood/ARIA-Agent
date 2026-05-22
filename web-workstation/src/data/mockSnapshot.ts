/**
 * Single mock root for MriAgent 工作站 UI — replace with API layer later.
 * `initial_metrics` aligns with mr_approval_agent ConflictableField patterns.
 */

export type OriginType = 'user_upload' | 'agent_corpus'
export type DocCategory =
  | 'a_requirements'
  | 'b_competitors'
  | 'c_compliance'
  | 'd_operations'

export interface ConflictableFieldLike {
  _type: 'ConflictableField'
  value: string
  origin_type: OriginType
  source_file: string
  doc_category: DocCategory | string
  conflict: boolean
  all_values: Array<{
    value: string
    origin_type: OriginType
    source_file: string
    doc_category: DocCategory | string
  }>
}

/** UI synthesis status mapped to Tailwind palettes from product spec */
export type MetricUiStatus = 'conflict' | 'hypothesis' | 'verified'

export interface BoundingBox {
  /** Normalized 0–1 coords within thumbnail */
  x: number
  y: number
  width: number
  height: number
}

export interface EvidenceTraceSlice {
  id: string
  excerpt: string
  confidence: number
  bbox: BoundingBox
  /** Display string e.g. "0.124, 0.318, 0.889, 0.402" */
  bbox_coordinates_label: string
}

export interface EvidenceTrace {
  metric_row_id: string
  /** Human label from snapshot */
  field_label_key: string
  document_file_name: string
  page_number: number
  /** Simulated PDF thumbnail — solid + pattern; swap for real thumbs from API */
  thumbnail_tint: string
  slices: EvidenceTraceSlice[]
}

export type InitialMetricKey =
  | 'charge_per_exam'
  | 'monthly_exam_volume'
  | 'reimbursement_ratio'
  | 'service_life_years'
  | 'exam_volume_growth_yoy'
  | 'equipment_purchase_cost'

export interface UiMetricRow {
  id: string
  label_key: string
  display_value_key: string
  unit_key: string | null
  ui_status: MetricUiStatus
  /** Maps to `initial_metrics` when present; computed rows omit */
  source_key: InitialMetricKey | null
  conflictable?: ConflictableFieldLike
  note_key?: string | null
  editable: boolean
}

export interface NavItem {
  id: string
  label_key: string
  icon: 'layout' | 'shuffle' | 'activity' | 'bar' | 'folder' | 'settings'
}

export interface PipelineStage {
  id: string
  agent: string
  label_key: string
  status: 'done' | 'active' | 'pending'
}

export interface MockStrings {
  product_title: string
  user_display_name: string
  project_selector_label: string
  project_selector_value: string
  nav: Record<string, string>
  pipeline: Record<string, string>
  metrics: Record<string, string>
  metric_notes: Record<string, string>
  units: Record<string, string>
  workstation: Record<string, string>
  approvals: Record<string, string>
  evidence: Record<string, string>
  material: Record<string, string>
}

export const mock_snapshot = {
  meta: {
    generated_at_key: 'meta.generated_at',
    parser_mode: 'mineru',
  },
  meta_display: {
    generated_at: '2026-05-12 09:30:00',
  },
  strings: {
    product_title: '设备申购工作站',
    user_display_name: '张若昕',
    project_selector_label: '项目',
    project_selector_value: '3.0T磁共振购置项目',
    nav: {
      workbench: '工作台',
      material_flow: '材料流转',
      progress: '进度跟踪',
      stats: '统计分析',
      docs: '文档中心',
      settings: '系统设置',
    },
    pipeline: {
      p1: '需求梳理',
      p2: '竞品归并',
      p3: '预算测算',
      p4: '收益测算',
      p5: '合规核验',
      p6: '立项文书',
      p7: '审批反馈',
    },
    metrics: {
      charge_per_exam: '单次收费标准',
      monthly_exam_volume: '月检查量（预计）',
      reimbursement_ratio: '报销比例（预计）',
      service_life: '使用年限（预计）',
      annual_revenue: '年预期收益（预计）',
      exam_volume_growth: '检查量增长率',
      equipment_purchase_cost: '设备采购成本',
    },
    metric_notes: {
      annual_revenue: '= 收费标准 × 报销比例 × 月检查量 × 12 × 饱和度系数',
      exam_volume_growth:
        '基于近 36 个月历史检查量 CAGR 推演，未见独立出处，标记为假设',
      conflict_hint:
        '多源取值不一致：申报材料 430 元/次 vs 历史归档 460 元/次。',
    },
    units: {
      currency_per_exam: '元/次',
      times: '次',
      percent: '%',
      years: '年',
      yuan: '元',
    },
    workstation: {
      sidebar_brand_accent: 'ARIA',
      current_workspace_title: '当前节点工作区',
      current_workspace_stage: '(A4 收益测算)',
      workspace_intro:
        '对收益测算口径进行结构化确认：指标状态将影响后续合规核验材料引用。',
      human_loop_title: '人工确认项',
      human_loop_prompt: '请确认收益测算取值逻辑是否与临床与物价口径一致。',
      human_confirmed: '已确认',
      human_pending: '待确认',
      upload_cta: '点击上传材料',
      action_upload: '上传材料',
      action_supplement: '发起补件',
      action_advance: '节点流转',
      action_export_list: '导出清单',
      action_view_flow: '查看流程说明',
      resolve_460: '确认 460 元',
      evidence_panel_title: '证据链溯源',
      evidence_bbox_caption: '证据片段定位',
      approval_title: '审批决策区',
      approval_reject_placeholder: '填写驳回意见（选填，将回传业务系统）',
      approval_pass: '通过',
      approval_reject: '驳回',
      notification_badge: '3',
      trace_prompt_select_row: '选择左侧指标行查看证据切片',
      trace_empty_state: '暂无结构化证据回溯',
      evidence_slice_badge_tpl: '片段 {n}',
      metrics_table_field: '指标',
      metrics_table_value: '取值',
      metrics_table_status: '状态',
      trace_doc_title_wrap: '《{title}》',
      trace_confidence_tail: '置信度',
      node_doc: '节点说明',
      conflict_banner_charge:
        '单次收费标准存在数据冲突（430元 vs 460元）。请点击红色标签选择正确值后继续。',
    },
    approvals: {},
    evidence: {
      page_label: '第 {n} 页',
      coord_prefix: 'BBox',
    },
    material: {
      checklist_title: '标准资料清单',
      collapse_all: '收起全部',
      expand_all: '展开全部',
      status_done_tpl: '已完成 {done}/{total}',
      item_uploaded: '已上传',
      view: '查看',
      footer_summary_tpl: '已完成 {done}/{total} 份材料',
      footer_complete: '完整',
      export_list: '一键导出清单',
      key_overview: '关键信息概览',
      upload_section_title: '已关联材料（收益测算节点）',
      uploaded_files_count_tpl: '已上传文件 ({n})',
      upload_task_title: '新建立项论证任务',
      upload_task_subtitle:
        '支持 8 类异构材料（申请单 / 报价单 / 注册证等）一键拖拽上传',
      upload_drop_hint: '点击或拖拽文件到这里上传',
      upload_drop_sub: '释放鼠标完成上传',
      upload_formats_short:
        'PDF · Excel · Word · 图片 · ZIP · 其他（单文件 ≤100MB）',
      batch_upload: '批量上传',
      execution_project: '3.0T 磁共振购置项目 · 执行链',
      execution_stage_label: '当前阶段',
      execution_stage_value: '第 5 阶段 · 合规核验 Agent',
      execution_progress: '5 / 7 阶段已完成',
      execution_eta: '预计剩余约 18 分钟',
    },
  } satisfies MockStrings,

  material_stats: { done: 9, total: 9 },

  material_categories: [
    {
      id: 1,
      title: '临床科室（放射科）',
      accent: 'emerald',
      done: 2,
      total: 2,
      items: [
        {
          code: '1.1',
          name: '临床申请单',
          icon: 'file',
          preview_relative_path:
            'user_uploads/01_requirements/2026年度万元以上设备预算申报论证表3.0T-20260113.docx',
          preview_summary:
            '申报论证表概述了 3.0T 磁共振购置的必要性、预期检查量与收费标准口径；包含科室盖章意见及预算科目勾稽关系，建议核对物价编号与收费条目是否与最新目录一致。',
        },
        {
          code: '1.2',
          name: '新技术引入评估表',
          icon: 'search',
          preview_relative_path:
            'agent_corpus/a_requirements/3.0T磁共振配置可行性报告.docx',
          preview_summary:
            '可行性报告从临床适应症、人员梯队与场地电力条件论证购置合理性；列出竞品对标参数与五年运维成本假设，可作为收益测算节点结构化字段的来源文档。',
        },
      ],
    },
    {
      id: 2,
      title: '外部供应商/厂家',
      accent: 'sky',
      done: 3,
      total: 3,
      items: [
        {
          code: '2.1',
          name: '产品彩页',
          icon: 'file',
          preview_relative_path: 'agent_corpus/b_competitors/uMR 870彩页.pdf',
        },
        {
          code: '2.2',
          name: '报价单',
          icon: 'file',
          preview_relative_path:
            'user_uploads/02_competitors/飞利浦Elition S医用磁共振成像系统-申报材料.docx',
          preview_summary:
            '申报材料内含主机标配清单、可选线圈及质保条款摘要；价格口径含税费与到货周期备注，流转节点可将含税总价映射至「设备采购成本」核验字段。',
        },
        {
          code: '2.3',
          name: '注册证',
          icon: 'file',
          preview_relative_path: 'user_uploads/03_compliance/国械注准20213060603-Lumina.pdf',
        },
      ],
    },
    {
      id: 3,
      title: '其他职能科室',
      accent: 'amber',
      done: 3,
      total: 3,
      items: [
        {
          code: '3.1',
          name: '项目立项管理制度',
          icon: 'file',
          preview_relative_path: 'agent_corpus/f_validation/附件1 申报文本-2026.3.18.doc',
        },
        {
          code: '3.2',
          name: '历史申购报告',
          icon: 'file',
          preview_relative_path: 'agent_corpus/a_requirements/设备申购报告表2022版-3T.doc',
        },
        {
          code: '3.3',
          name: '医保报销比例 / 收益测算口径',
          icon: 'file',
          preview_relative_path:
            'agent_corpus/a_requirements/50万元及以上医学装备可行性论证报告.docx',
          preview_summary:
            '文档汇总医保报销比例假设及饱和度系数来源说明；与收益测算中的报销比例、月度检查量字段交叉引用时，请关注脚注中年份差异。',
        },
      ],
    },
    {
      id: 4,
      title: '设备科自己',
      accent: 'violet',
      done: 1,
      total: 1,
      items: [
        {
          code: '4.1',
          name: '现有设备台账（1.5T 磁共振）',
          icon: 'file',
          preview_relative_path: 'agent_corpus/d_operations/MR使用效率数据.xlsx',
          preview_summary:
            'Excel 台账列出在用 1.5T 设备的开机率、日均检查量与停机工单摘要；可用于佐证更新换代紧迫度及与新机的业务量预估对齐。',
        },
      ],
    },
  ],

  /** 中部上传区示例文件 — 可替换为 API */
  material_demo_uploads: [
    { name: '收益测算表_20240528.xlsx', size: '20.5 KB', ext: 'xlsx' },
    { name: '收益测算说明_20240528.pdf', size: '1.2 MB', ext: 'pdf' },
  ],

  nav_items: [
    { id: 'workbench', label_key: 'nav.workbench', icon: 'layout' },
    { id: 'material', label_key: 'nav.material_flow', icon: 'shuffle' },
    { id: 'progress', label_key: 'nav.progress', icon: 'activity' },
    { id: 'stats', label_key: 'nav.stats', icon: 'bar' },
  ] satisfies NavItem[],

  default_nav_id: 'material',

  pipeline: [
    { id: 'a1', agent: 'A1', label_key: 'pipeline.p1', status: 'done' },
    { id: 'a2', agent: 'A2', label_key: 'pipeline.p2', status: 'done' },
    { id: 'a3', agent: 'A3', label_key: 'pipeline.p3', status: 'done' },
    { id: 'a4', agent: 'A4', label_key: 'pipeline.p4', status: 'active' },
    { id: 'a5', agent: 'A5', label_key: 'pipeline.p5', status: 'pending' },
    { id: 'a6', agent: 'A6', label_key: 'pipeline.p6', status: 'pending' },
    { id: 'a7', agent: 'A7', label_key: 'pipeline.p7', status: 'pending' },
  ] satisfies PipelineStage[],

  /**
   * Field dictionary — mirrors `key_params.revenue_params` ConflictableField style.
   */
  initial_metrics: {
    charge_per_exam: {
      _type: 'ConflictableField',
      value: '430元/次',
      origin_type: 'user_upload',
      source_file:
        '01_requirements/2026年度万元以上设备预算申报论证表3.0T.docx',
      doc_category: 'a_requirements',
      conflict: true,
      all_values: [
        {
          value: '430元/次',
          origin_type: 'user_upload',
          source_file:
            '01_requirements/2026年度万元以上设备预算申报论证表3.0T.docx',
          doc_category: 'a_requirements',
        },
        {
          value: '460元/次',
          origin_type: 'agent_corpus',
          source_file: 'a_requirements/设备申购报告表2022版-3T.doc',
          doc_category: 'a_requirements',
        },
      ],
    } satisfies ConflictableFieldLike,
    monthly_exam_volume: {
      _type: 'ConflictableField',
      value: '320次/月',
      origin_type: 'user_upload',
      source_file: '01_requirements/3.0T磁共振配置可行性报告_v2.docx',
      doc_category: 'a_requirements',
      conflict: false,
      all_values: [
        {
          value: '320次/月',
          origin_type: 'user_upload',
          source_file: '01_requirements/3.0T磁共振配置可行性报告_v2.docx',
          doc_category: 'a_requirements',
        },
      ],
    } satisfies ConflictableFieldLike,
    reimbursement_ratio: {
      _type: 'ConflictableField',
      value: '65%',
      origin_type: 'agent_corpus',
      source_file: 'a_requirements/医保报销比例说明-3.0T.docx',
      doc_category: 'a_requirements',
      conflict: false,
      all_values: [
        {
          value: '65%',
          origin_type: 'agent_corpus',
          source_file: 'a_requirements/医保报销比例说明-3.0T.docx',
          doc_category: 'a_requirements',
        },
      ],
    } satisfies ConflictableFieldLike,
    service_life_years: {
      _type: 'ConflictableField',
      value: '8年',
      origin_type: 'agent_corpus',
      source_file: 'b_competitors/飞利浦Elition S医用磁共振成像系统-申报材料.docx',
      doc_category: 'b_competitors',
      conflict: false,
      all_values: [
        {
          value: '8年',
          origin_type: 'agent_corpus',
          source_file:
            'b_competitors/飞利浦Elition S医用磁共振成像系统-申报材料.docx',
          doc_category: 'b_competitors',
        },
      ],
    } satisfies ConflictableFieldLike,
    exam_volume_growth_yoy: {
      _type: 'ConflictableField',
      value: '8.5%',
      origin_type: 'agent_corpus',
      source_file: 'd_operations/MR检查量增长率模型.xlsx',
      doc_category: 'd_operations',
      conflict: false,
      all_values: [
        {
          value: '8.5%',
          origin_type: 'agent_corpus',
          source_file: 'd_operations/MR检查量增长率模型.xlsx',
          doc_category: 'd_operations',
        },
      ],
    } satisfies ConflictableFieldLike,
    equipment_purchase_cost: {
      _type: 'ConflictableField',
      value: '¥ 12,800,000',
      origin_type: 'user_upload',
      source_file: '02_competitors/飞利浦Elition S报价单-2026Q1.xlsx',
      doc_category: 'b_competitors',
      conflict: false,
      all_values: [
        {
          value: '¥ 12,800,000',
          origin_type: 'user_upload',
          source_file: '02_competitors/飞利浦Elition S报价单-2026Q1.xlsx',
          doc_category: 'b_competitors',
        },
      ],
    } satisfies ConflictableFieldLike,
  },

  metric_rows: [
    {
      id: 'row_charge',
      label_key: 'metrics.charge_per_exam',
      display_value_key: 'charge_per_exam',
      unit_key: null,
      ui_status: 'conflict',
      source_key: 'charge_per_exam',
      note_key: 'metric_notes.conflict_hint',
      editable: true,
    },
    {
      id: 'row_volume_growth',
      label_key: 'metrics.exam_volume_growth',
      display_value_key: 'exam_volume_growth',
      unit_key: null,
      ui_status: 'hypothesis',
      source_key: 'exam_volume_growth_yoy',
      note_key: 'metric_notes.exam_volume_growth',
      editable: true,
    },
    {
      id: 'row_volume',
      label_key: 'metrics.monthly_exam_volume',
      display_value_key: 'monthly_exam_volume',
      unit_key: 'units.times',
      ui_status: 'verified',
      source_key: 'monthly_exam_volume',
      editable: true,
    },
    {
      id: 'row_cost',
      label_key: 'metrics.equipment_purchase_cost',
      display_value_key: 'equipment_purchase_cost',
      unit_key: null,
      ui_status: 'verified',
      source_key: 'equipment_purchase_cost',
      editable: false,
    },
    {
      id: 'row_insurance',
      label_key: 'metrics.reimbursement_ratio',
      display_value_key: 'reimbursement_ratio',
      unit_key: 'units.percent',
      ui_status: 'hypothesis',
      source_key: 'reimbursement_ratio',
      editable: true,
    },
    {
      id: 'row_years',
      label_key: 'metrics.service_life',
      display_value_key: 'service_life',
      unit_key: 'units.years',
      ui_status: 'verified',
      source_key: 'service_life_years',
      editable: false,
    },
    {
      id: 'row_revenue',
      label_key: 'metrics.annual_revenue',
      display_value_key: 'annual_revenue',
      unit_key: 'units.yuan',
      ui_status: 'hypothesis',
      source_key: null,
      note_key: 'metric_notes.annual_revenue',
      editable: false,
    },
  ] satisfies Omit<UiMetricRow, 'conflictable'>[],

  display_values: {
    charge_per_exam: '¥430/次',
    exam_volume_growth: '8.5%',
    monthly_exam_volume: '320',
    equipment_purchase_cost: '¥ 12,800,000',
    reimbursement_ratio: '65%',
    service_life: '8',
    annual_revenue: '¥ 1,148,800',
  },

  evidence_traces: {
    row_charge: {
      metric_row_id: 'row_charge',
      field_label_key: 'metrics.charge_per_exam',
      document_file_name: '2026年度万元以上设备预算申报论证表3.0T.docx',
      page_number: 4,
      thumbnail_tint: 'from-rose-900/40 to-slate-900',
      slices: [
        {
          id: 'sl1',
          excerpt:
            '本次申报收费标准按每次人民币 430 元执行（沪价医[2025]第 027 号）。',
          confidence: 0.93,
          bbox: { x: 0.08, y: 0.28, width: 0.84, height: 0.14 },
          bbox_coordinates_label: '0.082, 0.276, 0.918, 0.412',
        },
        {
          id: 'sl2',
          excerpt:
            '（交叉引用）旧版申购表记录：单次检查收费 460 元/次，执行文号已废止。',
          confidence: 0.88,
          bbox: { x: 0.12, y: 0.58, width: 0.72, height: 0.12 },
          bbox_coordinates_label: '0.118, 0.572, 0.836, 0.688',
        },
      ],
    } satisfies EvidenceTrace,
    row_volume_growth: {
      metric_row_id: 'row_volume_growth',
      field_label_key: 'metrics.exam_volume_growth',
      document_file_name: 'MR检查量增长率模型.xlsx',
      page_number: 1,
      thumbnail_tint: 'from-violet-900/50 to-slate-900',
      slices: [
        {
          id: 'vg1',
          excerpt: 'CAGR（36M）= 8.5%，用于预测检查量增长 — 模型假设场景 S2。',
          confidence: 0.72,
          bbox: { x: 0.1, y: 0.35, width: 0.55, height: 0.18 },
          bbox_coordinates_label: '0.095, 0.344, 0.648, 0.521',
        },
      ],
    } satisfies EvidenceTrace,
    row_cost: {
      metric_row_id: 'row_cost',
      field_label_key: 'metrics.equipment_purchase_cost',
      document_file_name: '飞利浦Elition S报价单-2026Q1.xlsx',
      page_number: 2,
      thumbnail_tint: 'from-emerald-900/40 to-slate-900',
      slices: [
        {
          id: 'c1',
          excerpt: '设备总价（含税）人民币 12,800,000 元，含五年全保。',
          confidence: 0.97,
          bbox: { x: 0.06, y: 0.42, width: 0.78, height: 0.1 },
          bbox_coordinates_label: '0.058, 0.418, 0.842, 0.516',
        },
      ],
    } satisfies EvidenceTrace,
  } satisfies Record<string, EvidenceTrace>,

  /** After user confirms 460 — patched display + conflictable */
  resolved_charge_patch: {
    display_charge_per_exam: '¥460/次',
    conflictable: {
      _type: 'ConflictableField',
      value: '460元/次',
      origin_type: 'agent_corpus',
      source_file: 'a_requirements/设备申购报告表2022版-3T.doc',
      doc_category: 'a_requirements',
      conflict: false,
      all_values: [
        {
          value: '460元/次',
          origin_type: 'agent_corpus',
          source_file: 'a_requirements/设备申购报告表2022版-3T.doc',
          doc_category: 'a_requirements',
        },
      ],
    } satisfies ConflictableFieldLike,
    evidence_trace_override: {
      metric_row_id: 'row_charge',
      field_label_key: 'metrics.charge_per_exam',
      document_file_name: '设备申购报告表2022版-3T.doc',
      page_number: 6,
      thumbnail_tint: 'from-emerald-900/35 to-slate-900',
      slices: [
        {
          id: 'r1',
          excerpt:
            '收费标准：460 元/次（历史归档版，已作为本次人工确认采纳值）。',
          confidence: 0.99,
          bbox: { x: 0.11, y: 0.31, width: 0.62, height: 0.11 },
          bbox_coordinates_label: '0.108, 0.302, 0.724, 0.408',
        },
      ],
    } satisfies EvidenceTrace,
  },
  resolved_annual_revenue_display: '¥ 1,232,880',
} as const

export type MockSnapshot = typeof mock_snapshot

export function hydrateMetricRows(s: MockSnapshot): UiMetricRow[] {
  return s.metric_rows.map((row) => ({
    ...row,
    conflictable: row.source_key
      ? structuredClone(s.initial_metrics[row.source_key])
      : undefined,
  }))
}

/** Nested key path into `strings` OR top-level literals */
export function pickString(
  root: MockSnapshot['strings'],
  keyPath: string,
): string {
  const parts = keyPath.split('.')
  let cur: unknown = root
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as object)) {
      cur = (cur as Record<string, unknown>)[p]
    } else {
      return keyPath
    }
  }
  return typeof cur === 'string' ? cur : keyPath
}
