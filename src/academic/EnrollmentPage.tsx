import {useCallback,useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {Link,useLocation,useNavigate,useSearchParams} from 'react-router-dom';
import {useAuth} from '../auth/AuthProvider';
import {useProgress} from '../store';
import {avatars} from '../data/avatars';
import {companions,type CompanionId} from '../data/companions';
import {AvatarPortrait} from '../components/AvatarPortrait';
import {CompanionPortrait} from '../components/CompanionPortrait';
import {academicClient,AcademicError,type AcademicCall} from './client';
import {invitationSnapshot,subscribeInvitation,discardInvitationSecret} from './invitationMemory';
import {key,scopeInput} from './components';
import type {AcademicProfile,PlayerIdentity,Api} from './types';
import './teacher.css';
export default function EnrollmentPage(){
  const auth=useAuth(),memory=useSyncExternalStore(subscribeInvitation,invitationSnapshot);
  if(auth.status==='loading')return <p role="status">Preparando tu bienvenida…</p>;
  if(!auth.user)return <section className="teacher-panel paper academic-enrollment"><span className="eyebrow">TU AVENTURA COMIENZA AQUÍ</span><h1>Bienvenido a OptiLab</h1><p>{memory.context?'Tu grupo te espera. Entra o crea tu cuenta para personalizar tu aventura e inscribirte.':'Crea tu cuenta para elegir tu identidad de jugador.'}</p><Link className="button primary" to="/cuenta">Entrar o crear mi cuenta</Link></section>;
  return <Onboarding key={`${auth.user.uid}/${memory.generation}`} uid={auth.user.uid}/>;
}
function Onboarding({uid}:{uid:string}){
  const auth=useAuth(),authRef=useRef(auth);authRef.current=auth;
  const progress=useProgress(),progressRef=useRef(progress);progressRef.current=progress;
  const memory=useSyncExternalStore(subscribeInvitation,invitationSnapshot),invitation=memory.context;
  const [search]=useSearchParams(),navigate=useNavigate(),location=useLocation();const editing=search.get('editar')==='1';
  const api=useRef<AcademicCall|null>(null),generation=useRef(0),lock=useRef(false);
  const [identity,setIdentity]=useState<PlayerIdentity|null>(null),[profile,setProfile]=useState<AcademicProfile|null>(null),[loaded,setLoaded]=useState(false);
  const [step,setStep]=useState(0),[name,setName]=useState(''),[tag,setTag]=useState(''),[avatar,setAvatar]=useState(''),[companion,setCompanion]=useState(''),[share,setShare]=useState(false);
  const [available,setAvailable]=useState<boolean|null>(null),[checking,setChecking]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false),[enrolled,setEnrolled]=useState(false);
  const [saveIntent,setSaveIntent]=useState<Api['savePlayerIdentity']['input']|null>(null),[redeemIntent,setRedeemIntent]=useState<Api['redeemInvitation']['input']|null>(null),[retrySave,setRetrySave]=useState(false);
  const [loadRevision,setLoadRevision]=useState(0);
  const current=()=>authRef.current.isCurrentSession(uid);
  const call=useCallback<AcademicCall>((op,input,cancel)=>api.current?api.current(op,input,cancel):Promise.reject(new DOMException('Sesión cambiada','AbortError')),[]);
  useEffect(()=>{
    const controller=new AbortController(),epoch=++generation.current;
    setLoaded(false);setSaved(false);setError('');setSaveIntent(null);setRetrySave(false);
    api.current=academicClient({uid,getIdToken:id=>authRef.current.getIdToken(id),current:()=>generation.current===epoch&&current()},controller.signal);
    void Promise.all([call('getPlayerIdentity',{}),call('getAcademicProfile',{})]).then(([player,academic])=>{
      if(!current()||controller.signal.aborted)return;
      const old=player.identity,p=progressRef.current.state;
      setIdentity(old);setProfile(academic.profile);setName(academic.profile?.fullName??authRef.current.user?.displayName??'');
      setTag(old?.gamertag??(p.nickname==='Entrenador OptiLab'?'':p.nickname.normalize('NFKC').replace(/\s+/g,'_').slice(0,20)));
      setAvatar(p.avatarId??old?.avatarId??academic.profile?.gameIdentity?.avatarId??'');setCompanion(p.companionId??old?.companionId??academic.profile?.gameIdentity?.companionId??'');
      setShare(academic.profile?.shareGameIdentity??false);setStep(old&&!editing?4:0);setLoaded(true);
    }).catch(e=>{if(current()&&e.name!=='AbortError')setError(e.message);});
    return ()=>{generation.current++;controller.abort();api.current=null;};
  },[uid,editing,loadRevision]);
  const validTag=/^[A-Za-z0-9_]{3,20}$/.test(tag.normalize('NFKC').trim());
  useEffect(()=>{if(!loaded)return;if(!avatar&&progress.state.avatarId)setAvatar(progress.state.avatarId);if(!companion&&progress.state.companionId)setCompanion(progress.state.companionId);},[loaded,progress.state.avatarId,progress.state.companionId]);
  useEffect(()=>{setAvailable(null);if(!loaded||step!==1||!validTag)return;
    const controller=new AbortController(),timer=setTimeout(()=>{setChecking(true);void call('gamertagAvailability',{gamertag:tag},controller.signal).then(r=>{if(!controller.signal.aborted)setAvailable(r.available);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setChecking(false);});},350);
    return ()=>{clearTimeout(timer);controller.abort();setChecking(false);};
  },[tag,step,loaded,call]);
  function applyChoices(player:PlayerIdentity){
    const value=progressRef.current;
    if(value.sync?.engine.uid===uid){const old=value.sync.engine.getSnapshot().progress;
      value.sync.engine.change({...old,nickname:player.gamertag,avatarId:player.avatarId,companionId:player.companionId as CompanionId});}
  }
  async function finish(retry=false){
    if(lock.current)return;lock.current=true;setBusy(true);setError('');
    const input=retry&&saveIntent?saveIntent:{idempotencyKey:key(),expectedVersion:identity?.revision??0,expectedProfileVersion:profile?.revision??0,
      fullName:name.trim(),gamertag:tag.normalize('NFKC').trim(),avatarId:avatar,companionId:companion,shareGameIdentity:share};
    setSaveIntent(input);
    try{await call('savePlayerIdentity',input);const [player,academic]=await Promise.all([call('getPlayerIdentity',{}),call('getAcademicProfile',{})]);
      if(!current()||!player.identity)return;setIdentity(player.identity);setProfile(academic.profile);setSaved(true);setRetrySave(false);setSaveIntent(null);setStep(4);
      applyChoices(player.identity);window.dispatchEvent(new Event('academic-identity-updated'));
    }catch(e){if(current()&&(e as Error).name!=='AbortError'){setError((e as Error).message);setRetrySave(e instanceof AcademicError&&(e.uncertain||e.status===429||e.status>=500));
      if(e instanceof AcademicError&&e.code==='GAMERTAG_TAKEN'){setStep(1);setAvailable(false);}}}
    finally{lock.current=false;if(current())setBusy(false);}
  }
  const redeemRunning=useRef(false);
  async function activeMembership(target:{courseId:string;termId:string;groupId:string}){
    let cursor:string|undefined;
    do{const page=await call('myScopes',{kind:'student',...cursor?{cursor}:{}});
      if(page.items.some(s=>s.courseId===target.courseId&&s.termId===target.termId&&s.groupId===target.groupId&&s.status==='active'))return true;
      cursor=page.nextCursor??undefined;
    }while(cursor&&current());return false;
  }
  async function redeem(){
    if(!identity||!invitation||memory.uid!==uid||redeemRunning.current)return;
    redeemRunning.current=true;setBusy(true);setError('');
    const input=redeemIntent??{...scopeInput(invitation),inviteId:invitation.inviteId,token:invitation.token??'',idempotencyKey:key()};
    setRedeemIntent(input);
    try{if(await activeMembership(input)){if(current()){setEnrolled(true);discardInvitationSecret();setRedeemIntent(null);}return;}
      if(!input.token){setError('Vuelve a abrir el enlace original para comprobar tu matrícula.');return;}
      await call('redeemInvitation',input);
      const active=await activeMembership(input);
      if(!current())return;
      if(!active)throw new AcademicError(409);
      setEnrolled(true);discardInvitationSecret();setRedeemIntent(null);
    }catch(e){if(current()&&(e as Error).name!=='AbortError')setError((e as AcademicError).status===404?'Este enlace de invitación ya no está disponible. Pide uno nuevo a tu profesora':(e as AcademicError).status===403&&(e as AcademicError).code!=='VERIFIED_EMAIL_REQUIRED'?'No podemos inscribirte en este grupo. Consulta a tu profesora para revisar tu situación.':(e as Error).message);}
    finally{redeemRunning.current=false;if(current())setBusy(false);}
  }
  useEffect(()=>{if(loaded&&identity&&invitation&&memory.uid===uid&&(!editing||saved))void redeem();},[loaded,identity?.revision,invitation?.inviteId,memory.uid,saved]);
  useEffect(()=>{if(location.pathname==='/bienvenida'&&loaded&&identity&&!invitation&&!editing&&!saved&&current()&&!invitationSnapshot().context)navigate('/aventura',{replace:true});},[loaded,identity,invitation,editing,saved,navigate,location.pathname]);
  async function refreshVerified(){setError('');try{await auth.refreshUser();await redeem();}catch{if(current())setError('No se pudo actualizar tu sesión. Reintenta desde Cuenta.');}}
  async function withdraw(){if(lock.current)return;lock.current=true;setBusy(true);setError('');
    try{const own=await call('getAcademicProfile',{});if(!own.profile)return;
      await call('updateAcademicProfile',{idempotencyKey:key(),expectedVersion:own.revision,fullName:own.profile.fullName,shareGameIdentity:false,nickname:null,avatarId:null,companionId:null});
      const updated=await call('getAcademicProfile',{});if(current())setProfile(updated.profile);
    }catch(e){if(current()&&(e as Error).name!=='AbortError')setError((e as Error).message);}finally{lock.current=false;if(current())setBusy(false);}
  }
  if(!loaded)return <section className="teacher-panel paper"><h1>Bienvenido a OptiLab</h1>{error?<p role="alert">{error}</p>:<p role="status">Preparando tu aventura…</p>}<Link className="button" to="/cuenta">Volver a Cuenta</Link></section>;
  return <section className="teacher-panel academic-enrollment onboarding" aria-label="Bienvenida de jugadores">
    <header className="paper teacher-hero"><div><span className="eyebrow">OPTILAB · TU HISTORIA EMPIEZA CONTIGO</span><h1>{['¿Cómo te llamas?','Elige tu gamertag','Elige tu entrenador','Elige tu OptiCriatura','¡Bienvenido a OptiLab!'][step]}</h1><p>{step<4?`Paso ${step+1} de 5 · Tus elecciones no borran tu progreso.`:'Tu cuenta y tu aventura están listas.'}</p></div></header>
    {error&&<p role="alert" className="teacher-error">{error}</p>}
    {error&&!busy&&!retrySave&&<button className="button" onClick={()=>setLoadRevision(n=>n+1)}>Actualizar datos guardados</button>}
    {step<4?<div className="paper teacher-section" aria-busy={busy}>
      {step===0&&<><label>Nombre completo académico<input autoComplete="name" required minLength={3} maxLength={120} value={name} disabled={busy} onChange={e=>setName(e.target.value)}/></label><p>Tu nombre es declarado, no verificado. El correo de tu cuenta lo obtiene el servidor de Auth, no de un campo libre.</p></>}
      {step===1&&<><label>Gamertag<input autoComplete="off" required minLength={3} maxLength={40} value={tag} disabled={busy} onChange={e=>setTag(e.target.value)}/></label><p>De 3 a20 letras A–Z, números o guion bajo. No distingue mayúsculas; normalizamos Unicode NFKC. Es único para tu cuenta.</p><p role="status">{!validTag?'Usa los caracteres y longitud indicados.':checking?'Comprobando disponibilidad…':available===true?'Disponible. Se reservará al confirmar.':available===false?'Ese gamertag ya está ocupado. Elige otro.':'Comprobando disponibilidad…'}</p></>}
      {step===2&&<fieldset disabled={busy||retrySave} className="trainer-roster onboarding-roster"><legend className="sr-only">Seis entrenadores</legend>{avatars.map(a=><label className={`trainer-slot ${avatar===a.id?'is-selected':''}`} key={a.id}><input type="radio" name="onboarding-avatar" aria-label={a.name} checked={avatar===a.id} onChange={()=>setAvatar(a.id)}/><AvatarPortrait id={a.id} decorative eager/><span>{a.name}</span></label>)}</fieldset>}
      {step===3&&<><fieldset disabled={busy||retrySave} className="trainer-roster onboarding-roster"><legend className="sr-only">Cinco familias de OptiCriaturas</legend>{companions.map(c=><label className={`trainer-slot ${companion===c.id?'is-selected':''}`} key={c.id}><input type="radio" name="onboarding-companion" aria-label={c.name} checked={companion===c.id} onChange={()=>setCompanion(c.id)}/><CompanionPortrait id={c.id} stage={progress.evolution.stage} decorative eager/><span>{c.name}</span></label>)}</fieldset>
        <label className="academic-check"><input type="checkbox" checked={share} onChange={e=>setShare(e.target.checked)} disabled={busy||retrySave}/>Compartir mi gamertag y mi equipo con mis docentes autorizados.</label><p>Tu nombre y correo identifican tu matrícula. Compartir la identidad de juego es opcional; nunca abre tu progreso privado ni tus resultados.</p></>}
      <div className="teacher-actions">{step>0&&<button className="button" disabled={busy||retrySave} onClick={()=>{setError('');setStep(n=>n-1);}}>Anterior</button>}
        {step<3?<button className="button primary" disabled={busy||(step===0&&name.trim().length<3)||(step===1&&(!validTag||available!==true))||(step===2&&!avatar)} onClick={()=>setStep(n=>n+1)}>Continuar</button>:
          <button className="button primary" disabled={busy||!companion} onClick={()=>void finish(retrySave)}>{busy?'Guardando tu identidad…':retrySave?'Reintentar sin duplicar':'Confirmar mi aventura'}</button>}
      </div>
    </div>:<div className="paper teacher-section">
      <h2>{identity?.gamertag}</h2><p>Tu nombre académico y tu gamertag son identidades distintas. Puedes repetir un nombre completo; tu gamertag tiene una reserva única.</p>
      {invitation?<>{busy&&<p role="status">Comprobando tu enlace e inscribiéndote…</p>}{enrolled?<p role="status" className="teacher-success">¡Ya estás dentro de tu grupo! Matrícula activa confirmada.</p>:<><p>La inscripción es automática: no necesitas esperar una aprobación individual.</p>
        {!auth.user?.emailVerified&&<p>Ya puedes personalizar tu aventura. Para entrar al grupo, verifica el correo con el mensaje enviado a tu cuenta.</p>}
        <Link className="button" to="/cuenta?verificar=1">Verificar mi correo en Cuenta</Link><button className="button" disabled={busy} onClick={()=>void refreshVerified()}>Ya verifiqué mi correo · reintentar inscripción</button></>}</>:<p>{location.pathname==='/unirse'?'No hay una invitación en memoria. Vuelve a abrir el enlace original.':'Tu aventura puede comenzar, aunque no tengas un enlace de grupo.'}</p>}
      <Link className="button primary" to="/aventura">Comenzar aventura</Link><Link className="button" to="/bienvenida?editar=1">Cambiar gamertag o equipo</Link>
      {profile&&<p>Nombre declarado: {profile.fullName}. Identidad de juego: {profile.shareGameIdentity?'compartida con docentes autorizados':'privada'}.</p>}
      {profile?.shareGameIdentity&&<button className="button" disabled={busy} onClick={()=>void withdraw()}>Ocultar mi identidad de juego a la profesora</button>}
    </div>}
    <div className="teacher-toolbar"><Link className="button" to="/cuenta">Mi cuenta</Link><button className="button" onClick={()=>void auth.logout().catch(()=>{})}>Cerrar sesión de jugador</button></div>
  </section>;
}
