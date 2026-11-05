import catalog from '../../catalogo_optimizacion_gimnasios_1_a_5.json';
export interface CatalogGame {gameId:string;gymId:number;title:string}
export interface CatalogGym {gymId:number;title:string;totalGames:number;games:string[]}
const titles:Record<number,string>={1:'Bosque de Sistemas',2:'Valle Lineal',3:'Fortaleza Simplex',4:'Santuario Dual',5:'Cumbre de Metas'};
const raw=catalog as {juegos?:unknown};
if(!raw||!Array.isArray(raw.juegos))throw new Error('INVALID_GAME_CATALOG');
const seen=new Set<string>();
export const catalogGames:CatalogGame[]=raw.juegos.map(entry=>{
  const game=entry as {gimnasio?:unknown;nombre?:unknown;repo?:unknown}|null;
  if(!game||typeof game.repo!=='string'||!game.repo||typeof game.nombre!=='string'||!game.nombre||
    !Number.isInteger(game.gimnasio)||![1,2,3,4,5].includes(game.gimnasio as number)||seen.has(game.repo))throw new Error('INVALID_GAME_CATALOG');
  seen.add(game.repo);
  return {gameId:game.repo,gymId:game.gimnasio as number,title:game.nombre};
});
export const gameById=new Map(catalogGames.map(game=>[game.gameId,game]));
export const catalogGyms:CatalogGym[]=[1,2,3,4,5].map(gymId=>{
  const games=catalogGames.filter(game=>game.gymId===gymId).map(game=>game.gameId);
  if(!games.length)throw new Error('INVALID_GAME_CATALOG');
  return {gymId,title:titles[gymId],totalGames:games.length,games};
});
