import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

import type {
  BootstrapRequest,
  BootstrapResult,
  RuntimeSnapshot,
  ServerSpec,
  ShortcutLocation,
} from '@shared/types';
import { IPC } from '@shared/types';

import { ensureDataDirs, envFile, logFileFor } from './services/paths';
import {
  describeSource,
  getServerOrThrow,
  loadManifests,
  validateField,
} from './services/manifestLoader';
import { readEnv, writeEnv } from './services/envManager';
import { loadSelection, saveSelection } from './services/selectionStore';
import { detectProxy } from './services/proxyDetector';
import { testConnection } from './services/connectionTester';
import { ServerController } from './services/serverController';
import { createOrRepair as createShortcut, info as shortcutInfo, remove as removeShortcut } from './services/shortcutManager';
import { integrateAll } from './services/vscodeIntegrator';
import { detectPython } from './services/pythonDetector';
import { bulkBootstrap } from './services/serverBootstrap';
import { markWizardCompleted, wizardCompleted } from './services/installationStore';

// --------------------------------------------------------------------------- //
// Global state
// --------------------------------------------------------------------------- //

let specs: ServerSpec[] = [];
let controller: ServerController | null = null;

let wizardWindow: BrowserWindow | null = null;
let controlPanelWindow: BrowserWindow | null = null;

type AppRoute = 'wizard' | 'panel' | `rotate/${string}`;

function replaceController(): void {
  controller?.stopPoller();
  const next = new ServerController(specs);
  next.on('change', (snaps: RuntimeSnapshot[]) => {
    for (const w of BrowserWindow.getAllWindows()) {
      w.webContents.send(IPC.events_statusChanged, snaps);
    }
  });
  controller = next;
  // Kick one poll cycle so live PIDs are detected before the panel repaints,
  // then start the recurring poller.
  void next.pollOnce().then(() => {
    const snap = next.snapshotAll();
    for (const w of BrowserWindow.getAllWindows()) {
      w.webContents.send(IPC.events_statusChanged, snap);
    }
    next.startPoller();
  });
}

// --------------------------------------------------------------------------- //
// Window factories
// --------------------------------------------------------------------------- //


const preloadPath = join(__dirname, '..', 'preload', 'index.js');
console.log('[MAIN] preload path:', preloadPath);
console.log('[MCP-Installer] preload:', preloadPath);
console.log('[MCP-Installer] preload exists:', existsSync(preloadPath));
function commonWindowOptions(): Electron.BrowserWindowConstructorOptions {
  return {
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#FAFAFA',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // needed so preload can require electron
    },
  };
}

async function ensureWizardWindow(route: AppRoute = 'wizard'): Promise<BrowserWindow> {
  if (wizardWindow && !wizardWindow.isDestroyed()) {
    const rotate = route.startsWith('rotate/');
    wizardWindow.setMinimumSize(rotate ? 640 : 780, rotate ? 520 : 640);
    wizardWindow.setSize(rotate ? 700 : 900, rotate ? 600 : 720);
    await loadRoute(wizardWindow, route);
    wizardWindow.focus();
    return wizardWindow;
  }
  const rotate = route.startsWith('rotate/');
  wizardWindow = new BrowserWindow({
    width: rotate ? 700 : 900,
    height: rotate ? 600 : 720,
    minWidth: rotate ? 640 : 780,
    minHeight: rotate ? 520 : 640,
    title: 'MCP-Installer — Setup',
    ...commonWindowOptions(),
  });
  console.log('[MAIN] wizard window created');
  wizardWindow.show();
wizardWindow.focus();

console.log('[MAIN] WINDOW CREATED');
  await loadRoute(wizardWindow, route);
  wizardWindow.once('ready-to-show', () => wizardWindow?.show());
  wizardWindow.on('closed', () => (wizardWindow = null));
  return wizardWindow;
}

async function ensureControlPanelWindow(): Promise<BrowserWindow> {
  if (controlPanelWindow && !controlPanelWindow.isDestroyed()) {
    controlPanelWindow.focus();
    return controlPanelWindow;
  }
  controlPanelWindow = new BrowserWindow({
    width: 980,
    height: 760,
    minWidth: 820,
    minHeight: 640,
    title: 'MCP-Installer — Control Panel',
    ...commonWindowOptions(),
  });
  console.log('[MAIN] control window created');
  controlPanelWindow.show();
controlPanelWindow.focus();
  
  await loadRoute(controlPanelWindow, 'panel');
  controlPanelWindow.once('ready-to-show', () => controlPanelWindow?.show());
  controlPanelWindow.on('closed', () => (controlPanelWindow = null));
  return controlPanelWindow;
}

async function loadRoute(win: BrowserWindow, route: AppRoute): Promise<void> {
  const devServer = process.env.ELECTRON_RENDERER_URL;
  if (devServer) {
    await win.loadURL(`${devServer}/#/${route}`);
  } else {
    await win.loadFile(join(__dirname, '..', 'renderer', 'index.html'), {
      hash: `/${route}`,
    });
  }
}

// --------------------------------------------------------------------------- //
// IPC handlers — every channel type-checked against the shared `IPC` map
// --------------------------------------------------------------------------- //

function registerIpc(): void {
  ipcMain.handle(IPC.system_getPlatform, () => process.platform);
  ipcMain.handle(IPC.system_openExternal, (_e, url: string) => shell.openExternal(url));
  ipcMain.handle(IPC.system_openPath, (_e, p: string) => shell.openPath(p));
  ipcMain.handle(IPC.system_quit, () => app.quit());

  ipcMain.handle(IPC.manifests_list, () => specs);

  ipcMain.handle(IPC.env_read, async (_e, key: string) => {
    const spec = getServerOrThrow(specs, key);
    return readEnv(envFile(spec.serverDirName));
  });
  ipcMain.handle(IPC.env_write, async (_e, key: string, values: Record<string, string>) => {
    const spec = getServerOrThrow(specs, key);
    // Server-side validation guards against a bad renderer.
    for (const f of spec.fields) {
      const err = validateField(f, values[f.key] ?? '');
      if (err && f.required) throw new Error(`${f.label}: ${err}`);
    }
    const path = envFile(spec.serverDirName);
    await writeEnv(path, values, 'MCP-Installer — written by the Setup Wizard.');
    return { path };
  });

  ipcMain.handle(IPC.selection_load, () => loadSelection());
  ipcMain.handle(IPC.selection_save, (_e, keys: string[]) => saveSelection(keys));

  ipcMain.handle(IPC.proxy_detect, () => detectProxy());

  ipcMain.handle(IPC.tester_test, async (_e, key: string, values: Record<string, string>) => {
    const spec = getServerOrThrow(specs, key);
    return testConnection(spec, values);
  });

  ipcMain.handle(IPC.server_listStatuses, () => controller?.snapshotAll() ?? []);
  ipcMain.handle(IPC.server_start, (_e, key: string) => controller?.start(key));
  ipcMain.handle(IPC.server_stop, (_e, key: string) => controller?.stop(key));
  ipcMain.handle(IPC.server_restart, (_e, key: string) => controller?.restart(key));
  ipcMain.handle(IPC.server_startAll, () => controller?.startAll());
  ipcMain.handle(IPC.server_stopAll, () => controller?.stopAll());
  ipcMain.handle(IPC.server_openLog, (_e, key: string) => {
    const path = logFileFor(key);
    if (!existsSync(path)) return;
    return shell.openPath(path);
  });

  ipcMain.handle(IPC.shortcuts_info, (_e, location: ShortcutLocation) => shortcutInfo(location));
  ipcMain.handle(IPC.shortcuts_create, (_e, location: ShortcutLocation) => {
    // Shortcut targets the current Electron executable — clicking it opens
    // the Control Panel window directly.
    const target = process.execPath;
    const args = location === 'startup' ? '--open-panel --start-servers' : '--open-panel';
    return createShortcut(location, target, args);
  });
  ipcMain.handle(IPC.shortcuts_remove, (_e, location: ShortcutLocation) => removeShortcut(location));

  ipcMain.handle(IPC.vscode_integrate, (_e, keys: string[]) => {
    const chosen = specs.filter((s) => keys.includes(s.key));
    return integrateAll(chosen);
  });

  ipcMain.handle(IPC.windows_openWizard, () => ensureWizardWindow());
  ipcMain.handle(IPC.windows_openPatRotation, (_e, serverKey: string) => ensureWizardWindow(`rotate/${serverKey}`));
  ipcMain.handle(IPC.windows_openControlPanel, () => ensureControlPanelWindow());
  ipcMain.handle(IPC.windows_closeCurrent, (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    win?.close();
  });

  ipcMain.handle(IPC.python_detect, () => detectPython());

  ipcMain.handle(IPC.bootstrap_run, async (_e, req: BootstrapRequest): Promise<BootstrapResult> => {
    try {
      const chosen = specs.filter((s) => req.serverKeys.includes(s.key));
      if (chosen.length === 0) throw new Error('No servers selected.');
      const py = await detectPython();
      if (!py.found || !py.executable) {
        throw new Error(`Python ${py.minSupported}+ not found on PATH`);
      }
      await bulkBootstrap({
        specs: chosen,
        pythonExecutable: py.executable,
        envValuesByServer: req.envValuesByServer,
        proxy: req.proxy ?? null,
        force: req.force,
        onProgress: (evt) => {
          for (const w of BrowserWindow.getAllWindows()) {
            w.webContents.send(IPC.bootstrap_progress, evt);
          }
        },
      });
      if (controller) replaceController();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle(IPC.bootstrap_completed, () => wizardCompleted());
  ipcMain.handle(IPC.bootstrap_markCompleted, () => markWizardCompleted());
}

// --------------------------------------------------------------------------- //
// App lifecycle
// --------------------------------------------------------------------------- //

function decideInitialWindow(): 'wizard' | 'panel' {
  if (process.argv.includes('--open-panel')) return 'panel';
  if (process.argv.includes('--open-wizard')) return 'wizard';
  return wizardCompleted() ? 'panel' : 'wizard';
}

app.setName('MCP-Installer');

// Single-instance lock — clicking the shortcut a second time just focuses.
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', async () => {
    await ensureControlPanelWindow();
  });

  app.whenReady().then(async () => {
    ensureDataDirs();
    const manifestSource = describeSource();
    console.log(`[MCP-Installer] Manifests: ${manifestSource.dir} (${manifestSource.found.join(', ')})`);
    specs = loadManifests();
    replaceController();

    registerIpc();

    // If launched from the startup shortcut, auto-start all servers so the
    // UI opening on login also ensures MCP servers are running.
    if (process.argv.includes('--start-servers')) {
      // controller is initialized in replaceController(); start all known servers.
      void controller?.startAll();
    }

    const target = decideInitialWindow();
    if (target === 'wizard') await ensureWizardWindow();
    else await ensureControlPanelWindow();
  });

  app.on('window-all-closed', () => {
    // Servers keep running in the background regardless — we spawned them
    // detached. Quitting Electron here just closes the UI.
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    controller?.stopPoller();
  });
}
