import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight} from 'lucide-react';
import * as attemptStorage from '../attempts/storage';
import {digest} from '../progress/model';
import {useAuth} from '../auth/AuthProvider';
import {academicEnabled} from './config';
import {academicClient,type AcademicCall} from './client';
import type {GymLayout,PublishedActivity,StudentScope,PublishedActivities} from './types';
import {games} from '../data';
import {GameCard} from '../components/GameCard';
import {useAcademicAccess} from './AcademicAccess';
import {LoadingContent} from '../components/LoadingShell';
import '../activities/external.css';

export type Item=PublishedActivity&{courseId:string;termId:string;groupId:string};
const providerName={optilab:'OptiLab',learningapps:'LearningApps',wordwall:'Wordwall'} as const;
export function ExternalCard({activity,preview=false}:{activity:Item;preview?:boolean}){
  const auth=useAuth(),ref=useRef(auth);ref.current=auth;const uid=auth.user?.uid??'';
  const [revision,refresh]=useState(0),[busy,setBusy]=useState(false);useEffect(()=>attemptStorage.subscribe(()=>refresh(n=>n+1)),[]);
  let allowed=false,declared=false,opened=false,completed=false,readError=false;try{allowed=!!uid&&attemptStorage.consent(uid);const entries=uid?attemptStorage.history(uid).entries.filter(e=>e.activityId===activity.activityId&&e.context?.courseId===activity.courseId&&e.context.termId===activity.termId&&e.context.groupId===activity.groupId):[];declared=entries.some(e=>e.kind==='declared');opened=entries.some(e=>e.kind==='opened');completed=entries.some(e=>e.kind==='reported'&&e.result?.completed===true);}catch{readError=true;}void revision;
  async function declare(){if(!uid||!allowed||declared||busy)return;setBusy(true);try{const id='declared:'+await digest(JSON.stringify([activity.courseId,activity.termId,activity.groupId,activity.activityId]));await attemptStorage.record(uid,{version:1,id,activityId:activity.activityId,kind:'declared',trust:'declaration',observedAt:new Date().toISOString(),context:{courseId:activity.courseId,termId:activity.termId,groupId:activity.groupId}},()=>ref.current.isCurrentSession(uid));}finally{setBusy(false);}}
  return <article className="cartridge group-activity-cartridge">
    <div className="cartridge-art"><span className="serial">ACTIVIDAD DE CLASE</span><div className="class-cover" aria-hidden="true"><span>✦</span><strong>CLASE</strong><small>UN RETO PARA EXPLORAR</small></div><span className="game-region">GIMNASIO {activity.gymId}</span></div>
    <div className="cartridge-body"><h3>{activity.title}</h3><p>{activity.description||'Actividad complementaria asignada por tu profesora.'}</p>
      <div className="game-actions">{preview?<Link className="button play" to={`/vista-docente/${encodeURIComponent(activity.courseId)}/${encodeURIComponent(activity.termId)}/${encodeURIComponent(activity.groupId)}/actividad/${encodeURIComponent(activity.activityId)}`}>Vista previa <ArrowRight size={17}/></Link>:<Link className="button play" to={`/grupo/${encodeURIComponent(activity.courseId)}/${encodeURIComponent(activity.termId)}/${encodeURIComponent(activity.groupId)}/actividad/${encodeURIComponent(activity.activityId)}`}>Abrir <ArrowRight size={17}/><span className="sr-only"> {activity.title}</span></Link>}</div>
      {!preview&&opened&&<small>Abierta</small>}{!preview&&completed&&<small>Finalización informada por el proveedor · sin validación</small>}
      {!preview&&readError&&<p role="alert">No pudimos leer tu historial. Revisa y exporta tus datos desde <Link to="/cuenta">Cuenta</Link>.</p>}
      {!preview&&!readError&&(declared?<p role="status">Practicada · declarada por ti y guardada en este navegador</p>:allowed?<button className="practice-toggle" disabled={busy} onClick={()=>void declare()}>{busy?'Guardando…':'Marcar como practicada'}</button>:<p className="group-activity-note">Para guardar tu práctica, activa el historial en <Link to="/cuenta">Cuenta</Link>.</p>)}
      <small className="group-activity-note">{providerName[activity.provider]} · Actividad de clase · no otorga insignias</small>
    </div>
  </article>;
}
const contextKey=(uid:string)=>`optilab:academic-context:v1:${uid}`;
const scopeKey=(s:StudentScope)=>JSON.stringify([s.courseId,s.termId,s.groupId]);
type CachedConfig={owner:string;loading:boolean;error:string;groups:StudentScope[];selected:string;data:PublishedActivities|null};
let cache:{key:string;expires:number;value:CachedConfig}|null=null;
const storedContext=(uid:string)=>{try{return sessionStorage.getItem(contextKey(uid))??'';}catch{return '';}};
export interface StudentGymConfig {items:Item[];gyms:PublishedActivities['gyms'];teacher:boolean;layout:GymLayout|null;loading:boolean;error:string;multipleGroups:boolean;groupTitle:string;needsSelection:boolean;groups:StudentScope[];selected:string;select:(key:string)=>void;reload:()=>void}
export function useStudentGymConfig(gymId:number):StudentGymConfig{
  const auth=useAuth(),access=useAcademicAccess(),ref=useRef(auth);const teacher=access.teacher;ref.current=auth;const uid=auth.user?.uid??'';
  const [revision,setRevision]=useState(0),[selection,setSelection]=useState({uid:'',value:''});
  const cacheKey=JSON.stringify([uid,teacher,storedContext(uid)]);
  const [state,setState]=useState<CachedConfig>(()=>cache?.key===cacheKey&&cache.expires>Date.now()?cache.value:{owner:'',loading:false,error:'',groups:[],selected:'',data:null});
  useEffect(()=>{const changed=()=>{cache=null;setRevision(n=>n+1);};window.addEventListener('academic-context-changed',changed);return()=>window.removeEventListener('academic-context-changed',changed);},[]);
  useEffect(()=>{
    if(!academicEnabled||!uid){cache=null;setState({owner:uid+'|'+teacher,loading:false,error:'',groups:[],selected:'',data:null});return;}
    if(!access.checked)return;
    const key=JSON.stringify([uid,teacher,selection.uid===uid?selection.value:storedContext(uid)]);
    if(cache?.key===key&&cache.expires>Date.now()){setState(cache.value);return;}
    const controller=new AbortController();let active=true;
    setState({owner:uid+'|'+teacher,loading:true,error:'',groups:[],selected:'',data:null});
    const api=academicClient({uid,getIdToken:id=>ref.current.getIdToken(id),current:()=>active&&ref.current.isCurrentSession(uid)},controller.signal);
    void(async()=>{try{
      const groups:StudentScope[]=[];let cursor:string|undefined;
      for(let page=0;page<100;page++){
        const result=await api('myScopes',{kind:teacher?'teacher':'student',limit:20,...cursor?{cursor}:{}});groups.push(...result.items.filter(s=>s.status==='active'));
        if(!result.nextCursor)break;if(result.nextCursor===cursor||page===99)throw new Error('No pudimos recuperar todos tus grupos.');cursor=result.nextCursor;
      }
      const remembered=selection.uid===uid?selection.value:storedContext(uid),chosen=groups.length===1?groups[0]:groups.find(s=>scopeKey(s)===remembered);
      const scope=chosen?{courseId:chosen.courseId,termId:chosen.termId,groupId:chosen.groupId}:null;
      const data=scope?await (teacher?api('teacherPublishedGroupActivities',scope):api('publishedGroupActivities',scope)):null;
      if(active){const value={owner:uid+'|'+teacher,loading:false,error:'',groups,selected:chosen?scopeKey(chosen):'',data};cache={key,expires:Date.now()+30000,value};setState(value);}
    }catch(e){if(active&&(e as Error).name!=='AbortError')setState({owner:uid+'|'+teacher,loading:false,error:'No pudimos cargar la configuración autorizada de tu grupo. Reintenta; no mostramos el catálogo como sustituto.',groups:[],selected:'',data:null});}})();
    return()=>{active=false;controller.abort();};
  },[uid,revision,selection,teacher,access.checked]);
  const current=state.owner===uid+'|'+teacher?state:null,loading=academicEnabled&&(auth.status==='loading'||!!uid&&(!current||current.loading)),groups=current?.groups??[],selected=current?.selected??'';
  const gym=current?.data?.gyms.find(g=>g.gymId===gymId),chosen=groups.find(s=>scopeKey(s)===selected);
  return {teacher,gyms:current?.data?.gyms??[],items:gym&&chosen?gym.activities.map(a=>({...a,courseId:chosen.courseId,termId:chosen.termId,groupId:chosen.groupId})):[],layout:gym?.layout??null,loading,error:current?.error??'',multipleGroups:groups.length>1,needsSelection:groups.length>1&&!selected,groups,selected,groupTitle:chosen?.title??'',
    select:value=>{if(value&&!groups.some(s=>scopeKey(s)===value))return;try{sessionStorage.setItem(contextKey(uid),value);}catch{/* Selection works in memory if browser storage is unavailable. */}setSelection({uid,value});setRevision(n=>n+1);window.dispatchEvent(new Event('academic-context-changed'));},reload:()=>{cache=null;setRevision(n=>n+1);}};
}
export function StudentGymContext({config}:{config:StudentGymConfig}){
  if(config.loading)return <LoadingContent/>;
  if(config.error)return <div className="teacher-error" role="alert"><p>{config.error}</p><button className="button" onClick={config.reload}>Reintentar</button></div>;
  return config.multipleGroups?<label className="student-gym-context">Contexto académico<select value={config.selected} onChange={e=>config.select(e.target.value)}><option value="">Elige tu grupo</option>{config.groups.map(s=><option key={scopeKey(s)} value={scopeKey(s)}>{[s.courseTitle,s.termTitle,s.title].filter(Boolean).join(' · ')}</option>)}</select></label>:null;
}
function GridContent({gymId,config}:{gymId:number;config:ReturnType<typeof useStudentGymConfig>}){
  const {items,layout,loading,error,needsSelection}=config;const original=games.filter(game=>game.gimnasio===gymId);
  if(loading||error||needsSelection)return <StudentGymContext config={config}/>;
  const byGame=new Map(original.map(game=>[game.repo,game])),byExternal=new Map(items.map(item=>[item.activityId,item]));
  const base=layout?.orderedActivityIds??[];const ids=[...new Set([...base,...original.map(game=>game.repo),...items.map(item=>item.activityId)])];
  const hidden=new Set(layout?.hiddenOriginalGameIds??[]);
  const rows=ids.map(id=>{const game=byGame.get(id);if(game)return hidden.has(id)?null:{type:'game' as const,id,game};const activity=byExternal.get(id);return activity?{type:'external' as const,id,activity}:null;}).filter((row):row is {type:'game';id:string;game:typeof original[number]}|{type:'external';id:string;activity:Item}=>!!row);
  return <><StudentGymContext config={config}/><div className="game-grid">{rows.map((row,index)=>row.type==='game'?<GameCard key={row.id} game={row.game} index={index} preview={config.teacher} academicScope={config.groups.find(s=>scopeKey(s)===config.selected)}/>:<ExternalCard key={row.id} activity={row.activity} preview={config.teacher}/>)}{!rows.length&&<p className="teacher-empty">Este gimnasio no tiene actividades visibles.</p>}</div></>;
}
function GridWithConfig({gymId}:{gymId:number}){const config=useStudentGymConfig(gymId);return <GridContent gymId={gymId} config={config}/>;}
export function GymGameGrid({gymId,config}:{gymId:number;config?:ReturnType<typeof useStudentGymConfig>}){return config?<GridContent gymId={gymId} config={config}/>:<GridWithConfig gymId={gymId}/>;}
