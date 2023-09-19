import { useState, type FC, useEffect, useCallback, useRef, useMemo } from 'react'
import './LoadingP.less'
import { fileRecord, homeResource, packageRecord } from '../data/data'
import { useDTJ } from '../worker/hooks'

enum LoadingPPhase { in = 0, loading = 1, out = 2, done = 3 }
enum LoadingPhase { waiting = 0, loading = 1, done = 2 }
type LoadingProgress = { loadedList: string[], needList: readonly string[], currentLoadedPercentage: number }
const defaultLoadingProgess: LoadingProgress = { loadedList: [], needList: [], currentLoadedPercentage: 0 }
interface LoadingResult {
    phase: LoadingPhase,
    progress: LoadingProgress,
    start: () => void
}
function useLoadingResult(loadList: string[]): LoadingResult {
    const loadListRef = useRef(loadList)
    const [phase, {
        [LoadingPhase.waiting]: [start],
        [LoadingPhase.loading]: [loaded],
        [LoadingPhase.done]: []
    }] = useDTJ<LoadingPhase>(
        [LoadingPhase.waiting, 1],
        [LoadingPhase.loading, 1],
        [LoadingPhase.done, 0],
    )
    const [progress, setProgress]: [LoadingProgress, React.Dispatch<React.SetStateAction<LoadingProgress>>] = useState(defaultLoadingProgess)
    useEffect(() => {
        const todoMap: Record<LoadingPhase, (() => void) | null> = {
            [LoadingPhase.waiting]: null,
            [LoadingPhase.loading]: () => {
                (() => {
                    const progressUpdateDelay = 200 as const // 进度刷新间隔
                    const needPackageKeys: readonly string[] = Array.from(new Set(loadListRef.current.map(fileKey => fileRecord[fileKey]?.fromPackage).filter(e => e)))
                    console.warn('need', needPackageKeys)
                    const loadedList: string[] = [];
                    const progress: LoadingProgress = {
                        loadedList: loadedList,
                        needList: needPackageKeys,
                        currentLoadedPercentage: 0
                    }
                    const updateProgress = () => { setProgress({ ...progress }) }
                    let progressUpdateInterval = window.setInterval(() => {
                        updateProgress()
                    }, progressUpdateDelay)
                    return (needPackageKeys.map((packageKey) => {
                        return () => packageRecord[packageKey].load({
                            ready: () => {
                                progress.currentLoadedPercentage = 0
                                updateProgress()
                                window.clearInterval(progressUpdateInterval)
                                progressUpdateInterval = window.setInterval(() => {
                                    updateProgress()
                                }, progressUpdateDelay)
                            },
                            downloading: (msg) => {
                                const { downloadTotal, downloaded } = msg as { downloadTotal: number | null, downloaded: number }
                                if (downloadTotal === null)
                                    progress.currentLoadedPercentage = 0
                                else
                                    progress.currentLoadedPercentage = Math.floor(downloaded * 100 / downloadTotal)
                            },
                            done: () => {
                                progress.currentLoadedPercentage = 100
                                loadedList.push(packageKey)
                                updateProgress()
                            }
                        })
                    }).reduce((lastPromise, nextLoad) => {
                        return lastPromise.then(() => nextLoad())
                    }, Promise.resolve()))
                        .then((data) => {
                            progress.loadedList = Array.from(needPackageKeys)
                            progress.currentLoadedPercentage = 100
                            updateProgress()
                            window.clearInterval(progressUpdateInterval)
                            return data
                        })
                })().then(() => loaded(true))
            },
            [LoadingPhase.done]: null
        }
        const todo = todoMap[phase]
        todo !== null && todo()
    }, [phase])
    return {
        phase,
        progress,
        start: () => start(true)
    }
}

interface LoadingPProps {
    onStepCase?: Partial<Record<LoadingPPhase, () => void>>, loadList: string[]
}
export const LoadingP: FC<LoadingPProps> = ({ onStepCase, loadList }: LoadingPProps) => {
    const onStepCaseRef = useRef(onStepCase)
    const { phase: loadingPhase, progress, start } = useLoadingResult(loadList)
    const [phase, {
        [LoadingPPhase.in]: [delay_in],
        [LoadingPPhase.loading]: [delay_loading, loaded],
        [LoadingPPhase.out]: [delay_out],
        [LoadingPhase.done]: []
    }] = useDTJ<LoadingPPhase>(
        [LoadingPPhase.in, 1],
        [LoadingPPhase.loading, 2],
        [LoadingPPhase.out, 1],
        [LoadingPPhase.done, 0],
    )
    useEffect(() => {
        if (loadingPhase === LoadingPhase.done) loaded(true)
    }, [loadingPhase])
    useEffect(() => {
        const todoMap: Record<LoadingPPhase, (() => void) | null> = {
            [LoadingPPhase.in]: () => {
                start()
                window.setTimeout(() => delay_in(true), 1000)
            },
            [LoadingPPhase.loading]: () => {
                window.setTimeout(() => delay_loading(true), 1000)
            },
            [LoadingPPhase.out]: () => {
                window.setTimeout(() => delay_out(true), 1000)
            },
            [LoadingPPhase.done]: null
        }
        const todo = todoMap[phase]
        todo !== null && todo()
    }, [phase])
    useEffect(() => {
        const todo = onStepCaseRef.current?.[phase]
        todo !== undefined && todo()
    }, [phase])
    return <div id='LoadingP' style={{opacity:progress.currentLoadedPercentage*0.01}}>
        <h1>{LoadingPhase[loadingPhase]},{LoadingPPhase[phase]} - {progress.loadedList.length}/{progress.needList.length} {progress.currentLoadedPercentage}</h1>
    </div>
}

export default LoadingP