import type { Garment } from '../types'

export const seedGarments: Omit<Garment, 'id'>[] = [
  {
    name: 'Jeans rectos azules',
    category: 'Jeans',
    brand: 'Levis',
    color: 'Mezclilla',
    size: 'M',
    notes: 'Favoritos para diario',
    status: 'clean',
    createdAt: Date.now() - 100000,
  },
  {
    name: 'Top rosa casual',
    category: 'Tops',
    brand: 'Zara',
    color: 'Rosa',
    size: 'S',
    notes: 'Combina con jeans',
    status: 'clean',
    createdAt: Date.now() - 90000,
  },
  {
    name: 'Tenis blancos',
    category: 'Tenis',
    brand: 'Converse',
    color: 'Blanco',
    size: '24',
    notes: 'Uso frecuente',
    status: 'dirty',
    createdAt: Date.now() - 80000,
  },
]
