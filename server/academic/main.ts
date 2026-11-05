import {localConfig} from './config.js';
if(process.argv.length!==2)throw new Error('ACADEMIC_ENV_REJECTED');
// Guard executes BEFORE even loading the SDK initialization module.
const config=localConfig(process.env);
const [{emulatorAdmin},{AcademicRepository},{AcademicService},{httpServer}]=await Promise.all([
  import('./sdk.js'),import('./repository.js'),import('./service.js'),import('./http.js'),
]);
const sdk=await emulatorAdmin(),service=new AcademicService(new AcademicRepository(sdk.db),sdk,config.maxTtlSeconds,{progressAttemptLimit:config.progressAttemptLimit});
const server=httpServer(config,sdk,service);
server.requestTimeout=15000;server.headersTimeout=10000;
server.listen(config.port,config.host,()=>console.log(`Academic emulator API http://127.0.0.1:${(server.address() as {port:number}).port} (${config.projectId})`));
const stop=()=>{server.close(()=>void sdk.close());};process.once('SIGINT',stop);process.once('SIGTERM',stop);
