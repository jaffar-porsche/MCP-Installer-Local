/**
 * Preload — the ONLY bridge between the sandboxed renderer and the main
 * process. `contextIsolation` is on and `nodeIntegration` is off, so the
 * renderer sees exactly what we expose here and nothing else.
 */
import { contextBridge, ipcRenderer } from 'electron';

import { IPC } from '@shared/types';
import type {
  Api,
  DetectedProxy,
  RuntimeSnapshot,
  ServerSpec,
  ShortcutInfo,
  ShortcutLocation,
  TestResult,
  VsCodeIntegrationResult,
} from '@shared/types';
console.log('[MCP-Installer] preload loaded');
const api: Api = {
  system: {
    getPlatform: () => ipcRenderer.invoke(IPC.system_getPlatform),
    openExternal: (url) => ipcRenderer.invoke(IPC.system_openExternal, url),
    openPath: (p) => ipcRenderer.invoke(IPC.system_openPath, p),
    quit: () => ipcRenderer.invoke(IPC.system_quit),
  },
  manifests: {
    list: () => ipcRenderer.invoke(IPC.manifests_list) as Promise<ServerSpec[]>,
  },
  env: {
    read: (k) => ipcRenderer.invoke(IPC.env_read, k),
    write: (k, v) => ipcRenderer.invoke(IPC.env_write, k, v),
  },
  selection: {
    load: () => ipcRenderer.invoke(IPC.selection_load) as Promise<string[] | null>,
    save: (keys) => ipcRenderer.invoke(IPC.selection_save, keys),
  },
  proxy: {
    detect: () => ipcRenderer.invoke(IPC.proxy_detect) as Promise<DetectedProxy>,
  },
  tester: {
    test: (k, v) => ipcRenderer.invoke(IPC.tester_test, k, v) as Promise<TestResult>,
  },
  serverControl: {
    listStatuses: () => ipcRenderer.invoke(IPC.server_listStatuses) as Promise<RuntimeSnapshot[]>,
    start: (k) => ipcRenderer.invoke(IPC.server_start, k) as Promise<RuntimeSnapshot>,
    stop: (k) => ipcRenderer.invoke(IPC.server_stop, k) as Promise<RuntimeSnapshot>,
    restart: (k) => ipcRenderer.invoke(IPC.server_restart, k) as Promise<RuntimeSnapshot>,
    startAll: () => ipcRenderer.invoke(IPC.server_startAll) as Promise<RuntimeSnapshot[]>,
    stopAll: () => ipcRenderer.invoke(IPC.server_stopAll) as Promise<RuntimeSnapshot[]>,
    openLog: (k) => ipcRenderer.invoke(IPC.server_openLog, k),
  },
  shortcuts: {
    info: (loc: ShortcutLocation) => ipcRenderer.invoke(IPC.shortcuts_info, loc) as Promise<ShortcutInfo>,
    create: (loc: ShortcutLocation) => ipcRenderer.invoke(IPC.shortcuts_create, loc) as Promise<ShortcutInfo>,
    remove: (loc: ShortcutLocation) => ipcRenderer.invoke(IPC.shortcuts_remove, loc) as Promise<boolean>,
  },
  vscode: {
    integrate: (keys) => ipcRenderer.invoke(IPC.vscode_integrate, keys) as Promise<VsCodeIntegrationResult>,
  },
  windows: {
    openWizard: () => ipcRenderer.invoke(IPC.windows_openWizard),
    openPatRotation: (serverKey) => ipcRenderer.invoke(IPC.windows_openPatRotation, serverKey),
    openControlPanel: () => ipcRenderer.invoke(IPC.windows_openControlPanel),
    closeCurrent: () => ipcRenderer.invoke(IPC.windows_closeCurrent),
  },
  python: {
    detect: () => ipcRenderer.invoke(IPC.python_detect),
  },
  bootstrap: {
    run: (req) => ipcRenderer.invoke(IPC.bootstrap_run, req),
    completed: () => ipcRenderer.invoke(IPC.bootstrap_completed),
    markCompleted: () => ipcRenderer.invoke(IPC.bootstrap_markCompleted),
    onProgress: (handler) => {
      const wrapped = (_e: unknown, evt: unknown) => handler(evt as never);
      ipcRenderer.on(IPC.bootstrap_progress, wrapped);
      return () => ipcRenderer.removeListener(IPC.bootstrap_progress, wrapped);
    },
  },
  events: {
    onStatusChanged: (handler) => {
      const wrapped = (_e: unknown, snaps: RuntimeSnapshot[]) => handler(snaps);
      ipcRenderer.on(IPC.events_statusChanged, wrapped);
      return () => ipcRenderer.removeListener(IPC.events_statusChanged, wrapped);
    },
  },
};

contextBridge.exposeInMainWorld('api', api);

console.log('[MCP-Installer] exposed:', Object.keys(api));