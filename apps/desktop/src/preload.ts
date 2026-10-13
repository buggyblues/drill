import { contextBridge, ipcRenderer } from 'electron';
const call = (name: string, ...args: any[]) => ipcRenderer.invoke('drill:' + name, ...args);
// No arbitrary ipcRenderer, filesystem, process, shell or auth token is exposed.
contextBridge.exposeInMainWorld('drill', Object.freeze({
    snapshot: () => call('snapshot'), status: () => call('status'), commit: (changes: any[]) => call('commit', changes),
    request: (path: string, method = 'GET', body?: any) => call('request', path, method, body),
    connect: (config: any) => call('connect', config), sync: () => call('sync'), captureAsset: (file: any) => call('captureAsset', file),
    addSource: (config: any) => call('addSource', config), pullSource: (id: string) => call('pullSource', id)
}));
