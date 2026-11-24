export interface ZipFile {
  name: string
  data: Uint8Array
}

const UTF8 = new TextEncoder()
const UTF8_FLAG = 0x0800
const DOS_DATE = 0x0021 // 1980-01-01, the ZIP epoch
const DOS_TIME = 0

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let value = n
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1)
    }
    table[n] = value >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff]
  }
  return (crc ^ 0xffffffff) >>> 0
}

function zipBlobPart(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

/**
 * Builds a standards-compliant ZIP using the STORE method (no recompression).
 * PNGs are already compressed, so deflating them again would waste CPU and
 * usually produce little or no size reduction.
 */
export function createCarouselZip(files: ZipFile[]): Blob {
  if (files.length === 0) throw new Error('No hay diapositivas para exportar.')
  if (files.length > 0xffff) throw new Error('El ZIP supera el máximo de archivos permitido.')

  const localParts: BlobPart[] = []
  const centralParts: Uint8Array[] = []
  let localOffset = 0
  let centralSize = 0

  for (const file of files) {
    const name = UTF8.encode(file.name)
    if (name.length === 0 || name.length > 0xffff) {
      throw new Error('Nombre de archivo no válido para el ZIP.')
    }
    if (file.data.byteLength > 0xffffffff) {
      throw new Error('Una diapositiva supera el tamaño máximo permitido.')
    }

    const checksum = crc32(file.data)
    const size = file.data.byteLength

    const localHeader = new Uint8Array(30 + name.length)
    const localView = new DataView(localHeader.buffer)
    localView.setUint32(0, 0x04034b50, true)
    localView.setUint16(4, 20, true)
    localView.setUint16(6, UTF8_FLAG, true)
    localView.setUint16(8, 0, true)
    localView.setUint16(10, DOS_TIME, true)
    localView.setUint16(12, DOS_DATE, true)
    localView.setUint32(14, checksum, true)
    localView.setUint32(18, size, true)
    localView.setUint32(22, size, true)
    localView.setUint16(26, name.length, true)
    localView.setUint16(28, 0, true)
    localHeader.set(name, 30)

    const centralHeader = new Uint8Array(46 + name.length)
    const centralView = new DataView(centralHeader.buffer)
    centralView.setUint32(0, 0x02014b50, true)
    centralView.setUint16(4, 20, true)
    centralView.setUint16(6, 20, true)
    centralView.setUint16(8, UTF8_FLAG, true)
    centralView.setUint16(10, 0, true)
    centralView.setUint16(12, DOS_TIME, true)
    centralView.setUint16(14, DOS_DATE, true)
    centralView.setUint32(16, checksum, true)
    centralView.setUint32(20, size, true)
    centralView.setUint32(24, size, true)
    centralView.setUint16(28, name.length, true)
    centralView.setUint16(30, 0, true)
    centralView.setUint16(32, 0, true)
    centralView.setUint16(34, 0, true)
    centralView.setUint16(36, 0, true)
    centralView.setUint32(38, 0, true)
    centralView.setUint32(42, localOffset, true)
    centralHeader.set(name, 46)

    localParts.push(zipBlobPart(localHeader), zipBlobPart(file.data))
    centralParts.push(centralHeader)
    localOffset += localHeader.byteLength + size
    centralSize += centralHeader.byteLength
  }

  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054b50, true)
  endView.setUint16(4, 0, true)
  endView.setUint16(6, 0, true)
  endView.setUint16(8, files.length, true)
  endView.setUint16(10, files.length, true)
  endView.setUint32(12, centralSize, true)
  endView.setUint32(16, localOffset, true)
  endView.setUint16(20, 0, true)

  return new Blob([...localParts, ...centralParts.map(zipBlobPart), zipBlobPart(end)], {
    type: 'application/zip',
  })
}
