import {games, gyms, gymGames} from '../data';
import {isAvatarId} from '../data/avatars';
import {isCompanionId, type CompanionId, type EvolutionStage} from '../data/companions';
import {savedResults, type SavedGameResult} from '../integration/protocol';
import {reconcileMilestones, evolutionProgress, validPracticeDate, type EvolutionMilestone} from '../lib/evolutionRules';

export interface Result {date:string; answers:number[]; score:number}
export interface Progress {
  practiced:Record<string,string>; visited:number[]; badges:number[]; results:Result[];
  gameResults:SavedGameResult[]; nickname:string; route:string[]; avatarId:string|null;
  companionId:CompanionId|null; evolutionMilestones:EvolutionMilestone[]; evolutionCelebratedStage:EvolutionStage;
}
export const emptyProgress = ():Progress => ({practiced:{},visited:[],badges:[],results:[],gameResults:[],
  nickname:'Entrenador OptiLab',route:[],avatarId:null,companionId:null,evolutionMilestones:[],evolutionCelebratedStage:1});
export function withEvolution(progress:Progress):Progress {
  const milestones=reconcileMilestones(progress.practiced,progress.evolutionMilestones,games);
  const {stage}=evolutionProgress(progress.practiced,milestones,games);
  const badges=gyms.filter(g=>gymGames(g.id).every(x=>progress.practiced[x.repo])).map(g=>g.id);
  return {...progress,badges,evolutionMilestones:milestones,evolutionCelebratedStage:Math.min(progress.evolutionCelebratedStage,stage) as EvolutionStage};
}
/** Existing guest loader stays tolerant. Cloud/import additionally demand a lossless valid input. */
export function parseProgress(p:unknown):Progress {
  if(!p || typeof p!=='object' || Array.isArray(p))return emptyProgress();
  const v=p as Partial<Progress>;
  return withEvolution({...emptyProgress(),
    nickname:typeof v.nickname==='string'?v.nickname.slice(0,30):emptyProgress().nickname,
    avatarId:isAvatarId(v.avatarId)?v.avatarId:null,companionId:isCompanionId(v.companionId)?v.companionId:null,
    evolutionMilestones:v.evolutionMilestones || [],
    evolutionCelebratedStage:[1,2,3].includes(v.evolutionCelebratedStage!)?v.evolutionCelebratedStage!:1,
    practiced:Object.fromEntries(Object.entries(v.practiced || {}).filter(([id,date])=>games.some(g=>g.repo===id)&&typeof date==='string')),
    visited:Array.isArray(v.visited)?v.visited.filter(n=>gyms.some(g=>g.id===n)):[],
    route:Array.isArray(v.route)?v.route.filter(id=>games.some(g=>g.repo===id)):[],
    results:Array.isArray(v.results)?v.results.filter(r=>r&&Array.isArray(r.answers)&&r.answers.length===5&&
      r.answers.every(n=>Number.isInteger(n)&&n>=0&&n<3)&&typeof r.score==='number'&&typeof r.date==='string').slice(-30):[],
    gameResults:savedResults(v.gameResults),
  });
}
export const canonical=(value:unknown):string=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)
  ?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
export const equal=(a:unknown,b:unknown)=>canonical(a)===canonical(b);
export async function digest(value:string):Promise<string> {
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');
}
export function importProgress(raw:string):Progress {
  const input=JSON.parse(raw);
  const p=parseProgress(input);
  if(!input || typeof input!=='object' || Array.isArray(input))throw new Error('El respaldo no contiene un progreso válido.');
  // Missing old fields are supported; incompatible supplied fields are never silently discarded.
  for(const field of Object.keys(input)) {
    if(!Object.prototype.hasOwnProperty.call(p,field))throw new Error(`Campo no compatible: ${field}. Conserva el respaldo original.`);
    if(field!=='badges' && field!=='evolutionMilestones' && !equal(input[field],p[field as keyof Progress]))
      throw new Error(`Revisa ${field}: hay datos que no pueden importarse sin cambios.`);
  }
  const dates=[...Object.values(p.practiced),...p.results.map(r=>r.date),...p.gameResults.map(r=>r.date),
    ...p.evolutionMilestones.flatMap(m=>[m.unlockedAt,...m.practice.map(e=>e.practicedAt)])];
  if(dates.some(d=>!validPracticeDate(d)||Date.parse(d)<0||Date.parse(d)>Date.now()))throw new Error('Hay fechas inválidas o futuras; el original permanece en el respaldo.');
  if(new Set(p.route).size!==p.route.length || new Set(p.visited).size!==p.visited.length)throw new Error('La ruta o las visitas contienen duplicados.');
  const correct=[1,0,1,1,0];
  if(p.results.some(r=>!Number.isInteger(r.score)||r.score!==r.answers.reduce((score,a,i)=>score+Number(a===correct[i]),0)))throw new Error('Diagnóstico incoherente: conserva el original y revisa el resultado antes de importar.');
  if(input.evolutionMilestones && !equal(input.evolutionMilestones,p.evolutionMilestones))throw new Error('Revisa las evidencias evolutivas antes de importar.');
  const iso=(d:string)=>new Date(d).toISOString();
  return {...p,practiced:Object.fromEntries(Object.entries(p.practiced).map(([id,d])=>[id,iso(d)])),
    results:p.results.map(r=>({...r,date:iso(r.date)})),gameResults:p.gameResults.map(r=>({...r,date:iso(r.date)})),
    evolutionMilestones:p.evolutionMilestones.map(m=>({...m,unlockedAt:iso(m.unlockedAt),practice:m.practice.map(e=>({...e,practicedAt:iso(e.practicedAt)}))}))};
}

export type FieldValue=string|number|boolean|null|string[]|EvolutionMilestone;
export interface Field {value:FieldValue; revision:number; operationId:string}
export interface Snapshot {
  epoch:number; revision:number; fields:Record<string,Field>;
  diagnostics:Record<string,Result>; runs:Record<string,SavedGameResult>;
  confirmed?:boolean;
}
export const blankSnapshot=():Snapshot=>({epoch:1,revision:0,fields:{},diagnostics:{},runs:{}});
export interface Change {value:FieldValue; baseRevision:number; predecessor:string|null}
export interface Operation {
  id:string; epoch:number; afterId:string|null; kind:'edit'|'import'|'reset'|'restore'; changes:Record<string,Change>;
  diagnostics:Record<string,Result>; runs:Record<string,SavedGameResult>; sourceHash?:string;
}
export interface Conflict {kind:'field'|'epoch'|'history'; keys:string[]; message:string}
export class SyncConflict extends Error {
  constructor(public conflict:Conflict,public snapshot?:Snapshot){super(conflict.message);}
}
export function fieldsOf(p:Progress):Record<string,FieldValue> {
  const values:Record<string,FieldValue>={nickname:p.nickname,avatarId:p.avatarId,companionId:p.companionId,
    route:p.route,celebrated:p.evolutionCelebratedStage};
  for(const g of games)values[`practice--${g.repo}`]=p.practiced[g.repo] || null;
  for(const id of p.visited)values[`visit--${id}`]=true;
  for(const m of p.evolutionMilestones)values[`milestone--${m.stage}`]=m;
  return values;
}
export function project(s:Snapshot):Progress {
  const p=emptyProgress();
  for(const [key,field] of Object.entries(s.fields)) {
    if(key.startsWith('practice--')&&typeof field.value==='string')p.practiced[key.slice(10)]=field.value;
    else if(key.startsWith('visit--')&&field.value===true)p.visited.push(Number(key.slice(7)));
    else if(key.startsWith('milestone--'))p.evolutionMilestones.push(field.value as EvolutionMilestone);
    else if(key==='celebrated')p.evolutionCelebratedStage=field.value as EvolutionStage;
    else if(['nickname','avatarId','companionId','route'].includes(key))Object.assign(p,{[key]:field.value});
  }
  p.results=Object.entries(s.diagnostics).sort(([a,x],[b,y])=>x.date.localeCompare(y.date)||a.localeCompare(b)).map(([,r])=>r).slice(-30);
  p.gameResults=Object.values(s.runs).sort((a,b)=>a.date.localeCompare(b.date)||a.runId.localeCompare(b.runId)).slice(-50);
  return parseProgress(p);
}
function unionMilestone(a:EvolutionMilestone,b:EvolutionMilestone):EvolutionMilestone {
  const evidence=new Map(a.practice.map(p=>[p.gameId,p.practicedAt]));
  for(const p of b.practice)evidence.set(p.gameId,[evidence.get(p.gameId)||p.practicedAt,p.practicedAt].sort()[0]);
  return {stage:a.stage,ruleVersion:a.ruleVersion,unlockedAt:[a.unlockedAt,b.unlockedAt].sort()[0],
    practice:games.filter(g=>evidence.has(g.repo)).map(g=>({gameId:g.repo,practicedAt:evidence.get(g.repo)!}))};
}
/** Shared deterministic merge: versions/causality, never the wall clock, arbitrate edits. */
export function reconcile(s:Snapshot,op:Operation):Snapshot {
  if(s.epoch!==op.epoch)throw new SyncConflict({kind:'epoch',keys:[],message:'La aventura fue reiniciada en otro dispositivo. Tus cambios antiguos no se enviaron.'},s);
  if(op.kind==='reset')return {...blankSnapshot(),epoch:s.epoch+1,revision:s.revision+1};
  if(op.kind==='restore') {
    const fresh={...blankSnapshot(),epoch:s.epoch+1,revision:s.revision};
    const changes=Object.fromEntries(Object.entries(op.changes).map(([key,c])=>[key,{...c,baseRevision:0,predecessor:null}]));
    return reconcile(fresh,{...op,kind:'edit',epoch:fresh.epoch,changes});
  }
  const next:Snapshot={...s,fields:{...s.fields},diagnostics:{...s.diagnostics},runs:{...s.runs}};
  const conflicts:string[]=[];
  for(const [key,c] of Object.entries(op.changes)) {
    const remote=s.fields[key]; let value=c.value;
    if(remote?.operationId===op.id)continue;
    const monotonic=key.startsWith('visit--')||key==='celebrated'||key.startsWith('milestone--');
    if(remote && key==='celebrated')value=Math.max(remote.value as number,value as number);
    if(remote && key.startsWith('milestone--'))value=unionMilestone(remote.value as EvolutionMilestone,value as EvolutionMilestone);
    if(!monotonic&&!equal(remote?.value??null,value)&&((remote?.revision||0)!==c.baseRevision)&&remote?.operationId!==c.predecessor)conflicts.push(key);
    next.fields[key]={value,revision:s.revision+1,operationId:op.id};
  }
  for(const [id,data] of Object.entries(op.diagnostics)) {
    if(s.diagnostics[id]&&!equal(s.diagnostics[id],data))conflicts.push(`diagnostic:${id}`);
    else next.diagnostics[id]=data;
  }
  for(const [id,data] of Object.entries(op.runs)) {
    if(s.runs[id]&&!equal(s.runs[id],data))conflicts.push(`run:${id}`);
    else next.runs[id]=data;
  }
  if(conflicts.length)throw new SyncConflict({kind:conflicts.some(k=>k.startsWith('run:')||k.startsWith('diagnostic:'))?'history':'field',keys:conflicts,message:'Hay cambios simultáneos. Revisa qué versión conservar antes de continuar.'},s);
  next.revision=s.revision+1;
  return next;
}
/** Optimistic local projection; conflicts are handled against server state on commit. */
export function optimistic(s:Snapshot,op:Operation):Snapshot {
  if(s.epoch!==op.epoch)return s;
  const rebased={...op,changes:Object.fromEntries(Object.entries(op.changes).map(([key,c])=>[key,{...c,baseRevision:s.fields[key]?.revision||0,predecessor:null}]))};
  try{return reconcile(s,rebased);}catch{return s;}
}
