declare module '@/pages/MaterialFlow' {
  import type { EvidenceTrace, MockSnapshot, UiMetricRow } from '@/data/mockSnapshot'
  import type { ReactElement } from 'react'

  export interface MaterialFlowProps {
    snapshot: MockSnapshot
    rows: UiMetricRow[]
    displayValues: Record<string, string>
    chargeResolved: boolean
    onConfirm460: () => void
    humanLoop: 'confirmed' | 'pending'
    onHumanLoopChange: (v: 'confirmed' | 'pending') => void
    traceOverrides: Record<string, EvidenceTrace>
    evidenceBase: Record<string, EvidenceTrace | undefined>
  }

  export function MaterialFlow(props: MaterialFlowProps): ReactElement
  export default MaterialFlow
}
