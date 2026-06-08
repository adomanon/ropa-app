type ImageTransformOptions = {
  rotation?: number
  removeWhiteBackground?: boolean
}

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

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('No se pudo leer la imagen.'))
    image.src = dataUrl
  })
}

export async function processImageForWardrobe(
  dataUrl: string,
  options: ImageTransformOptions = {},
): Promise<string> {
  const image = await loadImage(dataUrl)
  const rotation = ((options.rotation ?? 0) % 360 + 360) % 360
  const rotated = rotation === 90 || rotation === 270
  const canvas = document.createElement('canvas')
  canvas.width = rotated ? image.height : image.width
  canvas.height = rotated ? image.width : image.height

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('No se pudo procesar la imagen.')
  }

  context.save()
  context.translate(canvas.width / 2, canvas.height / 2)

  if (rotation) {
    context.rotate((rotation * Math.PI) / 180)
  }

  context.drawImage(image, -image.width / 2, -image.height / 2)
  context.restore()

  if (options.removeWhiteBackground) {
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
    const { data } = imageData

    for (let index = 0; index < data.length; index += 4) {
      const red = data[index]
      const green = data[index + 1]
      const blue = data[index + 2]

      const isNearWhite = red > 245 && green > 245 && blue > 245
      const isLowContrast = Math.max(red, green, blue) - Math.min(red, green, blue) < 16

      if (isNearWhite && isLowContrast) {
        data[index + 3] = 0
      }
    }

    context.putImageData(imageData, 0, 0)
  }

  return canvas.toDataURL('image/webp', 0.82)
}
