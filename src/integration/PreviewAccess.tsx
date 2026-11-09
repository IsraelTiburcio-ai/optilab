import {Link} from 'react-router-dom';

export function PreviewAccessPending(){
  return <section className="paper" role="status" aria-busy="true"><span className="eyebrow">VISTA PREVIA DOCENTE</span><h1>Verificando acceso docente…</h1><p>Comprobando que tu cuenta tenga autorización para una vista previa sin registros.</p></section>;
}

export function PreviewAccessDenied({to}:{to:string}){
  return <section className="paper"><span className="eyebrow">VISTA PREVIA DOCENTE</span><h1>Acceso docente requerido</h1><p>Esta vista previa no registra actividad y solo está disponible para docentes autorizados.</p><Link className="button primary" to={to}>Jugar en modo normal</Link></section>;
}
