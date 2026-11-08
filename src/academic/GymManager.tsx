import {TeacherSkeleton} from './TeacherSkeleton';
import {useCallback,useEffect,useLayoutEffect,useRef,useState,type DragEvent} from 'react';
import {ChevronDown,ChevronUp,Eye,EyeOff,RotateCcw,ExternalLink} from 'lucide-react';
import {useBlocker,type BlockerFunction} from 'react-router-dom';
import {games,gyms} from '../data';
import {key,scopeInput} from './components';
import {SimplexCover} from '../components/SimplexCover';
import {Activities} from './Activities';
import type {ActivityWorkspace,TeachingScope} from './types';
import type {AcademicCall} from './client';
import './teacher.css';
const providerName={learningapps:'LearningApps',wordwall:'Wordwall'};
export function GymManager({scope,scopes,call,disabled=false}:{scope:TeachingScope;scopes:TeachingScope[];call:AcademicCall;disabled?:boolean}){
  const [workspace,setWorkspace]=useState<ActivityWorkspace|null>(null),[gymId,setGymId]=useState(3),[order,setOrder]=useState<string[]>([]),[hidden,setHidden]=useState<string[]>([]),[hiddenExternal,setHiddenExternal]=useState<string[]>([]);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[preview,setPreview]=useState(false),[createRequest,setCreateRequest]=useState(0),[reload,setReload]=useState(0);
  const [pending,setPending]=useState<(()=>void)|null>(null),[confirmSave,setConfirmSave]=useState(false),[moving,setMoving]=useState<string|null>(null),[destination,setDestination]=useState(1);
  const root=useRef<HTMLElement>(null),dialog=useRef<HTMLDialogElement>(null),previewDialog=useRef<HTMLDialogElement>(null),drag=useRef<string|null>(null),bypass=useRef(false),retry=useRef<{payload:string;key:string}|null>(null);
  const definitions=new Map((workspace?.definitions??[]).map(item=>[item.activityId,item]));
  const external=(workspace?.assignments??[]).filter(item=>item.gymId===gymId).sort((a,b)=>a.displayOrder-b.displayOrder);
  const layout=workspace?.layouts.find(item=>item.gymId===gymId);
  const baseOrder=[...new Set([...(layout?.orderedActivityIds??[]),...games.filter(game=>game.gimnasio===gymId).map(game=>game.repo),...external.map(item=>item.activityId)])].filter(id=>games.some(game=>game.gimnasio===gymId&&game.repo===id)||external.some(a=>a.activityId===id));
  const baseHidden=layout?.hiddenOriginalGameIds??[],baseExternal=external.filter(a=>a.status!=='published').map(a=>a.activityId);
  const signature=(o:string[],h:string[],e:string[])=>JSON.stringify([o,[...h].sort(),[...e].sort()]);
  const dirty=!!workspace&&signature(order,hidden,hiddenExternal)!==signature(baseOrder,baseHidden,baseExternal);
  const dirtyRef=useRef(dirty);dirtyRef.current=dirty;
  const blocker=useBlocker(useCallback<BlockerFunction>(({currentLocation,nextLocation})=>dirtyRef.current&&(currentLocation.pathname!==nextLocation.pathname||currentLocation.search!==nextLocation.search),[]));
  useEffect(()=>{if(blocker.state==='blocked')setPending(()=>()=>blocker.proceed());},[blocker]);
  const rows=order.map(id=>{const game=games.find(g=>g.repo===id&&g.gimnasio===gymId),assignment=external.find(a=>a.activityId===id),definition=definitions.get(id);return game?{id,title:game.nombre,description:game.tema,provider:'OptiLab',assignment:undefined}:assignment&&definition?{id,title:definition.title,description:definition.description,provider:providerName[definition.provider],assignment}:null;}).filter(row=>row!==null);
  useEffect(()=>{
    const controller=new AbortController();let active=true;setLoading(true);setError('');setWorkspace(null);
    void call('activityWorkspace',scopeInput(scope),controller.signal).then(data=>{
      if(!active)return;const current=data.layouts.find(l=>l.gymId===gymId),ext=data.assignments.filter(a=>a.gymId===gymId).sort((a,b)=>a.displayOrder-b.displayOrder);
      const ids=[...games.filter(g=>g.gimnasio===gymId).map(g=>g.repo),...ext.map(a=>a.activityId)];
      setOrder([...new Set([...(current?.orderedActivityIds??[]),...ids])].filter(id=>ids.includes(id)));setHidden(current?.hiddenOriginalGameIds??[]);setHiddenExternal(ext.filter(a=>a.status!=='published').map(a=>a.activityId));setWorkspace(data);
    }).catch(e=>{if(active&&e.name!=='AbortError')setError(e.message||'No pudimos cargar las actividades.');}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;controller.abort();};
  },[call,scope.courseId,scope.termId,scope.groupId,gymId,reload]);
  function navigate(action:()=>void){if(busy)return;if(dirty)setPending(()=>action);else action();}
  useLayoutEffect(()=>{
    const warn=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();e.returnValue='';}};
    const guard=(e:MouseEvent)=>{
      if(bypass.current||!dirty)return;const element=(e.target as Element).closest<HTMLElement>('a,button');
      if(!element||root.current?.contains(element))return;
      if(element instanceof HTMLAnchorElement&&new URL(element.href).origin===location.origin&&new URL(element.href).pathname===location.pathname&&new URL(element.href).hash.startsWith('#/'))return;
      e.preventDefault();e.stopImmediatePropagation();if(!busy)setPending(()=>()=>{bypass.current=true;try{element.click();}finally{bypass.current=false;}});
    };
    window.addEventListener('beforeunload',warn);document.addEventListener('click',guard,true);
    return()=>{window.removeEventListener('beforeunload',warn);document.removeEventListener('click',guard,true);};
  },[dirty,busy]);
  useEffect(()=>{if(pending||confirmSave||moving)dialog.current?.showModal();else dialog.current?.close();},[pending,confirmSave,moving]);
  useEffect(()=>{if(preview)previewDialog.current?.showModal();else previewDialog.current?.close();},[preview]);
  function move(index:number,delta:number){const next=[...order],target=index+delta;if(target<0||target>=next.length)return;[next[index],next[target]]=[next[target],next[index]];setOrder(next);}
  function drop(event:DragEvent,target:string){event.preventDefault();const source=drag.current;drag.current=null;if(!source||source===target||busy)return;const next=order.filter(id=>id!==source);next.splice(next.indexOf(target),0,source);setOrder(next);}
  function toggle(id:string,externalRow:boolean){const update=(current:string[])=>current.includes(id)?current.filter(x=>x!==id):[...current,id];externalRow?setHiddenExternal(update):setHidden(update);}
  async function save(){
    if(busy||!workspace)return false;setBusy(true);setError('');setNotice('');
    const payload={...scopeInput(scope),gymId,orderedActivityIds:order,hiddenOriginalGameIds:hidden,expectedVersion:layout?.revision??0,
      externalVisibility:external.filter(a=>['published','hidden'].includes(a.status)).map(a=>({activityId:a.activityId,expectedVersion:a.revision,visible:!hiddenExternal.includes(a.activityId)}))};
    const encoded=JSON.stringify(payload);if(retry.current?.payload!==encoded)retry.current={payload:encoded,key:key()};
    try{const saved=await call('saveGymLayout',{...payload,idempotencyKey:retry.current!.key});
      // Commit is atomic. Keep edits visible if the follow-up read fails; a retry uses the same receipt.
      const data=await call('activityWorkspace',scopeInput(scope)),current=data.layouts.find(l=>l.gymId===gymId),ext=data.assignments.filter(a=>a.gymId===gymId).sort((a,b)=>a.displayOrder-b.displayOrder);
      const ids=[...games.filter(g=>g.gimnasio===gymId).map(g=>g.repo),...ext.map(a=>a.activityId)];
      setOrder([...new Set([...(current?.orderedActivityIds??[]),...ids])].filter(id=>ids.includes(id)));setHidden(current?.hiddenOriginalGameIds??[]);setHiddenExternal(ext.filter(a=>a.status!=='published').map(a=>a.activityId));setWorkspace(data);
      setNotice(current?.revision===saved.revision?'Cambios guardados.':'Tus cambios se guardaron. Otro docente actualizó después; se muestra la configuración actual.');retry.current=null;return true;
    }catch(e){setError(`${e instanceof Error?e.message:'No pudimos guardar los cambios.'} Tus cambios siguen aquí. Reintenta o descarta y vuelve a cargar para revisar la versión actual.`);return false;}finally{setBusy(false);}
  }
  function stay(){setPending(null);setConfirmSave(false);setMoving(null);if(blocker.state==='blocked')blocker.reset();}
  async function finishSave(){const action=pending;if(await save()){setPending(null);setConfirmSave(false);action?.();}}
  function discard(){const action=pending;setPending(null);setConfirmSave(false);setOrder(baseOrder);setHidden(baseHidden);setHiddenExternal(baseExternal);setReload(n=>n+1);action?.();}
  async function moveActivity(){
    const assignment=external.find(a=>a.activityId===moving);if(!assignment||busy||destination===gymId)return;
    setBusy(true);setError('');
    const payload={...scopeInput(scope),activityId:assignment.activityId,gymId:destination,expectedVersion:assignment.revision};
    const encoded=JSON.stringify(payload);if(retry.current?.payload!==encoded)retry.current={payload:encoded,key:key()};
    try{await call('moveActivity',{...payload,idempotencyKey:retry.current!.key});setMoving(null);setReload(n=>n+1);setNotice('Actividad movida al gimnasio elegido.');retry.current=null;}
    catch(e){setError(e instanceof Error?e.message:'No pudimos mover la actividad.');}finally{setBusy(false);}
  }
  const isHidden=(row:typeof rows[number])=>row.assignment?hiddenExternal.includes(row.id):hidden.includes(row.id);
  const pendingRow=(row:typeof rows[number],index:number)=>baseOrder[index]!==row.id||(row.assignment?baseExternal.includes(row.id)!==hiddenExternal.includes(row.id):baseHidden.includes(row.id)!==hidden.includes(row.id));
  return <section ref={root} className="gym-manager" aria-labelledby="gym-manager-title">
    <div className="section-heading"><div><span className="eyebrow">ACTIVIDADES DE TU GRUPO</span><h2 id="gym-manager-title">Gimnasios</h2><p>Elige un gimnasio y organiza lo que verán tus alumnos.</p></div><button className="button primary" disabled={disabled||busy||loading||!dirty} onClick={()=>setConfirmSave(true)}>Guardar cambios</button></div>
    <div className="gym-manager-toolbar"><label>Gimnasio<select value={gymId} disabled={disabled||busy||loading} onChange={e=>{const next=Number(e.target.value);navigate(()=>{setGymId(next);setNotice('');});}}>{gyms.map(gym=><option key={gym.id} value={gym.id}>{gym.id}. {gym.name}</option>)}</select></label>
      <button className="button primary" disabled={disabled||busy||loading||!!error&&!workspace} onClick={()=>navigate(()=>setCreateRequest(n=>n+1))}>+ Agregar actividad</button>
      <button className="button" disabled={busy||loading||!workspace} onClick={()=>setPreview(true)}><Eye size={17}/> Vista previa del alumno</button>
      <button className="button" disabled={disabled||busy||loading||!workspace} onClick={()=>{setOrder([...games.filter(g=>g.gimnasio===gymId).map(g=>g.repo),...new Set([...(workspace?.placements.find(p=>p.gymId===gymId)?.orderedActivityIds??[]).filter(id=>external.some(a=>a.activityId===id)),...external.map(a=>a.activityId)])]);setNotice('Orden predeterminado preparado. Guarda para confirmarlo.');}}><RotateCcw size={17}/> Restaurar orden predeterminado</button>
    </div>
    {error&&<p role="alert" className="teacher-error">{error} {!dirty&&<button className="button" onClick={()=>setReload(n=>n+1)}>Reintentar</button>}</p>}
    {notice&&<p role="status" className="teacher-success">{notice}</p>}
    <p className="muted" role="status">{dirty?'Tienes cambios pendientes de guardar.':'No hay cambios pendientes.'} El orden y la visibilidad se guardan juntos.</p>
    {loading?<TeacherSkeleton variant="list"/>:workspace&&<><p className="muted">Arrastra las filas o usa Subir y Bajar con el teclado. Ocultar no borra el progreso ni cambia las insignias.</p>
      <ol className="gym-manager-list" aria-label={`Actividades de ${gyms[gymId-1].name}`}>{rows.map((row,index)=><li key={row.id} className={`gym-manager-row ${isHidden(row)?'is-hidden':''}`} draggable={!disabled&&!busy} onDragStart={()=>{drag.current=row.id;}} onDragEnd={()=>{drag.current=null;}} onDragOver={e=>e.preventDefault()} onDrop={e=>drop(e,row.id)}>
        <span className="gym-manager-order" aria-hidden="true">{String(index+1).padStart(2,'0')}</span><div className="gym-manager-copy"><strong>{row.title}</strong><small>{row.provider} · {row.assignment?.status==='draft'?'Borrador':row.assignment?.status==='archived'?'Archivada':isHidden(row)?'Oculta para tus alumnos':'Visible para tus alumnos'}</small>{pendingRow(row,index)&&<small className="gym-pending">Cambio pendiente</small>}</div>
        <div className="gym-manager-actions"><button className="button" aria-label={`Subir ${row.title}`} disabled={disabled||busy||index===0} onClick={()=>move(index,-1)}><ChevronUp size={16}/> Subir</button><button className="button" aria-label={`Bajar ${row.title}`} disabled={disabled||busy||index===rows.length-1} onClick={()=>move(index,1)}><ChevronDown size={16}/> Bajar</button>
        <button className="button" aria-label={`${isHidden(row)?'Mostrar':'Ocultar'} ${row.title}`} aria-pressed={!isHidden(row)} disabled={disabled||busy||!!row.assignment&&!['published','hidden'].includes(row.assignment.status)} onClick={()=>toggle(row.id,!!row.assignment)}>{isHidden(row)?<Eye size={16}/>:<EyeOff size={16}/>} {isHidden(row)?'Mostrar':'Ocultar'}</button>{row.assignment&&<button className="button" disabled={disabled||busy||row.assignment.status==='archived'} aria-label={`Cambiar gimnasio de ${row.title}`} onClick={()=>navigate(()=>{setError('');setDestination(gymId===1?2:1);setMoving(row.id);})}>Cambiar gimnasio</button>}</div>
      </li>)}</ol></>}
    <Activities scope={scope} scopes={scopes} call={call} refresh={reload} disabled={disabled||busy} initialGymId={gymId} createRequest={createRequest} editorOnly onSaved={()=>setReload(n=>n+1)}/>
    <dialog ref={dialog} className="teacher-dialog" aria-labelledby="gym-save-title" onCancel={e=>{e.preventDefault();if(!busy)stay();}}><h2 id="gym-save-title">{moving?'Cambiar gimnasio de la actividad':pending?'Hay cambios sin guardar':'Guardar cambios del gimnasio'}</h2><p>{moving?'Se conservarán sus publicaciones e historial.':pending?'Puedes guardarlos antes de continuar o descartarlos.':'El nuevo orden y la visibilidad se aplicarán solo a este grupo.'}</p>{moving&&<label>Gimnasio de destino<select value={destination} onChange={e=>setDestination(Number(e.target.value))}>{gyms.filter(g=>g.id!==gymId).map(g=><option key={g.id} value={g.id}>{g.id}. {g.name}</option>)}</select></label>}{error&&<p role="alert">{error}</p>}<div className="teacher-actions">{moving?<button className="button primary" disabled={busy||loading} onClick={()=>void moveActivity()}>Confirmar cambio de gimnasio</button>:<button className="button primary" disabled={busy} onClick={()=>void finishSave()}>Guardar y continuar</button>}{pending&&<button className="button" disabled={busy} onClick={discard}>Descartar cambios</button>}<button className="button" disabled={busy} onClick={stay}>Seguir editando</button></div></dialog>
    <dialog ref={previewDialog} className="teacher-dialog gym-preview-dialog" aria-labelledby="gym-preview-title" onCancel={()=>setPreview(false)}><h2 id="gym-preview-title">Vista previa del alumno · {gyms[gymId-1].name}</h2><p>{dirty?'Incluye tus cambios pendientes. Guarda para publicarlos.':'Estas son las actividades visibles del grupo.'}</p><p className="muted">La vista previa no registra práctica ni resultados. Cada alumno conserva su propio progreso.</p><div className="game-grid gym-preview-cards">{rows.filter(row=>!isHidden(row)).map(row=><article className="cartridge" key={row.id}><div className="cartridge-art">{!row.assignment&&gymId===3?<SimplexCover repo={row.id}/>:<div className="game-glyph" aria-hidden="true">{row.assignment?<ExternalLink size={50}/>:'◈'}</div>}<span className="game-region">GIMNASIO {gymId}</span></div><div className="cartridge-body"><span className="cartridge-provider">{row.provider}</span><h3>{row.title}</h3><p>{row.description||'Actividad complementaria asignada por tu profesora.'}</p><span className="button play" aria-disabled="true">{row.assignment?'Abrir':'Jugar'} · Vista previa</span></div></article>)}</div><button className="button" onClick={()=>setPreview(false)}>Cerrar vista previa</button></dialog>
  </section>;
}
