import {spawnSync} from 'node:child_process';
import {teacherEnvironment} from './teacher-env.mjs';
if(process.argv.length!==2)throw new Error('ACADEMIC_ENV_REJECTED');
const result=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5195','--strictPort'],{stdio:'inherit',env:teacherEnvironment()});
process.exit(result.status??1);
