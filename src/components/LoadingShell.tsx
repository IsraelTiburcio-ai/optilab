import {useLocation} from 'react-router-dom';
import {SiteHeader} from './SiteHeader';
import './loading.css';
/** Public placeholders only: never render a previous account while identity is unresolved. */
export function LoadingShell(){
 return <div className="loading-shell"><SiteHeader/><main id="contenido"><LoadingContent/></main></div>;
}
export function LoadingContent(){
 const {pathname}=useLocation();const page=pathname==='/docente'?'docente':pathname==='/cuenta'?'cuenta':pathname==='/optidex'?'optidex':pathname.startsWith('/gimnasio')?'gimnasio':'inicio';
 return <div className={`loading-content loading-${page}`} role="status" aria-live="polite" aria-label="Cargando OptiLab"><span className="sr-only">Preparando tu aventura…</span><div className="skeleton skeleton-kicker"/><div className="skeleton skeleton-title"/><div className="skeleton skeleton-line"/><div className="skeleton skeleton-line short"/><div className="skeleton-grid">{Array.from({length:page==='inicio'?2:4},(_,i)=><div key={i} className="skeleton skeleton-card"/>)}</div></div>;
}
