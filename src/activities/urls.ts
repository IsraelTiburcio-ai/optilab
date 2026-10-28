import type {ActivityProvider,ExternalActivity} from './types';
/** No pasted HTML, arbitrary iframe URL or arbitrary provider query is consumed. */
export function approvedActivityUrl(provider:ActivityProvider,value:string,kind:'source'|'embed',resourceId:string):string|null {
  if(typeof value!=='string'||value.length>1000||value!==value.trim()||/[\s\\\u0000-\u001f\u007f]/.test(value))return null;
  let url:URL;try{url=new URL(value);}catch{return null;}
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash)return null;
  const entries=[...url.searchParams];
  if(new Set(entries.map(([k])=>k)).size!==entries.length)return null;
  if(provider==='learningapps'){
    if(url.hostname!=='learningapps.org'||!/^[a-z0-9]{8,32}$/.test(resourceId))return null;
    const key=kind==='source'?'v':'id';
    if(url.pathname!==(kind==='source'?'/watch':'/show.php')||entries.length!==1||url.searchParams.get(key)!==resourceId)return null;
  }else if(provider==='wordwall'){
    if(url.hostname!=='wordwall.net'||!/^[a-f0-9]{32}$/.test(resourceId))return null;
    if(kind==='source'){
      const path=/^\/(?:es\/)?resource\/[1-9][0-9]{0,11}\/([^/]{1,480})$/.exec(url.pathname);
      if(!path||entries.length)return null;
      try{if(!/^[\p{L}\p{N}_-]{1,160}$/u.test(decodeURIComponent(path[1])))return null;}catch{return null;}
    }else{
      if(url.pathname!==`/es/embed/${resourceId}`||entries.length!==3||entries.some(([k,v])=>!['themeId','templateId','fontStackId'].includes(k)||!/^(0|[1-9][0-9]{0,5})$/.test(v)))return null;
    }
  }else return null;
  return url.href;
}
export function validatedActivity(activity:ExternalActivity):ExternalActivity|null {
  const sourceUrl=approvedActivityUrl(activity.provider,activity.sourceUrl,'source',activity.resourceId),embedUrl=approvedActivityUrl(activity.provider,activity.embedUrl,'embed',activity.resourceId);
  return sourceUrl&&embedUrl?{...activity,sourceUrl,embedUrl}:null;
}
export function iframePolicy(provider:ActivityProvider){
  if(!['learningapps','wordwall'].includes(provider))throw new Error('UNSUPPORTED_ACTIVITY_PROVIDER');
  // These two real resources were tested with this restricted policy. No top
  // navigation, popups, downloads, modals, pointer lock or device permissions.
  return {sandbox:'allow-scripts allow-same-origin allow-forms',referrerPolicy:'no-referrer' as const,
    allow:"camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'; autoplay 'none'; fullscreen 'none'"};
}
