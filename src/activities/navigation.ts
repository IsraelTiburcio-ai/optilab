import {games} from '../data';
import type {PublishedActivity,Scope} from '../academic/types';
export function activityPath(id:string,scope?:Scope){return scope&&id.startsWith('a_')?`/grupo/${scope.courseId}/${scope.termId}/${scope.groupId}/actividad/${id}`:`/${id==='memorama-simplex'?'jugar':'jugar-original'}/${id}${scope?'?'+new URLSearchParams({...scope}):''}`;}
export function orderedVisible(gymId:number,layout:{orderedActivityIds:string[];hiddenOriginalGameIds:string[]},external:PublishedActivity[]){
 const originals=games.filter(g=>g.gimnasio===gymId).map(g=>g.repo),allowed=new Set([...originals.filter(id=>!layout.hiddenOriginalGameIds.includes(id)),...external.map(a=>a.activityId)]);
 return [...new Set([...layout.orderedActivityIds,...originals,...external.map(a=>a.activityId)])].filter(id=>allowed.has(id));
}
