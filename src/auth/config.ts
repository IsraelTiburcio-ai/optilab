export const firebaseEnvironmentKeys = [
  'VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET', 'VITE_FIREBASE_MESSAGING_SENDER_ID', 'VITE_FIREBASE_APP_ID',
] as const;
export interface PublicFirebaseConfig {
  apiKey: string; authDomain: string; projectId: string;
  storageBucket: string; messagingSenderId: string; appId: string;
}
export type FirebaseSettings =
  {status: 'ready'; config: PublicFirebaseConfig; emulatorUrl: string | null} |
  {status: 'missing' | 'invalid'; missing: string[]};

export function firebaseSettings(env: Record<string, unknown>): FirebaseSettings {
  const values = firebaseEnvironmentKeys.map(key => typeof env[key] === 'string' ? (env[key] as string).trim() : '');
  const missing = firebaseEnvironmentKeys.filter((_, i) => !values[i]);
  if (missing.length) return {status: 'missing', missing};
  const [apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId] = values;
  if (!/^[a-z0-9.-]+$/i.test(authDomain) || !/^[a-z0-9-]+$/.test(projectId) || !/^\d+$/.test(messagingSenderId) || !appId.startsWith('1:') || /[<>\s]/.test(apiKey)) {
    return {status: 'invalid', missing: []};
  }
  let emulatorUrl: string | null = null;
  if (env.VITE_FIREBASE_AUTH_EMULATOR_URL) {
    try {
      const url = new URL(String(env.VITE_FIREBASE_AUTH_EMULATOR_URL));
      if (env.DEV !== true || !projectId.startsWith('demo-') || url.protocol !== 'http:' ||
          !['localhost','127.0.0.1'].includes(url.hostname) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
        return {status: 'invalid', missing: []};
      }
      emulatorUrl = url.origin;
    } catch { return {status: 'invalid', missing: []}; }
  }
  return {status: 'ready', config: {apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId}, emulatorUrl};
}
export const authSettings = firebaseSettings(import.meta.env ?? {});
