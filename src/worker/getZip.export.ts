export type Worker_getZipState = 'ready' | 'downloading' | 'loading' | 'done' | 'error'
export interface Worker_getZipMessage {
  state: Worker_getZipState
  text: string
  resourcePath?: string,
  downloaded?: number,
  downloadTotal?: number | null,
  error?: any,
  loaded?: number,
  total?: number | null,
  data?: Worker_getZipResponse,
  failedFileNameList?: string[]
}
export type Worker_getZipProps = { url: string, fileNameSet: Set<string> }
export type Worker_getZipResponse = { [fileName: string]: string }
export type FileSuffix = 'json' | 'zip' | 'png' | 'gif' | 'jpeg' | 'jpg' | 'mp3' | 'aac' | 'oga' | 'ogg'
export const fileSuffixMap: { readonly [index in FileSuffix]: string } = {
  json: 'application/json',
  zip: 'application/zip',
  png: 'image/png',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  mp3: 'audio/mpeg',
  aac: 'audio/aac',
  oga: 'audio/ogg',
  ogg: 'audio/ogg',
}