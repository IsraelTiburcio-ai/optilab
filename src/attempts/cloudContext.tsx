import {createContext,useContext} from 'react';
import type {AttemptCloudView} from './cloudEngine';
import {productionSessionKind} from '../progress/productionConfig';
export const AttemptCloudContext=createContext<null|{view:AttemptCloudView;verified:boolean;activate:(guest:boolean)=>Promise<void>;pause:()=>void;retry:()=>void;keepRemote:()=>Promise<void>;restore:(file:File)=>Promise<void>;exportAll:()=>Promise<void>}>(null);
export function AttemptCloudControls(){
 const cloud=useContext(AttemptCloudContext);if(!cloud)return null;
 const run=(action:()=>Promise<void>)=>{void action();};
 return <section aria-label="Sincronización de intentos"><h3>Historial privado entre dispositivos</h3>
 <p role="status">Intentos: {cloud.view.status} · {cloud.view.pending} pendientes</p>
 <p>Consentimiento independiente del progreso de aventura. Solo declaraciones e informes del cliente; ningún resultado académico validado. El ranking incluye automáticamente a integrantes activos y muestra su nombre académico y gamertag solo dentro del grupo; no usa correo, UID ni puntuaciones. Las preferencias anteriores ya no controlan la inclusión. No usa puntuaciones de juegos.</p>
 {!cloud.verified?<p>Verifica tu correo y actualiza la sesión para habilitar este canal.</p>:<>
 <button onClick={()=>run(()=>cloud.activate(false))}>Sincronizar historial de esta cuenta</button>{' '}
 {productionSessionKind(import.meta.env??{})!=='single-operator-test'&&<button onClick={()=>run(()=>cloud.activate(true))}>Importar historial invitado y sincronizar</button>}{' '}
 <button onClick={cloud.pause}>Pausar envío de intentos</button>{' '}
 <button onClick={cloud.retry}>Reintentar intentos</button>
 </>}
 {cloud.view.error&&<p role="alert">{cloud.view.error}</p>}
 {cloud.view.status==='conflict'&&<button onClick={()=>run(cloud.keepRemote)}>Conservar remoto tras respaldar local</button>}
 <button onClick={()=>run(cloud.exportAll)}>Exportar respaldo de intentos de esta cuenta</button>
 <label>Restaurar respaldo de intentos de esta cuenta<input type="file" accept="application/json" onChange={e=>{const file=e.target.files?.[0];if(file)run(()=>cloud.restore(file));}}/></label>
 </section>;
}
