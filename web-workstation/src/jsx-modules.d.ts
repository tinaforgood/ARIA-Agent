declare module '*.jsx' {
  import type { JSX } from 'react'

  /** 默认导出 React 组件（占位类型，便于混编 .tsx 与 .jsx）。 */
  const Component: (...args: unknown[]) => JSX.Element
  export default Component
}
