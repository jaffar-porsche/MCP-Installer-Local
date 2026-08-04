/**
 * Auto-updater wiring for MCPorsche.
 *
 * `electron-updater` reads the same feed that `electron-builder` publishes to
 * (GitHub Releases, per `electron-builder.yml`). When a newer version is
 * available, we download it silently and prompt the user to restart at a
 * convenient moment. Users therefore never have to hunt for a new version.
 */
import { app, BrowserWindow, dialog } from 'electron';

type AutoUpdater = typeof import('electron-updater').autoUpdater;

let cached: AutoUpdater | null = null;
function getUpdater(): AutoUpdater | null {
  if (cached) return cached;
  try {
    // Lazy-require so HMR / non-packaged runs don't need the updater bundled.
    cached = require('electron-updater').autoUpdater as AutoUpdater;
    return cached;
  } catch {
    return null;
  }
}

export function startAutoUpdates(): void {
  if (!app.isPackaged) return;
  const u = getUpdater();
  if (!u) return;

  u.autoDownload = true;
  u.autoInstallOnAppQuit = true;

  u.on('update-downloaded', async (info) => {
    const win = BrowserWindow.getFocusedWindow();
    if (!win) return;
    const result = await dialog.showMessageBox(win, {
      type: 'info',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'MCPorsche — update ready',
      message: `Version ${info.version} downloaded.`,
      detail: 'Restart the app to complete the update.',
    });
    if (result.response === 0) u.quitAndInstall();
  });

  u.on('error', (err) => {
    console.warn('[updater] error:', err.message);
  });

  // First check ~1 minute after launch (VPN takes a moment) and every 6 h.
  setTimeout(() => void u.checkForUpdates().catch(() => undefined), 60_000);
  setInterval(
    () => void u.checkForUpdates().catch(() => undefined),
    6 * 60 * 60 * 1000,
  );
}
