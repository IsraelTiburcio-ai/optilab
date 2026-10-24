import {getApps, initializeApp} from 'firebase/app';
import {
  browserLocalPersistence, connectAuthEmulator, createUserWithEmailAndPassword,
  getAuth, GoogleAuthProvider, inMemoryPersistence, onAuthStateChanged, reload,
  sendEmailVerification, sendPasswordResetEmail, setPersistence, signInWithEmailAndPassword,
  signInWithPopup, signOut, type User,
} from 'firebase/auth';
import type {AuthClient, AccountUser} from './types';
import type {FirebaseSettings} from './config';

const accountUser = (user: User | null): AccountUser | null => user ? {
  uid: user.uid, email: user.email, displayName: user.displayName, emailVerified: user.emailVerified,
  providers: user.providerData.map(p => p.providerId),
} : null;
let clientPromise: Promise<AuthClient> | null = null;

export function initializeAuthClient(settings: Extract<FirebaseSettings, {status: 'ready'}>): Promise<AuthClient> {
  if (clientPromise) return clientPromise;
  clientPromise = (async () => {
    const name = 'optilab-accounts';
    const previous=getApps().find(app=>app.name===name);
    if(previous&&(previous.options.projectId!==settings.config.projectId||previous.options.apiKey!==settings.config.apiKey))
      throw new Error('Firebase configuration changed; reload before authenticating.');
    const app = previous || initializeApp(settings.config, name);
    const auth = getAuth(app);
    if (settings.emulatorUrl&&!auth.emulatorConfig) connectAuthEmulator(auth, settings.emulatorUrl, {disableWarnings: true});
    auth.languageCode = 'es';
    let persistence: AuthClient['persistence'] = 'local';
    try {
      // setPersistence can short-circuit for an empty session of the same type.
      // A read-only availability check avoids claiming persistence when storage is blocked.
      void window.localStorage.length;
      await setPersistence(auth, browserLocalPersistence);
    }
    catch { await setPersistence(auth, inMemoryPersistence); persistence = 'memory'; }
    const actionSettings = () => ({url: new URL(`${import.meta.env.BASE_URL}#/cuenta`, window.location.origin).href});
    const requireUser = () => {
      if (!auth.currentUser) throw Object.assign(new Error('Session required'), {code: 'auth/no-current-user'});
      return auth.currentUser;
    };
    return {
      persistence,
      currentAccount: () => accountUser(auth.currentUser),
      getIdToken: async expectedUid => {
        const user=requireUser();
        if(user.uid!==expectedUid)throw new Error('Session changed');
        const token=await user.getIdToken();
        if(auth.currentUser!==user||user.uid!==expectedUid)throw new Error('Session changed');
        return token;
      },
      subscribe: (next, error) => onAuthStateChanged(auth, user => next(accountUser(user)), error),
      login: async (email, password) => { await signInWithEmailAndPassword(auth, email, password); },
      register: async (email, password) => {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        try { await sendEmailVerification(credential.user, actionSettings()); }
        catch { throw Object.assign(new Error('Verification pending'), {code: 'auth/verification-send-failed'}); }
      },
      // Invoked directly by the user's click, after initialization, without an awaited preflight.
      google: async () => {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({prompt: 'select_account'});
        await signInWithPopup(auth, provider);
      },
      logout: () => signOut(auth),
      resetPassword: async email => {
        try { await sendPasswordResetEmail(auth, email, actionSettings()); }
        catch (error) {
          // Match the generic success text even if an emulator/older config reveals absence.
          if (!(error && typeof error === 'object' && 'code' in error && error.code === 'auth/user-not-found')) throw error;
        }
      },
      sendVerification: async () => { await sendEmailVerification(requireUser(), actionSettings()); },
      refreshUser: async () => {
        const user = requireUser();
        await reload(user);
        await user.getIdToken(true); // SDK-managed refresh; never stored or logged by application code.
        return accountUser(auth.currentUser);
      },
    };
  })();
  return clientPromise;
}
