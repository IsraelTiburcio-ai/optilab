import {academicEnvironment} from './academic-env.mjs';
export function teacherEnvironment(source=process.env) {
  const env=academicEnvironment(source);
  const web={VITE_FIREBASE_API_KEY:'demo-emulator-only-key',VITE_FIREBASE_AUTH_DOMAIN:'demo-optilab-sync.firebaseapp.com',
    VITE_FIREBASE_PROJECT_ID:'demo-optilab-sync',VITE_FIREBASE_STORAGE_BUCKET:'demo-optilab-sync.example',
    VITE_FIREBASE_MESSAGING_SENDER_ID:'123456789',VITE_FIREBASE_APP_ID:'1:123456789:web:demooptilabsync',
    VITE_FIREBASE_AUTH_EMULATOR_URL:'http://127.0.0.1:9099',VITE_FIRESTORE_EMULATOR_HOST:'127.0.0.1:8085',
    VITE_PROGRESS_SYNC:'emulator',VITE_ACADEMIC_ADMIN:'emulator'};
  if(Object.entries(web).some(([key,value])=>source[key]&&source[key]!==value))throw new Error('ACADEMIC_ENV_REJECTED');
  return {...env,...web};
}
