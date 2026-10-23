import {useState, type ChangeEvent} from 'react';
import {useProgress} from '../store';
import type {Backup} from './engine';

const labels={local:'Progreso local',pending:'Sincronización pendiente',syncing:'Sincronizando',synced:'Sincronizado',
  offline:'Sin conexión',conflict:'Conflicto',error:'Error recuperable'};
function download(value:unknown,name:string) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export default function SyncPanel() {
  const {sync}=useProgress();
  const [error,setError]=useState(''),[review,setReview]=useState(false),[busy,setBusy]=useState(false);
  const [restore,setRestore]=useState<Backup|null>(null);
  if(!sync)return <p className="sync-guest-note" role="status">Modo invitado · copia local del navegador (optilab-v1). Las cuentas usan un perfil separado.</p>;
  const {engine,view}=sync;
  const run=async(action:()=>Promise<unknown>)=>{
    if(busy)return;setBusy(true);setError('');
    try {await action();}catch(e){setError(e instanceof Error?e.message:'No se pudo completar; conserva el respaldo.');}finally{setBusy(false);}
  };
  const legacy=()=>{try{return localStorage.getItem('optilab-v1')||'{}';}catch{return 'null';}};
  const file=async(event:ChangeEvent<HTMLInputElement>)=>{
    const selected=event.target.files?.[0];if(!selected)return;
    if(selected.size>2_000_000){setError('El respaldo supera el límite de 2 MB.');return;}
    try {setRestore(JSON.parse(await selected.text()));setReview(true);}catch{setError('Archivo JSON inválido.');}
  };
  return <section className="sync-panel paper" aria-label="Sincronización de progreso">
    <h2>Tu aventura en Cloud · emulador</h2>
    <p role="status"><strong>{labels[view.status]}</strong> · {view.pending} operaciones pendientes</p>
    <p>Entorno local de pruebas. No está conectado con Firestore de producción. Este perfil pertenece solo a tu cuenta.</p>
    {view.decision!=='accepted'&&<div>
      <p>El progreso anterior de este navegador no se importará al iniciar sesión. Puedes unirlo a esta cuenta, usar solo lo remoto o cancelar.</p>
      <p>Usar la cuenta activa la sincronización de sus propios cambios pendientes; no importa el invitado. Cancelar pausa el envío y conserva esos cambios locales.</p>
      <button className="button" disabled={busy||!view.ready} onClick={()=>void run(()=>engine.importRaw(legacy()))}>Importar progreso del navegador</button>{' '}
      <button className="button" disabled={busy||!view.ready} onClick={()=>void run(()=>engine.keepRemote())}>Conservar progreso remoto</button>{' '}
      <button className="text-button" onClick={()=>setReview(!review)}>Revisar posibles conflictos</button>{' '}
      <button className="text-button" disabled={busy} onClick={()=>void run(()=>engine.keepRemote(true))}>Cancelar importación</button>
    </div>}
    {review&&<details open><summary>Vista previa privada</summary><p>No compartas este respaldo públicamente.</p>
      <h3>Progreso remoto confirmado de la cuenta</h3><pre>{JSON.stringify(view.remoteProgress,null,2)}</pre>
      <h3>{restore?'Respaldo seleccionado':'Progreso del navegador (sin propietario confirmado)'}</h3><pre>{restore?.raw??legacy()}</pre></details>}
    {view.conflict&&<div role="alert"><p>{view.conflict.message}</p><p>Campos: {view.conflict.keys.join(', ')||'generación de aventura'}</p>
      {view.comparison.map(c=><details open key={c.key}><summary>{c.key}</summary><p>Remoto</p><pre>{JSON.stringify(c.remote,null,2)}</pre><p>Propuesto localmente</p><pre>{JSON.stringify(c.local,null,2)}</pre></details>)}
      <button className="button" disabled={busy} onClick={()=>void run(()=>engine.keepRemote())}>Usar remoto y guardar copia de mis cambios</button>{' '}
      {view.conflict.kind==='field'&&<button className="button" onClick={()=>engine.resolveLocal(view)}>Aplicar mis cambios revisados</button>}
      {view.conflict.kind==='history'&&<p>Un identificador histórico ya tiene otro resultado. No se sobrescribe: conserva el remoto y revisa el respaldo original.</p>}
      {view.conflict.kind==='epoch'&&<p>Para recuperar la aventura anterior, selecciona un respaldo y confirma una restauración nueva.</p>}
    </div>}
    {(error||view.error)&&<p role="alert">{error||view.error}</p>}
    {view.error&&<button className="button" disabled={busy||!view.ready} onClick={()=>void run(()=>engine.keepRemote())}>Usar remoto tras guardar copia</button>}
    <div className="sync-actions">
      <button className="text-button" disabled={busy} onClick={()=>void run(async()=>{
        let raw=legacy();try{raw=localStorage.getItem('optilab-sync:legacy-original')||raw;}catch{/* export the accessible copy */}
        const copy=await engine.exportRaw(raw,'original legado');download(copy,'optilab-legado-original.json');
      })}>Exportar original del navegador</button>{' '}
      <button className="button" disabled={busy} onClick={()=>void run(async()=>{
        const copy=await engine.exportBackup();
        try {await engine.backup(copy.raw,copy.source,copy.journal,copy.viewEpoch);}catch{setError('No se guardó otra copia en el navegador; conserva el archivo descargado.');}
        download(copy,'optilab-respaldo.json');
      })}>Crear y exportar respaldo</button>{' '}
      <button className="text-button" onClick={()=>engine.retry()}>Reintentar sincronización</button>
      <label>Revisar archivo de respaldo<input type="file" accept="application/json,.json" onChange={e=>void file(e)}/></label>
    </div>
    {view.backups.length>0&&<details><summary>Respaldos de esta cuenta ({view.backups.length})</summary>
      {view.backups.map((b,i)=><div key={`${b.createdAt}-${i}`}><span>{b.source} · {b.createdAt}</span>{' '}
        <button className="text-button" onClick={()=>download(b,'optilab-respaldo.json')}>Exportar</button>{' '}
        <button className="text-button" onClick={()=>{setRestore(b);setReview(true);}}>Revisar restauración</button></div>)}
    </details>}
    {restore&&<div><p>Restaurar crea una nueva generación. La historia Cloud anterior se conserva; los cambios offline antiguos no se aplicarán automáticamente.</p>
      <button className="button" disabled={busy||!view.ready} onClick={()=>void run(async()=>{await engine.restore(restore,view.reviewEpoch);setRestore(null);})}>Confirmar restauración en mi cuenta</button>{' '}
      <button className="text-button" onClick={()=>setRestore(null)}>Cancelar restauración</button></div>}
    <p>Reiniciar aventura conserva las generaciones históricas en Cloud. No elimina tu cuenta ni equivale a borrar datos definitivamente.</p>
  </section>;
}
