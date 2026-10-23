import {spawnSync} from 'node:child_process';

// This entry point cannot select a real project or reuse a caller-supplied host.
// firebase-tools is tooling only, not part of the web app or its deployment.
if (process.argv.length !== 2 || process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Run npm run test:firestore without arguments or a pre-existing emulator host.');
}
const result = spawnSync('npx', ['--yes', 'firebase-tools@15.0.0', 'emulators:exec',
  '--only', 'firestore', '--project', 'demo-optilab-firestore',
  '--config', 'firebase.firestore-emulator.json', 'npm run test:firestore:rules'], {
  stdio: 'inherit', env: {...process.env, GCLOUD_PROJECT: 'demo-optilab-firestore', GOOGLE_CLOUD_PROJECT: 'demo-optilab-firestore'},
});
process.exit(result.status ?? 1);
