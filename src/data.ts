import raw from '../catalogo_optimizacion_gimnasios_1_a_5.json';
export type GymId = 1 | 2 | 3 | 4 | 5;
export interface Game { gimnasio: GymId; nombre: string; repo: string; repositorio_url: string; juego_url: string; tema: string }
export const games: Game[] = raw.juegos.map((g) => {
  if (![1,2,3,4,5].includes(g.gimnasio) || !g.nombre || !g.repo || !g.tema || ![g.juego_url,g.repositorio_url].every(u => {try {return new URL(u).protocol === 'https:'} catch {return false}})) throw new Error('El catálogo contiene un registro inválido.');
  return {...g, gimnasio:g.gimnasio as GymId};
});
if (games.length !== raw.total || new Set(games.map(g=>g.repo)).size !== games.length) throw new Error('El catálogo no coincide con su total o contiene duplicados.');
export const gyms = [
 {id:1, name:'Bosque de Sistemas', topic:'Introducción a la Teoría de Sistemas', color:'#4e8760', pale:'#dfebcd', creature:'Nexo', badge:'Sistema', desc:'Todo está conectado. Descubre sistemas, fronteras y los fundamentos de Investigación de Operaciones.'},
 {id:2, name:'Valle Lineal', topic:'Modelos de Programación Lineal', color:'#b26937', pale:'#f5dfb5', creature:'Poli', badge:'Lineal', desc:'Traza posibilidades. Formula modelos, reconoce restricciones y explora la región factible.'},
 {id:3, name:'Fortaleza Simplex', topic:'Método Simplex', color:'#527b8c', pale:'#d7e8e8', creature:'Piv', badge:'Pivote', desc:'Un movimiento a la vez. Conecta equivalencias, ordena el algoritmo y encuentra el siguiente pivote.'},
 {id:4, name:'Santuario Dual', topic:'Teoría de la Dualidad', color:'#86749c', pale:'#e9e0ef', creature:'Dua', badge:'Espejo', desc:'Mira el otro lado del problema. Explora dualidad, holguras y el valor de los recursos.'},
 {id:5, name:'Cumbre de Metas', topic:'Programación de Metas', color:'#b56959', pale:'#f4ddd0', creature:'Brío', badge:'Meta', desc:'Elige tu horizonte. Equilibra metas, desviaciones y prioridades para encontrar tu camino.'}
] as const;
export const gymGames = (id:number) => games.filter(g=>g.gimnasio===id);
export const normalize = (s:string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export interface Question { concept:string; prompt:string; options:string[]; answer:number; feedback:string; repo:string; source:string }
export const questions:Question[] = [
 {concept:'Variables de holgura',prompt:'Para transformar 2x₁ + x₂ ≤ 8 en una igualdad equivalente, ¿qué expresión es correcta?',options:['2x₁ + x₂ − s = 8; s ≥ 0','2x₁ + x₂ + s = 8; s ≥ 0','2x₁ + x₂ + s = 8; s ≤ 0'],answer:1,feedback:'Se suma s = 8 − 2x₁ − x₂ ≥ 0. La holgura representa el recurso disponible que no se utiliza.',repo:'rompecabezas-simplex',source:'§3.2, p. 6'},
 {concept:'Equivalencias algebraicas',prompt:'Al multiplicar 3x₁ − 2x₂ ≥ 6 por −1, la restricción equivalente es…',options:['−3x₁ + 2x₂ ≤ −6','−3x₁ + 2x₂ ≥ −6','−3x₁ − 2x₂ ≤ −6'],answer:0,feedback:'Multiplicar ambos lados por un número negativo invierte el sentido de la desigualdad y cambia el signo de cada término.',repo:'rompecabezas-simplex',source:'§3.2, p. 6'},
 {concept:'Variable de entrada',prompt:'En maximización, con una base factible y zⱼ − cⱼ = (−3, −5, 0) para (x₁, x₂, x₃), ¿qué variable entra con el criterio del más negativo?',options:['x₁','x₃','x₂'],answer:2,feedback:'En esta convención se elige el costo reducido más negativo: −5 corresponde a x₂.',repo:'caza-el-pivote',source:'§3.3, p. 14'},
 {concept:'Criterio de la razón',prompt:'La columna de entrada tiene coeficientes (2, 1, −1) y los lados derechos son (8, 3, 5). ¿Qué fila sale de la base?',options:['Fila 1: razón 8/2 = 4','Fila 2: razón 3/1 = 3','Fila 3: razón 5/(−1) = −5'],answer:1,feedback:'Solo se consideran coeficientes de entrada positivos. El mínimo entre 4 y 3 es 3; sale la variable básica de la fila 2.',repo:'caza-el-pivote',source:'§3.3, pp. 14–16'},
 {concept:'Criterio de optimalidad',prompt:'En maximización, una tabla primal factible tiene todos los zⱼ − cⱼ ≥ 0. ¿Qué concluyes?',options:['La solución básica actual es óptima','Debe entrar la variable con el mayor zⱼ − cⱼ','El modelo necesariamente es infactible'],answer:0,feedback:'Con una base primal factible y todos los costos reducidos zⱼ − cⱼ no negativos, se satisface el criterio de optimalidad de maximización.',repo:'ordena-simplex',source:'§3.3, p. 14'}
];
