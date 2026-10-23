import {createContext, useContext, useEffect, useRef, useState, type ReactNode} from 'react';
import {authSettings} from './config';
import type {AccountUser, AuthClient} from './types';

type AuthStatus = 'loading' | 'guest' | 'authenticated' | 'unavailable' | 'error';
const Context = createContext<{
  status: AuthStatus; user: AccountUser | null; temporary: boolean; settings: typeof authSettings;
  login: AuthClient['login']; register: AuthClient['register']; google: AuthClient['google'];
  logout: AuthClient['logout']; resetPassword: AuthClient['resetPassword'];
  sendVerification: AuthClient['sendVerification']; refreshUser: () => Promise<void>;
} | null>(null);

/** Identity only. Never imports, resets, keys or remounts the ProgressProvider. */
export function AuthProvider({children}: {children: ReactNode}) {
  const [status, setStatus] = useState<AuthStatus>(authSettings.status === 'ready' ? 'loading' : 'unavailable');
  const [user, setUser] = useState<AccountUser | null>(null);
  const [temporary, setTemporary] = useState(false);
  const client = useRef<AuthClient | null>(null);
  const currentUid = useRef<string | null>(null);
  useEffect(() => {
    if (authSettings.status !== 'ready') return;
    const settings = authSettings;
    let active = true;
    let unsubscribe: (() => void) | undefined;
    import('./firebaseClient').then(module => module.initializeAuthClient(settings)).then(service => {
      if (!active) return;
      client.current = service;
      setTemporary(service.persistence === 'memory');
      unsubscribe = service.subscribe(account => {
        if (!active) return;
        currentUid.current = account?.uid || null;
        setUser(account);
        setStatus(account ? 'authenticated' : 'guest');
      }, () => {if (active) {setUser(null); currentUid.current = null; setStatus('error');}});
    }).catch(() => {if (active) setStatus('error');});
    return () => {active = false; unsubscribe?.(); client.current = null;};
  }, []);
  const service = () => {
    if (!client.current || status === 'loading' || status === 'unavailable' || status === 'error') throw new Error('Auth unavailable');
    return client.current;
  };
  return <Context.Provider value={{status, user, temporary, settings: authSettings,
    login: (email,password) => service().login(email,password), register: (email,password) => service().register(email,password),
    google: () => service().google(), logout: () => service().logout(), resetPassword: email => service().resetPassword(email),
    sendVerification: () => service().sendVerification(),
    refreshUser: async () => {
      const uid = currentUid.current;
      const account = await service().refreshUser();
      if (uid && uid === currentUid.current && account?.uid === uid) setUser(account);
    },
  }}>{children}</Context.Provider>;
}
export function useAuth() {
  const context = useContext(Context);
  if (!context) throw new Error('AuthProvider requerido');
  return context;
}
