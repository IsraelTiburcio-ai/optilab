import {useState} from 'react';
import type {Member,Request,TeachingScope} from './types';
import type {PagedState} from './usePage';
import {Pagination,Person,SectionState,key,scopeInput,type Prepare} from './components';
export function Students({scope,scopes,page,prepare,busy}:{scope:TeachingScope;scopes:TeachingScope[];page:PagedState<Member>;prepare:Prepare;busy:boolean}) {
  const [filter,setFilter]=useState('all'),[destination,setDestination]=useState('');
  const destinations=scopes.filter(s=>s.courseId===scope.courseId&&s.termId===scope.termId&&s.groupId!==scope.groupId&&s.capabilities.manageMembers);
  const rows=page.data?.items.filter(r=>filter==='all'||r.status===filter)??[];
  if(!scope.capabilities.manageMembers)return <p>No tienes capacidad para consultar ni administrar integrantes de este grupo.</p>;
  return <section aria-labelledby="teacher-students"><h2 id="teacher-students">Alumnos</h2><p>Activos e inactivos del grupo seleccionado. Los filtros se aplican a la página consultada, no a un total global.</p>
    <div className="teacher-controls"><label>Estado en esta página<select aria-label="Estado en esta página" value={filter} onChange={e=>setFilter(e.target.value)} disabled={busy}><option value="all">Todos</option><option value="active">Activos</option><option value="revoked">Inactivos</option></select></label>
    <label>Destino de transferencia<select aria-label="Destino de transferencia" value={destination} onChange={e=>setDestination(e.target.value)} disabled={busy}><option value="">Selecciona otro grupo</option>{destinations.map(s=><option key={s.groupId} value={s.groupId}>{s.title} · {s.groupId}</option>)}</select></label></div>
    <p className="muted">Solo se ofrecen destinos autorizados del mismo curso y periodo entre los grupos cargados. Carga más grupos si falta un destino.</p>
    <SectionState loading={page.loading} error={page.error} empty={!rows.length}><ul className="teacher-records">{rows.map(member=><li className="teacher-record" key={member.uid}>
      <div><Person label={member.label} uid={member.uid} profile={member.academicProfile}/><span className="teacher-badge">{member.status==='active'?'Activo':'Inactivo'}</span><small>Revisión actual: {member.revision}</small></div>
      {member.status==='active'&&<div className="teacher-actions"><button className="button" disabled={busy} onClick={()=>prepare({operation:'revokeMembership',input:{...scopeInput(scope),uid:member.uid,expectedVersion:member.revision,idempotencyKey:key()},label:'Dar de baja',description:`Retirar a ${member.label} de ${scope.title}. Conserva cuenta, progreso personal e historial.`})}>Dar de baja</button>
      <button className="button" disabled={busy||!destination} onClick={()=>prepare({operation:'transferMembership',input:{...scopeInput(scope),uid:member.uid,destinationGroupId:destination,expectedVersion:member.revision,idempotencyKey:key()},label:'Transferir estudiante',description:`Transferir a ${member.label} de ${scope.title} a ${destinations.find(s=>s.groupId===destination)?.title}. Se retira el acceso al origen sin mover el historial.`})}>Transferir</button></div>}
    </li>)}</ul></SectionState>
    <Pagination {...page} nextCursor={page.data?.nextCursor} disabled={busy||page.loading}/>
  </section>;
}
export function Requests({scope,page,prepare,busy,status,setStatus}:{scope:TeachingScope;page:PagedState<Request>;prepare:Prepare;busy:boolean;status:Request['status'];setStatus:(s:Request['status'])=>void}) {
  if(!scope.capabilities.manageMembers)return <p>No tienes capacidad para consultar ni resolver solicitudes de este grupo.</p>;
  return <section aria-labelledby="teacher-requests"><h2 id="teacher-requests">Solicitudes</h2><p>Grupo: <strong>{scope.title}</strong>. Ninguna solicitud concede acceso hasta la aprobación confirmada.</p>
    <label>Estado de las solicitudes<select aria-label="Estado de las solicitudes" value={status} disabled={busy} onChange={e=>setStatus(e.target.value as Request['status'])}><option value="pending">Pendientes</option><option value="approved">Aprobadas</option><option value="rejected">Rechazadas</option></select></label>
    <SectionState loading={page.loading} error={page.error} empty={!page.data?.items.length}><ul className="teacher-records">{page.data?.items.map(r=><li className="teacher-record" key={r.requestId}><div><Person label={r.label} uid={r.uid} profile={r.academicProfile}/><span className="teacher-badge">{({pending:'Pendiente',approved:'Aprobada',rejected:'Rechazada'})[r.status]}</span></div>
      {r.status==='pending'&&<div className="teacher-actions">{(['approveMembership','rejectMembership'] as const).map(operation=><button key={operation} className={`button ${operation==='approveMembership'?'primary':''}`} disabled={busy} onClick={()=>prepare({operation,input:{...scopeInput(scope),requestId:r.requestId,expectedVersion:r.revision,idempotencyKey:key()},label:operation==='approveMembership'?'Aprobar solicitud':'Rechazar solicitud',description:`${operation==='approveMembership'?'Aprobar la incorporación':'Rechazar la solicitud'} de ${r.label} en ${scope.title}.`})}>{operation==='approveMembership'?'Aprobar':'Rechazar'}</button>)}</div>}
    </li>)}</ul></SectionState><Pagination {...page} nextCursor={page.data?.nextCursor} disabled={busy||page.loading}/>
  </section>;
}
