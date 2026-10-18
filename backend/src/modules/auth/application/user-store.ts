export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
}

export abstract class UserStore {
  abstract findByEmail(email: string): Promise<UserRecord | null>;
}
