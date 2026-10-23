import {useEffect, useLayoutEffect, useRef, useState, type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import {Sparkles, X} from 'lucide-react';
import {getCompanion, getCompanionForm, type CompanionId, type EvolutionStage} from '../data/companions';
import type {UnlockStage} from '../lib/evolutionRules';
import {useProgress} from '../store';
import {CompanionPortrait} from './CompanionPortrait';

export function EvolutionCelebration({id, stage, onClose, replay = false}: {id: CompanionId; stage: UnlockStage; onClose:()=>void; replay?:boolean}) {
  const [phase,setPhase] = useState<'before'|'changing'|'revealed'>(()=>matchMedia('(prefers-reduced-motion: reduce)').matches ? 'revealed' : 'before');
  const modal = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const family = getCompanion(id);
  const from = getCompanionForm(id,(stage-1) as EvolutionStage);
  const to = getCompanionForm(id,stage);
  useEffect(()=>{
    const media=matchMedia('(prefers-reduced-motion: reduce)');
    const reduce=()=>{if(media.matches)setPhase('revealed')};
    media.addEventListener('change',reduce);
    const changing=window.setTimeout(()=>setPhase(current=>current==='revealed'||media.matches?'revealed':'changing'),650);
    const reveal=window.setTimeout(()=>setPhase('revealed'),1800);
    return()=>{clearTimeout(changing);clearTimeout(reveal);media.removeEventListener('change',reduce)};
  },[]);
  useLayoutEffect(()=>{
    const root=modal.current!;
    const focused=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const bodyStyle=document.body.getAttribute('style');const htmlStyle=document.documentElement.getAttribute('style');
    const y=scrollY;
    const background=Array.from(document.body.children).filter((e):e is HTMLElement=>e instanceof HTMLElement&&e!==root).map(e=>({e,inert:e.inert,aria:e.getAttribute('aria-hidden')}));
    background.forEach(({e})=>{e.inert=true;e.setAttribute('aria-hidden','true')});
    Object.assign(document.body.style,{position:'fixed',top:`${-y}px`,width:'100%',overflow:'hidden'});
    document.documentElement.style.overflow='hidden';
    close.current?.focus({preventScroll:true});
    return()=>{
      background.forEach(({e,inert,aria})=>{e.inert=inert;if(aria===null)e.removeAttribute('aria-hidden');else e.setAttribute('aria-hidden',aria)});
      if(bodyStyle===null)document.body.removeAttribute('style');else document.body.setAttribute('style',bodyStyle);
      if(htmlStyle===null)document.documentElement.removeAttribute('style');else document.documentElement.setAttribute('style',htmlStyle);
      window.scrollTo({top:y,behavior:'instant'});
      if(focused?.isConnected)focused.focus({preventScroll:true});else document.getElementById('contenido')?.focus({preventScroll:true});
    };
  },[]);
  return createPortal(<div ref={modal} className={`evolution-overlay phase-${phase}`} style={{'--companion-color':family.color} as CSSProperties} onKeyDown={event=>{
    if(event.key==='Escape'){event.preventDefault();onClose()}
    if(event.key==='Tab'){
      const controls=Array.from(modal.current!.querySelectorAll<HTMLButtonElement>('button')).filter(b=>!b.hidden&&b.getClientRects().length>0);
      const first=controls[0],last=controls.at(-1)!;
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
    }
  }}>
    <section className="evolution-dialog" role="dialog" aria-modal="true" aria-labelledby="evolution-title" aria-describedby="evolution-explanation">
      <button ref={close} className="evolution-close" aria-label="Cerrar evolución" onClick={onClose}><X size={20}/></button>
      <span className="eyebrow">{replay?'RECUERDO DE TU AVENTURA':'UNA NUEVA FORMA DE AVANZAR'}</span>
      <h2 id="evolution-title">{phase==='revealed'?`¡${from.name} ha evolucionado a ${to.name}!`:'Tu compañero está cambiando…'}</h2>
      <div className="evolution-stage" aria-hidden="true">
        <span className="evolution-halo"/>
        <div className="evolution-particles">{Array.from({length:12},(_,i)=><i key={i} style={{'--angle':`${i*30}deg`} as CSSProperties}/>)}</div>
        <CompanionPortrait id={id} stage={(stage-1) as EvolutionStage} decorative eager className="evolution-before"/>
        <CompanionPortrait id={id} stage={stage} decorative eager className="evolution-after"/>
      </div>
      <p className="evolution-congratulations" aria-live="polite">{phase==='revealed'?`${to.name} te acompaña en tu próxima expedición. ¡Tu constancia abre nuevos caminos!`:`${from.name} se prepara para dar el siguiente paso contigo.`}</p>
      <p id="evolution-explanation">Etapa {stage} desbloqueada por práctica autorregistrada. No equivale a una evaluación de dominio.</p>
      <button className="button primary" onClick={phase==='revealed'?onClose:()=>setPhase('revealed')}>{phase==='revealed'?'Regresar a la aventura':'Omitir animación'}</button>
    </section>
  </div>,document.body);
}

export function EvolutionNotice() {
  const {state,evolution,acknowledgeEvolution}=useProgress();
  const [presentation,setPresentation]=useState<{id:CompanionId;stage:UnlockStage}|null>(null);
  const pending:UnlockStage|null=state.evolutionCelebratedStage<2&&evolution.stage>=2?2:state.evolutionCelebratedStage<3&&evolution.stage>=3?3:null;
  return <>
    {state.companionId&&pending&&<aside className="evolution-notice" role="status"><Sparkles size={23}/><div><strong>¡Tu compañero puede evolucionar!</strong><span>{evolution.stage>pending?`Recorre tus formas desbloqueadas. Primera parada: etapa ${pending}.`:`Has desbloqueado la etapa ${pending}. Descubre su nueva forma.`}</span></div>
      <button className="button" onClick={()=>{acknowledgeEvolution(pending);setPresentation({id:state.companionId!,stage:pending})}}>Evolucionar</button>
    </aside>}
    {presentation&&<EvolutionCelebration id={presentation.id} stage={presentation.stage} onClose={()=>setPresentation(null)}/>}
  </>;
}
