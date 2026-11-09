import {AttemptCloudControls} from './cloudContext';
import {AttemptCloudContext} from './cloudContext';
import {attemptStorageNotice} from '../progress/privacyCopy';
import {useContext,useEffect,useState,useRef,useSyncExternalStore} from 'react';
import {useAuth} from '../auth/AuthProvider';
import {useIntegratedFeatures} from '../integration/features';
import {useLocation,useParams} from 'react-router-dom';
import {empty,metrics,validContext,type AttemptContext,type Kind} from './model';
import * as storage from './storage';
import './local.css';

export function useAttempts(){
 const {user,status}=useAuth();
 const scope=user?.uid??'guest';
 const location=useLocation(),params=useParams(),query=new URLSearchParams(location.search);
 const candidate={courseId:params.courseId??query.get('courseId'),termId:params.termId??query.get('termId'),groupId:params.groupId??query.get('groupId')};
 const integrated=useIntegratedFeatures();
 const context=validContext(candidate)?candidate:undefined;
 const owner=useRef<string|null>(null),current=useRef(scope);
 current.current=status==='loading'?'':scope;
 return {scope,ready:status!=='loading',hasConsent:()=>{try{return storage.consent(scope);}catch{return false;}},record:(activityId:string,kind:Kind,id:string,result?:Record<string,number|string|boolean>,contextOverride?:AttemptContext):Promise<boolean>=>{
  if(status==='loading')return Promise.resolve(false);
  if(owner.current===null)owner.current=scope;
  if(owner.current!==scope)return Promise.resolve(false);
  const explicitContext=contextOverride?{courseId:contextOverride.courseId,termId:contextOverride.termId,groupId:contextOverride.groupId}:undefined;
  const eventContext=explicitContext&&validContext(explicitContext)?explicitContext:context;
  return storage.record(scope,{version:1,id,activityId,kind,trust:kind==='reported'?'client-report':'declaration',observedAt:new Date().toISOString(),...(eventContext?{context:eventContext}:{}),...(result?{result}:{})},()=>current.current===scope);
 }};
}

export function AttemptAlerts(){
 const {scope,ready}=useAttempts();
 const message=useSyncExternalStore(storage.subscribe,()=>storage.failure(scope));
 return ready&&message?<div className="attempt-alert" role="alert">{message} <a href="#/cuenta">Revisar historial local</a></div>:null;
}

export function AttemptHistory(){
 const {scope,ready}=useAttempts();
  const cloud=useContext(AttemptCloudContext);
 const [,refresh]=useState(0);
 useEffect(()=>storage.subscribe(()=>refresh(n=>n+1)),[scope]);
 let enabled=false,ledger=empty(),error='';
 if(!ready)return null;
 try{enabled=storage.consent(scope);ledger=storage.history(scope);}catch{error='No se pudo leer el historial. Conserva el almacenamiento y exporta antes de repararlo.';}
 function download(){
  const raw=storage.exportHistory(scope);if(raw===null)return;
  const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='optilab-intentos-locales.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <section className="paper attempt-history" aria-label="Historial local de intentos">
  <h2>Historial local de intentos</h2><AttemptCloudControls/>
  <p>{scope==='guest'?'Perfil invitado de este navegador':'Perfil de la cuenta actual en este navegador'}. Los informes del cliente no están validados. {attemptStorageNotice(!!cloud)} En un dispositivo compartido otras personas con acceso al navegador podrían acceder al almacenamiento.</p>
  <label><input type="checkbox" checked={enabled} onChange={e=>storage.setConsent(scope,e.target.checked)}/> Guardar futuros intentos en este navegador</label>
  {error&&<p role="alert">{error}</p>}
  <div className="attempt-actions"><button onClick={download}>Exportar historial</button><button onClick={()=>refresh(n=>n+1)}>Actualizar</button></div>
  <div className="attempt-table-scroll" role="region" aria-label="Métricas locales por actividad" tabIndex={0}>
   <table><caption>Conteos por actividad · ningún resultado validado</caption><thead><tr><th scope="col">Actividad</th><th scope="col">Aperturas</th><th scope="col">Declaradas</th><th scope="col">Reportadas</th><th scope="col">Validadas</th></tr></thead>
    <tbody>{metrics(ledger).map(m=><tr key={m.activityId}><th scope="row">{m.activityId}</th><td>{m.opened}</td><td>{m.declared}</td><td>{m.reported}</td><td>0 · sin validador</td></tr>)}</tbody>
   </table>
  </div>
  <ol>{ledger.entries.slice(-50).reverse().map(e=><li key={e.activityId+e.id}>{e.activityId} · {e.kind} · {e.observedAt}{e.result&&<pre>{JSON.stringify(e.result)}</pre>}</li>)}</ol>
 </section>;
}
