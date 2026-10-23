export interface AccountUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
  providers: string[];
}
export interface AuthClient {
  persistence: 'local' | 'memory';
  subscribe: (next: (user: AccountUser | null) => void, error: (reason: unknown) => void) => () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  google: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  sendVerification: () => Promise<void>;
  refreshUser: () => Promise<AccountUser | null>;
}
