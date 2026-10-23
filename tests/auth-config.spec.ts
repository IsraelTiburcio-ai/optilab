import {test, expect} from '@playwright/test';
import {firebaseSettings} from '../src/auth/config';
import {authErrorMessage} from '../src/auth/messages';

const demo = {
  VITE_FIREBASE_API_KEY:'demo-emulator-only-key', VITE_FIREBASE_AUTH_DOMAIN:'demo-optilab-auth.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID:'demo-optilab-auth', VITE_FIREBASE_STORAGE_BUCKET:'demo-optilab-auth.example',
  VITE_FIREBASE_MESSAGING_SENDER_ID:'123456789', VITE_FIREBASE_APP_ID:'1:123456789:web:demooptilabauth',
};
test('configuración ausente no inventa una key y el emulador falla cerrado fuera de desarrollo local',()=>{
  expect(firebaseSettings({}).status).toBe('missing');
  expect(firebaseSettings({...demo,VITE_FIREBASE_API_KEY:''})).toMatchObject({status:'missing',missing:['VITE_FIREBASE_API_KEY']});
  expect(firebaseSettings(demo).status).toBe('ready');
  expect(firebaseSettings({...demo,DEV:true,VITE_FIREBASE_AUTH_EMULATOR_URL:'http://127.0.0.1:9099'})).toMatchObject({status:'ready',emulatorUrl:'http://127.0.0.1:9099'});
  expect(firebaseSettings({...demo,DEV:false,VITE_FIREBASE_AUTH_EMULATOR_URL:'http://127.0.0.1:9099'}).status).toBe('invalid');
  expect(firebaseSettings({...demo,DEV:true,VITE_FIREBASE_PROJECT_ID:'optilab-cd829',VITE_FIREBASE_AUTH_EMULATOR_URL:'http://127.0.0.1:9099'}).status).toBe('invalid');
  expect(firebaseSettings({...demo,DEV:true,VITE_FIREBASE_AUTH_EMULATOR_URL:'https://untrusted.example'}).status).toBe('invalid');
});
test('errores no exponen el mensaje crudo ni distinguen cuenta ausente de contraseña incorrecta',()=>{
  expect(authErrorMessage({code:'auth/user-not-found'})).toBe(authErrorMessage({code:'auth/wrong-password'}));
  expect(authErrorMessage({message:'private-token-and-email'})).not.toContain('private-token');
  expect(authErrorMessage({code:'auth/popup-blocked'})).toContain('ventanas emergentes');
});
