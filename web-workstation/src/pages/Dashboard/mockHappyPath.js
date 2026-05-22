/**
 * Happy Path（完美直通流）演示数据
 *
 * 业务背景：资料极其规整，MinerU + 7 Agent 全链路 Straight-Through Processing，
 * 零人工干预、零冲突挂起。用于路演「理想态」一键切换。
 *
 * 接入方式：在 Dashboard 中根据 demoScenario === 'happy' 选用本文件导出，
 * 并向 DocDetailView 传入 docDetailOverrides（按 doc.id 覆盖详情）。
 */

import {
  Stethoscope,
  Building2,
  Briefcase,
  Server,
  FileText,
  Receipt,
  ShieldCheck,
  ClipboardList,
  Wallet,
  HardDrive,
} from 'lucide-react'

/** 与 Header / Dashboard 对齐的场景值 */
export const DEMO_SCENARIO_DEFAULT = 'default'
export const DEMO_SCENARIO_HAPPY = 'happy'

export const DEMO_SCENARIO_OPTIONS = [
  { value: DEMO_SCENARIO_DEFAULT, label: '标准演示数据' },
  { value: DEMO_SCENARIO_HAPPY, label: 'Happy Path · 完美直通（STP）' },
]

// ── 左侧材料树：8 类材料，全部为 MinerU 解析成功 ─────────────────────────────
export const HAPPY_MATERIAL_CATEGORIES = [
  {
    id: 'clinical',
    index: 1,
    title: '临床科室（放射科）',
    icon: Stethoscope,
    completed: 2,
    total: 2,
    defaultOpen: true,
    items: [
      { id: '1.1', label: '临床申请单', icon: FileText, status: 'parsed' },
      { id: '1.2', label: '新技术引入评估表', icon: ClipboardList, status: 'parsed' },
    ],
  },
  {
    id: 'vendor',
    index: 2,
    title: '外部供应商 / 厂家',
    icon: Building2,
    completed: 3,
    total: 3,
    defaultOpen: true,
    items: [
      { id: '2.1', label: '竞品彩页', icon: FileText, status: 'parsed' },
      { id: '2.2', label: '报价单', icon: Receipt, status: 'parsed' },
      { id: '2.3', label: '注册证', icon: ShieldCheck, status: 'parsed' },
    ],
  },
  {
    id: 'function',
    index: 3,
    title: '其他职能科室',
    icon: Briefcase,
    completed: 2,
    total: 2,
    defaultOpen: true,
    items: [
      { id: '3.1', label: '项目立项管理制度', icon: ClipboardList, status: 'parsed' },
      { id: '3.3', label: '医保报销比例 / 收益测算口径', icon: Wallet, status: 'parsed' },
    ],
  },
  {
    id: 'self',
    index: 4,
    title: '设备科',
    icon: Server,
    completed: 1,
    total: 1,
    defaultOpen: true,
    items: [
      { id: '4.1', label: '现有设备台账（1.5T 磁共振）', icon: HardDrive, status: 'parsed' },
    ],
  },
]

export const HAPPY_MATERIAL_TOTAL = { completed: 8, total: 8 }

// ── 阶段条 + 中栏 Agent 步骤器：全部完成 ─────────────────────────────────────
export const HAPPY_PROJECT_STAGES = [
  { id: 'A1', label: '需求梳理', status: 'done' },
  { id: 'A2', label: '竞品归并', status: 'done' },
  { id: 'A3', label: '预算测算', status: 'done' },
  { id: 'A4', label: '收益测算', status: 'done' },
  { id: 'A5', label: '合规核验', status: 'done' },
  { id: 'A6', label: '立项文书', status: 'done' },
  { id: 'A7', label: '审批反馈', status: 'done' },
]

export const HAPPY_PIPELINE_AGENTS = [
  { id: 1, label: '需求梳理',   agent: 'Agent', status: 'done' },
  { id: 2, label: '合理性判定', agent: 'Gate',  status: 'done' },
  { id: 3, label: '竞品归并',   agent: 'Agent', status: 'done' },
  { id: 4, label: '预算测算',   agent: 'Agent', status: 'done' },
  { id: 5, label: '收益测算',   agent: 'Agent', status: 'done' },
  { id: 6, label: '合规核验',   agent: 'Agent', status: 'done' },
  { id: 7, label: '文书生成',   agent: 'Agent', status: 'done' },
  { id: 8, label: '审批反馈',   agent: 'Agent', status: 'done' },
]

export const HAPPY_ACTIVE_TASK = {
  title: '【放射科 3.0T 磁共振立项】',
  description: '全链路自动直通已完成，建议书已生成',
  completedSteps: 8,
  totalSteps: 8,
  etaMinutes: 0,
}

// ── 工作台待办：仅一条成功态（无干预按钮语义）────────────────────────────────
export const HAPPY_SMART_TODOS = [
  {
    id: 'stp-success',
    severity: 'success',
    priorityLabel: '直通完成',
    title: '✅ 《放射科 3.0T 磁共振立项建议书 V1》已自动生成，等待最终打印/导出',
    summary:
      '资料规整度评分满分，MinerU 全量解析成功，7 大 Agent 无挂起点，未触发任何人工裁决（HITL）。',
    actionLabel: '',
    time: '刚刚',
    hideAction: true,
  },
]

// ── 材料流转右侧「智能待办」：零卡片（由 RightSidebar 展示替代文案）──────────
export const HAPPY_MATERIAL_FLOW_TODOS = []

// ── 全局流水线表格：单项目在途、全节点已完成 ─────────────────────────────────
export const HAPPY_PIPELINE_ROWS = [
  {
    id: 'hp1',
    name: '31****0147｜3.0T超导磁共振成像系统更新替换（STP 演示）',
    dept: '放射科',
    type: '更新',
    stage: '审批反馈已完成',
    progress: 100,
    progressTone: 'blue',
    nodes: ['done', 'done', 'done', 'done', 'done', 'done', 'done', 'done'],
    owner: '林晓明',
    ownerDept: '设备科',
    updatedAt: '2026-05-14 11:20',
    rationality: { verdict: 'exempt_renewal', dims: { workload: 'red', waiting_time: 'red', positive_rate: 'unknown', device_age: 'green' } },
  },
]

/** 文件详情覆盖：所有 extractedFields.status === 'verified'，无 conflict / 无裁决 CTA */
const verified = (label) => ({ label, status: 'verified' })

const happyRevenueParams = [
  { label: '场强（主磁体）', value: '3.0T', verified: true },
  { label: '采购金额（含税）', value: '1250 万元', verified: true },
  { label: '单次收费标准（院内基线）', value: '460 元/次', verified: true },
  { label: '月检查量', value: '1320 人次/月', verified: true },
  { label: '静态投资回收期', value: '3.1 年', verified: true },
  { label: '年均净收益（测算）', value: '约 380 万元', verified: true },
  { label: '设备折旧年限', value: '8 年', verified: true },
  { label: '维保费用占采购价比', value: '8%', verified: true },
  { label: '资金贴现率', value: '5%', verified: true },
]

const happyAgentTimeline = [
  { time: '08:58', agent: 'A1 需求梳理',   action: '临床语言已标准化为采购指标，字段置信度 0.99', status: 'done' },
  { time: '09:02', agent: 'A2 合理性判定', action: '申康三维基准通过，成新率 18.5% 触发更新豁免，建议立项', status: 'done' },
  { time: '09:08', agent: 'A3 竞品归并',   action: '三家厂商参数矩阵对齐完成，底价字段已脱敏定级', status: 'done' },
  { time: '09:15', agent: 'A4 预算测算',   action: 'TCO（裸机 + 场地 + 液氦 + 维保）已闭合', status: 'done' },
  { time: '09:22', agent: 'A5 收益测算',   action: '收费基线与检查量假设与院级财务口径一致，无冲突', status: 'done' },
  { time: '09:30', agent: 'A6 合规核验',   action: '证照、收费、注册证交叉比对通过，未触发挂起', status: 'done' },
  { time: '09:38', agent: 'A7 立项文书',   action: '《立项可行性论证报告》V1 已自动拼装', status: 'done' },
  { time: '09:43', agent: 'A8 审批反馈',   action: '无驳回意见回流，闭环结束', status: 'done' },
]

function happyDocBase(overrides) {
  return {
    statusLabel: '已核验',
    statusColor: 'green',
    updatedAt: '2026-05-14 09:40',
    generatedBy: 'ARIA 编排引擎',
    hasConflict: false,
    agentTimeline: happyAgentTimeline,
    ...overrides,
  }
}

export const HAPPY_DOC_DETAIL_OVERRIDES = {
  '1.1': happyDocBase({
    title: '临床申请单',
    filename: 'datasource/a_requirements/临床申请单_放射科_规整版.pdf',
    basicInfo: [
      { label: '申请科室', value: '放射科' },
      { label: '申请设备', value: '3.0T 超导磁共振成像系统' },
      { label: '申请类型', value: '更新替换（淘汰 1.5T）' },
      { label: '紧急程度', value: '常规' },
      { label: '项目阶段', value: '审批反馈已完成 (A7)' },
      { label: '当前流程进度', value: 100, type: 'progress' },
    ],
    extractedFields: [
      verified('申请科室'),
      verified('设备名称'),
      verified('申请类型'),
    ],
    relatedFiles: ['临床申请单.pdf', '新技术评估表.pdf'],
    notes: '模板字段完整、签章齐全，OCR 版面零缺失。',
  }),
  '1.2': happyDocBase({
    title: '新技术引入评估表',
    filename: 'datasource/a_requirements/新技术引入评估表_3.0T_规整版.docx',
    basicInfo: [
      { label: '评估项目', value: '3.0T MRI 临床应用评估' },
      { label: '评估科室', value: '放射科 + 医务部联合' },
      { label: '临床优先级', value: '高' },
      { label: '推荐引入', value: '是' },
      { label: '项目阶段', value: '审批反馈已完成 (A7)' },
      { label: '当前流程进度', value: 100, type: 'progress' },
    ],
    extractedFields: [verified('评估结论'), verified('科室签章')],
    relatedFiles: ['临床申请单.pdf', '新技术引入评估表.docx'],
    notes: '联合评估结论与申请单一致，无歧义表述。',
  }),
  '2.1': happyDocBase({
    title: '竞品彩页',
    filename: 'datasource/b_competitors/竞品彩页_三家_规整版.pdf',
    basicInfo: [
      { label: '厂商', value: '飞利浦 / 西门子 / 联影（矩阵行）' },
      { label: '对标型号', value: 'Elition S / Vida / uMR 790' },
      { label: '磁场强度', value: '3.0T' },
      { label: '梯度切换率', value: '200 T/m/s（已对齐单位）' },
      { label: '项目阶段', value: '审批反馈已完成 (A7)' },
      { label: '当前流程进度', value: 100, type: 'progress' },
    ],
    extractedFields: [verified('产品型号'), verified('技术规格')],
    relatedFiles: ['竞品彩页.pdf', '报价单.xlsx'],
    notes: '版面解析置信度统一 ≥ 0.97，表格行列未断裂。',
  }),
  '2.2': happyDocBase({
    title: '报价单',
    filename: 'datasource/b_competitors/报价单_3.0T_含税_规整版.xlsx',
    statusLabel: '已核验',
    statusColor: 'green',
    basicInfo: [
      { label: '申请科室', value: '放射科' },
      { label: '设备名称', value: '3.0T 超导磁共振成像系统' },
      { label: '场强', value: '3.0T' },
      { label: '采购金额（含税）', value: '1250 万元' },
      { label: '项目阶段', value: '审批反馈已完成 (A7)' },
      { label: '当前流程进度', value: 100, type: 'progress' },
    ],
    revenueParams: happyRevenueParams,
    extractedFields: [
      verified('设备名称'),
      verified('申请科室'),
      verified('场强'),
      verified('采购金额'),
      verified('收费参数'),
    ],
    relatedFiles: ['报价单.xlsx', '竞品彩页.pdf', '注册证.pdf'],
    notes: '报价与注册证、彩页参数三方自动对账通过。',
  }),
  '2.3': happyDocBase({
    title: '注册证',
    filename: 'datasource/c_compliance/注册证_国械注准20243061435.pdf',
    basicInfo: [
      { label: '注册证号', value: '国械注准20243061435' },
      { label: '产品名称', value: '磁共振成像系统' },
      { label: '批准日期', value: '2024-03-15' },
      { label: '有效期至', value: '2029-03-14' },
      { label: '项目阶段', value: '审批反馈已完成 (A7)' },
      { label: '当前流程进度', value: 100, type: 'progress' },
    ],
    extractedFields: [verified('证书编号'), verified('有效期'), verified('产品名称')],
    relatedFiles: ['注册证.pdf'],
    notes: '证照在有效期内，结构化字段与报价单型号一致。',
  }),
  '3.1': happyDocBase({
    title: '项目立项管理制度',
    filename: 'datasource/a_requirements/项目立项管理制度2024.docx',
    basicInfo: [
      { label: '制度版本', value: '2024 版' },
      { label: '适用范围', value: '全院大型医疗设备立项申请' },
      { label: '审批层级', value: '设备科 → 院办 → 院长' },
      { label: '项目阶段', value: '审批反馈已完成 (A7)' },
      { label: '当前流程进度', value: 100, type: 'progress' },
    ],
    extractedFields: [verified('制度版本'), verified('审批流程')],
    relatedFiles: ['立项管理制度2024.docx'],
    notes: '引用条款与当前项目路径匹配，无额外人工解读。',
  }),
  '3.3': happyDocBase({
    title: '医保报销比例 / 收益测算口径',
    filename: 'datasource/d_operations/医保收益测算口径2024.xlsx',
    basicInfo: [
      { label: '医保报销比例', value: '75%（住院）/ 60%（门诊）' },
      { label: '年工作天数', value: '250 天' },
      { label: '日均检查台次', value: '18 台次' },
      { label: '项目阶段', value: '审批反馈已完成 (A7)' },
      { label: '当前流程进度', value: 100, type: 'progress' },
    ],
    extractedFields: [verified('医保比例'), verified('工作天数')],
    relatedFiles: ['医保收益测算口径2024.xlsx'],
    notes: '与收益测算 Agent 使用的全局财务基线完全一致。',
  }),
  '4.1': happyDocBase({
    title: '现有设备台账（1.5T 磁共振）',
    filename: 'datasource/d_operations/现有设备台账_1.5T.xlsx',
    basicInfo: [
      { label: '在用设备型号', value: 'GE SIGNA 1.5T（2016 年购置）' },
      { label: '已使用年限', value: '10 年' },
      { label: '近 3 年年均维修费', value: '约 48 万元' },
      { label: '设备残值', value: '约 15 万元' },
      { label: '项目阶段', value: '审批反馈已完成 (A7)' },
      { label: '当前流程进度', value: 100, type: 'progress' },
    ],
    extractedFields: [verified('设备型号'), verified('使用年限'), verified('维修费用')],
    relatedFiles: ['现有设备台账.xlsx'],
    notes: '淘汰依据与临床申请单痛点描述交叉验证通过。',
  }),
}
