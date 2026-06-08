import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import './App.css'
import { appDb, ensureSeedData, exportAppData, importAppData } from './db'
import { fileToOptimizedDataUrl, processImageForWardrobe } from './lib/image'
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
  category: string
  brand: string
  color: string
  size: string
  notes: string
  status: GarmentStatus
  imageDataUrl: string
  rotation: number
  removeBackground: boolean
}

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('armario')
  const [garments, setGarments] = useState<Garment[]>([])
  const [outfits, setOutfits] = useState<Outfit[]>([])
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [settingsMessage, setSettingsMessage] = useState('')
  const [isImportingBackup, setIsImportingBackup] = useState(false)
  const [selectedBySlot, setSelectedBySlot] = useState<Record<string, number>>({})
  const [builderSlots, setBuilderSlots] = useState<string[]>(['Tops', 'Pantalones', 'Calzado'])
  const backupInputRef = useRef<HTMLInputElement>(null)

  const [filters, setFilters] = useState({
    brand: 'Todas',
    color: 'Todos',
    category: 'Todas',
  })

  const [newSlotCategory, setNewSlotCategory] = useState<string>(CATEGORIES[0])
  const [outfitName, setOutfitName] = useState('')
  const [outfitImageDataUrl, setOutfitImageDataUrl] = useState<string>()

  const [form, setForm] = useState<GarmentFormState>({
    category: CATEGORIES[0],
    brand: '',
    color: COLOR_OPTIONS[0],
    size: '',
    notes: '',
    status: 'clean' as GarmentStatus,
    imageDataUrl: '',
    rotation: 0,
    removeBackground: true,
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
    setForm((prev) => ({ ...prev, imageDataUrl, rotation: 0, removeBackground: true }))
  }

  async function handleOutfitImageChange(file?: File) {
    if (!file) {
      return
    }
    const imageDataUrl = await fileToOptimizedDataUrl(file)
    setOutfitImageDataUrl(imageDataUrl)
  }

  async function addGarment() {
    if (!form.category.trim()) {
      return
    }

    const imageDataUrl = form.imageDataUrl
      ? await processImageForWardrobe(form.imageDataUrl, {
          rotation: form.rotation,
          removeWhiteBackground: form.removeBackground,
        })
      : undefined

    await appDb.garments.add({
      name: `${form.category}${form.brand.trim() ? ` · ${form.brand.trim()}` : ''}`,
      category: form.category,
      brand: form.brand.trim() || 'Sin marca',
      color: form.color,
      size: form.size.trim() || 'N/A',
      notes: form.notes.trim(),
      status: form.status,
      isFavorite: false,
      imageDataUrl,
      createdAt: Date.now(),
    })

    setForm({
      category: CATEGORIES[0],
      brand: '',
      color: COLOR_OPTIONS[0],
      size: '',
      notes: '',
      status: 'clean',
      imageDataUrl: '',
      rotation: 0,
      removeBackground: true,
    })
    await loadData()
  }

  function rotateDraftImage() {
    setForm((prev) => ({ ...prev, rotation: (prev.rotation + 90) % 360 }))
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

  async function toggleGarmentFavorite(garment: Garment) {
    if (!garment.id) {
      return
    }

    await appDb.garments.update(garment.id, { isFavorite: !garment.isFavorite })
    await loadData()
  }

  async function deleteGarment(garment: Garment) {
    if (!garment.id) {
      return
    }

    await appDb.transaction('rw', appDb.garments, appDb.outfits, async () => {
      await appDb.garments.delete(garment.id)
      const allOutfits = await appDb.outfits.toArray()
      await Promise.all(
        allOutfits
          .filter((outfit) => outfit.garmentIds.includes(garment.id!))
          .map((outfit) =>
            appDb.outfits.update(outfit.id!, {
              garmentIds: outfit.garmentIds.filter((id) => id !== garment.id),
            }),
          ),
      )
    })

    setSelectedBySlot((prev) => {
      const next: Record<string, number> = {}
      for (const [slot, id] of Object.entries(prev)) {
        if (id !== garment.id) {
          next[slot] = id
        }
      }
      return next
    })

    await loadData()
  }

  function getSlotItems(slot: string) {
    const categories = slotGroups[slot] ?? [slot]
    return garments
      .filter((g) => categories.includes(g.category) && g.status === 'clean')
      .sort(
        (left, right) =>
          Number(Boolean(right.isFavorite)) - Number(Boolean(left.isFavorite)) ||
          right.createdAt - left.createdAt,
      )
  }

  function getSelectedSlotGarment(slot: string, slotItems: Garment[]) {
    const selectedId = selectedBySlot[slot]
    return slotItems.find((garment) => garment.id === selectedId) ?? slotItems[0]
  }

  function moveSlotSelection(slot: string, direction: 1 | -1) {
    const slotItems = getSlotItems(slot)
    if (!slotItems.length) {
      return
    }

    const currentIndex = Math.max(
      0,
      slotItems.findIndex((garment) => garment.id === selectedBySlot[slot]),
    )
    const nextIndex = (currentIndex + direction + slotItems.length) % slotItems.length
    const nextItem = slotItems[nextIndex]

    const nextGarmentId = nextItem.id
    if (typeof nextGarmentId !== 'number') {
      return
    }

    setSelectedBySlot((prev) => ({ ...prev, [slot]: nextGarmentId }))
  }

  function selectGarmentForSlot(slot: string, garmentId?: number) {
    if (typeof garmentId !== 'number') {
      return
    }

    setSelectedBySlot((prev) => ({
      ...prev,
      [slot]: garmentId,
    }))
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

  async function handleExportBackup() {
    const backup = await exportAppData()
    const backupBlob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const backupUrl = URL.createObjectURL(backupBlob)
    const downloadLink = document.createElement('a')
    const backupDate = new Date(backup.exportedAt).toISOString().slice(0, 10)

    downloadLink.href = backupUrl
    downloadLink.download = `colset-digital-backup-${backupDate}.json`
    downloadLink.click()
    URL.revokeObjectURL(backupUrl)

    setSettingsMessage('Copia exportada en JSON.')
  }

  async function handleImportBackup(file?: File) {
    if (!file) {
      return
    }

    setIsImportingBackup(true)
    setSettingsMessage('')

    try {
      const parsedBackup = JSON.parse(await file.text()) as Parameters<typeof importAppData>[0]
      await importAppData(parsedBackup)
      setSelectedBySlot({})
      setBuilderSlots(['Tops', 'Pantalones', 'Calzado'])
      setOutfitName('')
      setOutfitImageDataUrl(undefined)
      await loadData()
      setSettingsMessage('Copia importada correctamente.')
    } catch {
      setSettingsMessage('No pude importar el archivo. Revisa que sea una copia valida.')
    } finally {
      setIsImportingBackup(false)
      if (backupInputRef.current) {
        backupInputRef.current.value = ''
      }
    }
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
        <div className="topbar-copy">
          <h1>Colset Digital</h1>
          <p>Tu armario digital offline con respaldo local</p>
        </div>
        <button
          type="button"
          className={clsx('settings-toggle', isSettingsOpen && 'active')}
          onClick={() => setIsSettingsOpen((prev) => !prev)}
          aria-label="Abrir configuracion"
          aria-expanded={isSettingsOpen}
        >
          ⚙
        </button>
      </header>

      {isSettingsOpen && (
        <section className="panel settings-panel">
          <div className="settings-header">
            <div>
              <h2>Configuracion</h2>
              <p className="hint">Guarda una copia de tus prendas y outfits en un JSON para restaurarla cuando quieras.</p>
            </div>
            <button type="button" onClick={() => setIsSettingsOpen(false)}>
              Cerrar
            </button>
          </div>

          <div className="settings-actions">
            <button type="button" className="cta secondary-cta" onClick={() => void handleExportBackup()}>
              Exportar datos
            </button>
            <button
              type="button"
              className="cta secondary-cta"
              onClick={() => backupInputRef.current?.click()}
              disabled={isImportingBackup}
            >
              {isImportingBackup ? 'Importando...' : 'Importar datos'}
            </button>
            <input
              ref={backupInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden-input"
              onChange={(event) => void handleImportBackup(event.target.files?.[0])}
            />
          </div>

          <div className="settings-note">
            <strong>Incluye:</strong>
            <span>prendas, favoritas, fotos guardadas y outfits.</span>
          </div>

          {settingsMessage && <p className="hint settings-feedback">{settingsMessage}</p>}
        </section>
      )}

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
          <p className="hint">El nombre se genera solo con la categoria y la marca; no tienes que escribirlo.</p>
          <div className="grid-two">
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
            <div className="preview-toolbar span-two">
              <button type="button" onClick={rotateDraftImage} disabled={!form.imageDataUrl}>
                Rotar 90°
              </button>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={form.removeBackground}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, removeBackground: event.target.checked }))
                  }
                />
                <span>Quitar fondo blanco</span>
              </label>
            </div>
            <div className="preview-shell span-two">
              {form.imageDataUrl ? (
                <img
                  className="preview-image"
                  src={form.imageDataUrl}
                  alt="Vista previa de la prenda"
                  style={{ transform: `rotate(${form.rotation}deg)` }}
                />
              ) : (
                <div className="img-fallback large">Sin foto todavia</div>
              )}
            </div>
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
                  <strong>{garment.category}</strong>
                  <span>
                    {garment.brand} · {garment.color} · {garment.size}
                  </span>
                  <span>{garment.notes || 'Sin notas'}</span>
                </div>
                <div className="card-actions">
                  <button type="button" onClick={() => void toggleGarmentFavorite(garment)}>
                    {garment.isFavorite ? 'Quitar favorita' : 'Marcar favorita'}
                  </button>
                  <button type="button" onClick={() => void toggleGarmentStatus(garment)}>
                    {garment.status === 'clean' ? 'Marcar sucia' : 'Marcar limpia'}
                  </button>
                  <button type="button" className="danger" onClick={() => void deleteGarment(garment)}>
                    Eliminar
                  </button>
                </div>
              </article>
            ))}
            {!filteredGarments.length && <p className="hint">No hay prendas con esos filtros.</p>}
          </div>
        </section>
      )}

      {activeTab === 'combinar' && (
        <section className="panel">
          <h2>Creador de combinaciones</h2>
          <p className="hint">La seleccion ahora se organiza como galeria: primero favoritas y luego el resto, con mas aire entre prendas.</p>

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
            const selectedItem = getSelectedSlotGarment(slot, slotItems)
            const favoriteItems = slotItems.filter((garment) => garment.isFavorite)
            const regularItems = slotItems.filter((garment) => !garment.isFavorite)

            return (
              <section key={slot} className="slot-panel">
                <header>
                  <div>
                    <h3>{slot}</h3>
                    <p className="slot-summary">
                      {slotItems.length} disponible{slotItems.length === 1 ? '' : 's'}
                      {favoriteItems.length > 0 ? ` · ${favoriteItems.length} favorita${favoriteItems.length === 1 ? '' : 's'}` : ''}
                    </p>
                  </div>
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
                <div className="carousel">
                  <button type="button" className="carousel-nav" onClick={() => moveSlotSelection(slot, -1)}>
                    ◀
                  </button>
                  <article className="carousel-main">
                    {selectedItem ? (
                      <>
                        {selectedItem.imageDataUrl ? (
                          <img src={selectedItem.imageDataUrl} alt={selectedItem.name} />
                        ) : (
                          <div className="img-fallback large">Sin foto</div>
                        )}
                        <div className="badge-row">
                          <span className="badge">{selectedItem.category}</span>
                          {selectedItem.isFavorite && <span className="badge badge-favorite">Favorita</span>}
                        </div>
                        <strong>{selectedItem.category}</strong>
                        <span>{selectedItem.brand} · {selectedItem.color}</span>
                        <button type="button" onClick={() => void toggleGarmentFavorite(selectedItem)}>
                          {selectedItem.isFavorite ? 'Quitar de favoritas' : 'Guardar en favoritas'}
                        </button>
                      </>
                    ) : (
                      <p className="hint">No hay prendas limpias para este bloque.</p>
                    )}
                  </article>
                  <button type="button" className="carousel-nav" onClick={() => moveSlotSelection(slot, 1)}>
                    ▶
                  </button>
                </div>

                {slotItems.length > 0 && (
                  <div className="picker-sheet">
                    {favoriteItems.length > 0 && (
                      <section className="picker-group">
                        <div className="picker-group-header">
                          <strong>Favoritas</strong>
                          <span>{favoriteItems.length}</span>
                        </div>
                        <div className="picker-grid">
                          {favoriteItems.map((garment) => (
                            <button
                              key={garment.id}
                              type="button"
                              className={clsx('choice-card', selectedItem?.id === garment.id && 'selected')}
                              onClick={() => selectGarmentForSlot(slot, garment.id)}
                            >
                              {garment.imageDataUrl ? (
                                <img src={garment.imageDataUrl} alt={garment.name} />
                              ) : (
                                <div className="img-fallback small">Sin foto</div>
                              )}
                              <div className="choice-meta">
                                <strong>{garment.brand}</strong>
                                <span>{garment.color}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </section>
                    )}

                    {regularItems.length > 0 && (
                      <section className="picker-group">
                        <div className="picker-group-header">
                          <strong>{favoriteItems.length > 0 ? 'Mas opciones' : 'Disponibles'}</strong>
                          <span>{regularItems.length}</span>
                        </div>
                        <div className="picker-grid">
                          {regularItems.map((garment) => (
                            <button
                              key={garment.id}
                              type="button"
                              className={clsx('choice-card', selectedItem?.id === garment.id && 'selected')}
                              onClick={() => selectGarmentForSlot(slot, garment.id)}
                            >
                              {garment.imageDataUrl ? (
                                <img src={garment.imageDataUrl} alt={garment.name} />
                              ) : (
                                <div className="img-fallback small">Sin foto</div>
                              )}
                              <div className="choice-meta">
                                <strong>{garment.brand}</strong>
                                <span>{garment.color}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                )}
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
                      .map((id) => garments.find((g) => g.id === id)?.category)
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
