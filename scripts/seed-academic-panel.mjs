import {spawnSync} from 'node:child_process';
import {academicEnvironment} from './academic-env.mjs';
if(process.argv.length!==2||process.env.ACADEMIC_BOOTSTRAP!=='synthetic-v1')throw new Error('ACADEMIC_BOOTSTRAP_REJECTED');
const result=spawnSync(process.execPath,['--import','tsx','server/academic/seed-panel.ts'],{stdio:'inherit',env:academicEnvironment()});
process.exit(result.status??1);
