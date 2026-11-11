import { drawRoundRect } from '@/components/admin/SocialMedia/services/canvas/primitives'

export interface PremiumEditorialContent {
  title: string
  category: string | null
  status: string | null
  summary: string | null
  publishedAt: string | null
  readMinutes: number
  location: string | null
}

function fittedLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = []
  let line = ''

  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    if (ctx.measureText(word).width > maxWidth) {
      if (line) lines.push(line)
      line = ''
      let fragment = ''
      for (const character of Array.from(word)) {
        if (fragment && ctx.measureText(fragment + character).width > maxWidth) {
          lines.push(fragment)
          fragment = character
        } else {
          fragment += character
        }
      }
      line = fragment
      continue
    }

    const candidate = line ? `${line} ${word}` : word
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate
    } else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines
}

function limitedLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  maxWidth: number,
  maxLines: number,
): string[] {
  if (lines.length <= maxLines) return lines
  const visible = lines.slice(0, maxLines)
  let lastLine = visible[maxLines - 1]
  while (lastLine && ctx.measureText(`${lastLine}…`).width > maxWidth) {
    lastLine = lastLine.slice(0, -1).trimEnd()
  }
  visible[maxLines - 1] = `${lastLine}…`
  return visible
}

function drawPill(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  options: { filled?: boolean; maxWidth?: number } = {},
) {
  const { filled = false, maxWidth = 390 } = options
  const height = 48
  const padX = 20
  let fontSize = 21
  ctx.font = `700 ${fontSize}px Arial`
  while (fontSize > 15 && ctx.measureText(text).width + padX * 2 > maxWidth) {
    fontSize -= 1
    ctx.font = `700 ${fontSize}px Arial`
  }
  const width = Math.min(maxWidth, ctx.measureText(text).width + padX * 2)

  ctx.fillStyle = filled ? color : '#171A22'
  drawRoundRect(ctx, x, y, width, height, height / 2)
  if (!filled) {
    ctx.strokeStyle = '#343946'
    ctx.lineWidth = 2
    ctx.stroke()
  }
  ctx.fillStyle = filled ? '#FFFFFF' : color
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.font = `700 ${fontSize}px Arial`
  ctx.fillText(text, x + padX, y + height / 2, width - padX * 2)
  return width
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
  const drawWidth = image.naturalWidth * scale
  const drawHeight = image.naturalHeight * scale
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(x, y, width, height, 24)
  ctx.clip()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight)
  ctx.restore()
}

export function renderPremiumEditorial(
  ctx: CanvasRenderingContext2D,
  content: PremiumEditorialContent,
  accent: string,
  featuredImage: HTMLImageElement | null,
  brandLogo: HTMLImageElement | null,
) {
  const width = 1080
  const height = 1350
  const margin = 72

  ctx.fillStyle = '#10131B'
  ctx.fillRect(0, 0, width, height)

  ctx.strokeStyle = '#292E39'
  ctx.lineWidth = 2
  ctx.strokeRect(24, 24, width - 48, height - 48)

  if (content.category) {
    drawPill(ctx, content.category.toLocaleUpperCase('es-CO'), margin, 56, accent, { maxWidth: 430 })
  }
  if (content.status) {
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.font = '700 19px Arial'
    ctx.fillStyle = '#C6CAD3'
    ctx.fillText(content.status.toLocaleUpperCase('es-CO'), width - margin, 80, 260)
    ctx.textAlign = 'left'
  }

  const imageX = margin
  const imageY = 142
  const imageWidth = width - margin * 2
  const imageHeight = 510
  ctx.fillStyle = '#191D27'
  drawRoundRect(ctx, imageX, imageY, imageWidth, imageHeight, 24)
  if (featuredImage) drawCover(ctx, featuredImage, imageX, imageY, imageWidth, imageHeight)

  ctx.fillStyle = accent
  drawRoundRect(ctx, margin, 704, 132, 9, 5)

  let titleFontSize = 70
  let titleLines: string[] = []
  while (titleFontSize >= 48) {
    ctx.font = `800 ${titleFontSize}px Arial`
    titleLines = fittedLines(ctx, content.title, width - margin * 2)
    if (titleLines.length <= 3) break
    titleFontSize -= 4
  }
  titleLines = limitedLines(ctx, titleLines, width - margin * 2, 3)
  const titleLineHeight = titleFontSize * 1.13
  ctx.fillStyle = '#F7F7F8'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.font = `800 ${titleFontSize}px Arial`
  titleLines.forEach((line, index) => {
    ctx.fillText(line, margin, 744 + index * titleLineHeight)
  })

  const summaryLines = content.summary
    ? limitedLines(ctx, fittedLines(ctx, content.summary, width - margin * 2), width - margin * 2, 2)
    : []
  const summaryY = Math.max(970, 744 + titleLines.length * titleLineHeight + 20)
  if (summaryLines.length) {
    ctx.fillStyle = '#C2C5CE'
    ctx.font = '400 30px Arial'
    summaryLines.forEach((line, index) => {
      ctx.fillText(line, margin, summaryY + index * 39)
    })
  }

  const metadata: string[] = []
  if (content.publishedAt) {
    const date = new Date(content.publishedAt)
    if (!Number.isNaN(date.getTime())) {
      metadata.push(new Intl.DateTimeFormat('es-CO', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
        timeZone: 'America/Bogota',
      }).format(date))
    }
  }
  if (content.readMinutes > 0) metadata.push(`${content.readMinutes} min de lectura`)
  if (content.location) metadata.push(content.location)

  const metadataY = 1174
  ctx.fillStyle = '#B5B9C3'
  ctx.font = '500 22px Arial'
  ctx.textBaseline = 'middle'
  let metadataX = margin
  for (const item of metadata) {
    const available = width - margin * 2 - (metadataX - margin)
    const textWidth = ctx.measureText(item).width
    if (textWidth > available) break
    if (metadataX > margin) {
      ctx.fillStyle = '#555B67'
      ctx.fillRect(metadataX, metadataY - 12, 2, 24)
      metadataX += 20
      ctx.fillStyle = '#B5B9C3'
    }
    ctx.fillText(item, metadataX, metadataY, available)
    metadataX += textWidth + 20
  }

  ctx.fillStyle = accent
  ctx.font = '700 25px Arial'
  ctx.textBaseline = 'middle'
  ctx.fillText('Leer noticia  →', margin, 1266)
  ctx.fillStyle = accent
  ctx.fillRect(margin, 1292, 200, 2)

  if (brandLogo) {
    const maxWidth = 180
    const maxHeight = 52
    const scale = Math.min(maxWidth / brandLogo.naturalWidth, maxHeight / brandLogo.naturalHeight)
    ctx.drawImage(brandLogo, width - margin - brandLogo.naturalWidth * scale, 1236, brandLogo.naturalWidth * scale, brandLogo.naturalHeight * scale)
  }
}
