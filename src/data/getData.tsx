import { VM } from "../class/Book"
import { CharaInfo, FileInfo, PackageInfo, TipsGroup } from "../class/Records"
import { dataURL, resourceBasePath } from "../config"
import { dbh } from "../handle/IndexedDB"
import * as Data from "./data"
import type { FixedArray } from "../type";
async function getDataObject() {
    // const obj = fetch(dataURL).then(e=>e.json())
    const obj = await fetch(new URL('./sample/sample.data.json', import.meta.url)).then(e => e.json())
    return obj
}
async function timeAsync(fun: () => Promise<any>): Promise<number> {
    const startTime = Date.now()
    await fun()
    return Date.now() - startTime
}
function time(fun: () => any): number {
    const startTime = Date.now()
    fun()
    return Date.now() - startTime
}
export async function getData() {
    const dataobj = await getDataObject()
    const { book, file, packagePath, chara, tipsGroup } = dataobj
    console.log(dataobj)
    { // book
        const bookCache: VM.StaticBook[] = []
        Object.entries(book).map(([BookKey, BookVMe]: any, i) => bookCache.push(new VM.StaticBook(i, BookKey, BookVMe)))
        dbh.putM('Book', bookCache) // Book并入data？
    }

    { // file+packagePath
        const packageInfoCache: PackageInfo[] = []
        const keyNameMapCache: Record<string, Record<string, string>> = (() => {
            const re: Record<string, Record<string, string>> = {}
            Object.keys(packagePath).forEach(packageKey => re[packageKey] = {})
            return re
        })()
        Object.entries(file as Record<string, FixedArray<string, 2>>).forEach(([key, [fromPackage, fileName]]) => {
            if (keyNameMapCache[fromPackage] === void 0) throw new Error(`getData(): file表中存在无packagePath记录的fromPackage值。\n\t异常的packageKey为:${fromPackage}`)
            keyNameMapCache[fromPackage][key] = fileName
        })
        Object.entries(keyNameMapCache).forEach(([PackageKey, keyNameMap]) => {
            packageInfoCache.push(new PackageInfo(PackageKey, (resourceBasePath + packagePath[PackageKey]), keyNameMap))
        })
        Data.KKVRecord.push(Data.packageRecord, packageInfoCache)
    }

    { // chara
        const charaCache: CharaInfo[] = []
        Object.entries(chara).map(([charaKey, [name, pic]]: any) => charaCache.push(new CharaInfo(charaKey, name, pic)))
        Data.KKVRecord.push(Data.charaRecord, charaCache)
    }

    { // tipsGroup
        const tipsGroupCache: TipsGroup[] = []
        Object.entries(tipsGroup).map(([key, [name, ...group]]: any) => tipsGroupCache.push(new TipsGroup(key, name, group)))
        Data.KKVRecord.push(Data.tipsGroupRecord, tipsGroupCache)
    }

    // Promise.all(Object.values(Data.packageRecord).map(packageInfo => packageInfo.load())).then(async (e) => {
    //     console.warn(dataobj, Data, e,'any')
    //     const fileKeys = Object.keys(Data.fileRecord)
    //     const randomKeys = Array(10).fill(null).map((e, i) => fileKeys[i])
    //     console.warn(await timeAsync(async () => {
    //         const code = await FileInfo.getFilesBase64([...randomKeys])
    //         console.log(code, CharaInfo.getPicFilekey('12', '01'))
    //         return code
    //     }))
    // })
    // const ck = new Checker(['&', ['|', [], ['2', '1', '3', '4']], ['&', [], []]])
    // alert(ck.check())
    // const randomKV = Array(100000).fill(null).map(() => [Math.random().toString(36).slice(2), Math.random()] as [string, number])
    // console.warn(time(() => {
    //     const map: any = {}
    //     randomKV.forEach(e => {
    //         map[e[0]] = e[1]
    //     });
    // }))
    // alert(await time(() => {
    //     // const pa = []
    //     // for (let i = 0; i < 100; ++i)pa.push(dbh.put('Book', { ID: i, gg: new Array(i).fill('ab').join('') }))
    //     // return Promise.all(pa)
    //     // let g = new Promise((a)=>a(null));
    //     // for (let i = 0; i < 100; ++i)g = g.then(()=>dbh.put('Book', { ID: i, gg: new Array(i).fill('ab').join('') }))
    //     // return g
    //     return dbh.deleteM('Book', Array(10).fill(null).map((e, i) => i))
    // }))
    // alert(await time(() => {
    //     const pa = []
    //     for (let i = 0; i < 100; ++i)pa.push(dbh.delete('Book', i))
    //     return Promise.all(pa)
    // }))
    // write file&packageRecord
}
export { }