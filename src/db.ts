import Dexie, { type EntityTable } from 'dexie'
import { seedGarments } from './data/seed'
import type { Garment, Outfit } from './types'

export interface AppBackup {
  version: number
  exportedAt: number
  garments: Garment[]
  outfits: Outfit[]
}

const appDb = new Dexie('rosa-closet-db') as Dexie & {
  garments: EntityTable<Garment, 'id'>
  outfits: EntityTable<Outfit, 'id'>
}

appDb.version(1).stores({
  garments: '++id, category, brand, color, status, createdAt',
  outfits: '++id, mood, createdAt',
})

appDb.version(2)
  .stores({
    garments: '++id, category, brand, color, status, isFavorite, createdAt',
    outfits: '++id, mood, createdAt',
  })
  .upgrade(async (transaction) => {
    await transaction
      .table('garments')
      .toCollection()
      .modify((garment: Garment) => {
        if (typeof garment.isFavorite !== 'boolean') {
          garment.isFavorite = false
        }
      })
  })

export async function ensureSeedData() {
  const count = await appDb.garments.count()
  if (count > 0) {
    return
  }

  await appDb.garments.bulkAdd(seedGarments)
}

export async function exportAppData(): Promise<AppBackup> {
  const [garments, outfits] = await Promise.all([appDb.garments.toArray(), appDb.outfits.toArray()])

  return {
    version: 1,
    exportedAt: Date.now(),
    garments,
    outfits,
  }
}

export async function importAppData(backup: AppBackup) {
  if (!Array.isArray(backup.garments) || !Array.isArray(backup.outfits)) {
    throw new Error('El archivo no tiene un formato valido.')
  }

  const garments = backup.garments.map((garment) => ({
    ...garment,
    isFavorite: Boolean(garment.isFavorite),
  }))

  await appDb.transaction('rw', appDb.garments, appDb.outfits, async () => {
    await appDb.outfits.clear()
    await appDb.garments.clear()

    if (garments.length > 0) {
      await appDb.garments.bulkPut(garments)
    }

    if (backup.outfits.length > 0) {
      await appDb.outfits.bulkPut(backup.outfits)
    }
  })
}

export { appDb }
