export interface Avatar {
  id: string;
  name: string;
  image: string;
  personality: string;
  motto: string;
  color: string;
}

export const avatars: readonly Avatar[] = [
  {id: 'avatar-01', name: 'Kai', image: 'https://res.cloudinary.com/de7zwptxx/image/upload/v1792704693/Imagen-de-ChatGPT-22-oct-2026_-15_28_39-1_gooidd.webp', personality: 'La curiosidad es su brújula. Siempre encuentra una conexión que merece explorarse.', motto: 'Cada pregunta abre un camino.', color: '#527b8c'},
  {id: 'avatar-02', name: 'Mika', image: 'https://res.cloudinary.com/de7zwptxx/image/upload/v1792704692/Imagen-de-ChatGPT-22-oct-2026_-15_28_41-2_pztpz0.webp', personality: 'Observa con calma y escucha cada pista. Disfruta descubrir cómo encajan las ideas.', motto: 'Las pistas están en los detalles.', color: '#86749c'},
  {id: 'avatar-03', name: 'Ares', image: 'https://res.cloudinary.com/de7zwptxx/image/upload/v1792704692/Imagen-de-ChatGPT-22-oct-2026_-15_28_42-3_sr018d.webp', personality: 'Se anima ante un reto nuevo. Prueba, aprende de sus errores y vuelve a intentarlo.', motto: 'El siguiente intento también cuenta.', color: '#b56959'},
  {id: 'avatar-04', name: 'Lyra', image: 'https://res.cloudinary.com/de7zwptxx/image/upload/v1792704691/Imagen-de-ChatGPT-22-oct-2026_-15_28_44-4_xogrhr.webp', personality: 'Imagina rutas distintas para una misma aventura. Combina creatividad y paciencia.', motto: 'Siempre hay otra forma de mirar.', color: '#4e8760'},
  {id: 'avatar-05', name: 'Zane', image: 'https://res.cloudinary.com/de7zwptxx/image/upload/v1792704690/Imagen-de-ChatGPT-22-oct-2026_-15_28_46-5_ke9io0.webp', personality: 'Le gusta ordenar las pistas y preparar su próximo paso. Avanza con intención, a su ritmo.', motto: 'Una buena ruta empieza con un paso.', color: '#b26937'},
  {id: 'avatar-06', name: 'Nova', image: 'https://res.cloudinary.com/de7zwptxx/image/upload/v1792704689/Imagen-de-ChatGPT-22-oct-2026_-15_28_48-6_thynd7.webp', personality: 'La perseverancia ilumina su camino. Celebra los pequeños avances de cada expedición.', motto: 'Tu constancia deja huella.', color: '#8a7340'},
];
export const DEFAULT_AVATAR_ID = 'avatar-01';
export const getAvatar = (id: string | null | undefined): Avatar => avatars.find(a => a.id === id) || avatars[0];
export const isAvatarId = (id: unknown): id is string => typeof id === 'string' && avatars.some(a => a.id === id);
