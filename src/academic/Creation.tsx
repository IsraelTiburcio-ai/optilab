import {useState} from 'react';
import type {AcademicCall} from './client';
import type {TeachingScope} from './types';
import {useAcademicPage} from './usePage';
import {Pagination,SectionState,key,type Prepare} from './components';
export function Creation({scope,call,refresh,prepare,busy}:{scope:TeachingScope;call:AcademicCall;refresh:number;prepare:Prepare;busy:boolean}) {
  const [termTitle,setTermTitle]=useState(''),[groupTitle,setGroupTitle]=useState(''),[term,setTerm]=useState(scope.termId);
  const caps=scope.capabilities;
  const periods=useAcademicPage(call,'myScopes',{kind:'teacher',courseId:scope.courseId},refresh,caps.createTerms||caps.createGroups);
  const options=periods.data?.periods??[];
  return <section aria-labelledby="teacher-creation"><h2 id="teacher-creation">Periodos y grupos</h2><p>Solo dentro de <strong>{scope.courseTitle}</strong>. No se crean cursos ni se asignan otros profesores desde el navegador.</p>
    {!caps.createTerms&&<p>No tienes capacidad para crear periodos en este curso.</p>}
    {caps.createTerms&&<form onSubmit={e=>{e.preventDefault();prepare({operation:'createTerm',input:{courseId:scope.courseId,title:termTitle.trim(),idempotencyKey:key()},label:'Crear periodo',description:`Crear el periodo «${termTitle.trim()}» en ${scope.courseTitle}.`,done:r=>{setTermTitle('');if(r.termId)setTerm(r.termId);}});}}><fieldset disabled={busy}><legend>Nuevo periodo académico</legend><label>Nombre del periodo<input required maxLength={120} value={termTitle} onChange={e=>setTermTitle(e.target.value)}/></label><button className="button primary" disabled={!termTitle.trim()}>Crear periodo</button></fieldset></form>}
    {!caps.createGroups&&<p>No tienes capacidad para crear grupos en este curso.</p>}
    {caps.createGroups&&<form onSubmit={e=>{e.preventDefault();prepare({operation:'createGroup',input:{courseId:scope.courseId,termId:term,title:groupTitle.trim(),idempotencyKey:key()},label:'Crear grupo',description:`Crear «${groupTitle.trim()}» en el periodo seleccionado. Solo se asignará a tu cuenta como docente del nuevo grupo.`,done:()=>setGroupTitle('')});}}><fieldset disabled={busy||periods.loading||!!periods.error}><legend>Nuevo grupo</legend>
      <label>Periodo del nuevo grupo<select aria-label="Periodo del nuevo grupo" value={term} onChange={e=>setTerm(e.target.value)}>{!options.some(p=>p.termId===term)&&<option value={term}>{term===scope.termId?scope.termTitle:'Periodo recién creado / seleccionado'} · {term}</option>}{options.map(p=><option key={p.termId} value={p.termId}>{p.title} · {p.termId}</option>)}</select></label>
      <label>Nombre del grupo<input required maxLength={120} value={groupTitle} onChange={e=>setGroupTitle(e.target.value)}/></label><button className="button primary" disabled={!groupTitle.trim()||!term}>Crear grupo</button></fieldset></form>}
    {(caps.createTerms||caps.createGroups)&&<><h3>Periodos disponibles para creación</h3><SectionState loading={periods.loading} error={periods.error} empty={!options.length}><ul>{options.map(p=><li key={p.termId}>{p.title} · <span className="teacher-identifier">{p.termId}</span></li>)}</ul></SectionState><Pagination {...periods} nextCursor={periods.data?.nextCursor} disabled={busy||periods.loading}/></>}
  </section>;
}
