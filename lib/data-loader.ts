import { FIELDS_PER_VESSEL, HEADER_BYTES, MAGIC } from './constants'
import type { VesselIndex } from './types'

export async function loadYear(year: number): Promise<{
  buffer: Float32Array
  count: number
  index: VesselIndex
}> {
  const [binRes, idxRes] = await Promise.all([
    fetch(`/data/vessels-${year}.bin`),
    fetch(`/data/index-${year}.json`),
  ])

  if (!binRes.ok) throw new Error(`Failed to fetch vessels-${year}.bin: ${binRes.status}`)
  if (!idxRes.ok) throw new Error(`Failed to fetch index-${year}.json: ${idxRes.status}`)

  const arrayBuffer = await binRes.arrayBuffer()
  const header = new DataView(arrayBuffer, 0, HEADER_BYTES)

  const magic = header.getUint32(0, true)
  if (magic !== MAGIC) {
    throw new Error(`Invalid binary: expected magic 0x${MAGIC.toString(16)}, got 0x${magic.toString(16)}`)
  }

  const count = header.getUint32(8, true)
  const fields = header.getUint32(12, true)
  if (fields !== FIELDS_PER_VESSEL) {
    throw new Error(`Expected ${FIELDS_PER_VESSEL} fields, got ${fields}`)
  }

  const buffer = new Float32Array(arrayBuffer, HEADER_BYTES, count * FIELDS_PER_VESSEL)
  const index: VesselIndex = await idxRes.json()

  return { buffer, count, index }
}
