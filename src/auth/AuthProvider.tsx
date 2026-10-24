import {createContext, useContext, useEffect, useRef, useState, type ReactNode} from 'react';
import {authSettings} from './config';
import type {AccountUser, AuthClient} from './types';
import {acceptInteractiveLogin,announceLogout,logoutBlocked,logoutGeneration,subscribeSessions} from './sessionSignals';

type AuthStatus = 'loading' | 'guest' | 'authenticated' | 'unavailable' | 'error';
const Context = createContext<{
  status: AuthStatus; user: AccountUser | null; temporary: boolean; settings: typeof authSettings;
  login: AuthClient['login']; register: AuthClient['register']; google: AuthClient['google'];
  logout: AuthClient['logout']; resetPassword: AuthClient['resetPassword'];
  sendVerification: AuthClient['sendVerification']; refreshUser: () => Promise<void>;
  getIdToken: AuthClient['getIdToken']; isCurrentSession:(uid:string)=>boolean;
} | null>(null);

/** Identity only. Never imports, resets, keys or remounts the ProgressProvider. */
export function AuthProvider({children,coordinateSessions=false}: {children: ReactNode;coordinateSessions?:boolean}) {
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
    let stopSignals:(()=>void)|undefined;
    import('./firebaseClient').then(module => module.initializeAuthClient(settings)).then(service => {
      if (!active) return;
      client.current = service;
      setTemporary(service.persistence === 'memory');
      const publish=(account:AccountUser|null,force=false)=>{
        if (!active) return;
        if(!force&&(service.currentAccount()?.uid??null)!==(account?.uid??null))return;
        const visible=account&&!(coordinateSessions&&logoutBlocked(account.uid))?account:null;
        currentUid.current=visible?.uid??null;setUser(visible);setStatus(visible?'authenticated':'guest');
      };
      unsubscribe = service.subscribe(publish, () => {if (active) {setUser(null); currentUid.current = null; setStatus('error');}});
      if(coordinateSessions)stopSignals=subscribeSessions(signal=>{
        if(!active)return;
        const account=service.currentAccount();
        // Do not race a fresh interactive login by calling signOut repeatedly in
        // peer tabs. The fence hides the session and blocks transport immediately;
        // the initiating tab performs SDK signOut, and native SDK persistence follows.
        if(signal.kind==='logout'&&account?.uid===signal.uid)publish(null,true);
        else if(signal.kind==='accepted'&&account?.uid===signal.uid)publish(account);
      });
    }).catch(() => {if (active) setStatus('error');});
    return () => {active = false; unsubscribe?.();stopSignals?.(); client.current = null;};
  }, [coordinateSessions]);
  const service = () => {
    if (!client.current || status === 'loading' || status === 'unavailable' || status === 'error') throw new Error('Auth unavailable');
    return client.current;
  };
  const interactive=async(action:(client:AuthClient)=>Promise<void>)=>{
    const sdk=service();
    if(!coordinateSessions){await action(sdk);return;}
    const generation=logoutGeneration();await action(sdk);
    const account=sdk.currentAccount();
    if(account&&acceptInteractiveLogin(account.uid,generation)){
      currentUid.current=account.uid;setUser(account);setStatus('authenticated');
    } else {setUser(null);currentUid.current=null;setStatus('guest');throw Object.assign(new Error('Session changed during login'),{code:'auth/session-changed'});}
  };
  return <Context.Provider value={{status, user, temporary, settings: authSettings,
    isCurrentSession:uid=>currentUid.current===uid&&client.current?.currentAccount()?.uid===uid&&!(coordinateSessions&&logoutBlocked(uid)),
    getIdToken:async uid=>{
      if(currentUid.current!==uid||(coordinateSessions&&logoutBlocked(uid)))throw new Error('Session changed');
      const token=await service().getIdToken(uid);
      if(currentUid.current!==uid||(coordinateSessions&&logoutBlocked(uid)))throw new Error('Session changed');
      return token;
    },
    login: (email,password) => interactive(sdk=>sdk.login(email,password)), register: (email,password) => interactive(sdk=>sdk.register(email,password)),
    google: () => interactive(sdk=>sdk.google()), logout: async () => {
      const sdk=service(),uid=sdk.currentAccount()?.uid;
      if(coordinateSessions&&uid){announceLogout(uid);setUser(null);currentUid.current=null;setStatus('guest');}
      await sdk.logout();
    }, resetPassword: email => service().resetPassword(email),
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
