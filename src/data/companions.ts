import type {GymId} from '../data';

export type CompanionId = 'nexo' | 'poli' | 'piv' | 'dua' | 'brio';
export type EvolutionStage = 1 | 2 | 3;
export interface CompanionForm {id: string; stage: EvolutionStage; name: string; image: string}
export interface CompanionFamily {
  id: CompanionId;
  gymId: GymId;
  name: string;
  theme: string;
  color: string;
  personality: string;
  evolutions: readonly [CompanionForm, CompanionForm, CompanionForm];
}

export const companions: readonly CompanionFamily[] = [
  {id:'nexo', gymId:1, name:'Nexo', theme:'Sistemas y conexiones', color:'#4e8760', personality:'Curioso y atento. Disfruta descubrir las conexiones que mantienen unido al mundo.', evolutions:[
    {id:'nexo-form-01',stage:1,name:'Nexo',image:'https://res.cloudinary.com/de7zwptxx/image/upload/v1792721870/01_-_Nexo_nptgy6.webp'},
    {id:'nexo-form-02',stage:2,name:'Nexor',image:'https://res.cloudinary.com/de7zwptxx/image/upload/v1792721876/02_-_Nexor_xpuyob.webp'},
    {id:'nexo-form-03',stage:3,name:'Nexarbor',image:'https://res.cloudinary.com/de7zwptxx/image/upload/v1792721886/03_-_Nexarbor_ayupjx.webp'},
  ]},
  {id:'poli', gymId:2, name:'Poli', theme:'Geometría y programación lineal', color:'#b26937', personality:'Preciso y paciente. Observa cada ángulo antes de elegir el siguiente paso.', evolutions:[
    {id:'poli-form-01',stage:1,name:'Poli',image:'https://res.cloudinary.com/de7zwptxx/image/upload/v1792721871/01_-_Poli_ok46zf.webp'},
    {id:'poli-form-02',stage:2,name:'Poligon',image:'https://res.cloudinary.com/de7zwptxx/image/upload/v1792721878/02_-_Poligon_zyqpck.webp'},
    {id:'poli-form-03',stage:3,name:'Polidrón',image:'https://res.cloudinary.com/de7zwptxx/image/upload/v1792721895/03_-_Polidr%C3%B3n_pwetgd.webp'},
  ]},
  {id:'piv', gymId:3, name:'Piv', theme:'Estrategia y método Simplex', color:'#527b8c', personality:'Analítico y decidido. Encuentra oportunidades avanzando un movimiento a la vez.', evolutions:[
    {id:'piv-form-01',stage:1,name:'Piv',image:'https://res.cloudinary.com/de7zwptxx/image/upload/v1792721881/01_-_Piv_q6wjz0.webp'},
    {id:'piv-form-02',stage:2,name:'Pivox',image:'https://res.cloudinary.com/de7zwptxx/image/upload/v1792721883/02_-_Pivox_et0b16.webp'},
    {id:'piv-form-03',stage:3,name:'Pivótrón',image:'https://res.cloudinary.com/de7zwptxx/image/upload/v1792721893/03_-_Piv%C3%B3tr%C3%B3n_zl9lnd.webp'},
  ]},
  {id:'dua', gymId:4, name:'Dua', theme:'Dualidad y equilibrio', color:'#86749c', personality:'Reflexivo y sereno. Le gusta mirar cada desafío desde más de una perspectiva.', evolutions:[
    {id:'dua-form-01',stage:1,name:'Dua',image:'https://res.cloudinary.com/de7zwptxx/image/upload/v1792721873/01_-_Dua_liw9xd.webp'},
    {id:'dua-form-02',stage:2,name:'Dualuna',image:'https://res.cloudinary.com/de7zwptxx/image/upload/v1792721880/02_-_Dualuna_dfwyz2.webp'},
    {id:'dua-form-03',stage:3,name:'Dualaris',image:'https://res.cloudinary.com/de7zwptxx/image/upload/v1792721893/03_-_Dualaris_il8zaw.webp'},
  ]},
  {id:'brio', gymId:5, name:'Brío', theme:'Metas y perseverancia', color:'#b56959', personality:'Perseverante y entusiasta. Celebra cada avance sin perder de vista el horizonte.', evolutions:[
    {id:'brio-form-01',stage:1,name:'Brío',image:'https://res.cloudinary.com/de7zwptxx/image/upload/v1792721868/01_-_Br%C3%ADo_jiq8el.webp'},
    {id:'brio-form-02',stage:2,name:'Brion',image:'https://res.cloudinary.com/de7zwptxx/image/upload/v1792721875/02_-_Brion_omddfl.webp'},
    {id:'brio-form-03',stage:3,name:'Bríomonte',image:'https://res.cloudinary.com/de7zwptxx/image/upload/v1792721896/03_-_Br%C3%ADomonte_gaev9r.webp'},
  ]},
];
export const isCompanionId = (value: unknown): value is CompanionId => companions.some(c => c.id === value);
export const getCompanion = (id: CompanionId | null | undefined) => companions.find(c => c.id === id) || companions[0];
export const getCompanionForm = (id: CompanionId | null | undefined, stage: EvolutionStage = 1) => getCompanion(id).evolutions.find(f => f.stage === stage)!;
export const getGymCompanion = (gymId: number) => companions.find(c => c.gymId === gymId) || companions[0];
