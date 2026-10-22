import type {GymId} from '../data';

export interface BadgeAsset {id: string; name: string; image: string}

/** IDs and source URLs supplied for this project. Gym assignments are declared separately. */
export const badges: readonly BadgeAsset[] = [
  {id: 'badge-01', name: 'Insignia 01', image: 'https://res.cloudinary.com/de7zwptxx/image/upload/v1792704464/Imagen_de_ChatGPT_22_oct_2026_15_24_01-5_sibmhj.webp'},
  {id: 'badge-02', name: 'Insignia 02', image: 'https://res.cloudinary.com/de7zwptxx/image/upload/v1792704464/Imagen_de_ChatGPT_22_oct_2026_15_24_13_tah4xc.webp'},
  {id: 'badge-03', name: 'Insignia 03', image: 'https://res.cloudinary.com/de7zwptxx/image/upload/v1792704464/Imagen_de_ChatGPT_22_oct_2026_15_24_05-9_uxn9qd.webp'},
  {id: 'badge-04', name: 'Insignia 04', image: 'https://res.cloudinary.com/de7zwptxx/image/upload/v1792704463/Imagen_de_ChatGPT_22_oct_2026_15_24_04-8_mz3qwi.webp'},
  {id: 'badge-05', name: 'Insignia 05', image: 'https://res.cloudinary.com/de7zwptxx/image/upload/v1792704463/Imagen_de_ChatGPT_22_oct_2026_15_24_02-6_nobqhl.webp'},
  {id: 'badge-06', name: 'Insignia 06', image: 'https://res.cloudinary.com/de7zwptxx/image/upload/v1792704462/Imagen_de_ChatGPT_22_oct_2026_15_23_53-2_pstvlb.webp'},
  {id: 'badge-07', name: 'Insignia 07', image: 'https://res.cloudinary.com/de7zwptxx/image/upload/v1792704462/Imagen_de_ChatGPT_22_oct_2026_15_23_59-4_eeh65d.webp'},
  {id: 'badge-08', name: 'Insignia 08', image: 'https://res.cloudinary.com/de7zwptxx/image/upload/v1792704462/Imagen_de_ChatGPT_22_oct_2026_15_24_03-7_aq3esg.webp'},
  {id: 'badge-09', name: 'Insignia 09', image: 'https://res.cloudinary.com/de7zwptxx/image/upload/v1792704462/Imagen_de_ChatGPT_22_oct_2026_15_23_51-1_dtb9e7.webp'},
];

export interface GymBadgeDefinition {
  gymId: GymId;
  assetId: string;
  name: string;
  visualReason: string;
}
/** Chosen after inspecting the nine source images; this is not URL/index order. */
export const gymBadges: readonly GymBadgeDefinition[] = [
  {gymId: 1, assetId: 'badge-09', name: 'Sistema', visualReason: 'Tres nodos morados conectados: relaciones y componentes de un sistema.'},
  {gymId: 2, assetId: 'badge-06', name: 'Lineal', visualReason: 'Retícula naranja de rombos: geometría, restricciones y regiones.'},
  {gymId: 3, assetId: 'badge-01', name: 'Pivote', visualReason: 'Rotor naranja organizado alrededor de un eje central: el pivote como centro del movimiento.'},
  {gymId: 4, assetId: 'badge-05', name: 'Espejo', visualReason: 'Dos esferas en equilibrio dentro de un mismo marco: dos perspectivas relacionadas.'},
  {gymId: 5, assetId: 'badge-02', name: 'Meta', visualReason: 'Cumbre azul: alcanzar una meta siguiendo una ruta de avance.'},
];
export const specialBadges = [
  {assetId: 'badge-03', name: 'Horizonte', description: 'Brújula estelar · una futura recompensa de aventura.'},
  {assetId: 'badge-04', name: 'Prioridades', description: 'Torre de niveles · una futura recompensa de aventura.'},
  {assetId: 'badge-07', name: 'Conexión', description: 'Circuito verde · una futura recompensa de aventura.'},
  {assetId: 'badge-08', name: 'Rumbo', description: 'Marcador dorado · una futura recompensa de aventura.'},
] as const;
export const getBadgeAsset = (id: string): BadgeAsset => {
  const asset = badges.find(b => b.id === id);
  if (!asset) throw new Error(`Asset de insignia desconocido: ${id}`);
  return asset;
};
export const getGymBadge = (gymId: number) => gymBadges.find(b => b.gymId === gymId) || gymBadges[0];
