export interface SessionRecord {
  id: string;
  userId: string;
  expiresAt: Date;
}

export abstract class SessionStore {
  abstract create(userId: string, tokenHash: string): Promise<SessionRecord>;
  abstract findValidByTokenHash(
    tokenHash: string,
  ): Promise<SessionRecord | null>;
  abstract deleteByTokenHash(tokenHash: string): Promise<void>;
}
