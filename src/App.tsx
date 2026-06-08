import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import './App.css'
import { appDb, ensureSeedData } from './db'
import { fileToOptimizedDataUrl } from './lib/image'
import type { Garment, GarmentStatus, Outfit } from './types'
import { CATEGORIES, COLOR_OPTIONS } from './types'

const tabs = [
  { id: 'armario', label: 'Armario' },
  { id: 'combinar', label: 'Combinar' },
  { id: 'outfits', label: 'Outfits' },
] as const

const slotGroups: Record<string, string[]> = {
  Tops: ['Tops', 'Blusas', 'Camisas', 'Playeras', 'Sueteres', 'Sudaderas'],
  Pantalones: ['Pantalones', 'Jeans', 'Shorts', 'Faldas'],
  Calzado: ['Calzado', 'Tenis', 'Botas', 'Sandalias', 'Tacones'],
  Accesorios: ['Cinturones', 'Bolsas', 'Gorras', 'Sombreros', 'Lentes', 'Accesorios'],
}

type TabId = (typeof tabs)[number]['id']

type GarmentFormState = {
  name: string
  category: string
  brand: string
  color: string
  size: string
  notes: string
  status: GarmentStatus
  imageDataUrl: string
}

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('armario')
  const [garments, setGarments] = useState<Garment[]>([])
  const [outfits, setOutfits] = useState<Outfit[]>([])
  const [selectedBySlot, setSelectedBySlot] = useState<Record<string, number>>({})
  const [builderSlots, setBuilderSlots] = useState<string[]>(['Tops', 'Pantalones', 'Calzado'])

  const [filters, setFilters] = useState({
    brand: 'Todas',
    color: 'Todos',
    category: 'Todas',
  })

  const [newSlotCategory, setNewSlotCategory] = useState<string>(CATEGORIES[0])
  const [outfitName, setOutfitName] = useState('')
  const [outfitImageDataUrl, setOutfitImageDataUrl] = useState<string>()

  const [form, setForm] = useState<GarmentFormState>({
    name: '',
    category: CATEGORIES[0],
    brand: '',
    color: COLOR_OPTIONS[0],
    size: '',
    notes: '',
    status: 'clean' as GarmentStatus,
    imageDataUrl: '',
  })

  async function loadData() {
    const [dbGarments, dbOutfits] = await Promise.all([
      appDb.garments.orderBy('createdAt').reverse().toArray(),
      appDb.outfits.orderBy('createdAt').reverse().toArray(),
    ])
    setGarments(dbGarments)
    setOutfits(dbOutfits)
  }

  useEffect(() => {
    void (async () => {
      await ensureSeedData()
      await loadData()
    })()
  }, [])

  const brandOptions = useMemo(
    () => ['Todas', ...new Set(garments.map((g) => g.brand).filter(Boolean))],
    [garments],
  )

  const filteredGarments = useMemo(() => {
    return garments.filter((g) => {
      const byBrand = filters.brand === 'Todas' || g.brand === filters.brand
      const byColor = filters.color === 'Todos' || g.color === filters.color
      const byCategory = filters.category === 'Todas' || g.category === filters.category
      return byBrand && byColor && byCategory
    })
  }, [garments, filters])

  async function handleGarmentImageChange(file?: File) {
    if (!file) {
      return
    }
    const imageDataUrl = await fileToOptimizedDataUrl(file)
    setForm((prev) => ({ ...prev, imageDataUrl }))
  }

  async function handleOutfitImageChange(file?: File) {
    if (!file) {
      return
    }
    const imageDataUrl = await fileToOptimizedDataUrl(file)
    setOutfitImageDataUrl(imageDataUrl)
  }

  async function addGarment() {
    if (!form.name.trim()) {
      return
    }

    await appDb.garments.add({
      name: form.name.trim(),
      category: form.category,
      brand: form.brand.trim() || 'Sin marca',
      color: form.color,
      size: form.size.trim() || 'N/A',
      notes: form.notes.trim(),
      status: form.status,
      imageDataUrl: form.imageDataUrl || undefined,
      createdAt: Date.now(),
    })

    setForm({
      name: '',
      category: CATEGORIES[0],
      brand: '',
      color: COLOR_OPTIONS[0],
      size: '',
      notes: '',
      status: 'clean',
      imageDataUrl: '',
    })
    await loadData()
  }

  async function toggleGarmentStatus(garment: Garment) {
    if (!garment.id) {
      return
    }
    const status: GarmentStatus = garment.status === 'clean' ? 'dirty' : 'clean'
    await appDb.garments.update(garment.id, { status })
    if (status === 'dirty') {
      setSelectedBySlot((prev) => {
        const next: Record<string, number> = {}
        for (const [slot, id] of Object.entries(prev)) {
          if (id !== garment.id) {
            next[slot] = id
          }
        }
        return next
      })
    }
    await loadData()
  }

  function getSlotItems(slot: string) {
    const categories = slotGroups[slot] ?? [slot]
    return garments.filter((g) => categories.includes(g.category) && g.status === 'clean')
  }

  const selectedGarments = useMemo(() => {
    return Object.values(selectedBySlot)
      .map((id) => garments.find((g) => g.id === id))
      .filter((garment): garment is Garment => Boolean(garment))
  }, [garments, selectedBySlot])

  const builderMood = useMemo(() => {
    if (builderSlots.some((slot) => !selectedBySlot[slot])) {
      return 'incomplete'
    }
    if (selectedGarments.some((g) => g.status === 'dirty')) {
      return 'not-available'
    }
    return 'ready'
  }, [builderSlots, selectedBySlot, selectedGarments])

  async function saveOutfit() {
    const garmentIds = Object.values(selectedBySlot).filter(Boolean)
    if (!garmentIds.length) {
      return
    }

    await appDb.outfits.add({
      name: outfitName.trim() || `Outfit ${new Date().toLocaleDateString('es-MX')}`,
      garmentIds,
      mood: builderMood,
      imageDataUrl: outfitImageDataUrl,
      createdAt: Date.now(),
    })

    setOutfitName('')
    setOutfitImageDataUrl(undefined)
    await loadData()
  }

  function outfitStatus(outfit: Outfit): string {
    const items = outfit.garmentIds
      .map((id) => garments.find((g) => g.id === id))
      .filter((g): g is Garment => Boolean(g))
    if (!items.length) {
      return 'Incompleto'
    }
    if (items.some((g) => g.status === 'dirty')) {
      return 'No disponible (prenda sucia)'
    }
    return 'Listo para usar'
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>Rosa Closet</h1>
          <p>Tu armario digital offline</p>
        </div>
      </header>

      <nav className="tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={clsx('tab', activeTab === tab.id && 'active')}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'armario' && (
        <section className="panel">
          <h2>Subir prenda</h2>
          <div className="grid-two">
            <input
              placeholder="Nombre de la prenda"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
            <select
              value={form.category}
              onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
            >
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <input
              placeholder="Marca"
              value={form.brand}
              onChange={(event) => setForm((prev) => ({ ...prev, brand: event.target.value }))}
            />
            <select
              value={form.color}
              onChange={(event) => setForm((prev) => ({ ...prev, color: event.target.value }))}
            >
              {COLOR_OPTIONS.map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </select>
            <input
              placeholder="Talla"
              value={form.size}
              onChange={(event) => setForm((prev) => ({ ...prev, size: event.target.value }))}
            />
            <select
              value={form.status}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, status: event.target.value as GarmentStatus }))
              }
            >
              <option value="clean">Limpia</option>
              <option value="dirty">Sucia</option>
            </select>
            <textarea
              className="span-two"
              placeholder="Notas"
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
            />
            <label className="file-input span-two">
              <span>+ Foto de la prenda</span>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => void handleGarmentImageChange(event.target.files?.[0])}
              />
            </label>
          </div>
          <button type="button" className="cta" onClick={() => void addGarment()}>
            Guardar prenda
          </button>

          <h2>Filtros</h2>
          <div className="grid-two">
            <select
              value={filters.brand}
              onChange={(event) => setFilters((prev) => ({ ...prev, brand: event.target.value }))}
            >
              {brandOptions.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
            <select
              value={filters.color}
              onChange={(event) => setFilters((prev) => ({ ...prev, color: event.target.value }))}
            >
              <option value="Todos">Todos los colores</option>
              {COLOR_OPTIONS.map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </select>
            <select
              className="span-two"
              value={filters.category}
              onChange={(event) => setFilters((prev) => ({ ...prev, category: event.target.value }))}
            >
              <option value="Todas">Todas las categorias</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="garment-list">
            {filteredGarments.map((garment) => (
              <article
                key={garment.id}
                className={clsx('garment-card', garment.status === 'dirty' && 'is-dirty')}
              >
                {garment.imageDataUrl ? (
                  <img src={garment.imageDataUrl} alt={garment.name} />
                ) : (
                  <div className="img-fallback">Sin foto</div>
                )}
                <div className="garment-meta">
                  <strong>{garment.name}</strong>
                  <span>{garment.category}</span>
                  <span>
                    {garment.brand} · {garment.color}
                  </span>
                </div>
                <button type="button" onClick={() => void toggleGarmentStatus(garment)}>
                  {garment.status === 'clean' ? 'Marcar sucia' : 'Marcar limpia'}
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'combinar' && (
        <section className="panel">
          <h2>Creador de combinaciones</h2>
          <p className="hint">Desliza y toca para elegir una prenda por bloque.</p>

          <div className="slot-actions">
            <select
              value={newSlotCategory}
              onChange={(event) => setNewSlotCategory(event.target.value)}
            >
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() =>
                setBuilderSlots((prev) => (prev.includes(newSlotCategory) ? prev : [...prev, newSlotCategory]))
              }
            >
              + Agregar bloque
            </button>
          </div>

          {builderSlots.map((slot) => {
            const slotItems = getSlotItems(slot)
            return (
              <section key={slot} className="slot-panel">
                <header>
                  <h3>{slot}</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setBuilderSlots((prev) => prev.filter((value) => value !== slot))
                      setSelectedBySlot((prev) => {
                        const { [slot]: _removed, ...rest } = prev
                        return rest
                      })
                    }}
                  >
                    Quitar
                  </button>
                </header>
                <div className="horizontal-scroll">
                  {slotItems.map((garment) => (
                    <button
                      key={garment.id}
                      type="button"
                      className={clsx('choice-card', selectedBySlot[slot] === garment.id && 'selected')}
                      onClick={() =>
                        setSelectedBySlot((prev) => ({
                          ...prev,
                          [slot]: garment.id!,
                        }))
                      }
                    >
                      {garment.imageDataUrl ? (
                        <img src={garment.imageDataUrl} alt={garment.name} />
                      ) : (
                        <div className="img-fallback small">Sin foto</div>
                      )}
                      <span>{garment.name}</span>
                    </button>
                  ))}
                  {!slotItems.length && <p className="hint">No hay prendas limpias en este bloque.</p>}
                </div>
              </section>
            )
          })}

          <div className="status-box">
            <strong>Estatus del outfit:</strong>
            <span>
              {builderMood === 'ready' && 'Listo para usar'}
              {builderMood === 'incomplete' && 'Incompleto'}
              {builderMood === 'not-available' && 'No disponible'}
            </span>
          </div>

          <div className="grid-two">
            <input
              placeholder="Nombre del outfit"
              value={outfitName}
              onChange={(event) => setOutfitName(event.target.value)}
            />
            <label className="file-input">
              <span>+ Foto del outfit</span>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => void handleOutfitImageChange(event.target.files?.[0])}
              />
            </label>
          </div>
          <button type="button" className="cta" onClick={() => void saveOutfit()}>
            Guardar outfit
          </button>
        </section>
      )}

      {activeTab === 'outfits' && (
        <section className="panel">
          <h2>Outfits guardados</h2>
          <div className="outfit-list">
            {outfits.map((outfit) => (
              <article key={outfit.id} className="outfit-card">
                {outfit.imageDataUrl ? (
                  <img src={outfit.imageDataUrl} alt={outfit.name} />
                ) : (
                  <div className="img-fallback">Sin foto</div>
                )}
                <div>
                  <strong>{outfit.name}</strong>
                  <p>{outfitStatus(outfit)}</p>
                  <small>
                    {outfit.garmentIds
                      .map((id) => garments.find((g) => g.id === id)?.name)
                      .filter(Boolean)
                      .join(' · ')}
                  </small>
                </div>
              </article>
            ))}
            {!outfits.length && <p className="hint">Aun no has guardado outfits.</p>}
          </div>
        </section>
      )}
    </main>
  )
}

export default App
