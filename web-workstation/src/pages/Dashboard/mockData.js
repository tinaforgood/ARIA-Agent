// Mock data driving the MriAgent Dashboard (工作台)
// All copy / numbers align with the v2 design spec screenshot.

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
  Database,
  HardDrive,
  Package,
  LayoutGrid,
  Shuffle,
  BarChart3,
  FolderOpen,
  PieChart,
  Settings2,
  FileBarChart2,
  Clock,
  ShieldAlert,
} from 'lucide-react'

// ─────────────────────────────────────────────────
// Top bar
// ─────────────────────────────────────────────────
export const NAV_TABS = [
  { key: 'workbench', label: '工作台' },
  { key: 'material',  label: '材料流转' },
  { key: 'progress',  label: '进度跟踪' },
  { key: 'docs',      label: '文档中心' },
  // { key: 'stats',     label: '统计分析' },  // 暂时隐藏
  { key: 'settings',  label: '系统设置' },
]

export const CURRENT_USER = {
  name: '张若昕',
  role: '设备科主任',
  notificationCount: 12,
}

export const CURRENT_PROJECT = {
  name: '3.0T磁共振置购项目',
}

// ─────────────────────────────────────────────────
// Stage indicator (A1 – A7)  ── only used in MaterialFlow
// ─────────────────────────────────────────────────
export const PROJECT_STAGES = [
  { id: 'A1', label: '需求梳理',  status: 'done'    },
  { id: 'A2', label: '竞品归并',  status: 'done'    },
  { id: 'A3', label: '预算测算',  status: 'done'    },
  { id: 'A4', label: '收益测算',  status: 'active'  },
  { id: 'A5', label: '合规核验',  status: 'pending' },
  { id: 'A6', label: '立项文书',  status: 'pending' },
  { id: 'A7', label: '审批反馈',  status: 'pending' },
]

// ─────────────────────────────────────────────────
// Section 1 – QuickMetrics: 本年度立项总盘 + KPIs
// ─────────────────────────────────────────────────
export const ANNUAL_STATS = {
  total: 128,
  segments: [
    { id: 'inFlight', label: '正在流转', count: 58, pct: 45, color: '#3B82F6' },
    { id: 'passed',   label: '已通过',   count: 48, pct: 38, color: '#10B981' },
    { id: 'rejected', label: '已驳回',   count: 22, pct: 17, color: '#EF4444' },
  ],
}

export const KPI_CARDS = [
  {
    id: 'conflicts',
    label: '累计拦截数据冲突数',
    value: '326',
    unit: '次',
    icon: ShieldCheck,
    trendDir: 'up',
    trendValue: '28%',
    trendLabel: '同比上升',
    subtitle: '为医院避免潜在风险损失约 860 万元',
    type: 'badge',
    iconColor: 'text-blue-500',
    iconBg: 'bg-blue-50',
  },
  {
    id: 'passRate',
    label: '立项一次性通过率',
    value: 78,
    trendDir: 'up',
    trendValue: '15%',
    trendLabel: '较去年提升',
    type: 'ring',
    ringColor: '#3B82F6',
  },
  {
    id: 'rejectRate',
    label: '驳回重报率',
    value: 22,
    trendDir: 'down',
    trendValue: '12%',
    trendLabel: '较去年下降',
    type: 'ring',
    ringColor: '#10B981',
  },
]

export const MATERIAL_TYPES = [
  { id: '1', label: '临床申请单', icon: Stethoscope,  iconCls: 'text-blue-500   bg-blue-50'    },
  { id: '2', label: '现有台账',   icon: Database,      iconCls: 'text-emerald-500 bg-emerald-50' },
  { id: '3', label: '报价单',     icon: Receipt,       iconCls: 'text-amber-500  bg-amber-50'   },
  { id: '4', label: '注册证',     icon: ShieldCheck,   iconCls: 'text-green-600  bg-green-50'   },
  { id: '5', label: '检验报告',   icon: ClipboardList, iconCls: 'text-violet-500 bg-violet-50'  },
  { id: '6', label: '竞品资料',   icon: Building2,     iconCls: 'text-sky-500    bg-sky-50'     },
  { id: '7', label: '合同协议',   icon: FileText,      iconCls: 'text-pink-500   bg-pink-50'    },
  { id: '8', label: '其他材料',   icon: Package,       iconCls: 'text-slate-500  bg-slate-100'  },
]

// ─────────────────────────────────────────────────
// Left sidebar – Standard materials  ── only used in MaterialFlow
// ─────────────────────────────────────────────────
export const MATERIAL_CATEGORIES = [
  {
    id: 'internal', index: 1, title: '院内申报材料',
    icon: ClipboardList, completed: 0, total: 4, defaultOpen: true,
    subtitle: '由医院职能部门提供',
    items: [
      { id: 'basic_info',  label: '基本情况表', icon: FileText,      status: 'pending',   hint: '医院/科室床位、诊疗量等核心指标', required: true  },
      { id: 'budget_list', label: '预算清单',   icon: Receipt,       status: 'pending',   hint: '拟申请设备预算项目清单',           required: true  },
      { id: 'minutes',     label: '论证纪要',   icon: ClipboardList, status: 'pending',   hint: '预算论证会议纪要，需签字确认',     required: true  },
      { id: 'performance', label: '绩效目标表', icon: FileBarChart2, status: 'pending',   hint: '市级财政绩效申报表',               required: true  },
    ],
  },
  {
    id: 'compliance', index: 2, title: '合规证明材料',
    icon: ShieldCheck, completed: 0, total: 2, defaultOpen: true,
    subtitle: '由厂商或监管部门提供',
    items: [
      { id: 'nmpa_cert',   label: 'NMPA 注册证',  icon: ShieldCheck, status: 'pending', hint: '国家药监局注册证，确认在有效期内',  required: false },
      { id: 'price_proof', label: '价格依据证明',  icon: Wallet,      status: 'pending', hint: '含税报价单或询价记录（≥1家）',      required: true  },
    ],
  },
]
export const MATERIAL_TOTAL = { completed: 0, total: 6 }

// ─────────────────────────────────────────────────
// Section 2 – SmartToDo: 智能待办与干预中心
// severity: 'danger' | 'warning' | 'caution' | 'normal'
// ─────────────────────────────────────────────────
export const SMART_TODOS = [
  {
    id: 'conflict',
    severity: 'danger',
    priorityLabel: '高优 – 数据冲突待裁决',
    title: '数据冲突待裁决',
    summary:
      '【31****0318｜3.0T全身超导磁共振成像系统新增】存在 1 条关键数据冲突。A类文件与B类文件单次收费标准存在矛盾：430元 vs 460元，请确认可信值。',
    actionLabel: '立即处理',
    time: '10 分钟前',
  },
  {
    id: 'rejection',
    severity: 'warning',
    priorityLabel: '高优 – 驳回与回溯待处理',
    title: '驳回与回溯待处理',
    summary:
      '【31****0263｜3.0T超导磁共振成像系统新增配置】被院办驳回，Agent 已定位缺口。缺少「放射诊疗许可可增项证明」，请点击进入补证入口。',
    actionLabel: '去处理',
    time: '25 分钟前',
  },
  {
    id: 'hypothesis',
    severity: 'caution',
    priorityLabel: '中优 – 核心假设待背书',
    title: '核心假设待背书',
    summary:
      '【31****0429｜1.5T磁共振换型升级（3.0T超导型）】收益预测模型包含 2 项假设数值。请对「检查量年增长率」和「专家经验值」确认，确保模型合理性。',
    actionLabel: '去背书',
    time: '1 小时前',
  },
  {
    id: 'review',
    severity: 'normal',
    priorityLabel: '常规 – 终审与建议书导出',
    title: '终审与建议书导出',
    summary:
      '【31****0263｜3.0T超导磁共振成像系统新增配置】立项文书 Agent 已拼接完成，等待终审确认并生成标准化建议书。',
    actionLabel: '去终审',
    time: '2 小时前',
  },
]

// ─────────────────────────────────────────────────
// Section 3 – ActionCenter: quick-launch file type buttons
// ─────────────────────────────────────────────────
export const QUICK_FILE_TYPES = [
  { id: 'pdf',   label: 'PDF',   ext: '.pdf',             colorCls: 'bg-red-50    text-red-500    border-red-100'    },
  { id: 'excel', label: 'Excel', ext: '.xlsx,.xls',       colorCls: 'bg-green-50  text-green-600  border-green-100'  },
  { id: 'word',  label: 'Word',  ext: '.doc,.docx',       colorCls: 'bg-blue-50   text-blue-600   border-blue-100'   },
  { id: 'image', label: '图片',  ext: '.png,.jpg,.jpeg',  colorCls: 'bg-purple-50 text-purple-600 border-purple-100' },
  { id: 'txt',   label: 'TXT',   ext: '.txt',             colorCls: 'bg-slate-50  text-slate-500  border-slate-200'  },
]

// ─────────────────────────────────────────────────
// Section 4 – ActivePipeline: 全局项目流水线
// node status: 'done' | 'active' | 'shell' | 'error' | 'pending'
// ─────────────────────────────────────────────────
// 注意：第2位「合理性判定」对应后端新增的 rationality_gate node
export const PIPELINE_NODE_LABELS = [
  '需求梳理', '合理性判定', '竞品归并', '预算测算', '收益测算', '合规核验', '文书生成', '审批反馈',
]

export const PIPELINE_ROWS = [
  {
    // 31****0147：成新率 18.5% ≤ 30% → 更新豁免，其余维度不参与否决
    id: 'p1', name: '31****0147｜3.0T超导磁共振成像系统更新替换', dept: '放射科', type: '更新',
    stage: '合规核验中',       progress: 72, progressTone: 'blue',
    nodes: ['done','done','done','done','done','active','pending','pending'],
    owner: '陈建国', ownerDept: '院办', updatedAt: '2025-05-20 10:30',
    rationality: { verdict: 'exempt_renewal', dims: { workload: 'red', waiting_time: 'red', positive_rate: 'unknown', device_age: 'green' } },
    // 成新率 18.5%，日台均 41.3次，候检 3.5天（均低于市均，但更新豁免不否决）
  },
  {
    // 31****0263：合理性条件通过，但最终申康审批被驳回（文书补材料不全）
    id: 'p2', name: '31****0263｜3.0T超导磁共振成像系统新增配置', dept: '放射科', type: '新增',
    stage: '申康审批驳回',     progress: 85, progressTone: 'blue',
    nodes: ['done','done','done','done','done','done','done','error'],
    owner: '林晓明', ownerDept: '设备科', updatedAt: '2025-05-20 09:15',
    rationality: { verdict: 'conditional', dims: { workload: 'yellow', waiting_time: 'yellow', positive_rate: 'unknown', device_age: 'unknown' } },
    // 饱和度 80.3%（黄），候检 6.2天（黄），阳性率/成新率数据缺失
  },
  {
    // 31****0318：三维全达标 → 合理性通过，正在推进预算
    id: 'p3', name: '31****0318｜3.0T全身超导磁共振成像系统新增', dept: '放射科', type: '新增',
    stage: '预算测算中',       progress: 45, progressTone: 'blue',
    nodes: ['done','done','done','active','pending','pending','pending','pending'],
    owner: '吴雅珺', ownerDept: '财务处', updatedAt: '2025-05-19 16:45',
    rationality: { verdict: 'pass', dims: { workload: 'green', waiting_time: 'green', positive_rate: 'green', device_age: 'red' } },
    // 饱和度 93.2%（≥90% 绿），候检 8.5天（>7天 绿），阳性率 78%（>70% 绿）
  },
  {
    // 31****0429：1.5T→3.0T 升级，运营数据部分缺失 → 条件通过，文书已生成待终审
    id: 'p4', name: '31****0429｜1.5T磁共振换型升级（3.0T超导型）', dept: '放射科', type: '更新',
    stage: '文书生成中',       progress: 90, progressTone: 'blue',
    nodes: ['done','done','done','done','done','done','active','pending'],
    owner: '张雨桐', ownerDept: '设备科', updatedAt: '2025-05-19 11:20',
    rationality: { verdict: 'conditional', dims: { workload: 'yellow', waiting_time: 'yellow', positive_rate: 'unknown', device_age: 'unknown' } },
    // 饱和度 80.3%（黄），候检 6.2天（黄），阳性率/成新率待院方补充
  },
  {
    // 31****0534：刚启动需求梳理，尚未到达合理性判定节点
    id: 'p5', name: '31****0534｜1.5T超导磁共振成像系统新增配置', dept: '放射科', type: '新增',
    stage: '需求梳理中',       progress: 15, progressTone: 'blue',
    nodes: ['active','pending','pending','pending','pending','pending','pending','pending'],
    owner: '张若昕', ownerDept: '放射科主任', updatedAt: '2025-05-18 14:10',
    rationality: null,   // 尚未到达合理性判定节点
  },
  {
    // 31****0651：阳性率 52% < 60% 红灯 → 合理性判定暂缓，pipeline 在节点1中止
    id: 'p6', name: '31****0651｜3.0T高场强磁共振成像系统新增', dept: '放射科', type: '新增',
    stage: '合理性判定暂缓',   progress: 18, progressTone: 'red',
    nodes: ['done','error','pending','pending','pending','pending','pending','pending'],
    owner: '王磊', ownerDept: '设备科', updatedAt: '2025-05-18 09:50',
    rationality: { verdict: 'reject', dims: { workload: 'green', waiting_time: 'green', positive_rate: 'red', device_age: 'red' } },
    // 饱和度 88.5%（接近绿），候检 9.1天（绿），阳性率 52%（<60% 红）→ 建议暂缓
  },
]

// ─────────────────────────────────────────────────
// MaterialFlowView 专属待办（原始 2 条，danger / info 样式）
// ─────────────────────────────────────────────────
export const MATERIAL_FLOW_TODOS = [
  {
    id: 'conflict',
    severity: 'danger',
    priorityLabel: '高优先级',
    title: '数据冲突待裁决',
    summary: '你有 2 条关键数据冲突待人工裁决',
    detail: '包含：[放射科 3.0T MRI] 430 vs 460 收费标准冲突',
    actionLabel: '立即处理',
  },
  {
    id: 'review',
    severity: 'info',
    priorityLabel: '中优先级',
    title: '终审待处理',
    summary: '[31****0263] 放射科 3.0T 核磁立项建议书',
    detail: '已由 Agent 生成，等待你的最终审阅与导出',
    actionLabel: '进入终审',
  },
]

// ─────────────────────────────────────────────────
// Legacy exports (used by RecentDynamics, Module, etc.)
// ─────────────────────────────────────────────────
export const RECENT_DYNAMICS = [
  { id: 1, project: '31****0147｜超导MRI更新替换',      stage: 'A6 合规核验', time: '今天 10:30',  tone: 'emerald' },
  { id: 2, project: '31****0318｜3.0T全身超导MRI新增', stage: 'A4 预算测算', time: '今天 09:15',  tone: 'emerald' },
  { id: 3, project: '31****0429｜1.5T换型升级3.0T',   stage: 'A7 文书生成', time: '昨天 16:45',  tone: 'emerald' },
  { id: 4, project: '31****0263｜3.0T超导MRI新增配置', stage: 'A8 审批反馈', time: '昨天 14:20',  tone: 'red'     },
  { id: 5, project: '31****0651｜3.0T高场强MRI新增',  stage: 'A2 合理性判定', time: '05-18 09:50', tone: 'red'    },
]

export const MODULE_OVERVIEW = [
  { id: 'workbench', title: '工作台',   icon: LayoutGrid, lines: ['今日待办、风险概览',     '最近操作记录']       },
  { id: 'material',  title: '材料流转', icon: Shuffle,    lines: ['资料收集、补件上传',     '节点流转、材料清单'] },
  { id: 'progress',  title: '进度跟踪', icon: BarChart3,  lines: ['时间触线视图、责任人',   '节点完成率统计']     },
  { id: 'docs',      title: '文档中心', icon: FolderOpen, lines: ['模板管理、版本记录',     '全文检索、权限控制'] },
  { id: 'stats',     title: '统计分析', icon: PieChart,   lines: ['项目数量、周期分析',     '完整率、环节耗时']   },
  { id: 'settings',  title: '系统设置', icon: Settings2,  lines: ['角色权限、审批流',       '字段规则、基础配置'] },
]

export const QUICK_METRICS = [
  { id: 'count',  label: '本月处理立项数', value: '12',  unit: '份',     icon: FileBarChart2, tone: 'blue',    deltaLabel: '环比增长',   deltaValue: '15%',  deltaDirection: 'up',      trend: [4,6,5,7,6,8,7,9,10,12]          },
  { id: 'parse',  label: '平均解析时长',   value: '4.2', unit: 'min/份', icon: Clock,         tone: 'emerald', deltaLabel: '较上月下降', deltaValue: '18%',  deltaDirection: 'down',    trend: [9,8,8.5,7,6.5,6,5.5,5,4.6,4.2] },
  { id: 'reject', label: '驳回重报率',     value: '8.5', unit: '%',      icon: ShieldAlert,   tone: 'violet',  deltaLabel: '健康状态',   deltaValue: '良好', deltaDirection: 'neutral', trend: [12,11.5,11,10.5,10,9.5,9.3,9,8.7,8.5] },
]

export const PIPELINE_AGENTS = [
  { id: 1, label: '需求梳理',   agent: 'Agent', status: 'done'    },
  { id: 2, label: '合理性判定', agent: 'Gate',  status: 'done'    },
  { id: 3, label: '竞品归并',   agent: 'Agent', status: 'done'    },
  { id: 4, label: '预算测算',   agent: 'Agent', status: 'done'    },
  { id: 5, label: '收益测算',   agent: 'Agent', status: 'done'    },
  { id: 6, label: '合规核验',   agent: 'Agent', status: 'active'  },
  { id: 7, label: '文书生成',   agent: 'Agent', status: 'pending' },
  { id: 8, label: '审批反馈',   agent: 'Agent', status: 'pending' },
]

export const ACTIVE_TASK = {
  title: '【31****0147｜3.0T超导磁共振成像系统更新替换】',
  description: '正在进行"合规核验 Agent"处理',
  completedSteps: 5,
  totalSteps: 8,
  etaMinutes: 18,
}
