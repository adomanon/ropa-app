export type GarmentStatus = 'clean' | 'dirty'

export interface Garment {
  id?: number
  name: string
  category: string
  brand: string
  color: string
  size: string
  notes: string
  status: GarmentStatus
  imageDataUrl?: string
  createdAt: number
}

export interface Outfit {
  id?: number
  name: string
  garmentIds: number[]
  mood: 'incomplete' | 'ready' | 'not-available'
  imageDataUrl?: string
  createdAt: number
}

export const CATEGORIES = [
  'Pantalones',
  'Jeans',
  'Shorts',
  'Faldas',
  'Vestidos',
  'Blusas',
  'Tops',
  'Camisas',
  'Playeras',
  'Sueteres',
  'Sudaderas',
  'Chamarras',
  'Abrigos',
  'Blazers',
  'Ropa deportiva',
  'Ropa interior',
  'Trajes de bano',
  'Calcetas',
  'Pijamas',
  'Calzado',
  'Tenis',
  'Botas',
  'Sandalias',
  'Tacones',
  'Cinturones',
  'Bolsas',
  'Gorras',
  'Sombreros',
  'Panuelos',
  'Joyeria',
  'Lentes',
  'Accesorios',
] as const

export const COLOR_OPTIONS = [
  'Negro',
  'Blanco',
  'Gris',
  'Azul',
  'Mezclilla',
  'Rosa',
  'Rojo',
  'Verde',
  'Beige',
  'Cafe',
  'Morado',
  'Amarillo',
  'Naranja',
  'Dorado',
  'Plateado',
] as const
