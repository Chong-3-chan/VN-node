import { useRef, useState, useEffect, useMemo } from "react";

export function useDTJ<T extends number | string>(...args: readonly [[defaultPhaseName: T, conditionCount: number], ...[phaseName: T, conditionCount: number][]])
  : [T, Record<T, ((value?: boolean) => boolean)[]>] {
  const phaseConfig = useRef(args)
  const [phaseOrder, setPhaseOrder] = useState(0)
  const [condition, setCondition] = useState(() => Object.fromEntries<boolean[]>(phaseConfig.current.map(([phaseName, conditionCount]) => [phaseName, Array(conditionCount).fill(false)])))
  useEffect(() => {
    let nextOrder = phaseOrder;
    while (nextOrder + 1 < phaseConfig.current.length && !condition[phaseConfig.current[nextOrder][0]].some(e => !e)) ++nextOrder;
    nextOrder !== phaseOrder && setPhaseOrder(nextOrder)
  }, [condition])
  const re = useMemo(() => {
    return Object.fromEntries(
      Object.entries<boolean[]>(condition).map(([phaseName, phaseConditions]) => {
        return [phaseName, phaseConditions.map((e, i) => {
          return ((value?: boolean) => {
            if (value === undefined) return phaseConditions[i]
            phaseConditions[i] = value
            setCondition({ ...condition })
            return phaseConditions[i]
          })
        })]
      })
    )
  }, [])
  return [phaseConfig.current[phaseOrder][0], re as Record<T, ((value?: boolean) => boolean)[]>]
}