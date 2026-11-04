import {test} from 'node:test';
import assert from 'node:assert/strict';
import {adventureStorageNotice,attemptStorageNotice} from '../../src/progress/privacyCopy';
test('production, emulator and OFF notices describe the actual storage channel',()=>{
  assert.match(adventureStorageNotice('production'),/Firebase requiere tu consentimiento/);
  assert.doesNotMatch(adventureStorageNotice('production'),/emulador|únicamente en este navegador/);
  assert.match(adventureStorageNotice('emulator'),/emuladores locales/);
  assert.match(adventureStorageNotice('disabled'),/No se sincroniza entre dispositivos/);
  assert.match(attemptStorageNotice(true),/consentimiento independiente/);
  assert.doesNotMatch(attemptStorageNotice(true),/No se sincronizan/);
  assert.match(attemptStorageNotice(false),/No se sincronizan/);
});
