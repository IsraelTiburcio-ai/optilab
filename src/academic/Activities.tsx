import {useEffect,useMemo,useRef,useState} from 'react';
import {gyms} from '../data';
import {approvedActivityUrl,iframePolicy} from '../activities/urls';
import {key,scopeInput} from './components';
import type {AcademicCall} from './client';
import type {ActivityAssignment,ActivityDefinition,ActivityProvider,ActivityWorkspace,PublishedActivity,Scope,TeachingScope} from './types';
import './activities.css';

type FormState={activityId?:string;expectedVersion?:number;provider:ActivityProvider;resourceId:string;sourceUrl:string;embedUrl:string;title:string;description:string;instructions:string;gymId:number;groupIds:string[]};
const blankForm=(groupId:string):FormState=>({provider:'wordwall',resourceId:'',sourceUrl:'',embedUrl:'',title:'',description:'',instructions:'',gymId:3,groupIds:[groupId]});
const providerLabel=(provider:ActivityProvider)=>provider==='wordwall'?'Wordwall':'LearningApps';
const statusLabel=(status:string)=>status==='published'?'Publicada':status==='hidden'?'Oculta':status==='archived'?'Archivada':'Borrador';

export function Activities({scope,scopes,call,refresh,disabled=false}:{scope:TeachingScope;scopes:TeachingScope[];call:AcademicCall;refresh:number;disabled?:boolean}) {
  const [workspace,setWorkspace]=useState<ActivityWorkspace|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [reload,setReload]=useState(0),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  const [editor,setEditor]=useState<ActivityDefinition|null|undefined>(undefined),[form,setForm]=useState<FormState>(blankForm(scope.groupId));
  const [editorError,setEditorError]=useState(''),[preview,setPreview]=useState<{title:string;sourceUrl:string;embedUrl:string;provider:ActivityProvider}|null>(null);
  const [drag,setDrag]=useState<{activityId:string;gymId:number}|null>(null);
  const editorRef=useRef<HTMLDialogElement>(null),previewRef=useRef<HTMLDialogElement>(null),noticeRef=useRef<HTMLParagraphElement>(null);

  const groupOptions=useMemo(()=>scopes.filter(s=>s.courseId===scope.courseId&&s.termId===scope.termId&&s.capabilities.manageMembers),[scopes,scope.courseId,scope.termId]);
  const byId=useMemo(()=>new Map((workspace?.definitions??[]).map(definition=>[definition.activityId,definition])),[workspace]);
  const assignmentById=useMemo(()=>new Map((workspace?.assignments??[]).map(assignment=>[assignment.activityId,assignment])),[workspace]);
  const placements=useMemo(()=>new Map((workspace?.placements??[]).map(placement=>[placement.gymId,placement])),[workspace]);

  useEffect(()=>{
    const controller=new AbortController();let active=true;setLoading(true);setError('');
    void call('activityWorkspace',scopeInput(scope),controller.signal)
      .then(data=>{if(active)setWorkspace(data);})
      .catch(e=>{if(active&&e?.name!=='AbortError')setError(e.message||'No se pudieron cargar las actividades.');})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;controller.abort();};
  },[call,scope.courseId,scope.termId,scope.groupId,refresh,reload]);

  useEffect(()=>{
    if(editor!==undefined){const dialog=editorRef.current;if(dialog&&!dialog.open){dialog.showModal();dialog.querySelector<HTMLInputElement>('input[name="title"]')?.focus();}}
  },[editor]);
  useEffect(()=>{if(preview){const dialog=previewRef.current;if(dialog&&!dialog.open)dialog.showModal();}},[preview]);
  useEffect(()=>{if(notice){noticeRef.current?.focus();}},[notice]);

  const refreshWorkspace=()=>setReload(value=>value+1);
  const report=(message:string)=>setNotice(message);
  async function action<T>(fn:()=>Promise<T>,message:string){
    if(busy)return;setBusy(true);setError('');setNotice('');
    try{await fn();refreshWorkspace();report(message);}catch(e){setError(e instanceof Error?e.message:'No se pudo completar la operación.');}finally{setBusy(false);}
  }
  function openCreate(){
    setForm(blankForm(scope.groupId));setEditorError('');setEditor(null);
  }
  function openEdit(definition:ActivityDefinition){
    const assignment=assignmentById.get(definition.activityId);
    setForm({activityId:definition.activityId,expectedVersion:definition.revision,provider:definition.provider,resourceId:definition.resourceId,
      sourceUrl:definition.sourceUrl,embedUrl:definition.embedUrl,title:definition.title,description:definition.description,
      instructions:definition.instructions,gymId:assignment?.gymId??3,groupIds:definition.groupIds.filter(id=>groupOptions.some(group=>group.groupId===id))});
    setEditorError('');setEditor(definition);
  }
  function closeEditor(){setEditor(undefined);setEditorError('');editorRef.current?.close();}
  function checkUrls(state:FormState){
    const sourceUrl=approvedActivityUrl(state.provider,state.sourceUrl,'source',state.resourceId);
    const embedUrl=approvedActivityUrl(state.provider,state.embedUrl,'embed',state.resourceId);
    if(!sourceUrl||!embedUrl){setEditorError('Usa solo enlaces HTTPS exactos de Wordwall o LearningApps; source y embed deben corresponder al mismo recurso.');return null;}
    return {sourceUrl,embedUrl};
  }
  async function saveDraft(){
    if(!checkUrls(form))return;
    if(!form.title.trim()){setEditorError('Escribe un título.');return;}
    if(!form.groupIds.length){setEditorError('Selecciona al menos un grupo autorizado.');return;}
    if(busy)return;setBusy(true);setEditorError('');
    try{
      await call('saveActivityDraft',{...scopeInput(scope),groupIds:form.groupIds,activityId:form.activityId,expectedVersion:form.expectedVersion,
        provider:form.provider,resourceId:form.resourceId,sourceUrl:form.sourceUrl,embedUrl:form.embedUrl,title:form.title.trim(),
        description:form.description,instructions:form.instructions,gymId:form.gymId,idempotencyKey:key()});
      closeEditor();refreshWorkspace();report('Borrador guardado. Ya puedes previsualizarlo o publicarlo.');
    }catch(e){setEditorError(e instanceof Error?e.message:'No se pudo guardar el borrador.');}finally{setBusy(false);}
  }
  function openPreview(state:FormState){
    const urls=checkUrls(state);if(!urls)return;
    setPreview({title:state.title||'Borrador sin título',sourceUrl:urls.sourceUrl,embedUrl:urls.embedUrl,provider:state.provider});
  }
  function previewDefinition(definition:ActivityDefinition){
    const urls={sourceUrl:approvedActivityUrl(definition.provider,definition.sourceUrl,'source',definition.resourceId),embedUrl:approvedActivityUrl(definition.provider,definition.embedUrl,'embed',definition.resourceId)};
    if(!urls.sourceUrl||!urls.embedUrl){setError('La actividad guardada tiene URLs incompatibles.');return;}
    setPreview({title:definition.title,sourceUrl:urls.sourceUrl,embedUrl:urls.embedUrl,provider:definition.provider});
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
  async function move(assignment:ActivityAssignment,gymId:number){
    if(assignment.gymId===gymId)return;
    await action(()=>call('moveActivity',{...scopeInput(scope),activityId:assignment.activityId,gymId,expectedVersion:assignment.revision,idempotencyKey:key()}),`Actividad movida a Gimnasio ${gymId}.`);
  }
  async function reorder(gymId:number,orderedActivityIds:string[],placementRevision:number,message='Orden guardado.'){
    await action(()=>call('reorderActivities',{...scopeInput(scope),gymId,orderedActivityIds,expectedVersion:placementRevision,idempotencyKey:key()}),message);
  }
  function published(gymId:number){
    const placement=placements.get(gymId),ids=placement?.orderedActivityIds??[];
    return ids.map(activityId=>{const definition=byId.get(activityId),assignment=assignmentById.get(activityId);return definition&&assignment&&assignment.status==='published'?{definition,assignment}:null;})
      .filter((row):row is {definition:ActivityDefinition;assignment:ActivityAssignment}=>!!row);
  }
  function moveWithin(gymId:number,activityId:string,direction:-1|1){
    const placement=placements.get(gymId),rows=published(gymId),index=rows.findIndex(row=>row.definition.activityId===activityId);
    if(!placement||index<0)return;const target=index+direction;if(target<0||target>=rows.length)return;
    const ids=rows.map(row=>row.definition.activityId);[ids[index],ids[target]]=[ids[target],ids[index]];
    void reorder(gymId,ids,placement.revision,`Actividad movida ${direction<0?'arriba':'abajo'} en Gimnasio ${gymId}.`);
  }
  function dropOnCard(gymId:number,targetId:string){
    if(!drag)return;const placement=placements.get(gymId),rows=published(gymId);if(!placement)return;
    const ids=rows.map(row=>row.definition.activityId).filter(id=>id!==drag.activityId);const index=ids.indexOf(targetId);
    ids.splice(index<0?ids.length:index,0,drag.activityId);setDrag(null);
    if(ids.join('|')!==rows.map(row=>row.definition.activityId).join('|'))void reorder(gymId,ids,placement.revision,`Actividad movida en Gimnasio ${gymId}.`);
  }
  function dropOnGym(gymId:number){
    if(!drag)return;const assignment=assignmentById.get(drag.activityId);if(assignment){void move(assignment,gymId);}setDrag(null);
  }
  const library=workspace?.definitions??[];
  const pending=workspace?.assignments.filter(assignment=>assignment.status!=='published')??[];

  return <section className="activity-editor" aria-labelledby="activity-editor-title">
    <div className="activity-editor-heading"><div><span className="eyebrow">CONTENIDO DEL GRUPO</span><h2 id="activity-editor-title">Actividades</h2><p>Organiza actividades externas como complemento. Los 28 juegos originales no cambian.</p></div>
      <button className="button primary" onClick={openCreate} disabled={disabled||busy}>Nueva actividad</button></div>
    <p className="activity-editor-note">Solo se aceptan enlaces HTTPS de Wordwall y LearningApps con host, ruta y parámetros permitidos. La telemetría de estos proveedores no se inventa: se muestra como no verificada.</p>
    {error&&<p className="teacher-error" role="alert">{error} <button className="text-button" onClick={refreshWorkspace}>Reintentar</button></p>}
    {notice&&<p className="teacher-success" role="status" tabIndex={-1} ref={noticeRef}>{notice}</p>}
    {loading?<p role="status">Cargando actividades del grupo…</p>:<div className="activity-editor-layout">
      <section className="activity-library" aria-labelledby="activity-library-title"><div className="section-heading"><h3 id="activity-library-title">Biblioteca</h3><span>{library.length} definiciones</span></div>
        {!library.length?<p className="teacher-empty">Aún no hay actividades. Crea la primera para este grupo.</p>:<ul>{library.map(definition=>{const assignment=assignmentById.get(definition.activityId);return <li className="activity-library-card" key={definition.activityId}>
          <div><strong>{definition.title}</strong><small>{providerLabel(definition.provider)} · {assignment?statusLabel(assignment.status):'sin asignación'} · v{definition.revision}</small></div>
          <div className="activity-library-actions"><button className="button" onClick={()=>previewDefinition(definition)}>Previsualizar {definition.title}</button><button className="button" onClick={()=>openEdit(definition)}>Editar {definition.title}</button></div>
        </li>;})}</ul>}
        {!!pending.length&&<><h4>Borradores, ocultas y archivadas</h4><ul>{pending.map(assignment=>{const definition=byId.get(assignment.activityId);if(!definition)return null;return <li className="activity-library-card" key={`${assignment.activityId}-${assignment.status}`}><div><strong>{definition.title}</strong><small>{statusLabel(assignment.status)} · Gimnasio {assignment.gymId}</small></div><div className="activity-library-actions"><button className="button" onClick={()=>previewDefinition(definition)}>Previsualizar {definition.title}</button>{assignment.status!=='archived'&&<button className="button" onClick={()=>publish(definition)}>Publicar {definition.title}</button>}{assignment.status==='published'&&<button className="button" onClick={()=>hide(assignment)}>Ocultar {definition.title}</button>}{assignment.status!=='archived'&&<button className="button" onClick={()=>archive(assignment)}>Archivar {definition.title}</button>}</div></li>;})}</ul></>}
      </section>
      <section className="activity-gyms" aria-labelledby="activity-gyms-title"><div className="section-heading"><h3 id="activity-gyms-title">Gimnasios del grupo</h3><span>Arrastra o usa botones</span></div>
        <p className="activity-editor-help">Arrastrar y soltar funciona con ratón en escritorio. En móvil, teclado o lector de pantalla usa Subir/Bajar y Mover a gimnasio.</p>
        <div className="activity-gym-grid">{gyms.map(gym=>{const placement=placements.get(gym.id),rows=published(gym.id);return <section className="activity-gym-column" key={gym.id} aria-labelledby={`activity-gym-${gym.id}`} onDragOver={event=>event.preventDefault()} onDrop={()=>dropOnGym(gym.id)}>
          <div className="activity-gym-heading"><h4 id={`activity-gym-${gym.id}`}>Gimnasio {gym.id}</h4><span>{rows.length} actividades</span></div>
          <p className="activity-gym-topic">{gym.name}</p>
          {!rows.length?<p className="teacher-empty">Sin actividades publicadas.</p>:<ol className="activity-sort-list">{rows.map(({definition,assignment},index)=><li className="activity-sort-item" key={definition.activityId} draggable onDragStart={()=>setDrag({activityId:definition.activityId,gymId:gym.id})} onDragEnd={()=>setDrag(null)} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.stopPropagation();dropOnCard(gym.id,definition.activityId);}}>
            <div className="activity-sort-main"><strong>{definition.title}</strong><small>{providerLabel(definition.provider)} · {statusLabel(assignment.status)}</small><span className="activity-telemetry">Telemetría no verificada</span></div>
            <div className="activity-sort-actions" aria-label={`Acciones para ${definition.title}`}>
              <button className="button" onClick={()=>moveWithin(gym.id,definition.activityId,-1)} disabled={index===0||disabled||busy}>Subir {definition.title}</button>
              <button className="button" onClick={()=>moveWithin(gym.id,definition.activityId,1)} disabled={index===rows.length-1||disabled||busy}>Bajar {definition.title}</button>
              <label>Mover a gimnasio<select aria-label={`Mover ${definition.title} a gimnasio`} defaultValue={gym.id} disabled={disabled||busy} onChange={event=>{const target=Number(event.target.value);void move(assignment,target);event.target.value=String(gym.id);}}>{gyms.map(item=><option key={item.id} value={item.id}>{item.id}. {item.name}</option>)}</select></label>
              {(definition.status==='draft'||assignment.definitionRevision!==definition.revision)&&<button className="button primary" onClick={()=>publish(definition)} disabled={disabled||busy}>Publicar cambios {definition.title}</button>}
              <button className="button" onClick={()=>hide(assignment)} disabled={disabled||busy}>Ocultar {definition.title}</button>
              <button className="button" onClick={()=>archive(assignment)} disabled={disabled||busy}>Archivar {definition.title}</button>
            </div>
          </li>)}</ol>}
          {placement&&<small className="activity-placement-revision">Orden rev. {placement.revision}</small>}
        </section>;})}</div>
      </section>
    </div>}

    <dialog ref={editorRef} className="teacher-dialog activity-editor-dialog" aria-labelledby="activity-dialog-title" onCancel={event=>{event.preventDefault();if(!busy)closeEditor();}} onClose={()=>setEditor(undefined)}>
      <form method="dialog" onSubmit={event=>event.preventDefault()}>
        <h2 id="activity-dialog-title">{editor?'Editar actividad':'Nueva actividad'}</h2>
        <p className="muted">Guardar deja un borrador. Publicar es una acción separada y visible para el alumno.</p>
        <label>Título<input name="title" value={form.title} maxLength={120} onChange={event=>setForm({...form,title:event.target.value})}/></label>
        <label>Proveedor<select value={form.provider} onChange={event=>setForm({...form,provider:event.target.value as ActivityProvider})}><option value="wordwall">Wordwall</option><option value="learningapps">LearningApps</option></select></label>
        <label>ID del recurso<input value={form.resourceId} maxLength={80} onChange={event=>setForm({...form,resourceId:event.target.value})}/></label>
        <label>URL de origen<input type="url" value={form.sourceUrl} maxLength={1000} onChange={event=>setForm({...form,sourceUrl:event.target.value})}/></label>
        <label>URL de embed<input type="url" value={form.embedUrl} maxLength={1000} onChange={event=>setForm({...form,embedUrl:event.target.value})}/></label>
        <label>Descripción<textarea value={form.description} maxLength={500} onChange={event=>setForm({...form,description:event.target.value})}/></label>
        <label>Instrucciones<textarea value={form.instructions} maxLength={1000} onChange={event=>setForm({...form,instructions:event.target.value})}/></label>
        <label>Gimnasio<select value={form.gymId} onChange={event=>setForm({...form,gymId:Number(event.target.value)})}>{gyms.map(gym=><option key={gym.id} value={gym.id}>{gym.id}. {gym.name}</option>)}</select></label>
        <fieldset><legend>Grupos autorizados</legend>{groupOptions.map(group=><label key={group.groupId} className="activity-group-check"><input type="checkbox" checked={form.groupIds.includes(group.groupId)} onChange={event=>setForm({...form,groupIds:event.target.checked?[...form.groupIds,group.groupId]:form.groupIds.filter(id=>id!==group.groupId)})}/>{group.title}</label>)}</fieldset>
        {editorError&&<p className="teacher-error" role="alert">{editorError}</p>}
        <div className="teacher-actions"><button type="button" className="button" onClick={()=>{const urls=checkUrls(form);if(urls)setPreview({title:form.title||'Borrador sin título',...urls,provider:form.provider});}}>Previsualizar borrador</button><button type="button" className="button primary" onClick={()=>void saveDraft()} disabled={busy}>Guardar borrador</button><button type="button" className="button" onClick={closeEditor} disabled={busy}>Cancelar</button></div>
      </form>
    </dialog>

    <dialog ref={previewRef} className="teacher-dialog activity-preview-dialog" aria-labelledby="activity-preview-title" onCancel={()=>setPreview(null)} onClose={()=>setPreview(null)}>
      <h2 id="activity-preview-title">Vista previa: {preview?.title}</h2>
      <p className="activity-preview-warning">Vista previa docente. No se publica ni se envía al alumno.</p>
      {preview&&<><div className="activity-preview-frame"><iframe title={`Vista previa de ${preview.title}`} src={preview.embedUrl} {...iframePolicy(preview.provider)}/></div><p><a href={preview.sourceUrl} target="_blank" rel="noopener noreferrer">Abrir en {providerLabel(preview.provider)}</a></p></>}
      <button className="button" onClick={()=>{setPreview(null);previewRef.current?.close();}}>Cerrar vista previa</button>
    </dialog>
  </section>;
}
