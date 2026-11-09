import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const manifestPath=path.join(root,'brand-assets.json');
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const remote=process.argv.includes('--remote');
const failures=[];
const fail=(message)=>failures.push(message);
const sha=(file)=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const pngSize=(file)=>{
  const data=fs.readFileSync(file);
  if(data.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new Error('PNG signature');
  return {width:data.readUInt32BE(16),height:data.readUInt32BE(20)};
};
if(manifest.schema!=='optilab.brand-assets/v1')fail('schema');
if(!/^[a-z0-9]+$/.test(manifest.provider?.cloud_name||''))fail('cloud_name');
if(Number(manifest.integration?.interface_changed)!==0)fail('interface_changed');
const ids=new Set(),publicIds=new Set(),cdnHashes=new Set();
for(const asset of manifest.cdn_assets||[]){
  if(cdnHashes.has(asset.sha256))fail(`duplicate cdn source ${asset.id}`);cdnHashes.add(asset.sha256);
  if(!asset.public_id?.startsWith(`${manifest.provider.folder}/`))fail(`public_id ${asset.id}`);
  if(publicIds.has(asset.public_id))fail(`duplicate public_id ${asset.public_id}`);
  publicIds.add(asset.public_id);
  if(ids.has(asset.id))fail(`duplicate id ${asset.id}`);ids.add(asset.id);
  if(!asset.original_url?.startsWith(`https://res.cloudinary.com/${manifest.provider.cloud_name}/image/upload/`))fail(`original_url ${asset.id}`);
  if(!Array.isArray(asset.delivery_variants)||!asset.delivery_variants.length)fail(`variants ${asset.id}`);
  for(const variant of asset.delivery_variants||[]){
    if(!variant.transformation?.includes('f_auto')||!variant.transformation?.includes('q_auto')||!variant.transformation?.includes('c_limit'))fail(`transformation ${asset.id}/${variant.name}`);
    if(!variant.url?.includes(`/image/upload/${variant.transformation}/`))fail(`variant_url ${asset.id}/${variant.name}`);
    if(!Number.isInteger(variant.width)||variant.width<1)fail(`variant_width ${asset.id}/${variant.name}`);
  }
}
if((manifest.cdn_assets||[]).length!==14)fail('cdn_asset_count');
const localHashes=new Set(),localPaths=new Set();
for(const asset of manifest.local_assets||[]){
  const file=path.join(root,asset.path);
  if(!fs.existsSync(file)){fail(`missing ${asset.path}`);continue;}
  if(asset.path!==`public/${asset.vite_path}`||!asset.vite_path?.startsWith('brand/'))fail(`vite_path ${asset.path}`);
  if(localPaths.has(asset.path))fail(`duplicate local path ${asset.path}`);localPaths.add(asset.path);
  const hash=sha(file);
  if(hash!==asset.sha256)fail(`sha256 ${asset.path}`);
  if(localHashes.has(hash))fail(`duplicate local bytes ${asset.path}`);localHashes.add(hash);
  if(asset.format==='png'){
    const size=pngSize(file);
    if(size.width!==asset.width||size.height!==asset.height)fail(`dimensions ${asset.path}`);
  }
}
for(const required of ['icon-192.png','icon-512.png','apple-touch-icon.png','favicon.ico','favicon.svg'])if(!localPaths.has(`public/brand/pwa/${required}`))fail(`missing pwa ${required}`);
for(const duplicate of manifest.deduplicated||[]){if(!localPaths.has(duplicate.kept))fail(`dedupe target ${duplicate.kept}`);}
const serialized=JSON.stringify(manifest);
for(const forbidden of ['api_key','api_secret','accessToken','refreshToken','signature','/Users/'])if(serialized.includes(forbidden))fail(`forbidden field ${forbidden}`);
if(remote){
  for(const asset of manifest.cdn_assets||[]){
    for(const url of [asset.original_url,...asset.delivery_variants.map(v=>v.url)]){
      const response=await fetch(url,{headers:{Accept:'image/webp,image/png;q=0.9,*/*;q=0.1'}});
      const type=response.headers.get('content-type')||'';
      if(!response.ok)fail(`remote ${response.status} ${url}`);
      else if(!type.startsWith('image/'))fail(`remote content-type ${type} ${url}`);
    }
  }
}
if(failures.length){console.error(JSON.stringify({ok:false,failures},null,2));process.exit(1);}
console.log(JSON.stringify({ok:true,cdnAssets:manifest.cdn_assets.length,localAssets:manifest.local_assets.length,remoteChecked:remote},null,2));
process.exit(0);
