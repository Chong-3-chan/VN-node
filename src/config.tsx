export const resourceBasePathRecord: Record<ApplicationFrom, string> = {
    'SERVER': new URL('/resource/ex/', 'https://chong-chan.cn').toString(),
    'SAMPLE': new URL('/resource/sample3/', 'https://chong-chan.cn').toString(),
    'EDITOR': new URL('helper://localhost:8081/').toString()
} as const
export type ApplicationFrom = 'SAMPLE' | 'SERVER' | 'EDITOR'
export const sourceMode: ApplicationFrom = 'SAMPLE';
export const resourceBasePath: string = resourceBasePathRecord[sourceMode]
export const dataURL = new URL(resourceBasePath + '/data.json').toString()