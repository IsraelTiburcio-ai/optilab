import {useState} from 'react';
import {Link} from 'react-router-dom';
import {useProgress} from '../store';
import {getAvatar} from '../data/avatars';
import {getCompanion} from '../data/companions';
import type {AcademicProfile} from './types';
import {key,type Prepare} from './components';
export function AcademicProfileForm({profile,revision,email,busy,prepare}:{profile:AcademicProfile|null;revision:number;email:string|null;busy:boolean;prepare:Prepare}) {
  const {state,sync}=useProgress();
  const [fullName,setName]=useState(profile?.fullName??''),[share,setShare]=useState(profile?.shareGameIdentity??false),[ack,setAck]=useState(false);
  const [game,setGame]=useState(profile?.gameIdentity??{nickname:null as string|null,avatarId:null as string|null,companionId:null as string|null});
  const snapshot=()=>({nickname:state.nickname.trim()&&state.nickname!=='Entrenador OptiLab'?state.nickname.trim():null,avatarId:state.avatarId,companionId:state.companionId});
  function save(withdraw=false){prepare({operation:'updateAcademicProfile',input:{idempotencyKey:key(),expectedVersion:revision,fullName:withdraw?profile!.fullName:fullName.trim(),shareGameIdentity:withdraw?false:share,
    ...(withdraw||!share?{nickname:null,avatarId:null,companionId:null}:game)},label:withdraw?'Retirar identidad de juego':'Guardar perfil académico',
    description:withdraw?'Eliminar la proyección de gamertag, entrenador y OptiCriatura para próximas consultas docentes. Tu aventura privada no cambia.':'Compartir tu nombre declarado y correo de Auth con docentes autorizados de tus grupos activos o solicitudes pendientes. La identidad de juego se comparte solo si la seleccionaste.'});}
  return <section className="paper teacher-section" aria-labelledby="academic-profile-title"><h2 id="academic-profile-title">Mi perfil académico</h2>
    <p>Separado de tu aventura privada. No se comparte progreso, resultados, evoluciones ni rankings. El nombre es declarado, no verificado.</p>
    <p>El perfil actual será visible a tus docentes autorizados en todos tus grupos activos y solicitudes pendientes canjeables, no solo en la invitación que abriste. Puedes modificarlo y retirar la identidad de juego desde aquí.</p>
    <form onSubmit={e=>{e.preventDefault();save();}}><fieldset disabled={busy}><legend>Identificación mínima</legend>
      <label>Nombre completo declarado<input autoComplete="name" required minLength={3} maxLength={120} value={fullName} onChange={e=>setName(e.target.value)}/></label>
      <p>Correo de la cuenta: <strong>{email??'No disponible'}</strong>. Lo obtiene el API directamente de Firebase Auth; este formulario no puede cambiarlo.</p>
      {profile&&<p>Correo del último perfil: {profile.email??'No disponible'} · {profile.emailVerified?'verificado al guardar':'sin verificar'}. Guarda de nuevo después de verificar tu correo en Cuenta.</p>}
      <label className="academic-check"><input type="checkbox" checked={share} disabled={!sync&&!share} onChange={e=>{setShare(e.target.checked);if(e.target.checked&&sync)setGame(snapshot());}}/>Quiero compartir mi gamertag, entrenador y OptiCriatura con mis docentes autorizados.</label>
      {!sync&&<p>No hay una aventura aislada por cuenta disponible aquí. Puedes guardar tu perfil sin compartir identidad de juego, o retirar un consentimiento anterior.</p>}
      {share&&<div className="academic-game-preview"><h3>Vista previa de lo que compartirás</h3><p>Gamertag: {game.nickname??'No disponible'}</p><p>Entrenador: {game.avatarId?getAvatar(game.avatarId).name:'No seleccionado'}</p><p>OptiCriatura: {game.companionId?getCompanion(game.companionId as Parameters<typeof getCompanion>[0]).name:'No seleccionada'}</p>
        <button className="button" type="button" disabled={!sync} onClick={()=>setGame(snapshot())}>Actualizar desde mi aventura</button><p>Es una copia mínima declarada, no una sincronización automática.</p></div>}
      <label className="academic-check"><input required type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/>Entiendo que mi nombre declarado y correo de Auth serán visibles únicamente a docentes autorizados de los ámbitos indicados.</label>
      <button className="button primary" type="submit" disabled={!ack||fullName.trim().length<3}>Guardar perfil académico</button>
    </fieldset></form>
    {profile?.shareGameIdentity&&<button className="button" disabled={busy} onClick={()=>save(true)}>Retirar identidad de juego</button>}
    <p><Link className="text-button" to="/aventura">Editar mi aventura</Link> · <Link className="text-button" to="/cuenta">Verificar correo o cambiar de cuenta</Link></p>
  </section>;
}
