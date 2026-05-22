/**
 * SettingsView — 系统设置页面
 *
 * 左侧 4 个子模块导航 + 底部环境信息
 * 右侧主内容（AI 底座配置）：
 *   1. MinerU 解析引擎配置（SaaS / Docker 单选 + API Key）
 *   2. LLM 引擎配置（已连接模型卡 + 锁定 Temperature 滑块）
 *   3. 测算规则引擎（折旧年限 / 维保比例 / 贴现率）
 *   4. 人机协同策略（多条 Toggle 开关）
 */

import { useState } from 'react'
import {
  Database, Calculator, Users2, ShieldCheck,
  Eye, EyeOff, Lock, Info, Save, ChevronRight,
  CheckCircle2, ExternalLink, UserCircle2, KeyRound,
  Shield, Building2, AlertTriangle,
} from 'lucide-react'

// ─── Nav items ────────────────────────────────────────────────────────────────
const NAV = [
  { id: 'ai',       Icon: Database,    label: 'AI 底座配置',   sub: '模型与解析引擎配置' },
  { id: 'calc',     Icon: Calculator,  label: '测算规则引擎',  sub: '财务与测算规则配置' },
  { id: 'hitl',     Icon: Users2,      label: '人机协同策略',  sub: '协同与干预策略配置' },
  { id: 'security', Icon: ShieldCheck, label: '权限与安全',    sub: '角色与数据安全配置' },
]

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function SectionCard({ title, badge, subtitle, children }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-4">
        <div className="flex items-center gap-2">
          <h3 className="text-[14px] font-semibold text-slate-900">{title}</h3>
          {badge && (
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">{badge}</span>
          )}
        </div>
        {subtitle && <p className="mt-0.5 text-[12.5px] text-slate-400">{subtitle}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none',
        checked ? 'bg-blue-500' : 'bg-slate-200',
      ].join(' ')}
    >
      <span
        className={[
          'pointer-events-none inline-block size-5 rounded-full bg-white shadow-md ring-0 transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  )
}

function InfoTip({ text }) {
  return (
    <span title={text} className="cursor-help text-slate-400 hover:text-slate-600">
      <Info className="size-3.5" strokeWidth={1.75} />
    </span>
  )
}

function NumericInput({ value, onChange, unit }) {
  return (
    <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-transparent px-4 py-2.5 text-[14px] font-medium text-slate-800 outline-none"
      />
      <span className="shrink-0 border-l border-slate-200 bg-slate-50 px-3 py-2.5 text-[13px] text-slate-500">
        {unit}
      </span>
    </div>
  )
}

// ─── Section 1: MinerU ───────────────────────────────────────────────────────
function MinerUSection({ mode, onMode }) {
  const [showKey, setShowKey] = useState(false)
  const [apiKey, setApiKey]   = useState('sk-mineru-xxxxxxxxxxxxxxxxxxxxxxxxxxx')

  return (
    <SectionCard
      title="1. MinerU 解析引擎配置"
      badge="文档结构化引擎"
      subtitle="选择文档解析引擎的部署方式"
    >
      <div className="flex gap-8">
        {/* Radio group */}
        <div className="flex-1 space-y-3">
          {/* SaaS */}
          <label
            className={[
              'flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-colors',
              mode === 'saas' ? 'border-blue-500 bg-blue-50/40' : 'border-slate-200 hover:border-slate-300',
            ].join(' ')}
          >
            <input type="radio" className="sr-only" checked={mode === 'saas'} onChange={() => onMode('saas')} />
            <span className={[
              'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2',
              mode === 'saas' ? 'border-blue-500 bg-blue-500' : 'border-slate-300',
            ].join(' ')}>
              {mode === 'saas' && <span className="size-2 rounded-full bg-white" />}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] font-semibold text-slate-800">SaaS API（云端）</span>
                <span className="rounded-md bg-blue-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">推荐</span>
              </div>
              <p className="mt-0.5 text-[12px] text-slate-500">使用 MinerU 官方云端 API 服务，免维护、弹性扩展</p>
            </div>
          </label>

          {/* Docker */}
          <label
            className={[
              'flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-colors',
              mode === 'docker' ? 'border-blue-500 bg-blue-50/40' : 'border-slate-200 hover:border-slate-300',
            ].join(' ')}
          >
            <input type="radio" className="sr-only" checked={mode === 'docker'} onChange={() => onMode('docker')} />
            <span className={[
              'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2',
              mode === 'docker' ? 'border-blue-500 bg-blue-500' : 'border-slate-300',
            ].join(' ')}>
              {mode === 'docker' && <span className="size-2 rounded-full bg-white" />}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] font-semibold text-slate-800">本地 Docker（私有化）</span>
                <span className="text-[16px]">🐳</span>
              </div>
              <p className="mt-0.5 text-[12px] text-slate-500">在本地服务器部署 MinerU 容器，数据不出内网</p>
            </div>
          </label>
        </div>

        {/* API Key (only for SaaS) */}
        {mode === 'saas' && (
          <div className="w-[340px] shrink-0">
            <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-slate-700">
              API Key <InfoTip text="用于调用 MinerU SaaS API 接口的密钥" />
            </div>
            <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                className="min-w-0 flex-1 bg-transparent px-4 py-2.5 text-[13.5px] text-slate-700 outline-none"
              />
              <button type="button" onClick={() => setShowKey(v => !v)}
                className="shrink-0 px-3 text-slate-400 hover:text-slate-600">
                {showKey ? <Eye className="size-4" strokeWidth={1.75} /> : <EyeOff className="size-4" strokeWidth={1.75} />}
              </button>
            </div>
            <p className="mt-1.5 text-[11.5px] text-slate-400">
              用于调用 MinerU SaaS API 接口的密钥
              <button type="button" className="ml-1.5 text-blue-500 hover:underline inline-flex items-center gap-0.5">
                如何获取 API Key? <ExternalLink className="size-3" />
              </button>
            </p>
          </div>
        )}
      </div>
    </SectionCard>
  )
}

// ─── Section 2: LLM ──────────────────────────────────────────────────────────
function LLMSection() {
  return (
    <SectionCard
      title="2. LLM 引擎配置"
      badge="大语言模型"
      subtitle="选择并配置大语言模型引擎"
    >
      <div className="flex gap-8">
        {/* Model card */}
        <div className="flex-1">
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <div className="mb-3 text-[11.5px] font-medium text-slate-400">当前接入模型</div>
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet-100">
                <span className="text-[20px]">✦</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[18px] font-bold text-slate-900">Qwen-Max</span>
                  <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    已连接
                  </span>
                </div>
                <div className="mt-1 space-y-0.5 text-[12px] text-slate-500">
                  <div>模型提供商：阿里云百炼</div>
                  <div>模型类型：通义千问-Max</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Temperature */}
        <div className="w-[340px] shrink-0">
          <div className="mb-2 flex items-center gap-1.5 text-[12.5px] font-medium text-slate-700">
            Temperature（生成随机性）
            <InfoTip text="控制模型输出的随机程度，0 为确定性输出" />
          </div>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <input
                type="range" min={0} max={1} step={0.01} value={0.10}
                disabled
                className="h-2 w-full cursor-not-allowed appearance-none rounded-full bg-slate-200 accent-slate-400"
              />
            </div>
            <Lock className="size-4 shrink-0 text-slate-400" strokeWidth={1.75} />
            <div className="flex w-14 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 py-1.5 text-[13px] font-semibold text-slate-600">
              0.10
            </div>
          </div>
          <p className="mt-2 text-[11.5px] text-slate-400">
            当前模型温度参数已锁定，确保医疗场景的严谨性与输出稳定性
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-[12px] font-medium text-blue-700">
            <Lock className="size-3.5" strokeWidth={2} />
            已锁定（防幻觉模式）
          </div>
        </div>
      </div>
    </SectionCard>
  )
}

// ─── Section 3: Calc engine ──────────────────────────────────────────────────
function CalcSection({ depreciation, onDep, maintenance, onMaint, discount, onDisc }) {
  return (
    <SectionCard
      title="测算规则引擎"
      badge="全局财务基线"
      subtitle="设置收益测算 Agent 的全局默认参数"
    >
      <div className="grid grid-cols-3 gap-6">
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-slate-700">
            默认设备折旧年限 <InfoTip text="设备固定资产折旧的默认年限" />
          </div>
          <NumericInput value={depreciation} onChange={onDep} unit="年" />
          <p className="mt-1.5 text-[11.5px] text-slate-400">设备固定资产折旧的默认年限</p>
        </div>
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-slate-700">
            默认维保费测算比例 <InfoTip text="按设备采购价计算的年维保费比例" />
          </div>
          <NumericInput value={maintenance} onChange={onMaint} unit="%" />
          <p className="mt-1.5 text-[11.5px] text-slate-400">按设备采购价计算的年维保费比例</p>
        </div>
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-slate-700">
            贴现率（内部收益率计算）<InfoTip text="用于财务净现值计算的贴现率" />
          </div>
          <NumericInput value={discount} onChange={onDisc} unit="%" />
          <p className="mt-1.5 text-[11.5px] text-slate-400">用于财务净现值计算的贴现率</p>
        </div>
      </div>
      <div className="mt-4 flex items-start gap-2 rounded-xl bg-blue-50/60 px-4 py-3 text-[12px] text-slate-600">
        <Info className="mt-0.5 size-4 shrink-0 text-blue-400" strokeWidth={1.75} />
        此参数将作为收益测算 Agent 的全局保底基线，可在项目级别覆盖
      </div>
    </SectionCard>
  )
}

// ─── Section 4: HITL strategy ────────────────────────────────────────────────
const HITL_ITEMS = [
  {
    id: 'conflict',
    label: '开启跨文档核心数据冲突强阻断',
    desc: '当多源文件出现矛盾，如报价或收费标准 430 vs 460 时，强制挂起 LangGraph 工作流等待人工裁决',
    default: true,
  },
  {
    id: 'hallucination',
    label: '开启幻觉置信度低于阈值告警',
    desc: '当 Agent 输出置信度低于 0.75 时，自动触发人工审核流程，防止低质量内容进入立项文书',
    default: true,
  },
  {
    id: 'compliance',
    label: '合规核验失败强制人工复核',
    desc: '注册证过期或配置标准不满足时，不允许 Agent 自动跳过，须人工确认后方可继续流转',
    default: true,
  },
  {
    id: 'final',
    label: '立项文书生成前必经终审确认',
    desc: '所有立项建议书在导出前需经责任人终审签字，确保最终文件的合规性与准确性',
    default: false,
  },
]

function HITLSection({ values, onChange }) {
  return (
    <SectionCard
      title="人机协同策略"
      badge="Human-in-the-Loop"
      subtitle="配置系统在何种情况下需要人工介入"
    >
      <div className="space-y-4">
        {HITL_ITEMS.map(item => (
          <div
            key={item.id}
            className={[
              'flex items-start gap-4 rounded-xl border p-4 transition-colors',
              values[item.id] ? 'border-blue-100 bg-blue-50/30' : 'border-slate-100 bg-slate-50/30',
            ].join(' ')}
          >
            <Toggle
              checked={values[item.id]}
              onChange={v => onChange(item.id, v)}
            />
            <div className="flex-1">
              <div className={`text-[13.5px] font-semibold ${values[item.id] ? 'text-slate-900' : 'text-slate-600'}`}>
                {item.label}
              </div>
              <p className="mt-0.5 text-[12px] text-slate-500">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

// ─── Left sidebar ─────────────────────────────────────────────────────────────
function Sidebar({ active, onSelect }) {
  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-slate-100 bg-white">
      <nav className="flex-1 space-y-1 p-3">
        {NAV.map(({ id, Icon, label, sub }) => {
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
              <div>
                <div className={`text-[13px] font-medium ${isActive ? 'text-blue-700' : 'text-slate-700'}`}>{label}</div>
                <div className="mt-0.5 text-[11px] text-slate-400">{sub}</div>
              </div>
            </button>
          )
        })}
      </nav>

      {/* Environment info */}
      <div className="border-t border-slate-100 p-4">
        <div className="mb-2 text-[12px] font-semibold text-slate-500">当前环境</div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-[12px]">
          <div className="flex items-center gap-1.5 font-semibold text-emerald-600">
            <span className="size-2 rounded-full bg-emerald-500" />
            生产环境 (Production)
          </div>
          <div className="mt-2 space-y-1 text-slate-400">
            <div>版本：<span className="text-slate-600">v1.2.0</span></div>
            <div>最后更新：<span className="text-slate-600">2024-11-03 10:24</span></div>
          </div>
        </div>
      </div>
    </aside>
  )
}

// ─── Security section ─────────────────────────────────────────────────────────
const ROLES = [
  { id: 'admin',    name: '超级管理员', desc: '可访问所有模块，修改系统设置，管理用户权限', count: 2,  color: '#EF4444', badge: 'bg-red-50 text-red-600'    },
  { id: 'director', name: '设备科主任', desc: '可查看全部项目，审批合规核验，导出立项报告',   count: 4,  color: '#3B82F6', badge: 'bg-blue-50 text-blue-600'  },
  { id: 'operator', name: '立项专员',   desc: '可上传材料，发起新项目，查看自己负责的立项',   count: 12, color: '#10B981', badge: 'bg-emerald-50 text-emerald-600' },
  { id: 'viewer',   name: '只读观察员', desc: '仅可浏览项目进度与报告，不可执行任何操作',      count: 5,  color: '#8B5CF6', badge: 'bg-violet-50 text-violet-600'  },
]

const IP_RULES = [
  { id: 'r1', name: '院内网段', cidr: '192.168.10.0/24', roles: '全角色', status: '启用', statusCls: 'bg-emerald-50 text-emerald-600' },
  { id: 'r2', name: '申康专线', cidr: '10.100.0.0/16',   roles: '超级管理员 / 主任', status: '启用', statusCls: 'bg-emerald-50 text-emerald-600' },
  { id: 'r3', name: 'VPN 网段', cidr: '172.16.0.0/12',  roles: '立项专员',    status: '停用', statusCls: 'bg-slate-100 text-slate-500' },
]

function SecuritySection() {
  const [mfaEnabled, setMfaEnabled] = useState(true)
  const [auditLog,   setAuditLog]   = useState(true)

  return (
    <div className="space-y-5">

      {/* Role matrix */}
      <SectionCard
        title="1. 角色权限矩阵"
        badge="RBAC"
        subtitle="系统角色与功能访问权限配置"
      >
        <div className="grid grid-cols-2 gap-3">
          {ROLES.map(role => (
            <div key={role.id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCircle2 className="size-4 text-slate-400" strokeWidth={1.75} style={{ color: role.color }} />
                  <span className="text-[13.5px] font-semibold text-slate-800">{role.name}</span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${role.badge}`}>
                  {role.count} 人
                </span>
              </div>
              <p className="text-[12px] leading-relaxed text-slate-500">{role.desc}</p>
              <button type="button" className="mt-2 flex items-center gap-1 text-[12px] font-medium text-blue-500 hover:text-blue-600">
                管理成员 <ChevronRight className="size-3.5" strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* IP allowlist */}
      <SectionCard
        title="2. 网络访问控制"
        badge="IP 白名单"
        subtitle="限制系统只能从指定 IP 网段访问"
      >
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="pb-2 text-left text-[11.5px] font-medium text-slate-400">规则名称</th>
              <th className="pb-2 text-left text-[11.5px] font-medium text-slate-400">IP 网段</th>
              <th className="pb-2 text-left text-[11.5px] font-medium text-slate-400">适用角色</th>
              <th className="pb-2 text-left text-[11.5px] font-medium text-slate-400">状态</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {IP_RULES.map(rule => (
              <tr key={rule.id} className="hover:bg-slate-50/50">
                <td className="py-3 pr-4 text-[13px] font-medium text-slate-800">{rule.name}</td>
                <td className="py-3 pr-4 font-mono text-[12.5px] text-slate-600">{rule.cidr}</td>
                <td className="py-3 pr-4 text-[12.5px] text-slate-600">{rule.roles}</td>
                <td className="py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${rule.statusCls}`}>
                    {rule.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" className="mt-4 flex items-center gap-1.5 text-[12.5px] font-medium text-blue-500 hover:text-blue-600">
          <Shield className="size-3.5" strokeWidth={2} /> 添加新规则
        </button>
      </SectionCard>

      {/* Auth & audit */}
      <SectionCard
        title="3. 认证与审计"
        badge="安全策略"
        subtitle="多因素认证与操作审计日志"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-4 rounded-xl border border-slate-100 bg-slate-50/30 p-4">
            <Toggle checked={mfaEnabled} onChange={setMfaEnabled} />
            <div>
              <div className="text-[13.5px] font-semibold text-slate-900">启用多因素认证（MFA）</div>
              <p className="mt-0.5 text-[12px] text-slate-500">
                登录时需验证手机短信验证码，适用于超级管理员和设备科主任角色
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4 rounded-xl border border-slate-100 bg-slate-50/30 p-4">
            <Toggle checked={auditLog} onChange={setAuditLog} />
            <div>
              <div className="text-[13.5px] font-semibold text-slate-900">开启完整操作审计日志</div>
              <p className="mt-0.5 text-[12px] text-slate-500">
                记录所有用户的登录、上传、审批等操作，保留 180 天，可导出 CSV
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50/40 px-4 py-3 text-[12px] text-amber-700">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" strokeWidth={1.75} />
            关闭审计日志可能影响等保合规性，建议保持开启状态
          </div>
        </div>
      </SectionCard>

    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function SettingsView() {
  const [activeNav, setActiveNav]   = useState('ai')
  const [mineruMode, setMineruMode] = useState('saas')
  const [depreciation, setDep]      = useState(8)
  const [maintenance,  setMaint]    = useState(8)
  const [discount,     setDisc]     = useState(5)
  const [hitl, setHitl] = useState(
    Object.fromEntries(HITL_ITEMS.map(i => [i.id, i.default]))
  )
  const [saved, setSaved] = useState(false)

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // Each nav entry: { id, Icon, label, sub, pageTitle, pageDesc, pageIcon, pageIconBg }
  const PAGE_META = {
    ai:       { title: 'AI 底座配置',  desc: '配置系统底层 AI 引擎与文档解析服务',    Icon: Database,    iconBg: 'bg-blue-50',    iconCls: 'text-blue-500'   },
    calc:     { title: '测算规则引擎', desc: '设置财务测算 Agent 的全局默认基线参数',  Icon: Calculator,  iconBg: 'bg-orange-50',  iconCls: 'text-orange-500' },
    hitl:     { title: '人机协同策略', desc: '配置哪些情况需要人工干预，防止幻觉传导', Icon: Users2,      iconBg: 'bg-violet-50',  iconCls: 'text-violet-500' },
    security: { title: '权限与安全',   desc: '角色权限矩阵、IP 白名单与操作审计',      Icon: ShieldCheck, iconBg: 'bg-emerald-50', iconCls: 'text-emerald-500'},
  }

  const hasSaveButton = activeNav === 'ai' || activeNav === 'calc' || activeNav === 'hitl'
  const meta = PAGE_META[activeNav] ?? PAGE_META.ai

  return (
    <div className="flex flex-1 overflow-hidden">
      <Sidebar active={activeNav} onSelect={setActiveNav} />

      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Breadcrumb + save button */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-white px-8 py-3">
          <div className="flex items-center gap-2 text-[13px] text-slate-500">
            <span>系统设置</span>
            <ChevronRight className="size-3.5 text-slate-300" />
            <span className="font-medium text-slate-800">
              {NAV.find(n => n.id === activeNav)?.label}
            </span>
          </div>
          {hasSaveButton && (
            <button
              type="button"
              onClick={handleSave}
              className={[
                'flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition-all',
                saved ? 'bg-emerald-500' : 'bg-blue-500 hover:bg-blue-600 shadow-sm shadow-blue-500/30',
              ].join(' ')}
            >
              {saved
                ? <><CheckCircle2 className="size-4" strokeWidth={2} /> 已保存</>
                : <><Save className="size-4" strokeWidth={2} /> 保存配置</>
              }
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {/* Page title */}
          <div className="mb-6 flex items-center gap-3">
            <div className={`flex size-10 items-center justify-center rounded-xl ${meta.iconBg}`}>
              <meta.Icon className={`size-5 ${meta.iconCls}`} strokeWidth={1.75} />
            </div>
            <div>
              <h1 className="text-[18px] font-bold text-slate-900">{meta.title}</h1>
              <p className="text-[12.5px] text-slate-400">{meta.desc}</p>
            </div>
          </div>

          {/* Tab content */}
          {activeNav === 'ai' && (
            <div className="space-y-5">
              <MinerUSection mode={mineruMode} onMode={setMineruMode} />
              <LLMSection />
            </div>
          )}
          {activeNav === 'calc' && (
            <CalcSection
              depreciation={depreciation} onDep={setDep}
              maintenance={maintenance}   onMaint={setMaint}
              discount={discount}         onDisc={setDisc}
            />
          )}
          {activeNav === 'hitl' && (
            <HITLSection
              values={hitl}
              onChange={(id, v) => setHitl(prev => ({ ...prev, [id]: v }))}
            />
          )}
          {activeNav === 'security' && (
            <SecuritySection />
          )}
        </div>
      </div>
    </div>
  )
}
