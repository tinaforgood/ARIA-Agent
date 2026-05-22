/**
 * 将后端 project_snapshot.json 适配为工作台 UI 所使用的 MockSnapshot 形态。
 */

import type {
  ConflictableFieldLike,
  InitialMetricKey,
  MetricUiStatus,
  MockSnapshot,
} from '@/data/mockSnapshot'
import { mock_snapshot } from '@/data/mockSnapshot'

export const SNAPSHOT_API_URL =
  import.meta.env.VITE_SNAPSHOT_API_URL ?? 'http://localhost:8000/api/snapshot'

function cloneBase(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(mock_snapshot)) as Record<string, unknown>
}

function isConflictableField(x: unknown): x is Record<string, unknown> {
  return (
    !!x &&
    typeof x === 'object' &&
    (x as { _type?: string })._type === 'ConflictableField'
  )
}

/** 后端 ConflictableField → 前端结构 */
export function normalizeConflictableField(
  raw: Record<string, unknown>,
): ConflictableFieldLike {
  const vals = raw.all_values
  return {
    _type: 'ConflictableField',
    value: String(raw.value ?? ''),
    origin_type: (raw.origin_type === 'agent_corpus'
      ? 'agent_corpus'
      : 'user_upload') as ConflictableFieldLike['origin_type'],
    source_file: String(raw.source_file ?? ''),
    doc_category: String(raw.doc_category ?? ''),
    conflict: Boolean(raw.conflict),
    all_values: Array.isArray(vals)
      ? (vals as Record<string, unknown>[]).map((e) => ({
          value: String(e.value ?? ''),
          origin_type:
            e.origin_type === 'agent_corpus' ? 'agent_corpus' : 'user_upload',
          source_file: String(e.source_file ?? ''),
          doc_category: String(e.doc_category ?? ''),
        }))
      : [],
  }
}

function pickCf(obj: unknown, key: string): ConflictableFieldLike | undefined {
  if (!obj || typeof obj !== 'object') return undefined
  const v = (obj as Record<string, unknown>)[key]
  if (!isConflictableField(v)) return undefined
  return normalizeConflictableField(v)
}

/** 月收入「1500人次/月」→ 表格数字列 「1500」 */
function monthlyVolumeDisplay(cf: ConflictableFieldLike): string {
  const m = cf.value.match(/[\d,.]+/)
  return m ? m[0].replace(/,/g, '') : cf.value.replace(/\D+/g, '') || cf.value
}

/** 粗略从 Conflictable 展示收费：带 ¥ 前缀 */
function chargeDisplay(cf: ConflictableFieldLike): string {
  const v = cf.value.trim()
  if (/^[¥￥]/.test(v)) return v
  const n = v.match(/[\d.]+/)
  return n ? `¥${n[0]}/次` : `¥${v}`
}

/** 首条有价竞品 → 采购成本展示 */
function firstCompetitorPrice(
  list: unknown,
): ConflictableFieldLike | undefined {
  if (!Array.isArray(list)) return undefined
  for (const e of list) {
    if (!e || typeof e !== 'object') continue
    const price = (e as { price?: unknown }).price
    if (price == null || price === '') continue
    const p = String(price)
    return {
      _type: 'ConflictableField',
      value: p.includes('万') ? `¥ ${p}` : `¥ ${p}`,
      origin_type:
        (e as { origin_type?: string }).origin_type === 'user_upload'
          ? 'user_upload'
          : 'agent_corpus',
      source_file: String((e as { source?: unknown }).source ?? ''),
      doc_category: 'b_competitors',
      conflict: false,
      all_values: [],
    }
  }
  return undefined
}

function patchMetricRows(
  rows: Record<string, unknown>[],
  initial: Record<string, unknown>,
): void {
  for (const row of rows) {
    const sk = row.source_key as InitialMetricKey | null
    if (!sk || !(sk in initial)) continue
    const cf = initial[sk] as ConflictableFieldLike | undefined
    if (!cf || cf._type !== 'ConflictableField') continue
    if (sk === 'charge_per_exam') {
      row.ui_status = cf.conflict
        ? 'conflict'
        : ('verified' as MetricUiStatus)
      if (!cf.conflict) row.note_key = null
      else row.note_key = 'metric_notes.conflict_hint'
    }
  }

  const costCf = initial.equipment_purchase_cost as
    | ConflictableFieldLike
    | undefined
  if (costCf?.value) {
    const rc = rows.find((x) => x.id === 'row_cost')
    if (rc) rc.ui_status = 'verified'
  }
}

/**
 * @param api — GET /api/snapshot 返回的 JSON
 * @returns 与 mock_snapshot 同形的运行时可变对象（供 hydrateMetricRows）
 */
export function adaptProjectSnapshot(api: unknown): MockSnapshot {
  const base = cloneBase()
  const initial = base.initial_metrics as Record<string, unknown>
  const rows = base.metric_rows as Record<string, unknown>[]
  const strings = base.strings as Record<string, unknown>

  if (!api || typeof api !== 'object') return base as unknown as MockSnapshot

  const root = api as Record<string, unknown>
  const kp = root.key_params as Record<string, unknown> | undefined
  const rp = kp?.revenue_params as Record<string, unknown> | undefined

  if (typeof root.generated_at === 'string') {
    const md = base.meta_display as Record<string, unknown>
    md.generated_at = root.generated_at
  }
  if (typeof root.parser_mode === 'string') {
    ;(base.meta as Record<string, unknown>).parser_mode = root.parser_mode
  }

  const device = pickCf(kp, 'device_name')
  if (device?.value) {
    strings.project_selector_value = device.value
  }

  const charge = rp ? pickCf(rp, 'charge_per_exam') : undefined
  if (charge) initial.charge_per_exam = charge

  const monthly = rp ? pickCf(rp, 'monthly_volume') : undefined
  if (monthly) initial.monthly_exam_volume = monthly

  const compPrice = kp ? firstCompetitorPrice(kp.competitor_list) : undefined
  if (compPrice) initial.equipment_purchase_cost = compPrice

  /* 简易 display_values — 后端未给的键保留克隆里的默认 */
  const dv = base.display_values as Record<string, string>

  const ch = initial.charge_per_exam as ConflictableFieldLike | undefined
  if (ch) dv.charge_per_exam = chargeDisplay(ch)

  const mv = initial.monthly_exam_volume as ConflictableFieldLike | undefined
  if (mv) dv.monthly_exam_volume = monthlyVolumeDisplay(mv)

  const ep = initial.equipment_purchase_cost as
    | ConflictableFieldLike
    | undefined
  if (ep) dv.equipment_purchase_cost = ep.value

  patchMetricRows(rows, initial)

  return base as unknown as MockSnapshot
}
