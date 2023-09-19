import * as GetZip from "./getZip.export"
type WorkerState = 'ready' | 'working' | 'done' | 'error'
export interface WorkerMessage {
    state: any
    text: string
    [key: string]: any
}
type WorkerOnmessage = (msg: WorkerMessage) => void | any
let lastWorkerID = 0x1234
export class WorkerHandle {
    ID: number
    functionName: WorkerNames
    state: WorkerState
    lastMessage?: WorkerMessage
    totalMessage: WorkerMessage
    worker: Worker
    constructor(fnName: WorkerNames, props: {}, onmessage: WorkerOnmessage) {
        this.ID = ++lastWorkerID
        this.functionName = fnName
        this.state = 'ready'
        this.totalMessage = {
            state: 'ready',
            text: '准备中'
        }
        this.worker = workerRecord[fnName].getWorker()
        this.worker.onmessage = e => {
            const msg: WorkerMessage = e.data;
            this.lastMessage = msg
            this.state = workerRecord[this.functionName].states[msg.state]
            this.totalMessage = { ...this.totalMessage, ...msg } // co?
            onmessage(msg)
        }
        this.worker.postMessage(props)
    }
}

type WorkerNames = 'getZip'
interface WorkerInfo { getWorker: () => Worker, states: Record<string, WorkerState> }
export const workerRecord: Record<WorkerNames, WorkerInfo> = {
    'getZip': {
        getWorker: () => new Worker(new URL('./getZip.worker', import.meta.url)),
        states: {
            'ready': 'ready',
            'downloading': 'working',
            'loading': 'working',
            'done': 'done',
            'error': 'error'
        }
    }
} as const

type Worker_getZipOnmessage = (msg: GetZip.Worker_getZipMessage) => void | any
export class Worker_getZip extends WorkerHandle {
    constructor(props: GetZip.Worker_getZipProps, onmessage: Worker_getZipOnmessage) {
        super('getZip', props, onmessage)
    }
}