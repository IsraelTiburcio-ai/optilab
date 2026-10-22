import {useId, useLayoutEffect, useRef, useState, type ReactNode} from 'react';
import {Link} from 'react-router-dom';
import {ArrowLeft, Maximize, Minimize} from 'lucide-react';
import './GameArena.css';

interface GameArenaProps {
  title: string;
  region: string;
  returnTo: string;
  controls: ReactNode;
  children: ReactNode;
}

/** CSS-only arena. Children never move to a portal or change position in React's tree. */
export function GameArena({title, region, returnTo, controls, children}: GameArenaProps) {
  const [expanded, setExpanded] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const entryScroll = useRef<{x: number; y: number} | null>(null);
  const restoreScroll = useRef<{x: number; y: number} | null>(null);
  const titleId = useId();

  useLayoutEffect(() => {
    if (!expanded) {
      // Layout is normal again. Restoring during cleanup alone can clamp to the
      // temporarily shorter fixed-mode document, particularly on portrait tablets.
      if (restoreScroll.current) {
        const {x, y} = restoreScroll.current;
        restoreScroll.current = null;
        window.scrollTo({left: x, top: y, behavior: 'instant'});
        toggle.current?.focus({preventScroll: true});
      }
      return;
    }
    if (!root.current) return;
    const arena = root.current;
    const body = document.body;
    const html = document.documentElement;
    const {x, y} = entryScroll.current || {x: window.scrollX, y: window.scrollY};
    const bodyStyle = body.getAttribute('style');
    const htmlStyle = html.getAttribute('style');
    const previousArena = body.getAttribute('data-game-arena');
    const surroundings: {element: HTMLElement; inert: boolean; aria: string | null; visibility: string}[] = [];

    // Hide/inert siblings along the ancestor chain, never an ancestor of the iframe.
    // Visibility preserves the normal layout so closing can restore the exact scroll.
    for (let branch: HTMLElement = arena; branch.parentElement && branch !== body; branch = branch.parentElement) {
      for (const sibling of Array.from(branch.parentElement.children)) {
        if (sibling === branch || !(sibling instanceof HTMLElement)) continue;
        surroundings.push({element: sibling, inert: sibling.inert, aria: sibling.getAttribute('aria-hidden'), visibility: sibling.style.visibility});
        sibling.inert = true;
        sibling.setAttribute('aria-hidden', 'true');
        sibling.style.visibility = 'hidden';
      }
    }
    body.setAttribute('data-game-arena', 'expanded');
    Object.assign(body.style, {position: 'fixed', top: `${-y}px`, left: `${-x}px`, width: '100%', overflow: 'hidden', overscrollBehavior: 'none'});
    Object.assign(html.style, {overflow: 'hidden', overscrollBehavior: 'none', scrollBehavior: 'auto'});
    toggle.current?.focus({preventScroll: true});

    const escape = (event: KeyboardEvent) => {
      // This listener is intentionally only on the host. Iframe Escape need not bubble.
      if (event.key === 'Escape') {
        event.preventDefault();
        setExpanded(false);
      }
    };
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('keydown', escape);
      for (const {element, inert, aria, visibility} of surroundings) {
        element.inert = inert;
        if (aria === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', aria);
        element.style.visibility = visibility;
      }
      if (bodyStyle === null) body.removeAttribute('style');
      else body.setAttribute('style', bodyStyle);
      if (htmlStyle === null) html.removeAttribute('style');
      else html.setAttribute('style', htmlStyle);
      if (previousArena === null) body.removeAttribute('data-game-arena');
      else body.setAttribute('data-game-arena', previousArena);
      restoreScroll.current = {x, y};
      window.scrollTo({left: x, top: y, behavior: 'instant'});
      // On unmount the router takes over focus; on close the next layout effect restores it.
    };
  }, [expanded]);

  const focusExit = () => { if (expanded) toggle.current?.focus({preventScroll: true}); };
  return <div ref={root} className={`game-arena${expanded ? ' is-expanded' : ''}`}
    role={expanded ? 'dialog' : undefined} aria-modal={expanded || undefined}
    aria-labelledby={expanded ? titleId : undefined}>
    <span className="arena-focus-boundary" tabIndex={expanded ? 0 : -1} onFocus={focusExit}/>
    <div className="arena-toolbar">
      <div className="arena-normal-controls" hidden={expanded}>{controls}</div>
      <div className="arena-heading" hidden={!expanded}>
        <span>OPTILAB / {region}</span><strong id={titleId}>{title}</strong>
      </div>
      <Link className="arena-back" to={returnTo} hidden={!expanded} aria-label="Regresar al gimnasio desde pantalla grande"><ArrowLeft size={19}/></Link>
      <button ref={toggle} type="button" className="button arena-toggle" aria-pressed={expanded} onClick={() => {
        // Capture before the fixed container leaves normal flow and can clamp scrollY.
        if (!expanded) entryScroll.current = {x: window.scrollX, y: window.scrollY};
        setExpanded(value => !value);
      }}>
        {expanded ? <Minimize size={18} aria-hidden="true"/> : <Maximize size={18} aria-hidden="true"/>}
        {expanded ? 'Salir de pantalla grande' : 'Pantalla grande'}
      </button>
    </div>
    <div className="arena-content">{children}</div>
    <span className="arena-focus-boundary" tabIndex={expanded ? 0 : -1} onFocus={focusExit}/>
  </div>;
}
