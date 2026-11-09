import type {Api,Scope} from './types';
export type RankingBoard=Api['groupRanking']['output'];
const cache=new Map<string,{expires:number;board:RankingBoard}>();
const key=(uid:string,scope:Scope)=>`${uid}/${scope.courseId}/${scope.termId}/${scope.groupId}`;
export function readRankingCache(uid:string,scope:Scope):RankingBoard|null{const row=cache.get(key(uid,scope));return row&&row.expires>Date.now()?row.board:null;}
export function writeRankingCache(uid:string,scope:Scope,board:RankingBoard,ttl=30000){cache.set(key(uid,scope),{expires:Date.now()+ttl,board});}
export function invalidateRanking(scope?:Scope){if(!scope){cache.clear();return;}const suffix=`/${scope.courseId}/${scope.termId}/${scope.groupId}`;for(const item of cache.keys())if(item.endsWith(suffix))cache.delete(item);}
