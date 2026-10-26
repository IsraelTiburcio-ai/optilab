import {useState} from 'react';
import type {Member,Request,TeachingScope} from './types';
import type {PagedState} from './usePage';
import {Pagination,Person,SectionState,key,scopeInput,type Prepare} from './components';
import {getAvatar} from '../data/avatars';
import {getCompanion,type CompanionId} from '../data/companions';
function StudentIdentity({member}:{member:Member}){
  const p=member.academicProfile,game=p?.shareGameIdentity?p.gameIdentity:null;
  return <div className="teacher-student-main"><div className="teacher-row-heading"><strong>{p?.fullName||member.label||'Nombre no disponible'}</strong><span className="teacher-badge">{member.status==='active'?'Activo':'Inactivo'}</span></div>
    <div className="teacher-row-team"><span>Gamertag: <b>{game?.nickname??'—'}</b></span><span>Entrenador: {game?.avatarId?getAvatar(game.avatarId).name:'—'}</span><span>OptiCriatura: {game?.companionId?getCompanion(game.companionId as CompanionId).name:'—'}</span></div>
    {p?.email&&<span className="teacher-row-email">{p.email}</span>}
    <details className="teacher-row-details"><summary>Ver más</summary><div>
      <small>{p?'Nombre completo declarado · no verificado':'Nombre elegido · identidad académica no verificada'}</small>
      {p?<><small>Correo de Auth: {p.email??'No disponible'} · {p.emailVerified?'verificado al actualizar':'sin verificar'}</small><small>Identidad actualizada: {new Date(p.updatedAt).toLocaleString('es')}</small><small>{p.shareGameIdentity?'Comparte los datos de juego disponibles.':'El alumno no comparte su identidad de juego.'}</small></>:<small>Perfil académico no disponible en este ámbito. No se consulta el progreso privado.</small>}
      <small>Revisión actual: {member.revision}</small><span className="teacher-identifier">ID: {member.uid}</span>
    </div></details>
  </div>;
}
export function Students({scope,page,prepare,busy,move}:{scope:TeachingScope;page:PagedState<Member>;prepare:Prepare;busy:boolean;move:(member:Member)=>void}) {
  const [filter,setFilter]=useState('all');
  const rows=page.data?.items.filter(r=>filter==='all'||r.status===filter)??[];
  if(!scope.capabilities.manageMembers)return <p>No tienes capacidad para consultar ni administrar integrantes de este grupo.</p>;
  return <section aria-labelledby="teacher-students"><h2 id="teacher-students">Alumnos</h2><p>Activos e inactivos del grupo seleccionado. Los filtros se aplican a la página consultada, no a un total global.</p>
    <div className="teacher-controls"><label>Estado en esta página<select aria-label="Estado en esta página" value={filter} onChange={e=>setFilter(e.target.value)} disabled={busy}><option value="all">Todos</option><option value="active">Activos</option><option value="revoked">Inactivos</option></select></label></div>
    <SectionState loading={page.loading} error={page.error} empty={!rows.length}><ul className="teacher-records teacher-student-list">{rows.map(member=><li className="teacher-record teacher-student-row" key={member.uid}>
      <StudentIdentity member={member}/>
      {member.status==='active'&&<div className="teacher-actions teacher-row-actions"><button className="button" disabled={busy} onClick={()=>prepare({operation:'revokeMembership',input:{...scopeInput(scope),uid:member.uid,expectedVersion:member.revision,idempotencyKey:key()},label:'Dar de baja',description:`Retirar a ${member.academicProfile?.fullName||member.label} de ${scope.title}. Conserva cuenta, progreso personal e historial.`})}>Dar de baja</button>
      <button className="button" disabled={busy} onClick={e=>{e.currentTarget.focus();move(member);}}>Mover de grupo</button></div>}
    </li>)}</ul></SectionState>
    <Pagination {...page} nextCursor={page.data?.nextCursor} disabled={busy||page.loading}/>
  </section>;
}
export function Requests({scope,page,prepare,busy,status,setStatus}:{scope:TeachingScope;page:PagedState<Request>;prepare:Prepare;busy:boolean;status:Request['status'];setStatus:(s:Request['status'])=>void}) {
  if(!scope.capabilities.manageMembers)return <p>No tienes capacidad para consultar ni resolver solicitudes de este grupo.</p>;
  return <section aria-labelledby="teacher-requests"><h3 id="teacher-requests">Solicitudes del mecanismo anterior</h3><p>Las nuevas matrículas son automáticas. No tienes que aprobar a los nuevos alumnos. Estos registros históricos se conservan sin borrarlos ni cambiar su estado automáticamente.</p>
    <label>Estado de las solicitudes<select aria-label="Estado de las solicitudes" value={status} disabled={busy} onChange={e=>setStatus(e.target.value as Request['status'])}><option value="pending">Pendientes</option><option value="approved">Aprobadas</option><option value="rejected">Rechazadas</option></select></label>
    <SectionState loading={page.loading} error={page.error} empty={!page.data?.items.length}><ul className="teacher-records">{page.data?.items.map(r=><li className="teacher-record" key={r.requestId}><div><Person label={r.label} uid={r.uid} profile={r.academicProfile}/><span className="teacher-badge">{r.status==='pending'&&r.membershipStatus==='active'?'Ya inscrito':({pending:'Registro histórico pendiente',approved:'Aprobada',rejected:'Rechazada'})[r.status]}</span>{r.status==='pending'&&r.membershipStatus==='active'&&<small>Su matrícula ya está activa; este registro anterior no necesita aprobación.</small>}</div>
      {r.status==='pending'&&r.membershipStatus!=='active'&&<div className="teacher-actions">{(['approveMembership','rejectMembership'] as const).map(operation=><button key={operation} className={`button ${operation==='approveMembership'?'primary':''}`} disabled={busy} onClick={()=>prepare({operation,input:{...scopeInput(scope),requestId:r.requestId,expectedVersion:r.revision,idempotencyKey:key()},label:operation==='approveMembership'?'Aprobar solicitud':'Rechazar solicitud',description:`${operation==='approveMembership'?'Resolver aprobando el registro histórico':'Rechazar el registro histórico'} de ${r.label} en ${scope.title}.`})}>{operation==='approveMembership'?'Aprobar':'Rechazar'}</button>)}</div>}
    </li>)}</ul></SectionState><Pagination {...page} nextCursor={page.data?.nextCursor} disabled={busy||page.loading}/>
  </section>;
}
