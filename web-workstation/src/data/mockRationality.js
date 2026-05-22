/**
 * mockRationality.js
 * 申康 MRI 采购合理性判定 Mock 数据 — 对应 rationality_result JSON schema
 *
 * 每条数据对应一家具体医院的立项场景，数值基于：
 *   2025年四季度上海市级医院综合绩效简报（总第71期）MR 品类基准
 *
 * 市均基准（MR）：
 *   日台均     49.64次   综合医院中位数 52.50次
 *   工作饱和度 78.84%   综合医院中位数 83.32%
 *   候检时间   4.70天（收费→检查）/ 5.50天（总）
 *   成新率     44.34%
 *
 * 阈值：
 *   饱和度绿灯 ≥90%  黄灯 ≥85%
 *   候检绿灯   >7天  黄灯 >5.5天
 *   阳性率红灯 <60%  黄灯 <70%
 *   更新豁免   成新率 ≤30%
 */

// ── p3 31****0318：三维全达标，典型新增场景 ───────────────────────────────────
export const MOCK_RATIONALITY_PASS = {
  verdict: 'pass',
  renewal_exemption: false,
  dimensions: {
    workload: {
      score: 'green',
      hospital_daily_volume: 58.9,
      hospital_saturation: 93.2,
      hospital_work_hours: 12.4,
      city_avg_daily_volume: 49.64,
      city_avg_saturation: 78.84,
      threshold_saturation_green: 90.0,
      threshold_saturation_yellow: 85.0,
      note: '工作饱和度 93.2%，超绿灯阈值 90%；日台均 58.9次，高于市均 49.64次及综合医院中位数 52.50次',
    },
    waiting_time: {
      score: 'green',
      hospital_waiting_days: 8.5,
      city_avg_waiting_days: 4.70,
      city_avg_waiting_total: 5.50,
      threshold_green_days: 7.0,
      threshold_yellow_days: 5.5,
      note: '候检时间 8.5天（收费→检查），超绿灯阈值 7天，为市均 4.70天的 1.8倍',
    },
    positive_rate: {
      score: 'green',
      hospital_positive_rate: 0.78,
      city_avg_not_available: true,
      threshold_red: 0.60,
      threshold_yellow: 0.70,
      data_available: true,
      note: '检查阳性率 78.0%，高于黄灯阈值 70%，检查指征合理，无过度检查风险',
    },
    device_age: {
      score: 'red',
      hospital_chengxin_rate: 55.2,
      city_avg_chengxin_rate: 44.34,
      exemption_threshold: 30.0,
      exemption_triggered: false,
      note: '成新率 55.2%，高于市均 44.34%，设备相对较新；属新增场景，成新率不触发豁免（仅供参考）',
    },
  },
  blocking_reason: '',
  recommendation:
    '31****0318放射科工作负荷饱和（93.2%）、候检时间显著超标（8.5天），MRI 新增合理性充分。建议立项文书重点量化：增机后每年可消化的积压检查量，及候检天数改善预期（目标压缩至 ≤5天）。',
  benchmark_source: '2025年四季度上海市级医院综合绩效简报（总第71期）',
}

// ── p2/p4 31****0263/31****0429：运营数据缺失，条件通过 ──────────────────────────
export const MOCK_RATIONALITY_CONDITIONAL = {
  verdict: 'conditional',
  renewal_exemption: false,
  dimensions: {
    workload: {
      score: 'yellow',
      hospital_daily_volume: 50.7,
      hospital_saturation: 80.3,
      hospital_work_hours: 11.2,
      city_avg_daily_volume: 49.64,
      city_avg_saturation: 78.84,
      threshold_saturation_green: 90.0,
      threshold_saturation_yellow: 85.0,
      note: '工作饱和度 80.3%，高于市均 78.84% 但低于绿灯阈值 90%，属黄灯区间',
    },
    waiting_time: {
      score: 'yellow',
      hospital_waiting_days: 6.2,
      city_avg_waiting_days: 4.70,
      city_avg_waiting_total: 5.50,
      threshold_green_days: 7.0,
      threshold_yellow_days: 5.5,
      note: '候检时间 6.2天，高于市均 4.70天，但低于绿灯阈值 7天，属黄灯区间',
    },
    positive_rate: {
      score: 'unknown',
      hospital_positive_rate: null,
      city_avg_not_available: true,
      threshold_red: 0.60,
      threshold_yellow: 0.70,
      data_available: false,
      note: '阳性率数据缺失，需院方从 HIS 系统提取近 12 个月大型设备检查数据',
    },
    device_age: {
      score: 'unknown',
      hospital_chengxin_rate: null,
      city_avg_chengxin_rate: 44.34,
      exemption_threshold: 30.0,
      exemption_triggered: false,
      note: '成新率数据缺失，无法判断是否触发更新豁免，请补充固定资产折旧报表',
    },
  },
  blocking_reason: '',
  recommendation:
    '工作负荷与候检时间均处黄灯区间，具备一定合理性；但阳性率与成新率数据缺失，无法完整判定。请在 5 个工作日内补充：(1) HIS 导出近 12 个月 MRI 检查阳性率；(2) 固定资产管理系统中现有 MRI 设备成新率。',
  benchmark_source: '2025年四季度上海市级医院综合绩效简报（总第71期）',
}

// ── p6 31****0651：阳性率过低，合理性判定暂缓 ─────────────────────────────────
export const MOCK_RATIONALITY_REJECT = {
  verdict: 'reject',
  renewal_exemption: false,
  dimensions: {
    workload: {
      score: 'green',
      hospital_daily_volume: 55.6,
      hospital_saturation: 88.5,
      hospital_work_hours: 12.1,
      city_avg_daily_volume: 49.64,
      city_avg_saturation: 78.84,
      threshold_saturation_green: 90.0,
      threshold_saturation_yellow: 85.0,
      note: '工作饱和度 88.5%，高于市均 78.84%，接近绿灯阈值 90%',
    },
    waiting_time: {
      score: 'green',
      hospital_waiting_days: 9.1,
      city_avg_waiting_days: 4.70,
      city_avg_waiting_total: 5.50,
      threshold_green_days: 7.0,
      threshold_yellow_days: 5.5,
      note: '候检时间 9.1天，远超绿灯阈值 7天，为市均 4.70天的近 2倍',
    },
    positive_rate: {
      score: 'red',
      hospital_positive_rate: 0.52,
      city_avg_not_available: true,
      threshold_red: 0.60,
      threshold_yellow: 0.70,
      data_available: true,
      note: '检查阳性率 52.0%，低于红灯阈值 60%，存在过度检查、开单不合理问题',
    },
    device_age: {
      score: 'red',
      hospital_chengxin_rate: 62.1,
      city_avg_chengxin_rate: 44.34,
      exemption_threshold: 30.0,
      exemption_triggered: false,
      note: '成新率 62.1%，高于市均 44.34%，设备较新，不属更新替换场景',
    },
  },
  blocking_reason:
    '大型 MRI 设备检查阳性率过低（52.0% < 60%），存在过度检查、开单指征不严问题。申康绩效体系要求：阳性率不达标须先整改开单规范，再申报新增设备，否则增机只会扩大过度检查规模。',
  recommendation:
    '建议暂缓立项，整改方向：(1) 开展 MRI 检查适应症规范培训，明确开单权限；(2) 建立大型设备检查申请多级审批机制；(3) 整改满 6 个月且阳性率连续稳定在 ≥65% 后重新申报。',
  benchmark_source: '2025年四季度上海市级医院综合绩效简报（总第71期）',
}

// ── p1 31****0147：成新率 18.5% 触发更新豁免 ──────────────────────────────────
export const MOCK_RATIONALITY_EXEMPT = {
  verdict: 'exempt_renewal',
  renewal_exemption: true,
  dimensions: {
    workload: {
      score: 'red',
      hospital_daily_volume: 41.3,
      hospital_saturation: 72.1,
      hospital_work_hours: 9.4,
      city_avg_daily_volume: 49.64,
      city_avg_saturation: 78.84,
      threshold_saturation_green: 90.0,
      threshold_saturation_yellow: 85.0,
      note: '工作饱和度 72.1%，低于市均 78.84%；因更新豁免触发，此维度不参与否决',
    },
    waiting_time: {
      score: 'red',
      hospital_waiting_days: 3.5,
      city_avg_waiting_days: 4.70,
      city_avg_waiting_total: 5.50,
      threshold_green_days: 7.0,
      threshold_yellow_days: 5.5,
      note: '候检时间 3.5天，低于市均 4.70天；因更新豁免触发，此维度不参与否决',
    },
    positive_rate: {
      score: 'unknown',
      hospital_positive_rate: null,
      city_avg_not_available: true,
      threshold_red: 0.60,
      threshold_yellow: 0.70,
      data_available: false,
      note: '更新场景豁免，阳性率维度不参与判定',
    },
    device_age: {
      score: 'green',
      hospital_chengxin_rate: 18.5,
      city_avg_chengxin_rate: 44.34,
      exemption_threshold: 30.0,
      exemption_triggered: true,
      note: '成新率 18.5% ≤ 30%，触发更新场景豁免；设备已严重老化，立项类型应为设备更新而非新增',
    },
  },
  blocking_reason: '',
  recommendation:
    '31****0147放射科现有 MRI 成新率极低（18.5%），属设备更新替换场景，豁免工作负荷/候检/阳性率三项门槛。立项文书建议重点论述：① 设备老化故障率趋势与停机风险；② 近 3 年维修费用占购置价比；③ 老旧设备图像质量对临床诊断的影响。',
  benchmark_source: '2025年四季度上海市级医院综合绩效简报（总第71期）',
}

// 默认导出
export default MOCK_RATIONALITY_CONDITIONAL
