import type {IncomingMessage,ServerResponse} from 'node:http';
import {authorizedSmokeRequest,oidcSmokeConfig,OidcSmokeError,runOidcSmoke} from '../../server/oidc-smoke.js';
import {oidcTokenFromRequest,verifiedRequestOidcToken,withRequestOidcToken} from '../../server/vercel-oidc.js';

function send(res:ServerResponse,status:number,body:unknown,headers:Record<string,string>={}):void {
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Pragma':'no-cache','X-Content-Type-Options':'nosniff',...headers});
  res.end(JSON.stringify(body));
}
function hasQuery(req:IncomingMessage):boolean {return (req.url??'').includes('?');}
function hasBody(req:IncomingMessage):boolean {
  const raw=req.headers['content-length'];
  if(raw!==undefined){const length=Number(Array.isArray(raw)?raw[0]:raw);if(!Number.isInteger(length)||length!==0)return true;}
  return req.headers['transfer-encoding']!==undefined;
}
function failure(res:ServerResponse,error:unknown):void {
  if(error instanceof OidcSmokeError){send(res,error.status,{ok:false,error:{code:error.code,stage:error.stage}});return;}
  send(res,502,{ok:false,error:{code:'OIDC_SMOKE_INTERNAL',stage:'EXCHANGE'}});
}
export default async function handler(req:IncomingMessage,res:ServerResponse):Promise<void> {
  let config:ReturnType<typeof oidcSmokeConfig>;
  try{config=oidcSmokeConfig(process.env);}catch(error){failure(res,error);return;}
  if(req.method!=='POST'){send(res,405,{ok:false,error:{code:'OIDC_SMOKE_METHOD'}},{'Allow':'POST'});return;}
  const authorization=req.headers.authorization;
  if(typeof authorization!=='string'||!authorizedSmokeRequest(authorization,config.secret)){
    send(res,401,{ok:false,error:{code:'OIDC_SMOKE_UNAUTHORIZED'}},{'WWW-Authenticate':'Bearer'});return;
  }
  if(hasQuery(req)||hasBody(req)){send(res,400,{ok:false,error:{code:'OIDC_SMOKE_BAD_REQUEST'}});return;}
  const raw=oidcTokenFromRequest(req);
  if(!raw){failure(res,new OidcSmokeError('OIDC_TOKEN_UNAVAILABLE',502,'TOKEN'));return;}
  try{
    const token=await withRequestOidcToken(raw,()=>verifiedRequestOidcToken({issuer:config.oidc.vercelIssuer,audience:config.oidc.vercelAudience,projectId:config.oidc.vercelProjectId,subject:config.oidc.subject,environment:'production'}));
    const [{verifyVercelOidcToken},{ExternalAccountClient}]=await Promise.all([
      import('@vercel/oidc'),import('google-auth-library'),
    ]);
    const result=await runOidcSmoke(config.oidc,{
      getVercelOidcToken:async()=>token,
      verifyVercelOidcToken:(token,options)=>verifyVercelOidcToken(token,options),
      createClient:value=>ExternalAccountClient.fromJSON(value as unknown as Parameters<typeof ExternalAccountClient.fromJSON>[0]),
    });
    send(res,200,result);
  }catch(error){
    if(error instanceof OidcSmokeError)failure(res,error);
    else if(error instanceof Error&&error.message==='OIDC_TOKEN_UNAVAILABLE')failure(res,new OidcSmokeError('OIDC_TOKEN_UNAVAILABLE',502,'TOKEN'));
    else failure(res,new OidcSmokeError('OIDC_TOKEN_INVALID',502,'TOKEN'));
  }
}
