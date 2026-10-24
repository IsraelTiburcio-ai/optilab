import {localConfig} from './config';
if(process.argv.length!==2)throw new Error('ACADEMIC_ENV_REJECTED');
// Guard executes BEFORE even loading the SDK initialization module.
const config=localConfig(process.env);
const [{emulatorAdmin},{AcademicRepository},{AcademicService},{httpServer}]=await Promise.all([
  import('./sdk'),import('./repository'),import('./service'),import('./http'),
]);
const sdk=await emulatorAdmin(),service=new AcademicService(new AcademicRepository(sdk.db),sdk,config.maxTtlSeconds);
const server=httpServer(config,sdk,service);
server.requestTimeout=15000;server.headersTimeout=10000;
server.listen(config.port,config.host,()=>console.log(`Academic emulator API http://127.0.0.1:${(server.address() as {port:number}).port} (${config.projectId})`));
const stop=()=>{server.close(()=>void sdk.close());};process.once('SIGINT',stop);process.once('SIGTERM',stop);
