import {mkdtempSync,writeFileSync,symlinkSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {pathToFileURL} from 'node:url';import {spawnSync} from 'node:child_process';
const dir=mkdtempSync(join(tmpdir(),'optilab-native-esm-'));
try{
 writeFileSync(join(dir,'package.json'),'{"type":"module"}');symlinkSync(resolve('node_modules'),join(dir,'node_modules'),'dir');
 const compile=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','-p','tsconfig.academic.json','--noEmit','false','--allowImportingTsExtensions','false','--rootDir','.', '--outDir',dir],{encoding:'utf8'});
 if(compile.status!==0)throw Error('Native server compilation failed: '+compile.stdout+compile.stderr);
 const entry=pathToFileURL(join(dir,'server/academic/service.js')).href;
 const native=spawnSync(process.execPath,['--input-type=module','-e',`await import(${JSON.stringify(entry)});process.stdout.write('NATIVE_ESM_PASS');`],{encoding:'utf8'});
 if(native.status!==0||native.stdout!=='NATIVE_ESM_PASS')throw Error('Native server import failed: '+native.stderr);
 console.log('NATIVE_ESM_PASS');
}finally{rmSync(dir,{recursive:true,force:true});}
