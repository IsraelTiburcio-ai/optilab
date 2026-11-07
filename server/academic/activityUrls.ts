export type ActivityProvider='learningapps'|'wordwall';
export function approvedActivityUrl(provider:ActivityProvider,value:string,kind:'source'|'embed',resourceId:string):string|null {
  if(typeof value!=='string'||value.length>1000||value!==value.trim()||/[\s\\\u0000-\u001f\u007f]/.test(value))return null;
  let url:URL;try{url=new URL(value);}catch{return null;}
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash)return null;
  const entries=[...url.searchParams];
  if(new Set(entries.map(([key])=>key)).size!==entries.length)return null;
  if(provider==='learningapps'){
    if(url.hostname!=='learningapps.org'||!/^[a-z0-9]{8,32}$/.test(resourceId))return null;
    const key=kind==='source'?'v':'id';
    if(url.pathname!==(kind==='source'?'/watch':'/show.php')||entries.length!==1||url.searchParams.get(key)!==resourceId)return null;
  }else if(provider==='wordwall'){
    if(url.hostname!=='wordwall.net')return null;
    if(kind==='source'){
      if(!/^(?:[a-f0-9]{32}|[1-9][0-9]{0,11})$/.test(resourceId))return null;
      const path=/^\/(?:es\/)?resource\/([1-9][0-9]{0,11})\/([^/]{1,480})$/.exec(url.pathname);
      if(!path||entries.length||(/^[0-9]+$/.test(resourceId)&&path[1]!==resourceId))return null;
      try{if(!/^[\p{L}\p{N}_-]{1,160}$/u.test(decodeURIComponent(path[1])))return null;}catch{return null;}
    }else{
      if(!/^[a-f0-9]{32}$/.test(resourceId)||url.pathname!==`/es/embed/${resourceId}`||entries.length!==3||entries.some(([key,value])=>!['themeId','templateId','fontStackId'].includes(key)||!/^(0|[1-9][0-9]{0,5})$/.test(value)))return null;
    }
  }else return null;
  return url.href;
}
export function validatedActivityUrls(provider:ActivityProvider,resourceId:string,source:string,embed:string|null):{sourceUrl:string;embedUrl:string|null}|null {
  const sourceUrl=approvedActivityUrl(provider,source,'source',resourceId),embedUrl=embed===null?null:approvedActivityUrl(provider,embed,'embed',resourceId);
  return sourceUrl&&(embed===null||embedUrl)?{sourceUrl,embedUrl}:null;
}
export function providerTelemetry() {
  return {opened:false,completed:false,accuracy:false,errors:false,elapsedMs:false,evidence:'none' as const};
}
