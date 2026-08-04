import { Auth, DcrStore, Session } from "../auth/providers/dcrProxyProvider.js";

/**
 * 🚨 DEMO ONLY - NOT FOR PRODUCTION
 *
 * This example demonstrates a simple in-memory DCR store.
 * It is not suitable for production use due to its limitations:
 * - Lack of persistent storage
 */
export class DemoInMemoryDcrProxyStore implements DcrStore {
  private stateCodes = new Map<string, string>();
  private auths = new Map<string, Auth>();
  private codeSessionKeys = new Map<string, string>();
  private sessions = new Map<string, Session>();

  async setStateCode(state: string, code: string): Promise<void> {
    this.stateCodes.set(state, code);
  }

  async getStateCode(state: string) {
    return this.stateCodes.get(state);
  }

  async getAuth(code: string) {
    return this.auths.get(code);
  }

  async setAuth(code: string, session: Auth) {
    this.auths.set(code, session);
  }

  async setCodeSessionKey(code: string, sessionKey: string) {
    this.codeSessionKeys.set(code, sessionKey);
  }

  async getCodeSessionKey(code: string) {
    return this.codeSessionKeys.get(code);
  }

  async setSession(sessionKey: string, session: Session) {
    this.sessions.set(sessionKey, session);
  }

  async getSession(sessionKey: string) {
    return this.sessions.get(sessionKey);
  }
}
