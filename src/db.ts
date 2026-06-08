import Dexie, { type EntityTable } from 'dexie'
import { seedGarments } from './data/seed'
import type { Garment, Outfit } from './types'

const appDb = new Dexie('rosa-closet-db') as Dexie & {
  garments: EntityTable<Garment, 'id'>
  outfits: EntityTable<Outfit, 'id'>
}

appDb.version(1).stores({
  garments: '++id, category, brand, color, status, createdAt',
  outfits: '++id, mood, createdAt',
})

export async function ensureSeedData() {
  const count = await appDb.garments.count()
  if (count > 0) {
    return
  }

  await appDb.garments.bulkAdd(seedGarments)
}

export { appDb }
