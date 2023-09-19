import { KKVRecord } from "../data/data"
import * as GlobalSave from "../data/globalSave";
import { dbh } from "../handle/IndexedDB"
import type { FixedArray } from "../type";

export namespace VM {
    function equationLineToKV(equationLine: string) {
        const signIndex = equationLine.indexOf('=');
        if (signIndex <= 0) throw new Error(`equationLineToKV():输入了非等式行\n${equationLine}`)
        return [equationLine.slice(1, signIndex), equationLine.slice(signIndex + 1)]
    }
    type Category = 'BOOK' | 'STORY'
    const equationLineTest = Object.freeze({
        BOOK: {
            propNames: Object.freeze(['start', 'defaultStyle', 'end', 'cover', 'check']),
            RegExpMap: Object.freeze({
                start: /^".+?"$/,
                defaultStyle: /^".+?"$/,
                end: /^\[\[".+?",".+?"\](,\[".+?",".+?"\])*\]$/,
                cover: /^".+?"$/,
                check: /(^".+?"$)|(^\["[&|!]"(,\["[&|!]"(,(\[\]|\[".+?"(,".+?")*\])){2}\]){2}\]$)/
            })
        },
        STORY: {
            propNames: Object.freeze(['title', 'end', 'tips']),
            RegExpMap: Object.freeze({
                title: /^".+?"$/,
                end: /^\[".+?"(,".+?")*\]$/,
                tips: /^\[".+?"(,".+?")*\]$/,
                to: /^".+?"$/,
            })
        }
    })
    function readProps(VMLines: readonly string[], category: 'BOOK', check: boolean): [{ [propName in keyof typeof equationLineTest.BOOK.RegExpMap]: any }, number]
    function readProps(VMLines: readonly string[], category: 'STORY', check: boolean): [{ [propName in keyof typeof equationLineTest.STORY.RegExpMap]: any }, number]
    function readProps(VMLines: readonly string[], category: Category, check: boolean) {
        const re: any = [{}, VMLines.length]
        const props = re[0];
        if (check) {
            const RegExpMap = equationLineTest[category].RegExpMap
            for (let i = 1; i < VMLines.length; ++i) {
                const currentLine = VMLines[i];
                if (currentLine[0] !== '>') {
                    if (category === 'BOOK') throw new Error(`VM.readProps(): 非追加属性行于${category}-VM第 ${i} 行。\n"${VMLines[i]}"`)
                    re[1] = i
                    break;
                }
                const [ikey, ivalue] = equationLineToKV(currentLine)
                const reg = RegExpMap[ikey as keyof typeof RegExpMap]
                if (reg) {
                    if (!reg.test(ivalue)) {
                        throw new Error(`VM.readProps(): 追加属性${ikey}格式出错。\n\t匹配:${reg}\n\t读取到:${ivalue}`)
                    }
                }
                props[ikey] = JSON.parse(ivalue)
            }
        }
        else {
            for (let i = 1; i < VMLines.length; ++i) {
                const currentLine = VMLines[i];
                const [ikey, ivalue] = equationLineToKV(currentLine)
                props[ikey] = JSON.parse(ivalue)
            }
        }
        const propNames = equationLineTest[category].propNames
        let firstLost = propNames.find(name => !props[name])
        if (firstLost) throw new Error(`VM.readProps(): 构造${category}-VM时追加属性不足够或不对应。缺少:${firstLost}\n需要:${propNames.join(',')}。\n读取到:\n${(JSON.stringify(re, null, 2))}\n实际输入:\n${VMLines.slice(1).join('\n')}`)
        return re
    }
    export type KeyIDEnum = {
        [ID: number]: string,
        [key: string]: number | string
    }
    export class RuntimeStory {
        key: string
        constructor(key: string) {
            this.key = key

        }
    }

    export class RuntimeBook {
        key: string
        constructor(key: string) {
            this.key = key

        }
    }
    type fnProps = (string | fnProps)[]
    class StaticSentence {
        ID: number // 0x0000 ~ 0xffff
        // line: string
        charaKey: string
        text: string
        fns: [string, fnProps][]
        constructor(ID: number, sentenceLine: string) {
            this.ID = ID
            // this.line = sentenceLine
            const [charaKey, text, ...fnsStringList] = sentenceLine.slice(1).split('\x1e')
            this.charaKey = charaKey
            this.text = text
            this.fns = fnsStringList.map(fnString => {
                const firstLeftBracketIndex = fnString.indexOf('[')
                const [fnName, propsStr] = [fnString.slice(0, firstLeftBracketIndex), fnString.slice(firstLeftBracketIndex)]
                return [fnName, JSON.parse(propsStr)]
            })

            console.log(this)
        }
    }
    class Paragraph {
        key: string
        start: number // 0x0000 ~ 0xffff
        end: number // === start+para.len-1
        constructor(key: string, startSentenceID: number, endSentenceID: number) {
            this.key = key
            this.start = startSentenceID
            this.end = endSentenceID
        }
    }
    export class StaticStory {
        ID: number
        key: string
        title: string
        end: readonly string[]
        tips: readonly string[]
        ParagraphRecord?: KKVRecord<Paragraph>
        to?: string
        constructor(ID: number, key: string, VMLines: readonly string[]) {
            this.ID = ID
            this.key = key

            const [{ title, end, tips, to }, lastPropsLineIndex] = readProps(VMLines, 'STORY', true)
            this.title = title
            this.end = end
            this.tips = tips
            to !== void 0 && (this.to = to)

            const paragraphCache: Paragraph[] = []
            const sentenceCache: StaticSentence[] = []
            let nextSentenceID = (this.ID << 16) + 0x0000
            const maxSentenceID = (this.ID << 16) + 0xffff
            for (let i = lastPropsLineIndex; i < VMLines.length; ++i) {
                let currentLine = VMLines[i]
                if (currentLine[0] !== '\x02') {
                    throw new Error(`StaticStory构造: 未读到段落起始标识于行 ${i}。读取到:\n\t${currentLine}`)
                }
                const paragraphKey = currentLine.slice(1),
                    paragraphStartID = nextSentenceID
                currentLine = VMLines[++i]
                for (; currentLine[0] === '@'; currentLine = VMLines[++i]) {
                    if (nextSentenceID > maxSentenceID) throw new Error(`StaticStory构造: 故事 ${this.ID} 语句过多。`)
                    sentenceCache.push(new StaticSentence(nextSentenceID++, currentLine))
                }
                const paragraphEndID = nextSentenceID - 1
                if (paragraphStartID > paragraphEndID) throw new Error(`StaticStory构造: 空段落于行 ${i}。`)
                if (currentLine[0] !== '\x03') {
                    throw new Error(`StaticStory构造: 未读到段落结束标识于行 ${i}。读取到:\n\t${currentLine}`)
                }
                else if (paragraphKey !== currentLine.slice(1)) {
                    throw new Error(`StaticStory构造: 未读到段落结束标识不匹配于行 ${i}。读取到:\n\t${currentLine.slice(1)},\n应为:\n\t${paragraphKey}`)
                }
                paragraphCache.push(new Paragraph(paragraphKey, paragraphStartID, paragraphEndID))
            }
            this.ParagraphRecord = new KKVRecord(paragraphCache)
            // console.log(sentenceCache)
            dbh.putM('Sentence', sentenceCache)

            console.log(this)
        }
    }
    export class StaticBook {
        ID: number
        key: string
        start: string // Story's key
        defaultStyle: string
        end: FixedArray<string, 2>
        cover: string // homeResource's filekey
        check: GlobalSave.CheckerConstructorProps
        Story_KeyIDEnum?: KeyIDEnum
        constructor(ID: number, key: string, [BookVM, StoryVMMap]: [string, { [StoryKey: string]: string }]) {
            this.ID = ID
            this.key = key
            const VMLines = BookVM.split('\n').map(l => l.trim()).filter(l => l)

            const [{ start, defaultStyle, end, cover, check }] = readProps(VMLines, 'BOOK', true)
            this.start = start
            this.defaultStyle = defaultStyle
            this.end = end
            this.cover = cover
            this.check = check

            this.Story_KeyIDEnum = {}

            const storyCache: StaticStory[] = []
            let nextStoryID = (this.ID << 8) + 0x01
            const maxStoryID = (this.ID << 8) + 0xff
            for (const key in StoryVMMap) {
                if (nextStoryID > maxStoryID) throw new Error(`StaticBook构造: 故事过多。`)
                const newStoryID = key === this.start ? (this.ID << 8) + 0x00 : nextStoryID++
                this.Story_KeyIDEnum[newStoryID] = key
                this.Story_KeyIDEnum[key] = newStoryID
                storyCache.push(new StaticStory(newStoryID, key, StoryVMMap[key].split('\n').map(l => l.trim()).filter(l => l)))
            }
            dbh.putM('Story', storyCache)

            console.log(this)
        }
    }
    // export function fromObject(vm: string) {
    //     const lines = vm.split('\n').map(l => l.trim()).filter(l => l)
    //     const firstLine = lines[0]
    //     if (firstLine[0] !== '=') throw new Error(`VM.fromObject(): 传入的vm字符串非空首行未以"="起始。\n错误的行:"${firstLine}"`)
    //     const [category, key] = firstLine.slice(1).split(':');
    //     switch (category as Category) {
    //         case 'BOOK':
    //         // return new StaticBook(-1, key, lines)
    //         case "STORY":
    //         // return new StaticStory(-1, key, lines)
    //         default: throw new Error(`VM.fromObject(): 传入的vm字符串类型字段值(${category})未定义。`)
    //     }
    // }
    // export function toObject() {

    // }
}

// export const vmtoobj = (e: string) => console.log(VM.fromObject(e))