import { resourceBasePath } from "../config";
import { fileRecord, packageRecord, charaRecord, KKVRecord } from "../data/data";
import { dbh } from "../handle/IndexedDB";
import { WorkerHandle, WorkerMessage, Worker_getZip } from "../worker/WorkerHandle";
import * as GetZip from "../worker/getZip.export"
import type { FixedArray } from "../type";


export type FileType = 'application' | 'image' | 'audio' | 'unknow'
export namespace FileType {
  export function fromSuffix(suffix: GetZip.FileSuffix): FileType {
    return (GetZip.fileSuffixMap[suffix]?.split('/', 1)[0] ?? 'unknow') as FileType;
  }
}


/******************************* PackageInfo ********************************/
export interface PackageInfoLike {
  key: string
  state: 'waiting' | 'ready' | 'downloading' | 'loading' | 'done' | 'error'
  resourcePath: string
  fileKeyNameMap: Record<string, string>
  // total?: number | null
  // loaded?: number
  error?: any
  worker?: WorkerHandle
  failedFileNameList?: string[]
}
export class PackageInfo implements PackageInfoLike {
  key!: string
  state!: 'waiting' | 'ready' | 'downloading' | 'loading' | 'done' | 'error'
  resourcePath!: string
  fileKeyNameMap!: Record<string, string>
  // total?: number | null
  // loaded?: number
  error?: any
  worker?: WorkerHandle
  failedFileNameList?: string[]
  constructor(packageInfo: PackageInfoLike)
  constructor(key: string, url?: string, fileKeyNameMap?: Record<string, string>)
  constructor(...args: any[]) {
    if (args.length === 1) {
      const packageInfo: PackageInfo = args[0];
      let key: keyof PackageInfo
      for (key in packageInfo)
        this[key] = packageInfo[key]
      return
    }
    else if (
      args.length === 3 &&
      typeof args[0] === 'string' &&
      typeof args[1] === 'string' &&
      args[2] instanceof Object
    ) {
      const [key, url, fileKeyNameMap] = args;
      this.state = 'waiting'
      this.key = key
      this.resourcePath = url
      this.fileKeyNameMap = fileKeyNameMap
      const allFileInfosFromPackage = (() => {
        const re: FileInfo[] = []
        Object.entries(this.fileKeyNameMap).forEach(([key, name]) => re.push(new FileInfo(key, this.key, name)))
        return re
      })()
      KKVRecord.push(fileRecord, allFileInfosFromPackage)
      return
    }
    else throw new Error(`构造PackageInfo时传入错误的参数:\n${JSON.stringify(Array.from(arguments), null, 2)}`)
  }
  private loadPromiseOnStepCallbacks?: Partial<Record<GetZip.Worker_getZipState, ((msg: GetZip.Worker_getZipMessage) => void)[]>>
  private loadPromise?: Promise<any>
  load(onStepCallback?: Partial<Record<GetZip.Worker_getZipState, ((msg: GetZip.Worker_getZipMessage) => void)>>): Promise<[string, string[]] | any> {
    // if (this.loadPromise) debugger
    if (onStepCallback !== undefined) {
      Object.entries(onStepCallback).forEach(([state, fn]) => {
        ((this.loadPromiseOnStepCallbacks ??= {})[state as GetZip.Worker_getZipState] ??= []).push(fn)
      })
    }
    if (this.loadPromise) return this.loadPromise
    return this.loadPromise = new Promise(async (resolve, reject) => {
      const fileNameKeysMap = (() => {
        const re: { [fileName: string]: string | string[] } = {}
        Object.entries(this.fileKeyNameMap).forEach(([key, name]) => {
          if (re[name] === void 0) re[name] = key
          else Array.isArray(re[name]) ? (re[name] as string[]).push(key) : (re[name] = [re[name] as string, key])
        })
        return re
      })()
      function setInDBTrueM(fileNameList: string[]) {
        fileNameList.forEach((fileName) => {
          const fileKey_s = fileNameKeysMap[fileName]
          Array.isArray(fileKey_s) ? (fileKey_s as string[]).forEach(fileKey => fileRecord[fileKey].setInDBTrue()) : fileRecord[fileKey_s].setInDBTrue();
        })
      }
      // TODO:hit helper
      // hit DB
      type DBfile = { path: string, fileName: string, packageKey: string, code: string }
      const fromDBfiles: DBfile[] = await dbh.getByIndex('Files', 'packageKey', this.key)
      if (fromDBfiles) {
        // TODO:文件校验（md5）
        this.worker = void 0
        const needFileNameSet = new Set(Object.values(this.fileKeyNameMap))
        const fileNameList: string[] = []
        for (const { fileName } of fromDBfiles) {
          if (needFileNameSet.has(fileName)) {
            needFileNameSet.delete(fileName)
            fileNameList.push(fileName)
          }
          else break
        }
        if (needFileNameSet.size === 0) {
          this.state = 'done'
          // this.loadPromiseOnStepCallbacks?.['done']?.forEach(fn => fn({}))
          setInDBTrueM(fileNameList)
          console.warn('DBhit', this.key)
          resolve([this.key, fileNameList])
          return
        }
      }

      const data: string[] = await new Promise((resolve, reject) => {
        this.worker = new Worker_getZip({
          url: this.resourcePath.toString(),
          fileNameSet: new Set(Object.values(this.fileKeyNameMap))
        }, (msg) => {
          const onStepCase: Record<GetZip.Worker_getZipState, null | (() => void)> = {
            ready: null,
            downloading: null,
            loading: null,
            done: () => {
              this.failedFileNameList = msg.failedFileNameList as string[]
              if (this.failedFileNameList.length !== 0)
                console.warn(`资源包 ${this.key} 下存在获取失败的文件: \n${JSON.stringify(this.failedFileNameList, null, 2)}\n将会导致以下文件无法正常获取: \n[\n${(this.failedFileNameList.map(fileName => `\t${JSON.stringify(fileNameKeysMap[fileName])} // ${fileName}\n`))}]`)
              resolve(msg.data);
            },
            error: () => {
              this.error = msg.error
              reject(msg.error);
            }
          } as const
          this.state = msg.state
          const todo = onStepCase[this.state]
          typeof todo === 'function' && (todo())
          const callbacks = this.loadPromiseOnStepCallbacks?.[this.state]
          callbacks?.forEach(callback => typeof callback === 'function' && callback(msg))
          console.log(this, msg, msg.text)
        })
      }).then((data: any) => {
        this.worker = void 0
        const writeDBfilesCache: DBfile[] = []
        const wroteFileNameList: string[] = []
        const failedFileNameSet = new Set(this.failedFileNameList)
        Object.entries(data).forEach(([name, code]) => {
          if (!failedFileNameSet.has(name)) {
            writeDBfilesCache.push({ path: `${this.key}/${name}`, fileName: name, packageKey: this.key, code: code as string })
            wroteFileNameList.push(name)
          }
        })
        setInDBTrueM(Object.keys(data))
        return dbh.putM('Files', writeDBfilesCache).then(() => wroteFileNameList)
      }).catch((error) => {
        throw new Error(error)
      })
      resolve([this.key, data])
    }).then((e) => {
      // if (!Object.isFrozen(this)) {
      this.loadPromise = void 0
      //   Object.freeze(this)
      // }
      return e
    })
  }
}
// export namespace PackageInfo {
//   export function createPackageInfo(packageInfo: PackageInfo): PackageInfo
//   export function createPackageInfo(packageKey: string, relativePath?: string, fileKeyNameMap?: Record<string, string>): PackageInfo
//   export function createPackageInfo(args_0: PackageInfo | string, args_1?: string, args_2?: Record<string, string>): PackageInfo {
//     if (args_0 instanceof PackageInfo) {
//       const [packageInfo] = [args_0];
//       KKVRecord.push(packageRecord, [packageInfo])
//       return packageRecord[packageInfo.key]
//     }
//     else {
//       const [packageKey, relativePath, fileKeyNameMap] = [args_0, args_1, args_2]
//       const newInfo = new PackageInfo(packageKey, new URL(resourceBasePath.toString() + relativePath), fileKeyNameMap)
//       KKVRecord.push(packageRecord, [newInfo])
//       return packageRecord[newInfo.key]
//     }
//   }
// }
/******************************* PackageInfo END ********************************/


/******************************* FileInfo ********************************/
export class FileInfo {
  key: string
  fromPackage: string
  fileName: string
  base64_type: string
  inDB: boolean
  // base64_code: string
  static async getFilesBase64(fileKeyList: string[]) { // 123
    // let outRecordFileKey = fileKeyList.find((filekey) => fileRecord[filekey] === void 0 || !fileRecord[filekey].inDB)
    // if (outRecordFileKey) throw new Error(`FileInfo.getFilesBase64(): 未在记录的fileKey (异常值: ${outRecordFileKey})`)
    const fileKeyUniqueList = Array.from(new Set(fileKeyList))

    const outDBFileKeyList: string[] = []
    fileKeyUniqueList.forEach(fileKey => {
      if (fileRecord[fileKey] === void 0) throw new Error(`FileInfo.getFilesBase64(): 未在记录的fileKey (异常值: ${fileKey})`)
      if (!fileRecord[fileKey].inDB) outDBFileKeyList.push(fileKey)
    })
    if (outDBFileKeyList.length !== 0) console.warn(`FileInfo.getFilesBase64(): 请求了可能未写入的文件:\n${JSON.stringify(outDBFileKeyList, null, 2)}`)
    const resultValues = await dbh.getM('Files', fileKeyUniqueList.map((filekey) => fileRecord[filekey].getPath()))
    return Object.fromEntries(fileKeyUniqueList.map((fileKey, i) => [fileKey, resultValues[i]]))
  }
  constructor(key: string, fromPackage: string, fileName: string, inDB?: boolean) {
    this.key = key
    this.fromPackage = fromPackage
    this.fileName = fileName
    this.inDB = inDB !== void 0 ? inDB : false
    // this.base64_code = base64_code ?? ''
    const lastNodeIndex = fileName.lastIndexOf('.')
    const suffix = lastNodeIndex >= 0 ?
      fileName.slice(lastNodeIndex + 1) : ""
    if (suffix in GetZip.fileSuffixMap)
      this.base64_type = GetZip.fileSuffixMap[suffix as GetZip.FileSuffix]
    else throw new Error(`错误：未知的拓展名"${suffix}"。\n\t- 包key值: "${fromPackage}"\n\t- 文件名: "${fileName}"`)
  }
  setInDBTrue() {
    // if (this.base64_code) throw new Error(`错误：尝试覆盖已经写入的base64。\n\t- 文件key值: "${this.key}"`)
    // this.base64_code = code
    this.inDB = true
  }
  getPath() {
    return `${this.fromPackage}/${this.fileName}`
  }
}
/******************************* FileInfo END ********************************/


/******************************* CharaInfo ********************************/
export class CharaInfo {
  key: string
  name: string
  pic: Record<string, string>
  static getPicFilekey(key: string, style: string) {
    if (charaRecord[key] === void 0) throw new Error(`CharaInfo.getPicFilekey(): 不存在的人物记录: ${key}`)
    return charaRecord[key].pic[style]
  }
  constructor(key: string, name: string, pic: Record<string, string>) {
    this.key = key
    this.name = name
    this.pic = pic
  }
}
/******************************* CharaInfo END ********************************/


/******************************* TipsGroup ********************************/
export class Tips {
  title: string
  text: string
  constructor(title: string, text: string) {
    this.title = title
    this.text = text
    Object.freeze(this)
  }
}
export class TipsGroup {
  key: string
  name: string
  list: Tips[]
  constructor(key: string, name: string, titleTextList: FixedArray<string, 2>[]) {
    this.key = key
    this.name = name
    this.list = titleTextList.map(([title, text]) => new Tips(title, text))
  }
}
/******************************* TipsGroup END ********************************/

// PackageInfo.createPackageInfo('pk1','/package/home_SAMPLE.zip',{'_H_BG_0':'bg_0.png','_H_BG_1':'bg_1.png','_H_LOGO':'霂LOGO.png','_H_TITLE':'_h_title.png'}).load({})
