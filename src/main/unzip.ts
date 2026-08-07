import { promises as fs } from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { promisify } from 'node:util'

const inflateRaw = promisify(zlib.inflateRaw)

const EOCD_SIG = 0x06054b50
const CD_SIG = 0x02014b50
const LFH_SIG = 0x04034b50

interface CentralEntry {
  name: string
  method: number
  compressedSize: number
  uncompressedSize: number
  localHeaderOffset: number
}

/**
 * Minimal ZIP extractor supporting the only two methods real-world zips use for
 * text/asset payloads: stored (0) and deflate (8). Keeps course-pack import
 * dependency-free.
 */
export async function extractZip(zipPath: string, destDir: string): Promise<void> {
  const buf = await fs.readFile(zipPath)

  const eocd = findEocd(buf)
  if (eocd < 0) throw new Error('Not a valid .zip archive')

  const entryCount = buf.readUInt16LE(eocd + 10)
  let offset = buf.readUInt32LE(eocd + 16)

  const entries: CentralEntry[] = []
  for (let i = 0; i < entryCount; i++) {
    if (buf.readUInt32LE(offset) !== CD_SIG) throw new Error('Corrupt zip central directory')
    const method = buf.readUInt16LE(offset + 10)
    const compressedSize = buf.readUInt32LE(offset + 20)
    const uncompressedSize = buf.readUInt32LE(offset + 24)
    const nameLen = buf.readUInt16LE(offset + 28)
    const extraLen = buf.readUInt16LE(offset + 30)
    const commentLen = buf.readUInt16LE(offset + 32)
    const localHeaderOffset = buf.readUInt32LE(offset + 42)
    const name = buf.toString('utf8', offset + 46, offset + 46 + nameLen)
    entries.push({ name, method, compressedSize, uncompressedSize, localHeaderOffset })
    offset += 46 + nameLen + extraLen + commentLen
  }

  const destRoot = path.resolve(destDir)
  for (const entry of entries) {
    const normalised = entry.name.replace(/\\/g, '/')
    if (normalised.endsWith('/')) continue

    // Zip-slip guard.
    const target = path.resolve(destRoot, normalised)
    if (!target.startsWith(destRoot + path.sep)) {
      throw new Error(`Archive entry escapes destination: ${entry.name}`)
    }

    const lfh = entry.localHeaderOffset
    if (buf.readUInt32LE(lfh) !== LFH_SIG) throw new Error('Corrupt zip local header')
    const nameLen = buf.readUInt16LE(lfh + 26)
    const extraLen = buf.readUInt16LE(lfh + 28)
    const dataStart = lfh + 30 + nameLen + extraLen
    const raw = buf.subarray(dataStart, dataStart + entry.compressedSize)

    let contents: Buffer
    if (entry.method === 0) {
      contents = Buffer.from(raw)
    } else if (entry.method === 8) {
      contents = Buffer.from(await inflateRaw(raw))
    } else {
      throw new Error(`Unsupported compression method ${entry.method} in ${entry.name}`)
    }

    if (entry.uncompressedSize && contents.length !== entry.uncompressedSize) {
      throw new Error(`Size mismatch extracting ${entry.name}`)
    }

    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, contents)
  }
}

function findEocd(buf: Buffer): number {
  const min = Math.max(0, buf.length - 0xffff - 22)
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) return i
  }
  return -1
}
