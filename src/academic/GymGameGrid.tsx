import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight,ExternalLink} from 'lucide-react';
import {useAuth} from '../auth/AuthProvider';
import {academicEnabled} from './config';
import {academicClient,type AcademicCall} from './client';
import type {GymLayout,PublishedActivity,StudentScope,PublishedActivities} from './types';
import {games} from '../data';
import {GameCard} from '../components/GameCard';
import '../activities/external.css';

type Item=PublishedActivity&{courseId:string;termId:string;groupId:string};
const providerName={optilab:'OptiLab',learningapps:'LearningApps',wordwall:'Wordwall'} as const;
function ExternalCard({activity}:{activity:Item}){
  return <article className="cartridge group-activity-cartridge">
    <div className="cartridge-art"><span className="serial">ACTIVIDAD DE CLASE</span><div className="game-glyph" aria-hidden="true"><ExternalLink size={58}/></div><span className="game-region">GIMNASIO {activity.gymId}</span></div>
    <div className="cartridge-body"><span className="cartridge-provider">{providerName[activity.provider]}</span><h3>{activity.title}</h3><p>{activity.description||'Actividad complementaria asignada por tu profesora.'}</p>
      <div className="game-actions"><Link className="button play" to={`/grupo/${encodeURIComponent(activity.courseId)}/${encodeURIComponent(activity.termId)}/${encodeURIComponent(activity.groupId)}/actividad/${encodeURIComponent(activity.activityId)}`}>Abrir <ArrowRight size={17}/><span className="sr-only"> {activity.title}</span></Link></div>
      <small className="group-activity-note">Actividad complementaria · no otorga insignias</small>
    </div>
  </article>;
}
const contextKey=(uid:string)=>`optilab:academic-context:v1:${uid}`;
const scopeKey=(s:StudentScope)=>JSON.stringify([s.courseId,s.termId,s.groupId]);
const storedContext=(uid:string)=>{try{return sessionStorage.getItem(contextKey(uid))??'';}catch{return '';}};
export interface StudentGymConfig {items:Item[];layout:GymLayout|null;loading:boolean;error:string;multipleGroups:boolean;groupTitle:string;needsSelection:boolean;groups:StudentScope[];selected:string;select:(key:string)=>void;reload:()=>void}
export function useStudentGymConfig(gymId:number):StudentGymConfig{
  const auth=useAuth(),ref=useRef(auth);ref.current=auth;const uid=auth.user?.uid??'';
  const [revision,setRevision]=useState(0),[selection,setSelection]=useState({uid:'',value:''});
  const [state,setState]=useState<{owner:string;loading:boolean;error:string;groups:StudentScope[];selected:string;data:PublishedActivities|null}>({owner:'',loading:false,error:'',groups:[],selected:'',data:null});
  useEffect(()=>{const changed=()=>setRevision(n=>n+1);window.addEventListener('academic-context-changed',changed);return()=>window.removeEventListener('academic-context-changed',changed);},[]);
  useEffect(()=>{
    if(!academicEnabled||!uid){setState({owner:uid,loading:false,error:'',groups:[],selected:'',data:null});return;}
    const controller=new AbortController();let active=true;
    setState({owner:uid,loading:true,error:'',groups:[],selected:'',data:null});
    const api=academicClient({uid,getIdToken:id=>ref.current.getIdToken(id),current:()=>active&&ref.current.isCurrentSession(uid)},controller.signal);
    void(async()=>{try{
      const groups:StudentScope[]=[];let cursor:string|undefined;
      for(let page=0;page<100;page++){
        const result=await api('myScopes',{kind:'student',limit:20,...cursor?{cursor}:{}});groups.push(...result.items.filter(s=>s.status==='active'));
        if(!result.nextCursor)break;if(result.nextCursor===cursor||page===99)throw new Error('No pudimos recuperar todos tus grupos.');cursor=result.nextCursor;
      }
      const remembered=selection.uid===uid?selection.value:storedContext(uid),chosen=groups.length===1?groups[0]:groups.find(s=>scopeKey(s)===remembered);
      const data=chosen?await api('publishedGroupActivities',{courseId:chosen.courseId,termId:chosen.termId,groupId:chosen.groupId}):null;
      if(active)setState({owner:uid,loading:false,error:'',groups,selected:chosen?scopeKey(chosen):'',data});
    }catch(e){if(active&&(e as Error).name!=='AbortError')setState({owner:uid,loading:false,error:'No pudimos cargar la configuración autorizada de tu grupo. Reintenta; no mostramos el catálogo como sustituto.',groups:[],selected:'',data:null});}})();
    return()=>{active=false;controller.abort();};
  },[uid,revision,selection]);
  const current=state.owner===uid?state:null,loading=academicEnabled&&(auth.status==='loading'||!!uid&&(!current||current.loading)),groups=current?.groups??[],selected=current?.selected??'';
  const gym=current?.data?.gyms.find(g=>g.gymId===gymId),chosen=groups.find(s=>scopeKey(s)===selected);
  return {items:gym&&chosen?gym.activities.map(a=>({...a,courseId:chosen.courseId,termId:chosen.termId,groupId:chosen.groupId})):[],layout:gym?.layout??null,loading,error:current?.error??'',multipleGroups:groups.length>1,needsSelection:groups.length>1&&!selected,groups,selected,groupTitle:chosen?.title??'',
    select:value=>{if(value&&!groups.some(s=>scopeKey(s)===value))return;try{sessionStorage.setItem(contextKey(uid),value);}catch{/* Selection works in memory if browser storage is unavailable. */}setSelection({uid,value});setRevision(n=>n+1);window.dispatchEvent(new Event('academic-context-changed'));},reload:()=>setRevision(n=>n+1)};
}
export function StudentGymContext({config}:{config:StudentGymConfig}){
  if(config.loading)return <p role="status">Cargando las actividades de tu grupo…</p>;
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
  return <><StudentGymContext config={config}/><div className="game-grid">{rows.map((row,index)=>row.type==='game'?<GameCard key={row.id} game={row.game} index={index} academicScope={config.groups.find(s=>scopeKey(s)===config.selected)}/>:<ExternalCard key={row.id} activity={row.activity}/>)}{!rows.length&&<p className="teacher-empty">Este gimnasio no tiene actividades visibles.</p>}</div></>;
}
function GridWithConfig({gymId}:{gymId:number}){const config=useStudentGymConfig(gymId);return <GridContent gymId={gymId} config={config}/>;}
export function GymGameGrid({gymId,config}:{gymId:number;config?:ReturnType<typeof useStudentGymConfig>}){return config?<GridContent gymId={gymId} config={config}/>:<GridWithConfig gymId={gymId}/>;}
