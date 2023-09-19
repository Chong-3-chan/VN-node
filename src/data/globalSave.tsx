type InfoState = 'waiting' | 'done'
interface InfoData {
    readStory: string[] | null,
    endedStory: string[] | null,
    options: {} | null,
    autoSave: {} | null,
    checkKeyMap: Record<string, boolean> | null
}// TODO:完善属性type
interface InfoData_wrote extends InfoData {
    readStory: string[],
    endedStory: string[],
    options: {},
    autoSave: {},
    checkKeyMap: Record<string, boolean>
}
const info: { state: InfoState, data: InfoData | InfoData_wrote } = {
    state: 'done',
    data: {
        readStory: ['1', '2', '3', '4'],
        endedStory: ['1', '2'],
        options: null,
        autoSave: null,
        checkKeyMap: null
    },
}
// export get

type StoryCheckerMode = '&' | '|' | '!'
type CheckerType = 'key' | '&' | '|' | '!'
export interface Checker {
    type: CheckerType
    read?: { mode: StoryCheckerMode, some: readonly string[] | null, all: readonly string[] | null }
    ended?: { mode: StoryCheckerMode, some: readonly string[] | null, all: readonly string[] | null }
    checkKeyName?: string
    check(): boolean
}
interface Checher_key extends Checker {
    type: 'key'
    checkKeyName: string
}
interface Checher_story extends Checker {
    type: '&' | '|' | '!'
    read: { mode: StoryCheckerMode, some: readonly string[] | null, all: readonly string[] | null }
    ended: { mode: StoryCheckerMode, some: readonly string[] | null, all: readonly string[] | null }
}
export type CheckerConstructorProps = [
    StoryCheckerMode,
    [] | [StoryCheckerMode, readonly string[], readonly string[]],
    [] | [StoryCheckerMode, readonly string[], readonly string[]]
]
export class Checker {
    type: CheckerType
    read?: { mode: StoryCheckerMode, some: readonly string[] | null, all: readonly string[] | null }
    ended?: { mode: StoryCheckerMode, some: readonly string[] | null, all: readonly string[] | null }
    checkKeyName?: string
    check() {
        if (info.state === 'waiting') return null;
        const infoData = info.data as InfoData_wrote
        const storycheckerModeCase: Record<StoryCheckerMode, ((...args: any) => boolean)> = {
            // some和all只用其一时 另一个检查组需要为空，结果上不生效
            // 两个组都空则返回true
            "&": (fromChecker: { some: string[], all: string[] }, fromGlobal: string[]) => {
                const some = fromChecker.some, all = fromChecker.all
                if (some.length === 0 && all.length === 0) return true
                const fromGlobalSet = new Set(fromGlobal)
                const someCheck = some.length === 0 ? true : some.some(storyKey => fromGlobalSet.has(storyKey)),
                    allCheck = all.length === 0 ? true : !all.some(storyKey => !fromGlobalSet.has(storyKey))
                return someCheck && allCheck
            },
            "|": (fromChecker: { some: string[], all: string[] }, fromGlobal: string[]) => {
                const some = fromChecker.some, all = fromChecker.all
                if (some.length === 0 && all.length === 0) return true
                const fromGlobalSet = new Set(fromGlobal)
                const someCheck = some.length === 0 ? false : some.some(storyKey => fromGlobalSet.has(storyKey)),
                    allCheck = all.length === 0 ? false : !all.some(storyKey => !fromGlobalSet.has(storyKey))
                return someCheck || allCheck
            },
            "!": (...args: any) => true
        }
        const checkerTypeCase: Record<CheckerType, (() => boolean)> = {
            key: () => {
                const checker = this as Checher_key
                return infoData.checkKeyMap[checker.checkKeyName]
            },
            "&": () => {
                const checker = this as Checher_story
                return storycheckerModeCase[checker.read.mode](checker.read, info.data.readStory) &&
                    storycheckerModeCase[checker.ended.mode](checker.ended, info.data.endedStory)
            },
            "|": () => {
                const checker = this as Checher_story
                return storycheckerModeCase[checker.read.mode](checker.read, info.data.readStory) ||
                    storycheckerModeCase[checker.ended.mode](checker.ended, info.data.endedStory)
            },
            "!": () => true
        }
        return checkerTypeCase[this.type]()
    }
    constructor(keyName: string)
    constructor(readAndEndedConfig: CheckerConstructorProps)
    constructor(args_0: any) {
        if (typeof args_0 === 'string') {
            const [keyName] = [args_0]
            this.type = 'key'
            this.checkKeyName = keyName
        }
        else if (Array.isArray(args_0) && args_0.length === 3) {
            const [readAndEndedConfig] = [args_0]
            const [type, readConfig, endedConfig] = readAndEndedConfig
            this.type = type
            this.read = readConfig.length === 0 ?
                Object.freeze({ mode: '!', some: null, all: null }) :
                Object.freeze({
                    mode: readConfig[0] as StoryCheckerMode,
                    some: Object.freeze(readConfig[1]),
                    all: Object.freeze(readConfig[2])
                })
            this.ended = endedConfig.length === 0 ?
                Object.freeze({ mode: '!', some: null, all: null }) :
                Object.freeze({
                    mode: endedConfig[0] as StoryCheckerMode,
                    some: Object.freeze(endedConfig[1]),
                    all: Object.freeze(endedConfig[2])
                })
        }
        else throw new Error(`Checker构造:参数类型有误。实际为:\n${JSON.stringify(args_0)}`)
        Object.freeze(this)
    }
}