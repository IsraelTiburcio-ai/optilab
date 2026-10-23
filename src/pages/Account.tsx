import {useEffect, useRef, useState, type FormEvent} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRight, Check, KeyRound, LogOut, Mail, Shield} from 'lucide-react';
import {useAuth} from '../auth/AuthProvider';
import {authErrorMessage} from '../auth/messages';
import {useProgress} from '../store';
import {AvatarPortrait} from '../components/AvatarPortrait';
import {CompanionPortrait} from '../components/CompanionPortrait';

type Mode = 'login' | 'register' | 'reset';
export default function Account() {
  const auth = useAuth();
  const {state, evolution} = useProgress();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const errorRef = useRef<HTMLDivElement>(null);
  const enabled = auth.status === 'guest' || auth.status === 'authenticated';
  useEffect(() => {if (auth.user) {setPassword(''); setConfirmation('');}}, [auth.user?.uid]);
  useEffect(() => {if (error) errorRef.current?.focus({preventScroll: true});}, [error]);

  async function run(action: () => Promise<void>, success: string) {
    if (busy || !enabled) return;
    setBusy(true); setError(''); setNotice('');
    try {await action(); setNotice(success);}
    catch (reason) {setError(authErrorMessage(reason));}
    finally {setBusy(false); setPassword(''); setConfirmation('');}
  }
  function changeMode(next: Mode) {
    setMode(next); setPassword(''); setConfirmation(''); setError(''); setNotice('');
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === 'register' && password !== confirmation) {setError('Las contraseñas no coinciden. Revisa ambos campos.'); return;}
    if (mode === 'reset') void run(() => auth.resetPassword(email.trim()), 'Si este correo tiene una cuenta, recibirás un enlace para restablecer la contraseña. Revisa también la carpeta de correo no deseado.');
    else if (mode === 'register') void run(() => auth.register(email.trim(), password), 'Cuenta creada. Te enviamos un correo de verificación; tu aventura local permanece intacta.');
    else void run(() => auth.login(email.trim(), password), 'Sesión iniciada. Tu progreso sigue siendo local en esta fase.');
  }

  return <section className="account-page">
    <header className="page-title"><span className="eyebrow">TU PASE A LA AVENTURA</span><h1>Tu cuenta OptiLab</h1>
      <p>Una identidad para tu aventura. Elige cómo entrar o sigue explorando como invitado.</p></header>
    <div className="account-layout"><aside className="account-story">
      <span className="eyebrow">EL EQUIPO SIGUE SIENDO TUYO</span><h2>Una cuenta.<br/>{' '}Tu mismo camino.</h2>
      <div className="account-team" aria-hidden="true"><AvatarPortrait id={state.avatarId} decorative eager/><CompanionPortrait id={state.companionId} stage={state.companionId ? evolution.stage : 1} decorative eager/></div>
      <div className="account-local-info"><Shield size={20}/><div><strong>Tu progreso todavía es local</strong><p>Al entrar o salir no se importa, borra ni sincroniza tu aventura. Las prácticas, personajes e insignias siguen en este navegador, también al cambiar de cuenta.</p></div></div>
      <p className="account-future-note">La sincronización entre dispositivos y los grupos llegarán en una fase posterior. Esta cuenta todavía no los activa.</p>
    </aside>
    <section className="account-panel paper" aria-label="Acceso a la cuenta" aria-busy={busy || auth.status === 'loading'}>
      {auth.settings.status === 'ready' && auth.settings.emulatorUrl && <p className="auth-temporary" role="status">Entorno de pruebas local · Firebase Auth Emulator. No son cuentas reales.</p>}
      {auth.status === 'loading' && <p className="auth-status" role="status">Preparando tu sesión… Puedes seguir explorando mientras tanto.</p>}
      {auth.status === 'unavailable' && <div className="auth-config-note" role="status"><KeyRound size={24}/><h2>El acceso con cuenta necesita configuración</h2>
        <p>El modo invitado está disponible. El propietario debe completar la configuración pública de Firebase antes de habilitar estas acciones.</p>
        {auth.settings.status === 'missing' && <p className="auth-config-keys">Falta: {auth.settings.missing.join(', ')}.</p>}
        {auth.settings.status === 'invalid' && <p>La configuración contiene valores no válidos. No se inició una conexión de autenticación.</p>}
      </div>}
      {auth.status === 'error' && <div className="auth-config-note" role="alert"><h2>No pudimos preparar tu sesión</h2><p>Revisa tu conexión o la configuración de Firebase. La aventura local sigue disponible.</p><button className="button" onClick={() => location.reload()}>Reintentar inicio</button></div>}
      {error && <div ref={errorRef} className="auth-error" role="alert" tabIndex={-1}>{error}</div>}
      {notice && <p className="auth-success" role="status">{notice}</p>}
      {auth.temporary && <p className="auth-temporary" role="status">El navegador no permite guardar la sesión. Este acceso es temporal y podría perderse al recargar.</p>}
      {auth.user ? <div className="account-signed-in">
        <span className="account-check"><Check size={26}/></span><span className="eyebrow">SESIÓN INICIADA</span>
        <h2>{auth.user.displayName || 'Tu cuenta está lista'}</h2><p className="account-email">{auth.user.email || 'Cuenta sin correo visible'}</p>
        <p className="account-verification">{auth.user.emailVerified ? <><Check size={16}/> Correo verificado</> : <><Mail size={16}/> Verificación pendiente</>}</p>
        {!auth.user.emailVerified && <div className="verification-actions">
          <button className="button" disabled={busy} onClick={() => void run(auth.sendVerification, 'Enviamos un correo de verificación. Revisa tu bandeja de entrada y correo no deseado.')}>Reenviar verificación</button>
          <button className="text-button" disabled={busy} onClick={() => void run(auth.refreshUser, 'Estado de la cuenta actualizado.')}>Ya verifiqué mi correo</button>
        </div>}
        <p className="account-session-note">Firebase mantiene tu sesión. No se ha creado un perfil ni se ha guardado progreso en Firestore.</p>
        <Link className="button primary" to="/aventura">Volver a mi aventura <ArrowRight size={17}/></Link>
        <button className="button account-logout" disabled={busy} onClick={() => void run(auth.logout, 'Sesión cerrada. Puedes continuar como invitado; tu progreso local sigue aquí.')}><LogOut size={16}/> Cerrar sesión</button>
      </div> : <>
        <button className="button google-sign-in" disabled={busy || !enabled} onClick={() => void run(auth.google, 'Acceso con Google completado. Tu progreso sigue en este navegador.')}><span aria-hidden="true">G</span> Continuar con Google <ArrowRight size={17}/></button>
        <p className="auth-divider">o usa tu correo</p>
        <div className="auth-modes" aria-label="Elegir acción de cuenta">{([['login','Entrar'],['register','Crear cuenta'],['reset','Recuperar']] as const).map(([value,label]) => <button key={value} type="button" disabled={busy} aria-pressed={mode === value} onClick={() => changeMode(value)}>{label}</button>)}</div>
        <form onSubmit={submit} className="auth-form">
          <h2>{mode === 'login' ? 'Retoma tu expedición' : mode === 'register' ? 'Prepara tu pase de aventura' : 'Recupera tu acceso'}</h2>
          <label htmlFor="account-email">Correo electrónico</label>
          <input id="account-email" type="email" inputMode="email" autoComplete="email" required maxLength={254} value={email} disabled={busy || !enabled} onChange={event => setEmail(event.target.value)}/>
          {mode !== 'reset' && <>
            <label htmlFor="account-password">Contraseña{mode === 'register' && <small>Al menos 6 caracteres; sujeta a la política del proyecto.</small>}</label>
            <input id="account-password" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} minLength={mode === 'register' ? 6 : undefined} required value={password} disabled={busy || !enabled} onChange={event => setPassword(event.target.value)}/>
          </>}
          {mode === 'register' && <><label htmlFor="account-password-confirm">Repite tu contraseña</label><input id="account-password-confirm" type="password" autoComplete="new-password" required value={confirmation} disabled={busy || !enabled} onChange={event => setConfirmation(event.target.value)}/></>}
          <button className="button primary" type="submit" disabled={busy || !enabled}>{busy ? 'Un momento…' : mode === 'login' ? 'Entrar a mi cuenta' : mode === 'register' ? 'Crear mi cuenta' : 'Enviar enlace de recuperación'} <ArrowRight size={17}/></button>
        </form>
        <p className="auth-popup-help">Google se abre en una ventana al pulsar el botón. Si tu navegador la bloquea, permite ventanas emergentes para este sitio y vuelve a intentarlo.</p>
      </>}
      <Link className="account-guest-link" to="/mapa">{auth.user ? 'Explorar el mapa' : 'Continuar como invitado'} <ArrowRight size={16}/></Link>
    </section></div>
  </section>;
}
