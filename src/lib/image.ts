export async function fileToOptimizedDataUrl(file: File): Promise<string> {
  const imageBitmap = await createImageBitmap(file)

  const maxSide = 1280
  const ratio = Math.min(1, maxSide / Math.max(imageBitmap.width, imageBitmap.height))
  const width = Math.max(1, Math.round(imageBitmap.width * ratio))
  const height = Math.max(1, Math.round(imageBitmap.height * ratio))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('No se pudo procesar la imagen.')
  }

  context.drawImage(imageBitmap, 0, 0, width, height)

  return canvas.toDataURL('image/webp', 0.78)
}
