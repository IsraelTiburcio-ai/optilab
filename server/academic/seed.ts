import {localConfig} from './config';
localConfig(process.env);
if(process.argv.length!==2||process.env.ACADEMIC_BOOTSTRAP!=='synthetic-v1')throw new Error('ACADEMIC_BOOTSTRAP_REJECTED');
const password=process.env.ACADEMIC_FIXTURE_PASSWORD??'';
if(password.length<12)throw new Error('ACADEMIC_BOOTSTRAP_REJECTED');
const [{emulatorAdmin},{seedFixtures}]=await Promise.all([import('./sdk'),import('./bootstrap')]);
const sdk=await emulatorAdmin();
try{console.log(JSON.stringify(await seedFixtures(sdk,password),null,2));}finally{await sdk.close();}
