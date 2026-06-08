# Rosa Closet

App web movil tipo guardarropa para subir prendas, crear outfits y gestionar disponibilidad por estado (limpia/sucia).

## Funciones principales

- Subir prendas con: categoria, marca, color, talla, notas e imagen.
- Catalogo amplio de categorias: pantalones, shorts, faldas, tops, blusas, camisas, calzado, cinturones y mas.
- Estado por prenda: limpia o sucia.
- Las prendas sucias no aparecen como disponibles en el creador de combinaciones.
- Creador de outfits por bloques con deslizamiento horizontal.
- Subida de imagen para cada outfit guardado.
- Filtros por marca, color y categoria.
- Almacenamiento local con IndexedDB (Dexie).
- Modo offline-first con PWA (service worker).

## Tecnologias

- React + TypeScript + Vite
- Dexie (IndexedDB local)
- Vite PWA (cache offline)

## Desarrollo local

```bash
npm install
npm run dev
```

## Build de produccion

```bash
npm run build
npm run preview
```

## Offline y espacio

- La app se puede usar sin internet despues de la primera carga.
- Las imagenes se comprimen automaticamente antes de guardarse para reducir uso de espacio.
- Todo se guarda en el navegador del dispositivo.
- Si borras datos del navegador, se borra el contenido local de la app.

## Subir a GitHub Pages

1. Crea un repositorio en GitHub.
2. Inicializa git en este proyecto y conecta remoto.
3. Haz push de la rama principal.
4. Publica con:

```bash
npm run deploy
```

5. En GitHub, activa Pages para la rama gh-pages si no se activa automaticamente.

## Estructura base

- src/App.tsx: UI principal (armario, combinar, outfits)
- src/db.ts: base local IndexedDB
- src/lib/image.ts: compresion de imagenes
- src/types.ts: tipos y categorias
