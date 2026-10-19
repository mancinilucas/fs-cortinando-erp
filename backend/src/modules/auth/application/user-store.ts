export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
}

export interface UserIdentity {
  id: string;
  email: string;
}

export abstract class UserStore {
  abstract findByEmail(email: string): Promise<UserRecord | null>;
  abstract findById(id: string): Promise<UserIdentity | null>;
}
