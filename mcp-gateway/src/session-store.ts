import { randomUUID } from "node:crypto";

export interface SessionUserProfile {
  sub?: string;
  name?: string;
  email?: string;
  preferredUsername?: string;
}

export interface SessionRecord {
  id: string;
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt?: number;
  user?: SessionUserProfile;
}

export interface SessionStore {
  create(record: Omit<SessionRecord, "id">): SessionRecord;
  get(id: string): SessionRecord | undefined;
  delete(id: string): void;
}

export function createInMemorySessionStore(): SessionStore {
  const sessions = new Map<string, SessionRecord>();

  return {
    create(record) {
      const id = randomUUID();
      const session: SessionRecord = { id, ...record };
      sessions.set(id, session);
      return session;
    },
    get(id) {
      const session = sessions.get(id);
      if (!session) {
        return undefined;
      }

      if (session.expiresAt && session.expiresAt * 1000 < Date.now()) {
        sessions.delete(id);
        return undefined;
      }

      return session;
    },
    delete(id) {
      sessions.delete(id);
    },
  };
}