/** Independent of Memorama's protocol and persistent progress schema. */
export const ORIGINAL_RESULTS_PROTOCOL='optilab-original-results';
export const resultPilotIds=['ahorcado-simplex','ordena-simplex'] as const;
export type ResultPilotId=typeof resultPilotIds[number];
export const isResultPilot=(id:string):id is ResultPilotId=>resultPilotIds.some(v=>v===id);
export const originalResultDisplay:Record<ResultPilotId,{labels:readonly string[];note:string}>={
  'ahorcado-simplex':{labels:['Aciertos · palabras','Total · palabras previstas','Intentos · letras probadas','Errores · letras falladas','Duración de partida'],note:'Los aciertos cuentan palabras; los intentos y errores cuentan letras. No son unidades equivalentes.'},
  'ordena-simplex':{labels:['Aciertos · colocaciones correctas','Total · colocaciones comprobadas','Intentos · comprobaciones completas','Errores · colocaciones fuera de lugar','Duración activa'],note:'Las colocaciones se cuentan cada vez que se comprueba una línea completa, incluidas las que se vuelven a comprobar.'},
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export interface OriginalResult {
  reason:'completed'|'time-limit';
  correct:number;total:number;attempts:number;errors:number;durationMs:number;
  /** Only for a native score; neither initial emitter supplies this field. */
  score?:number;
}
type Envelope={protocol:typeof ORIGINAL_RESULTS_PROTOCOL;version:1;gameId:ResultPilotId;session:string};
export type OriginalResultMessage=Envelope&(
  {type:'game:ready'}|
  {type:'game:started';runId:string}|
  {type:'game:aborted';runId:string}|
  {type:'game:completed';runId:string;result:OriginalResult}
);
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const keys=(v:object,expected:string[])=>Object.keys(v).sort().join(',')===[...expected].sort().join(',');
const integer=(v:unknown,max:number):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=max;
export function allowedResultsHost(origin:string){
  try{const u=new URL(origin);return u.origin===origin&&!u.username&&!u.password&&(
    origin==='https://israeltiburcio-ai.github.io'||u.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(u.hostname));
  }catch{return false;}
}
export function originalResultSource(url:string,gameId:string,session:string,hostOrigin:string){
  if(!isResultPilot(gameId)||!uuid.test(session)||!allowedResultsHost(hostOrigin)||url!==`https://israeltiburcio-ai.github.io/${gameId}/`)return url;
  const source=new URL(url);source.searchParams.set('optilabSession',session);source.searchParams.set('optilabOrigin',hostOrigin);return source.href;
}
export function validOriginalResult(value:unknown,gameId:ResultPilotId):value is OriginalResult {
  if(!isResultPilot(gameId))return false;
  if(!record(value)||!keys(value,['reason','correct','total','attempts','errors','durationMs',...('score'in value?['score']:[])]))return false;
  if(typeof value.reason!=='string'||!['completed','time-limit'].includes(value.reason)||!integer(value.correct,1000000)||!integer(value.total,1000000)||!value.total||!integer(value.attempts,1000000)||!integer(value.errors,1000000)||!integer(value.durationMs,604800000))return false;
  if('score'in value&&(typeof value.score!=='number'||!Number.isFinite(value.score)||Math.abs(value.score)>1000000000))return false;
  if(value.correct>value.total)return false;
  if(gameId==='ahorcado-simplex')return [3,4,5].includes(value.total)&&value.attempts<=27*value.total&&value.attempts>=value.correct+value.errors&&value.errors<=6*value.total&&value.durationMs<=90000&&
    (value.reason==='time-limit'?value.durationMs===90000:value.errors>=6*(value.total-value.correct));
  // Correct/error counts are placements across checks, not rounds or attempts.
  if(gameId==='ordena-simplex')return value.reason==='completed'&&value.correct===value.total-value.errors&&value.attempts>=6&&value.attempts<=value.total;
  return false;
}
export function parseOriginalResultMessage(value:unknown,gameId:ResultPilotId,session:string):OriginalResultMessage|null {
  if(!isResultPilot(gameId)||!uuid.test(session)||!record(value)||value.protocol!==ORIGINAL_RESULTS_PROTOCOL||value.version!==1||value.gameId!==gameId||value.session!==session)return null;
  const base=['protocol','version','gameId','session','type'];
  if(value.type==='game:ready'&&keys(value,base))return value as OriginalResultMessage;
  if(typeof value.runId!=='string'||!uuid.test(value.runId))return null;
  if((value.type==='game:started'||value.type==='game:aborted')&&keys(value,[...base,'runId']))return value as OriginalResultMessage;
  if(value.type==='game:completed'&&keys(value,[...base,'runId','result'])&&validOriginalResult(value.result,gameId))return value as OriginalResultMessage;
  return null;
}
export interface OriginalFrame {window:unknown;sourceUrl:string;connected:boolean}
/** Mounted-session lifecycle, bounded replay protection; never an academic verdict. */
export class OriginalResultReceiver {
  private active=true;private ready=false;private run:string|null=null;private finished=false;private seen=new Set<string>();
  constructor(private gameId:ResultPilotId,private session:string,private sourceUrl:string){}
  invalidate(){this.active=false;}
  accept(event:{origin:string;source:unknown;data:unknown},frame:OriginalFrame):OriginalResultMessage|null {
    if(!this.active||!frame.connected||!frame.window||event.origin!=='null'||event.source!==frame.window||frame.sourceUrl!==this.sourceUrl)return null;
    const message=parseOriginalResultMessage(event.data,this.gameId,this.session);if(!message)return null;
    if(message.type==='game:ready'){if(this.ready)return null;this.ready=true;return message;}
    if(!this.ready)return null;
    if(message.type==='game:started'){
      if(this.seen.has(message.runId)||this.seen.size>=256)return null;
      this.seen.add(message.runId);this.run=message.runId;this.finished=false;return message;
    }
    if(message.runId!==this.run||this.finished)return null;
    this.finished=true;return message;
  }
}
