import { create } from 'zustand';
import type { ServerSpec } from '@shared/types';

/**
 * All state accumulated during the Setup Wizard. One store per wizard run.
 * When the user finishes, we call the appropriate IPC handlers to persist.
 */
interface WizardState {
  loaded: boolean;
  specs: ServerSpec[];

  selectedKeys: string[];
  proxyHttp: string;
  proxyHttps: string;
  /** values[serverKey][FIELD_KEY] = "value" */
  values: Record<string, Record<string, string>>;

  createStartMenu: boolean;
  createDesktop: boolean;
  createStartup: boolean;
  openPanelNow: boolean;

  completed: boolean;

  bootstrap: () => Promise<void>;
  toggleServer: (key: string) => void;
  setProxy: (http: string, https: string) => void;
  setValue: (server: string, field: string, value: string) => void;
  setValues: (server: string, values: Record<string, string>) => void;
  setDone: (patch: Partial<Pick<WizardState, 'createStartMenu' | 'createDesktop' | 'createStartup' | 'openPanelNow'>>) => void;
  markCompleted: () => void;
}

export const useWizardStore = create<WizardState>((set, get) => ({
  loaded: false,
  specs: [],

  selectedKeys: [],
  proxyHttp: '',
  proxyHttps: '',
  values: {},

  createStartMenu: true,
  createDesktop: true,
  createStartup: false,
  openPanelNow: true,

  completed: false,

  async bootstrap() {
    if (get().loaded) return;
    const specs = await window.api.manifests.list();
    const values: WizardState['values'] = {};
    for (const spec of specs) {
      let existing: Record<string, string> = {};
      try {
        existing = await window.api.env.read(spec.key);
      } catch { /* no .env yet */ }
      const merged: Record<string, string> = {};
      for (const f of spec.fields) {
        const fromDisk = existing[f.key];
        const seed = (fromDisk !== undefined && fromDisk !== '') ? fromDisk : (f.default ?? '');
        merged[f.key] = seed;
      }
      values[spec.key] = merged;
    }
    const selectedFromDisk = await window.api.selection.load().catch(() => null);
    const selectedKeys = selectedFromDisk?.length ? selectedFromDisk : specs.map((s) => s.key);
    set({
      loaded: true,
      specs,
      selectedKeys,
      values,
      proxyHttp: '',
      proxyHttps: '',
    });
  },

  toggleServer(key) {
    const cur = new Set(get().selectedKeys);
    if (cur.has(key)) cur.delete(key);
    else cur.add(key);
    set({ selectedKeys: [...cur] });
  },

  setProxy(http, https) {
    set({ proxyHttp: http, proxyHttps: https });
  },

  setValue(server, field, value) {
    const cur = get().values;
    set({
      values: {
        ...cur,
        [server]: { ...(cur[server] ?? {}), [field]: value },
      },
    });
  },

  setValues(server, values) {
    set({ values: { ...get().values, [server]: values } });
  },

  setDone(patch) {
    set(patch);
  },

  markCompleted() {
    set({ completed: true });
  },
}));
