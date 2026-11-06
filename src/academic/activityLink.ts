import type {ActivityProvider} from './types';
export interface ResolvedActivityLink {
  provider:ActivityProvider;
  resourceId:string;
  sourceUrl:string;
  embedUrl:string|null;
  title:string;
  externalOnly:boolean;
}
const learningId=/^[a-z0-9]{8,32}$/;
const wordId=/^[1-9][0-9]{0,11}$/;
function safeUrl(value:string):URL|null {
  if(!value||value.length>1000||value!==value.trim()||/[\s\\\u0000-\u001f\u007f]/.test(value))return null;
  try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&!url.hash?url:null;}catch{return null;}
}
function titleFromSlug(slug:string):string {
  try{return decodeURIComponent(slug).replace(/[-_]+/g,' ').replace(/\s+/g,' ').trim().slice(0,120);}catch{return '';}
}
export function resolveActivityLink(value:string):ResolvedActivityLink|null {
  const url=safeUrl(value);if(!url)return null;
  if(url.hostname==='learningapps.org'){
    const id=url.pathname==='/watch'?url.searchParams.get('v'):url.pathname==='/show.php'?url.searchParams.get('id'):null;
    if(!id||!learningId.test(id)||[...url.searchParams].length!==1)return null;
    return {provider:'learningapps',resourceId:id,sourceUrl:`https://learningapps.org/watch?v=${id}`,
      embedUrl:`https://learningapps.org/show.php?id=${id}`,title:'',externalOnly:false};
  }
  if(url.hostname==='wordwall.net'){
    if([...url.searchParams].length)return null;
    const match=/^\/(?:es\/)?resource\/([1-9][0-9]{0,11})\/([^/]{1,480})$/.exec(url.pathname);
    if(!match)return null;
    const title=titleFromSlug(match[2]);
    return {provider:'wordwall',resourceId:match[1],sourceUrl:`https://wordwall.net${url.pathname}`,
      embedUrl:null,title,externalOnly:true};
  }
  return null;
}
