/** Independent of Memorama's protocol and persistent progress schema. */
export const ORIGINAL_RESULTS_PROTOCOL='optilab-original-results';
export const resultPilotIds=['ahorcado-simplex','ordena-simplex','system-lab','SystemScope','complexity-lab','desviacion-express','torre-prioridades','rompecabezas-metas','ruta-de-metas','candado-simplex','espejo-dual','balanza-dual','domino-holguras','mercado-recursos-dual','semaforo-sensibilidad','model-match','lp-factory','constraint-dash','feasible-drop','OptiQuest1','or-mission','solution-detective','planificador-produccion','mapa-produccion','claves-planeacion-produccion','rompecabezas-simplex','caza-el-pivote'] as const;
export type ResultPilotId=typeof resultPilotIds[number];
export const isResultPilot=(id:string):id is ResultPilotId=>resultPilotIds.some(v=>v===id);
export const originalResultDisplay:Record<ResultPilotId,{labels:readonly string[];note:string}>={
  'ahorcado-simplex':{labels:['Aciertos · palabras','Total · palabras previstas','Intentos · letras probadas','Errores · letras falladas','Duración de partida'],note:'Los aciertos cuentan palabras; los intentos y errores cuentan letras. No son unidades equivalentes.'},
  'ordena-simplex':{labels:['Aciertos · colocaciones correctas','Total · colocaciones comprobadas','Intentos · comprobaciones completas','Errores · colocaciones fuera de lugar','Duración activa'],note:'Las colocaciones se cuentan cada vez que se comprueba una línea completa, incluidas las que se vuelven a comprobar.'},
  'system-lab':{labels:['Elementos clasificados correctamente','Total de elementos','','','','Puntos'],note:'Los elementos no acertados pueden incluir elementos que no se respondieron; no se presentan como errores ni intentos.'},
  'SystemScope':{labels:['Situaciones clasificadas correctamente','Total de situaciones','','','Duración aproximada','Puntos'],note:'La duración es la mostrada por el juego, redondeada a segundos.'},
  'complexity-lab':{labels:['Rondas correctas','Total de rondas','','','','Puntos'],note:'Las rondas no acertadas pueden incluir tiempo agotado; no se presentan como errores ni intentos.'},
  'desviacion-express':{labels:['Aciertos · tarjetas','Total · tarjetas','','','Duración activa'],note:'Cada tarjeta se clasifica una vez; una tarjeta sin respuesta no se presenta como intento.'},
  'torre-prioridades':{labels:['Colocaciones correctas','Total · colocaciones previstas','Intentos · colocaciones','','Duración'],note:'Los intentos incluyen colocaciones inválidas; la precisión nativa es colocaciones correctas entre intentos.'},
  'rompecabezas-metas':{labels:['Máquinas correctas al primer intento','Total · máquinas','','','Duración'],note:'Un reintento dentro de la misma máquina no cuenta como acierto al primer intento.'},
  'ruta-de-metas':{labels:['Retos superados','Total · retos','','','Duración'],note:'Cada reto admite todos los destinos que empatan en la mejor desviación.'},
  'candado-simplex':{labels:['Aciertos al primer intento','Total · candados','Movimientos','','Duración'],note:'Los movimientos incluyen intentos fallidos; los aciertos solo cuentan la primera elección de cada candado.'},
  'espejo-dual':{labels:['Reflejos completados','Total · reflejos','','Ajustes incorrectos','Duración aproximada'],note:'Los reflejos se completan tras corregir los ajustes; no se presentan como aciertos al primer intento.'},
  'balanza-dual':{labels:['Rondas resueltas','Total · rondas','','','Duración aproximada'],note:'Cada ronda debe resolverse para continuar; no equivale a acierto al primer intento.'},
  'domino-holguras':{labels:['Conexiones completadas','Total · conexiones','','Selecciones incorrectas','Duración aproximada'],note:'Cada conexión se completa tras corregir las selecciones incorrectas.'},
  'mercado-recursos-dual':{labels:['Decisiones correctas','Total · oportunidades','','','Duración aproximada'],note:'El beneficio monetario del juego no se convierte en puntos.'},
  'semaforo-sensibilidad':{labels:['Retos correctos','Total · retos','','','Duración aproximada'],note:'Cada reto admite una decisión; no se inventan intentos ni errores.'},
  'model-match':{labels:['Modelos correctos','Total · modelos','Respuestas dadas','Respuestas incorrectas','Duración aproximada','','Rondas sin respuesta'],note:'Los errores excluyen las rondas que expiraron; las expiraciones se muestran por separado.'},
  'lp-factory':{labels:['Piezas correctas','Total · piezas','Piezas respondidas','Piezas incorrectas','Duración activa','Puntos'],note:'La duración usa el cronómetro activo nativo; los puntos pertenecen al juego.'},
  'constraint-dash':{labels:['Restricciones correctas','Total · rondas','Respuestas dadas','Respuestas incorrectas','Duración aproximada','Puntos','Rondas sin respuesta'],note:'Los errores excluyen el tiempo agotado; las expiraciones se muestran por separado.'},
  'feasible-drop':{labels:['Rondas correctas','Total · rondas','','','Duración de partida','Puntos'],note:'El juego no registra por separado intentos y errores en su resultado.'},
  'OptiQuest1':{labels:['Zonas vencidas','Total · zonas del gimnasio'],note:'El informe aparece al completar las tres zonas de la aventura, incluido el progreso nativo que se haya continuado. Las victorias no se convierten en aciertos por pregunta ni las bayas en puntos.'},
  'or-mission':{labels:['Fases correctas al primer intento','Total · fases','','Fallos nativos','Duración aproximada','Puntos'],note:'El contador nativo de fallos incluye elecciones incorrectas y fases cuyo tiempo se agotó; no se presenta como número de respuestas incorrectas.'},
  'solution-detective':{labels:['Sellos correctos','Total · casos','','','Duración aproximada'],note:'La puntuación nativa cuenta sellos correctos; no se convierte en puntos adicionales.'},
  'planificador-produccion':{labels:['Estaciones y reto final correctos','Total · retos','','','Duración aproximada','Puntos'],note:'Las cinco estaciones y la selección final cuentan como seis retos; las tarjetas finales no son cinco aciertos adicionales.'},
  'mapa-produccion':{labels:['Tarjetas reconstruidas','Total · tarjetas de reconstrucción','','','Duración aproximada'],note:'El resultado exige las dos etapas de cinco tarjetas. El contador mostrado corresponde a la reconstrucción final, no a diez aciertos ni a primeros intentos.'},
  'claves-planeacion-produccion':{labels:['Estaciones correctas al primer intento','Total · estaciones','','','Duración aproximada'],note:'Los reintentos y la selección final no se convierten en aciertos adicionales.'},
  'rompecabezas-simplex':{labels:['Rondas correctas al primer intento','Total · rondas','Comprobaciones completas','Intentos incorrectos','Duración activa','Puntos'],note:'Los errores cuentan comprobaciones fallidas, no piezas individuales; las rondas se corrigen hasta resolverlas.'},
  'caza-el-pivote':{labels:['Selecciones correctas al primer intento','Total · selecciones previstas','Selecciones evaluadas','Selecciones incorrectas','Duración activa aproximada','Puntos'],note:'Cada tabla requiere columna, renglón y pivote: quince selecciones previstas. Las pistas y respuestas mostradas no son aciertos al primer intento; el límite de tiempo no convierte lo pendiente en errores.'},
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export interface OriginalResult {
  reason:'completed'|'time-limit';
  correct:number;total:number;attempts?:number;errors?:number;durationMs?:number;timeouts?:number;
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
  if(!record(value))return false;
  if(gameId==='OptiQuest1')return keys(value,['reason','correct','total'])&&value.reason==='completed'&&value.correct===3&&value.total===3;
  if(gameId==='or-mission')return keys(value,['reason','correct','total','errors','durationMs','score'])&&value.reason==='completed'&&value.total===8&&integer(value.correct,8)&&integer(value.errors,1000000)&&integer(value.durationMs,604800000)&&value.durationMs%1000===0&&integer(value.score,1000000);
  if(gameId==='solution-detective'||gameId==='planificador-produccion'||gameId==='mapa-produccion'||gameId==='claves-planeacion-produccion'){
    const total=gameId==='solution-detective'?8:gameId==='planificador-produccion'?6:5;
    return keys(value,['reason','correct','total','durationMs',...(gameId==='planificador-produccion'?['score']:[])])&&value.reason==='completed'&&value.total===total&&integer(value.correct,total)&&(gameId!=='mapa-produccion'||value.correct===total)&&integer(value.durationMs,604800000)&&value.durationMs%1000===0&&(gameId!=='planificador-produccion'||integer(value.score,1000000));
  }
  if(gameId==='rompecabezas-simplex')return keys(value,['reason','correct','total','attempts','errors','durationMs','score'])&&value.reason==='completed'&&integer(value.total,8)&&[6,7,8].includes(value.total)&&integer(value.correct,value.total)&&integer(value.attempts,1000000)&&integer(value.errors,1000000)&&value.attempts===value.total+value.errors&&value.correct>=Math.max(0,value.total-value.errors)&&integer(value.durationMs,604800000)&&integer(value.score,1000000);
  if(gameId==='caza-el-pivote')return keys(value,['reason','correct','total','attempts','errors','durationMs','score'])&&['completed','time-limit'].includes(String(value.reason))&&typeof value.reason==='string'&&value.total===15&&integer(value.correct,15)&&integer(value.errors,1000000)&&integer(value.attempts,1000000)&&value.attempts>=value.errors+value.correct&&value.attempts-value.errors<=15&&integer(value.durationMs,120000)&&value.durationMs%1000===0&&(value.reason!=='time-limit'||value.durationMs===120000)&&integer(value.score,1500);
  if(gameId==='model-match'||gameId==='constraint-dash'){
    const total=10,fields=['reason','correct','total','attempts','errors','timeouts','durationMs',...(gameId==='constraint-dash'?['score']:[])];
    return keys(value,fields)&&value.reason==='completed'&&value.total===total&&integer(value.correct,total)&&integer(value.attempts,total)&&integer(value.errors,total)&&integer(value.timeouts,total)&&value.correct+value.errors===value.attempts&&value.attempts+value.timeouts===total&&integer(value.durationMs,604800000)&&value.durationMs%1000===0&&(gameId!=='constraint-dash'||integer(value.score,1000000));
  }
  if(gameId==='lp-factory')return keys(value,['reason','correct','total','attempts','errors','durationMs','score'])&&value.reason==='completed'&&value.total===15&&integer(value.correct,15)&&value.attempts===15&&integer(value.errors,15)&&value.correct+value.errors===15&&integer(value.durationMs,604800000)&&integer(value.score,1000000);
  if(gameId==='feasible-drop')return keys(value,['reason','correct','total','durationMs','score'])&&value.reason==='completed'&&value.total===6&&integer(value.correct,6)&&integer(value.durationMs,604800000)&&integer(value.score,1000000);
  if(gameId==='system-lab'||gameId==='complexity-lab'||gameId==='SystemScope'){
    const fields=['reason','correct','total','score',...(gameId==='SystemScope'?['durationMs']:[])];
    const expectedTotal=gameId==='system-lab'?8:gameId==='SystemScope'?6:4;
    return keys(value,fields)&&value.reason==='completed'&&value.total===expectedTotal&&integer(value.correct,expectedTotal)&&integer(value.score,1000000)&&(gameId!=='SystemScope'||integer(value.durationMs,604800000));
  }
  if(gameId==='desviacion-express')return keys(value,['reason','correct','total','durationMs'])&&value.reason==='completed'&&value.total===8&&integer(value.correct,8)&&integer(value.durationMs,604800000);
  if(gameId==='torre-prioridades')return keys(value,['reason','correct','total','attempts','durationMs'])&&value.reason==='completed'&&integer(value.correct,1000)&&integer(value.total,1000)&&value.total>=1&&value.correct<=value.total&&integer(value.attempts,10000)&&value.attempts>=1&&value.attempts>=value.correct&&integer(value.durationMs,604800000);
  if(gameId==='rompecabezas-metas')return keys(value,['reason','correct','total','durationMs'])&&value.reason==='completed'&&value.total===7&&integer(value.correct,7)&&integer(value.durationMs,604800000);
  if(gameId==='ruta-de-metas')return keys(value,['reason','correct','total','durationMs'])&&value.reason==='completed'&&value.total===5&&integer(value.correct,5)&&integer(value.durationMs,604800000);
  if(gameId==='candado-simplex')return keys(value,['reason','correct','total','attempts','durationMs'])&&value.reason==='completed'&&value.total===5&&integer(value.correct,5)&&integer(value.attempts,10000)&&value.attempts>=1&&value.attempts>=value.correct&&integer(value.durationMs,604800000);
  if(gameId==='espejo-dual'||gameId==='domino-holguras'){
    const total=gameId==='espejo-dual'?5:6;
    return keys(value,['reason','correct','total','errors','durationMs'])&&value.reason==='completed'&&value.total===total&&value.correct===total&&integer(value.errors,1000000)&&integer(value.durationMs,604800000)&&value.durationMs%1000===0;
  }
  if(gameId==='balanza-dual'||gameId==='mercado-recursos-dual'||gameId==='semaforo-sensibilidad'){
    const total=gameId==='balanza-dual'?5:6;
    return keys(value,['reason','correct','total','durationMs'])&&value.reason==='completed'&&value.total===total&&integer(value.correct,total)&&(gameId!=='balanza-dual'||value.correct===total)&&integer(value.durationMs,604800000)&&value.durationMs%1000===0;
  }
  if(!keys(value,['reason','correct','total','attempts','errors','durationMs',...('score'in value?['score']:[])]))return false;
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
