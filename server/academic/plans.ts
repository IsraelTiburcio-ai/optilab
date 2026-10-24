import type {Data,Scope} from './contracts';
export interface Write {path:string;data:Data}
export interface Event {scope:Scope;action:string;subjectUid:string|null;version:number|null}
export interface Plan {writes:Write[];events:Event[];result:Data;secret?:string}
export const plan=(result:Data,writes:Write[]=[],events:Event[]=[],secret?:string):Plan=>({result,writes,events,secret});
