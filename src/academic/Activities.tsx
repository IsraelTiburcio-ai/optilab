import {useEffect,useMemo,useRef,useState} from 'react';
import {gyms} from '../data';
import {iframePolicy} from '../activities/urls';
import {provisionalTitle,resolveActivityLink} from './activityLink';
import {key,scopeInput} from './components';
import type {AcademicCall} from './client';
import type {ActivityAssignment,ActivityDefinition,ActivityProvider,ActivityWorkspace,TeachingScope} from './types';
import './activities.css';

type FormState={activityId?:string;expectedVersion?:number;link:string;embedUrl:string|null;title:string;description:string;instructions:string;gymId:number;groupIds:string[]};
const blankForm=(groupId:string,gymId=3):FormState=>({link:'',embedUrl:null,title:'',description:'',instructions:'',gymId,groupIds:[groupId]});
const providerLabel=(provider:ActivityProvider)=>provider==='wordwall'?'Wordwall':'LearningApps';
const formKey=(form:FormState)=>JSON.stringify([form.activityId,form.expectedVersion,form.link,form.embedUrl,form.title,form.description,form.instructions,form.gymId,form.groupIds]);
const statusLabel=(status:string)=>status==='published'?'Publicada':status==='hidden'?'Oculta':status==='archived'?'Archivada':'Borrador';

export function Activities({scope,scopes,call,refresh,disabled=false,initialGymId=3,createRequest=0,editorOnly=false,onSaved}:{scope:TeachingScope;scopes:TeachingScope[];call:AcademicCall;refresh:number;disabled?:boolean;initialGymId?:number;createRequest?:number;editorOnly?:boolean;onSaved?:()=>void}) {
  const [workspace,setWorkspace]=useState<ActivityWorkspace|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [reload,setReload]=useState(0),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  const [editor,setEditor]=useState<ActivityDefinition|null|undefined>(undefined),[form,setForm]=useState<FormState>(blankForm(scope.groupId));
  const [editorError,setEditorError]=useState(''),[preview,setPreview]=useState<{title:string;sourceUrl:string;embedUrl:string|null;provider:ActivityProvider}|null>(null);
  const [partial,setPartial]=useState<{activityId:string;revision:number;key:string}|null>(null),partialRef=useRef<{activityId:string;revision:number;key:string}|null>(null),saveKey=useRef(key()),publishKey=useRef(key()),saveFormKey=useRef('');
  const resolved=useMemo(()=>resolveActivityLink(form.link),[form.link]);
  const editorRef=useRef<HTMLDialogElement>(null),previewRef=useRef<HTMLDialogElement>(null),noticeRef=useRef<HTMLParagraphElement>(null);

  const groupOptions=useMemo(()=>scopes.filter(s=>s.courseId===scope.courseId&&s.termId===scope.termId&&s.capabilities.manageMembers),[scopes,scope.courseId,scope.termId]);
  const byId=useMemo(()=>new Map((workspace?.definitions??[]).map(definition=>[definition.activityId,definition])),[workspace]);
  const assignmentById=useMemo(()=>new Map((workspace?.assignments??[]).map(assignment=>[assignment.activityId,assignment])),[workspace]);

  useEffect(()=>{
    if(editorOnly){setLoading(false);return;}
    const controller=new AbortController();let active=true;setLoading(true);setWorkspace(null);setError('');
    void call('activityWorkspace',scopeInput(scope),controller.signal)
      .then(data=>{if(active)setWorkspace(data);})
      .catch(e=>{if(active&&e?.name!=='AbortError')setError(e.message||'No se pudieron cargar las actividades.');})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;controller.abort();};
  },[call,scope.courseId,scope.termId,scope.groupId,refresh,reload,editorOnly]);

  useEffect(()=>{
    if(editor!==undefined){const dialog=editorRef.current;if(dialog&&!dialog.open){dialog.showModal();dialog.querySelector<HTMLInputElement>('input[name="title"]')?.focus();}}
  },[editor]);
  useEffect(()=>{if(preview){const dialog=previewRef.current;if(dialog&&!dialog.open)dialog.showModal();}},[preview]);
  useEffect(()=>{if(notice){noticeRef.current?.focus();}},[notice]);
  useEffect(()=>{if(createRequest>0)openCreate();},[createRequest]);

  const refreshWorkspace=()=>setReload(value=>value+1);
  const report=(message:string)=>setNotice(message);
  async function action<T>(fn:()=>Promise<T>,message:string){
    if(busy)return;setBusy(true);setError('');setNotice('');
    try{await fn();refreshWorkspace();report(message);}catch(e){setError(e instanceof Error?e.message:'No se pudo completar la operación.');}finally{setBusy(false);}
  }
  function openCreate(){
    setForm(blankForm(scope.groupId,initialGymId));setEditorError('');partialRef.current=null;setPartial(null);saveKey.current=key();publishKey.current=key();saveFormKey.current='';setEditor(null);
  }
  function openEdit(definition:ActivityDefinition){
    const assignment=assignmentById.get(definition.activityId);
    setForm({activityId:definition.activityId,expectedVersion:definition.revision,link:definition.sourceUrl,embedUrl:definition.embedUrl,title:definition.title,description:definition.description,
      instructions:definition.instructions,gymId:assignment?.gymId??3,groupIds:definition.groupIds.filter(id=>groupOptions.some(group=>group.groupId===id))});
    setEditorError('');partialRef.current=null;setPartial(null);saveKey.current=key();publishKey.current=key();saveFormKey.current='';setEditor(definition);
  }
  function closeEditor(){setEditor(undefined);setEditorError('');editorRef.current?.close();}
  async function saveDraft(publishNow=false){
    const link=resolveActivityLink(form.link);
    if(!link){setEditorError('Pega un enlace público válido de LearningApps o Wordwall.');return;}
    const title=(form.title.trim()||link.title||provisionalTitle(link.provider)).trim();
    if(!form.groupIds.length){setEditorError('Selecciona un grupo autorizado.');return;}
    if(busy)return;setBusy(true);setEditorError('');
    const targetScope=groupOptions.find(group=>group.groupId===form.groupIds[0]);
    if(!targetScope){setBusy(false);setEditorError('Selecciona un grupo autorizado.');return;}
    const prior=partialRef.current,currentKey=formKey(form);let current=prior&&prior.key===currentKey?prior:null;
    try{
      if(!current){
        if(saveFormKey.current!==currentKey){saveKey.current=key();publishKey.current=key();saveFormKey.current=currentKey;}
        const saved=await call('saveActivityDraft',{...scopeInput(targetScope),groupIds:form.groupIds,activityId:prior?.activityId??form.activityId,expectedVersion:prior?.revision??form.expectedVersion,
          provider:link.provider,resourceId:link.resourceId,sourceUrl:link.sourceUrl,embedUrl:form.embedUrl,title,
          description:form.description,instructions:form.instructions,gymId:form.gymId,idempotencyKey:saveKey.current});
        if(!saved.activityId||typeof saved.revision!=='number')throw new Error('El API no devolvió la actividad guardada.');
        current={activityId:saved.activityId,revision:saved.revision,key:currentKey};partialRef.current=current;setPartial(current);
      }
      if(publishNow){
        await call('publishActivities',{...scopeInput(targetScope),groupIds:form.groupIds,activityId:current.activityId,expectedVersion:current.revision,idempotencyKey:publishKey.current});
      }
      closeEditor();refreshWorkspace();onSaved?.();report(publishNow?'Actividad publicada. Ya aparece en las tarjetas del gimnasio.':'Borrador guardado. Ya puedes publicarlo cuando quieras.');
    }catch(e){setEditorError(publishNow&&current?'La actividad quedó guardada como borrador, pero no se pudo publicar. Reintenta «Publicar actividad»; no se creará otro borrador.':e instanceof Error?e.message:'No se pudo guardar la actividad.');}finally{setBusy(false);}
  }
  async function retryPublish(){
    const targetScope=groupOptions.find(group=>group.groupId===form.groupIds[0]);if(!targetScope){setEditorError('Selecciona un grupo autorizado.');return;}
    const current=partialRef.current;
    if(!current||current.key!==formKey(form)){await saveDraft(true);return;}
    if(busy)return;setBusy(true);setEditorError('');
    try{
      await call('publishActivities',{...scopeInput(targetScope),groupIds:form.groupIds,activityId:current.activityId,expectedVersion:current.revision,idempotencyKey:publishKey.current});
      closeEditor();refreshWorkspace();onSaved?.();report('Actividad publicada. Ya aparece en las tarjetas del gimnasio.');
    }catch(e){setEditorError(e instanceof Error?e.message:'No se pudo publicar la actividad guardada. Reintenta; no se creará otro borrador.');}finally{setBusy(false);}
  }
  function openPreview(state:FormState){
    const link=resolveActivityLink(state.link);if(!link){setEditorError('El enlace no corresponde a LearningApps o Wordwall.');return;}
    setPreview({title:state.title||link.title||provisionalTitle(link.provider),sourceUrl:link.sourceUrl,embedUrl:link.embedUrl,provider:link.provider});
  }
  function previewDefinition(definition:ActivityDefinition){
    setPreview({title:definition.title,sourceUrl:definition.sourceUrl,embedUrl:definition.embedUrl,provider:definition.provider});
  }
  async function publish(definition:ActivityDefinition){
    await action(()=>call('publishActivities',{...scopeInput(scope),groupIds:[scope.groupId],activityId:definition.activityId,expectedVersion:definition.revision,idempotencyKey:key()}),'Actividad publicada en este grupo.');
  }
  async function hide(assignment:ActivityAssignment){
    await action(()=>call('setActivityStatus',{...scopeInput(scope),activityId:assignment.activityId,status:'hidden',expectedVersion:assignment.revision,idempotencyKey:key()}),'Actividad oculta para alumnos.');
  }
  async function archive(assignment:ActivityAssignment){
    await action(()=>call('setActivityStatus',{...scopeInput(scope),activityId:assignment.activityId,status:'archived',expectedVersion:assignment.revision,idempotencyKey:key()}),'Actividad archivada; su historial permanece.');
  }
  const library=workspace?.definitions??[];
  const pending=workspace?.assignments.filter(assignment=>assignment.status!=='published')??[];

  return <section className="activity-editor" aria-label={editorOnly?"Agregar actividad":"Biblioteca de actividades"}>
    {!editorOnly&&<><div className="activity-editor-heading"><div><span className="eyebrow">CONTENIDO DEL GRUPO</span><h2 id="activity-editor-title">Biblioteca</h2><p>Edita recursos existentes y recupera borradores. Agrega y organiza actividades en Gimnasios.</p></div>
      </div>
    <p className="activity-editor-note">Las actividades de Wordwall y LearningApps se abren de forma segura. Sus resultados no se cuentan como insignias de OptiLab.</p>
    {error&&<p className="teacher-error" role="alert">{error} <button className="text-button" onClick={refreshWorkspace}>Reintentar</button></p>}

    {loading?<p role="status">Cargando actividades del grupo…</p>:<div className="activity-editor-layout">
      <section className="activity-library" aria-labelledby="activity-library-title"><div className="section-heading"><h3 id="activity-library-title">Biblioteca</h3><span>{library.length} actividades</span></div>
        {!library.length?<p className="teacher-empty">Aún no hay actividades. Agrega la primera desde Gimnasios.</p>:<ul>{library.map(definition=>{const assignment=assignmentById.get(definition.activityId);return <li className="activity-library-card" key={definition.activityId}>
          <div><strong>{definition.title}</strong><small>{providerLabel(definition.provider)} · {assignment?statusLabel(assignment.status):'sin asignación'} · v{definition.revision}</small></div>
          <div className="activity-library-actions"><button className="button" onClick={()=>previewDefinition(definition)}>Previsualizar {definition.title}</button><button className="button" onClick={()=>openEdit(definition)}>Editar {definition.title}</button></div>
        </li>;})}</ul>}
        {!!pending.length&&<><h4>Borradores, ocultas y archivadas</h4><ul>{pending.map(assignment=>{const definition=byId.get(assignment.activityId);if(!definition)return null;return <li className="activity-library-card" key={`${assignment.activityId}-${assignment.status}`}><div><strong>{definition.title}</strong><small>{statusLabel(assignment.status)} · Gimnasio {assignment.gymId}</small></div><div className="activity-library-actions"><button className="button" onClick={()=>previewDefinition(definition)}>Previsualizar {definition.title}</button>{assignment.status!=='archived'&&<button className="button" onClick={()=>publish(definition)}>Publicar {definition.title}</button>}{assignment.status==='published'&&<button className="button" onClick={()=>hide(assignment)}>Ocultar {definition.title}</button>}{assignment.status!=='archived'&&<button className="button" onClick={()=>archive(assignment)}>Archivar {definition.title}</button>}</div></li>;})}</ul></>}
      </section>
    </div>}

    </>}
    {notice&&<p className="teacher-success" role="status" tabIndex={-1} ref={noticeRef}>{notice}</p>}
    <dialog ref={editorRef} className="teacher-dialog activity-editor-dialog" aria-labelledby="activity-dialog-title" onCancel={event=>{event.preventDefault();if(!busy)closeEditor();}} onClose={()=>setEditor(undefined)}>
      <form method="dialog" onSubmit={event=>event.preventDefault()}>
        <h2 id="activity-dialog-title">{editor?'Editar actividad':'Nueva actividad'}</h2>
        <p className="muted">Pega el enlace, revisa el título y publica para tu grupo. También puedes guardarlo como borrador.</p>
        <label>Enlace de la actividad<input type="url" name="link" value={form.link} maxLength={1000} placeholder="https://learningapps.org/watch?v=… o https://wordwall.net/resource/…" onChange={event=>{const link=event.target.value;const parsed=resolveActivityLink(link);setEditorError('');setForm({...form,link,embedUrl:parsed?.embedUrl??null,title:form.title||parsed?.title||(parsed?provisionalTitle(parsed.provider):'')});}}/></label>
        <p className="muted">{resolved?`Detectado: ${providerLabel(resolved.provider)} · ${resolved.externalOnly?'se abrirá de forma segura en el proveedor':'vista integrada disponible'}`:'Pega el enlace público de la actividad.'}</p>
        <label>Título<input name="title" value={form.title} maxLength={120} placeholder={resolved?.title||'Título de la actividad'} onChange={event=>setForm({...form,title:event.target.value})}/></label>
        <label>Gimnasio<select value={form.gymId} onChange={event=>setForm({...form,gymId:Number(event.target.value)})}>{gyms.map(gym=><option key={gym.id} value={gym.id}>{gym.id}. {gym.name}</option>)}</select></label>
        <label>Grupo<select value={form.groupIds[0]??scope.groupId} onChange={event=>setForm({...form,groupIds:[event.target.value]})}>{groupOptions.map(group=><option key={group.groupId} value={group.groupId}>{group.title||'Grupo autorizado'}</option>)}</select></label>
        <details className="activity-advanced"><summary>Opciones avanzadas</summary><label>Descripción<textarea value={form.description} maxLength={500} onChange={event=>setForm({...form,description:event.target.value})}/></label><label>Instrucciones<textarea value={form.instructions} maxLength={1000} onChange={event=>setForm({...form,instructions:event.target.value})}/></label></details>
        {partial&&<p className="muted">Borrador recuperable guardado. Los cambios de contenido actualizan esta misma actividad.</p>}{editorError&&<p className="teacher-error" role="alert">{editorError}</p>}
        <div className="teacher-actions"><button type="button" className="button" onClick={()=>openPreview(form)}>Previsualizar</button><button type="button" className="button" onClick={()=>void saveDraft(false)} disabled={busy}>Guardar borrador</button><button type="button" className="button primary" onClick={()=>void (partialRef.current?.key===formKey(form)?retryPublish():saveDraft(true))} disabled={busy}>Publicar actividad</button><button type="button" className="button" onClick={closeEditor} disabled={busy}>Cancelar</button></div>
      </form>
    </dialog>

    <dialog ref={previewRef} className="teacher-dialog activity-preview-dialog" aria-labelledby="activity-preview-title" onCancel={()=>setPreview(null)} onClose={()=>setPreview(null)}>
      <h2 id="activity-preview-title">Vista previa: {preview?.title}</h2>
      <p className="activity-preview-warning">Vista previa docente. No se publica ni se envía al alumno.</p>
      {preview&&<>{preview.embedUrl?<div className="activity-preview-frame"><iframe title={`Vista previa de ${preview.title}`} src={preview.embedUrl} {...iframePolicy(preview.provider)}/></div>:<p className="notice">Esta actividad se abrirá en {preview?.provider==='wordwall'?'Wordwall':'LearningApps'}.</p>}<p><a href={preview.sourceUrl} target="_blank" rel="noopener noreferrer">Abrir en {providerLabel(preview.provider)}</a></p></>}
      <button className="button" onClick={()=>{setPreview(null);previewRef.current?.close();}}>Cerrar vista previa</button>
    </dialog>
  </section>;
}
