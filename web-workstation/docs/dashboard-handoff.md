# MriAgent 工作台 (Dashboard) — 交接文档

> 本文档面向接手开发的 AI 助手（Cursor / Claude / Copilot）与人类工程师。
> 它描述了 `src/pages/Dashboard/` 下"工作台"页面的设计意图、约束、结构与扩展点。
> **阅读顺序建议：** 1 → 2 → 3 → 4 → 5 → 6。

---

## 1. 背景与目标

我们正在开发 **MriAgent 医疗设备立项数据智能体** 的前端工作站（web-workstation）。
项目原有 `MaterialFlow`（暗色主题"材料流转"页）已经存在，本次新增的是顶部导航中的 **"工作台" (Workbench)** 主页 —— 一个浅色、信息密度高的总览仪表盘。

设计稿来源：用户上传的 `统筹的设计稿v2.png`。
目标用户：医院设备科老师（示例用户：张若昕），负责医疗设备的立项论证流程。

业务核心：

- 一个项目（如 *3.0T磁共振置购项目*）会经历 7 个阶段 **A1 → A7**：
  需求梳理 → 竞品归并 → 预算测算 → 收益测算 → 合规核验 → 立项文书 → 审批反馈。
- 每个阶段由对应的 **Agent** 自动处理；遇到无法消解的冲突（如 430 vs 460 收费标准）才触发"人工裁决"。
- 用户上传 8 类异构材料（PDF / Excel / Word / 图片），Agent 自动解析、归并、生成立项建议书。

---

## 2. 技术栈与项目约定

- **React 19 + Vite 8 + TypeScript** —— 已配置 `@` 路径别名指向 `src/`。
- **Tailwind CSS v4** —— 通过 `@tailwindcss/vite` 插件接入，CSS 入口写 `@import "tailwindcss";`。
- **lucide-react** —— 全站图标库，统一用 `strokeWidth={1.75}` 让线条更细更现代。
- **新增的 Dashboard 模块全部用 `.jsx`**（非 TS）—— 与现有 `MaterialFlow` 的写法一致，避免类型样板。
  如需迁移为 TS，把 `props` 加上 interface 即可，组件 API 是稳定的。

启动：

```bash
npm install      # 如果还没装
npm run dev
```

浏览器访问：

- `http://localhost:5173/`          → **默认**：新增的 Dashboard 工作台（浅色）
- `http://localhost:5173/#material` → 原有的 MaterialFlow 页（暗色，保留参考用）

切换逻辑在 `src/main.tsx`：根据 `window.location.hash` 决定渲染 `Dashboard` 还是 `App`，
并监听 `hashchange` 自动 reload。Dashboard 是默认入口，旧页面只为参考保留。

---

## 3. 设计系统（严格约束）

接手开发时**不要自由发挥**，必须遵循以下视觉规范，否则会和现有页面风格脱节。

### 3.1 背景与卡片

| 用途         | Tailwind class                                  |
| ------------ | ----------------------------------------------- |
| 全局背景     | `bg-slate-50/60`                                |
| 卡片底       | `bg-white`                                      |
| 卡片边框     | `border border-slate-100`                       |
| 卡片阴影     | `shadow-sm`（hover 时可升级 `shadow-md`）       |
| 外层卡片圆角 | `rounded-2xl`                                   |
| 内层卡片圆角 | `rounded-xl`                                    |

### 3.2 语义色

| 角色         | 主色                            | 浅底（提示底色）     |
| ------------ | ------------------------------- | -------------------- |
| 品牌 / 行动  | `text-blue-600` / `bg-blue-600` | `bg-blue-50`         |
| 危险 / 冲突  | `text-red-500` / `bg-red-500`   | `bg-red-50`          |
| 成功 / 完成  | `text-emerald-500`              | `bg-emerald-50`      |
| 警示 / 中优先| `text-amber-500`                | `bg-amber-50`        |
| 中性辅助     | `text-violet-500`               | `bg-violet-50`       |

### 3.3 字号与字重

- 卡片标题：`text-[14px] font-semibold text-slate-900`
- 一级数值（KPI）：`text-[32px] font-bold tracking-tight`
- 正文：`text-[13px] text-slate-700`
- 次要说明 / 时间：`text-[11.5px] text-slate-400`
- 按钮：`text-[12px]` ~ `text-[13px]`，`font-medium`

### 3.4 动效约定

- **手风琴展开**：`grid-rows-[0fr|1fr]` 配合 `transition-[grid-template-rows]`，不用 max-height hack。
- **涟漪 / 脉冲**：用两层 `animate-ping` 错开 `animationDelay` 模拟（见 ActionCenter、ActivePipeline active node）。
- **悬停**：卡片可加 `hover:shadow-md`，列表项加 `hover:bg-slate-50`。

---

## 4. 文件结构

```
src/pages/Dashboard/
├── Dashboard.jsx          ← 主页面：唯一持有可变状态
├── index.jsx              ← 仅 re-export，便于 import 路径短一点
├── mockData.js            ← 所有文案 / 数字 / 图标都集中在这里
└── components/
    ├── Header.jsx              顶栏：Logo + 主导航 tabs + 通知 + 用户
    ├── StageIndicator.jsx      A1 → A7 阶段胶囊条 + 项目选择器
    ├── LeftSidebar.jsx         "标准资料清单" 手风琴 + 一键导出
    ├── CenterPanel.jsx         中间列容器（仅组合）
    │   ├── QuickMetrics.jsx        3 张 KPI 卡 + 内嵌 sparkline (SVG)
    │   ├── ActionCenter.jsx        大蓝色 + 按钮（涟漪）+ 拖拽上传区
    │   └── ActivePipeline.jsx      7 节点横向 stepper + 进度条 + ETA
    ├── RightSidebar.jsx        右侧列容器（仅组合）
    │   ├── SmartToDo.jsx           红色冲突 + 蓝色终审 待办卡
    │   └── RecentDynamics.jsx      近期项目动态时间线
    └── ModuleOverview.jsx      底部"模块内容总览" 6 宫格
```

---

## 5. 状态与数据流

### 5.1 状态归属

整个 Dashboard 子树**只有一个 stateful 组件**：`Dashboard.jsx`。

```js
const [activeTab, setActiveTab] = useState('workbench') // 顶部导航选中
const [todos, setTodos]         = useState(SMART_TODOS) // 智能待办列表
```

所有其它组件都是纯 props 受控的，便于：

- 替换 Mock 为 API 数据（只改 `Dashboard.jsx` 一个文件）
- 在 Storybook / 单元测试里独立渲染
- 给 Cursor / AI agent 局部修改

### 5.2 现有交互

| 行为                  | 触发                            | 当前实现                                   |
| --------------------- | ------------------------------- | ------------------------------------------ |
| 切换顶部 tab          | `Header → onTabChange`          | 仅高亮，不路由（待接入 React Router）      |
| 处理待办              | `SmartToDo → onAction(todo)`    | 乐观地从列表移除                           |
| 上传文件              | `ActionCenter → onSelectFiles`  | `console.log` 占位                         |
| 展开/收起资料清单     | `LeftSidebar` 内部状态          | 完成；记忆每个分类的开合                   |

### 5.3 接入真实数据的推荐路径

1. **新建 hooks**：`src/pages/Dashboard/hooks/`
   - `useDashboardSnapshot()` —— 一次性拉所有模块数据，返回与 `mockData.js` 同形状的对象。
   - `useSmartTodos()` —— SWR / React Query 风格，支持 `resolve(todoId)` mutation。
2. **`Dashboard.jsx` 替换**：把 `import { … } from './mockData'` 改成 `const data = useDashboardSnapshot()`，
   其它子组件 props **不需要改**。
3. **Loading / Error**：在 `Dashboard.jsx` 顶部统一处理；子组件保持 dumb。

### 5.4 Mock 数据规约

`mockData.js` 导出的所有常量都是 **可序列化** 的（除了 lucide icon 组件本身）。
后端真实接口设计时，建议：

- 图标用语义字符串（`"Stethoscope"`, `"Building2"`），前端再做一次映射。
- 时间用 ISO 8601，前端在渲染层格式化为"今天 10:30 / 昨天 16:45 / 06-22 11:30"。
- 状态枚举固定为：`'done' | 'active' | 'pending'`（已用在 `PROJECT_STAGES` 和 `PIPELINE_AGENTS`）。

---

## 6. 各组件 Props 速查

### Header

```ts
{
  navTabs: { key: string; label: string }[]
  activeTab: string
  onTabChange: (key: string) => void
  user: { name: string; role: string; notificationCount: number }
}
```

### StageIndicator

```ts
{
  project: { name: string }
  stages: { id: 'A1'..'A7'; label: string; status: 'done' | 'active' | 'pending' }[]
}
```

### LeftSidebar

```ts
{
  categories: {
    id: string
    index: number
    title: string
    icon: LucideIcon
    completed: number
    total: number
    defaultOpen: boolean
    items: { id: string; label: string; icon: LucideIcon; status: 'uploaded' | 'pending' }[]
  }[]
  total: { completed: number; total: number }
}
```

### QuickMetrics

```ts
{
  metrics: {
    id: string
    label: string
    value: string
    unit: string
    icon: LucideIcon
    tone: 'blue' | 'emerald' | 'violet'
    deltaLabel: string
    deltaValue: string
    deltaDirection: 'up' | 'down' | 'neutral'
    trend: number[]   // 任意长度，至少 2 个点
  }[]
}
```

### ActionCenter

```ts
{
  onSelectFiles?: (files: File[]) => void
}
```

### ActivePipeline

```ts
{
  task: {
    title: string
    description: string
    completedSteps: number
    totalSteps: number
    etaMinutes: number
  }
  steps: { id: number; label: string; agent: string; status: 'done' | 'active' | 'pending' }[]
}
```

### SmartToDo

```ts
{
  todos: {
    id: string
    severity: 'danger' | 'info'
    priorityLabel: string
    title: string
    summary: string
    detail: string
    actionLabel: string
  }[]
  onAction?: (todo) => void
}
```

### RecentDynamics

```ts
{
  items: {
    id: number | string
    project: string
    stage: string
    time: string
    tone: 'emerald' | 'red' | 'amber' | 'blue' | 'slate'
  }[]
}
```

### ModuleOverview

```ts
{
  modules: {
    id: string
    title: string
    icon: LucideIcon
    lines: string[]
  }[]
}
```

---

## 7. 已知 TODO / 可继续做的事

按优先级排列，方便 Cursor 接力：

1. **真实路由**：当前 `activeTab` 只切高亮。建议接 `react-router-dom`，让每个 tab 对应独立 page。
2. **API 接入**：参照 5.3，把 `mockData.js` 替换为 hooks。
3. **冲突裁决弹窗**：点击"立即处理"目前只是从待办列表移除，应该打开一个 drawer / dialog 展示
   `430 vs 460` 的证据链，复用现有 `src/components/EvidencePanel.jsx`。
4. **上传服务接线**：`ActionCenter.onSelectFiles` 目前是 `console.log`，需要：
   - 调用后端预签名 URL → 直传 OSS
   - 上传中显示进度条（建议在 ActionCenter 内部用一个 `uploads: File[]` 局部 state）
   - 上传完成后刷新 LeftSidebar 的清单
5. **响应式**：当前布局针对 ≥1440px 桌面。小于 1280px 时三栏会挤，建议 LeftSidebar 在窄屏折叠成抽屉。
6. **国际化**：所有中文文案集中在 `mockData.js`，未来抽 i18n 时只需要替换这一个文件。
7. **a11y**：手风琴可加 `aria-expanded`，待办按钮可加 `aria-label`。

---

## 8. 给 Cursor 的提示词模板

如果你打开 Cursor 想继续在这套设计上加功能，可以这样提示：

> 我在 `src/pages/Dashboard/` 下有一个浅色主题的工作台页面，
> 设计系统约束、组件 props 已经在 `docs/dashboard-handoff.md` 中描述。
> 请遵守该文档的视觉规范（圆角、阴影、语义色），不要引入新的色板。
> 现在我想 **<具体需求>**：
> - …

或者更具体一点：

> 参考 `docs/dashboard-handoff.md` 第 3 节的设计系统和第 6 节的组件 API。
> 在 `RightSidebar` 上面再加一个名为 `RiskAlerts` 的卡片，展示风险等级、风险数量、最近 1 条风险摘要，
> 视觉风格与 `SmartToDo` 一致但不要重复红色告警感。

---

## 9. 联系上下文（本次会话沉淀）

- 用户：tina （vsi.tinajin@gmail.com）
- 工作目录：`/Users/tina/Desktop/MriAgent/web-workstation`
- 设计稿：`统筹的设计稿v2.png`（用户上传，未提交到仓库）
- 本次新增文件清单：见 §4
- 唯一对原有代码的修改：`src/main.tsx` 加了 hash 路由开关（无损切换 Dashboard / MaterialFlow）
