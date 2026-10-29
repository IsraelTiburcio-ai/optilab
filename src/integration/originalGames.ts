import {games,type Game} from '../data';

const pilotIds=new Set(['ahorcado-simplex','ordena-simplex','rompecabezas-simplex','caza-el-pivote']);
/** Public catalog only. Never consume a URL from route/query input. */
export function embeddedOriginalGame(id:string):Game|null {
  if(!pilotIds.has(id))return null;
  const game=games.find(g=>g.repo===id);
  return game?.juego_url===`https://israeltiburcio-ai.github.io/${id}/`?game:null;
}

// GitHub Pages games share the host's origin. Omit allow-same-origin: scripts
// must not read OptiLab's DOM, cookies or storage, nor remove their own sandbox.
export const originalGameIframePolicy={sandbox:'allow-scripts',referrerPolicy:'no-referrer' as const,
  allow:"camera 'none'; microphone 'none'; geolocation 'none'; payment 'none'; autoplay 'none'; fullscreen 'none'"};
