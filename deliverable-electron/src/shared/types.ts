/**
 * Shared type contracts between the Electron main process and the React
 * renderer. Both sides of the contextBridge import from this single file so
 * IPC stays type-safe end to end.
 */

// --------------------------------------------------------------------------- //
// Manifest / schema
// --------------------------------------------------------------------------- //

export type FieldCategory = 'Connection' | 'Auth' | 'Proxy' | 'Advanced';

export type ValidatorName = 'url' | 'port' | 'pat_shape';

export interface FieldSpec {
  key: string;
  label: string;
  category: FieldCategory;
  default?: string | null;
  secret?: boolean;
  required?: boolean;
  helpText?: string;
  helpUrl?: string | null;
  placeholder?: string | null;
  validator?: ValidatorName | null;
}

export interface ServerSpec {
  key: string;
  displayName: string;
  serverDirName: string;
  defaultPort: number;
  appModule: string;
  healthPath: string;
  myselfPath: string;
  baseUrlEnv: string;
  tokenEnv: string;
  fields: FieldSpec[];
}

// --------------------------------------------------------------------------- //
// Connection tester
// --------------------------------------------------------------------------- //

export type TestStatus =
  | 'OK'
  | 'PAT_INVALID'
  | 'PAT_EXPIRED'
  | 'NETWORK'
  | 'PROXY_REQUIRED'
  | 'CERT_ERROR'
  | 'UNKNOWN';

export interface TestResult {
  status: TestStatus;
  message: string;
  hint?: string;
  displayName?: string;
  rawStatus?: number;
}

// --------------------------------------------------------------------------- //
// Server runtime
// --------------------------------------------------------------------------- //

export type RunState =
  | 'UNCONFIGURED'
  | 'STOPPED'
  | 'STARTING'
  | 'RUNNING_OK'
  | 'RUNNING_PAT_BAD'
  | 'CRASHED'
  | 'ERROR';

export interface RuntimeSnapshot {
  key: string;
  displayName: string;
  port: number;
  state: RunState;
  message: string;
  pid?: number | null;
  displayUser?: string | null;
  updatedAt: number;
}

// --------------------------------------------------------------------------- //
// Proxy / shortcut / integration
// --------------------------------------------------------------------------- //

export interface DetectedProxy {
  http: string | null;
  https: string | null;
  source: 'registry' | 'env' | 'none';
}

export type ShortcutLocation = 'start_menu' | 'desktop' | 'startup';

export interface ShortcutInfo {
  location: ShortcutLocation;
  exists: boolean;
  path: string;
  target?: string;
  arguments?: string;
}

export interface VsCodeIntegrationResult {
  updated: string[];
  errors: string[];
}

export interface PythonInfo {
  found: boolean;
  executable?: string;
  version?: string;
  minSupported: string;
}

export type BootstrapPhase =
  | 'venv'
  | 'pip-upgrade'
  | 'requirements'
  | 'env'
  | 'done';

export interface BootstrapProgress {
  phase: BootstrapPhase;
  message: string;
  percent: number;
  currentServer?: string;
}

export interface BootstrapRequest {
  serverKeys: string[];
  envValuesByServer: Record<string, Record<string, string>>;
  proxy?: string | null;
  force?: boolean;
}

export interface BootstrapResult {
  success: boolean;
  error?: string;
}

// --------------------------------------------------------------------------- //
// IPC channel map — every message the renderer can send
// --------------------------------------------------------------------------- //

export interface Api {
  system: {
    getPlatform: () => Promise<NodeJS.Platform>;
    openExternal: (url: string) => Promise<void>;
    openPath: (path: string) => Promise<void>;
    quit: () => Promise<void>;
  };
  manifests: {
    list: () => Promise<ServerSpec[]>;
  };
  env: {
    read: (serverKey: string) => Promise<Record<string, string>>;
    write: (
      serverKey: string,
      values: Record<string, string>,
    ) => Promise<{ path: string }>;
  };
  selection: {
    load: () => Promise<string[] | null>;
    save: (keys: string[]) => Promise<void>;
  };
  proxy: {
    detect: () => Promise<DetectedProxy>;
  };
  tester: {
    test: (
      serverKey: string,
      values: Record<string, string>,
    ) => Promise<TestResult>;
  };
  serverControl: {
    listStatuses: () => Promise<RuntimeSnapshot[]>;
    start: (key: string) => Promise<RuntimeSnapshot>;
    stop: (key: string) => Promise<RuntimeSnapshot>;
    restart: (key: string) => Promise<RuntimeSnapshot>;
    startAll: () => Promise<RuntimeSnapshot[]>;
    stopAll: () => Promise<RuntimeSnapshot[]>;
    openLog: (key: string) => Promise<void>;
  };
  shortcuts: {
    info: (location: ShortcutLocation) => Promise<ShortcutInfo>;
    create: (location: ShortcutLocation) => Promise<ShortcutInfo>;
    remove: (location: ShortcutLocation) => Promise<boolean>;
  };
  vscode: {
    integrate: (serverKeys: string[]) => Promise<VsCodeIntegrationResult>;
  };
  windows: {
    openWizard: () => Promise<void>;
    openPatRotation: (serverKey: string) => Promise<void>;
    openControlPanel: () => Promise<void>;
    closeCurrent: () => Promise<void>;
  };
  python: {
    detect: () => Promise<PythonInfo>;
  };
  bootstrap: {
    run: (req: BootstrapRequest) => Promise<BootstrapResult>;
    completed: () => Promise<boolean>;
    markCompleted: () => Promise<void>;
    onProgress: (handler: (evt: BootstrapProgress) => void) => () => void;
  };
  events: {
    onStatusChanged: (
      handler: (snapshots: RuntimeSnapshot[]) => void,
    ) => () => void;
  };
}

/**
 * IPC channel names — kept as a const-record so the main-process handlers
 * cannot drift out of sync with the preload script.
 */
export const IPC = {
  system_getPlatform: 'system:getPlatform',
  system_openExternal: 'system:openExternal',
  system_openPath: 'system:openPath',
  system_quit: 'system:quit',
  manifests_list: 'manifests:list',
  env_read: 'env:read',
  env_write: 'env:write',
  selection_load: 'selection:load',
  selection_save: 'selection:save',
  proxy_detect: 'proxy:detect',
  tester_test: 'tester:test',
  server_listStatuses: 'server:listStatuses',
  server_start: 'server:start',
  server_stop: 'server:stop',
  server_restart: 'server:restart',
  server_startAll: 'server:startAll',
  server_stopAll: 'server:stopAll',
  server_openLog: 'server:openLog',
  shortcuts_info: 'shortcuts:info',
  shortcuts_create: 'shortcuts:create',
  shortcuts_remove: 'shortcuts:remove',
  vscode_integrate: 'vscode:integrate',
  windows_openWizard: 'windows:openWizard',
  windows_openPatRotation: 'windows:openPatRotation',
  windows_openControlPanel: 'windows:openControlPanel',
  windows_closeCurrent: 'windows:closeCurrent',
  python_detect: 'python:detect',
  bootstrap_run: 'bootstrap:run',
  bootstrap_completed: 'bootstrap:completed',
  bootstrap_markCompleted: 'bootstrap:markCompleted',
  bootstrap_progress: 'bootstrap:progress',
  events_statusChanged: 'events:statusChanged',
} as const;
