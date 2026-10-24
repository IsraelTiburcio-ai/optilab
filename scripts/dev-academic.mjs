import {spawnSync} from 'node:child_process';
import {academicEnvironment} from './academic-env.mjs';
if(process.argv.length!==2)throw new Error('ACADEMIC_ENV_REJECTED');
const result=spawnSync(process.execPath,['--import','tsx','server/academic/main.ts'],{stdio:'inherit',env:academicEnvironment()});
process.exit(result.status??1);
