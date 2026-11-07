import {Link,useLocation} from 'react-router-dom';
import './loading.css';
/** Public placeholders only: never render a previous account while identity is unresolved. */
export function LoadingShell(){
 return <div className="loading-shell"><header className="loading-header"><Link to="/" className="loading-brand">OPTI<span>LAB</span></Link><nav aria-label="Navegación principal"><Link to="/">Inicio</Link><Link to="/mapa">Mapa</Link><Link to="/optidex">OptiDex</Link><Link to="/entrenar">Entrenar</Link><Link to="/aventura">Mi aventura</Link><Link to="/cuenta">Cuenta</Link></nav></header><LoadingContent/></div>;
}
export function LoadingContent(){
 const {pathname}=useLocation();const page=pathname==='/docente'?'docente':pathname==='/cuenta'?'cuenta':pathname==='/optidex'?'optidex':pathname.startsWith('/gimnasio')?'gimnasio':'inicio';
 return <div className={`loading-content loading-${page}`} role="status" aria-live="polite" aria-label="Cargando OptiLab"><span className="sr-only">Preparando tu aventura…</span><div className="skeleton skeleton-kicker"/><div className="skeleton skeleton-title"/><div className="skeleton skeleton-line"/><div className="skeleton skeleton-line short"/><div className="skeleton-grid">{Array.from({length:page==='inicio'?2:4},(_,i)=><div key={i} className="skeleton skeleton-card"/>)}</div></div>;
}
