export const BYTES_PER_ROW = 8

export type SampleKind = 'pdf' | 'jpeg' | 'db'

export type HexRow = {
  offset: number
  original: number[]
  repaired: number[]
  fixed: boolean[]
}

export type TextLine = { original: string; repaired: string; fixed: boolean }

export type Tone = 'primary' | 'info' | 'destructive'
export type BreakdownItem = { label: string; value: number; tone: Tone }

export type ScanDataset = {
  kind: SampleKind
  fileName: string
  classification: string
  signature: string
  repairedBytes: number[]
  hexRows: HexRow[]
  textLines: TextLine[]
  patchedByteCount: number
  patchedRowCount: number
  score: number
  preRepairScore: number
  totalBytes: number
  breakdown: BreakdownItem[]
  sha256: string
  model: string
}

const ascii = (s: string) => Array.from(s, (ch) => ch.charCodeAt(0) & 0xff)
const hex = (s: string) => s.trim().split(/\s+/).map((h) => parseInt(h, 16))

const NOISE = [0x00, 0xff, 0x3f, 0xde, 0xad, 0x1a, 0x00, 0xff]

function scatterCorruptions(length: number, count: number, seed: number, protect = 0): Record<number, number> {
  const result: Record<number, number> = {}
  let state = seed
  while (Object.keys(result).length < count) {
    state = (state * 1103515245 + 12345) % 2 ** 31
    const index = protect + (state % (length - protect))
    const burst = 1 + (state % 3)
    for (let i = index; i < Math.min(length, index + burst); i++) {
      result[i] = NOISE[(state >> 4) % NOISE.length]
    }
  }
  return result
}

const bytesToText = (bytes: number[]) =>
  bytes.map((b) => (b === 0x0a ? '\n' : b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '\u00b7')).join('')

function buildBytes(repairedBytes: number[], corruptions: Record<number, number>) {
  const corruptedBytes = repairedBytes.map((b, i) => (i in corruptions ? corruptions[i] : b))

  const hexRows: HexRow[] = Array.from({ length: Math.ceil(repairedBytes.length / BYTES_PER_ROW) }, (_, r) => {
    const start = r * BYTES_PER_ROW
    const original = corruptedBytes.slice(start, start + BYTES_PER_ROW)
    const repaired = repairedBytes.slice(start, start + BYTES_PER_ROW)
    return { offset: start, original, repaired, fixed: repaired.map((b, i) => b !== original[i]) }
  })

  const o = bytesToText(corruptedBytes).split('\n')
  const textLines: TextLine[] = bytesToText(repairedBytes)
    .split('\n')
    .map((line, i) => ({ original: o[i] ?? '', repaired: line, fixed: line !== o[i] }))

  return {
    repairedBytes,
    hexRows,
    textLines,
    patchedByteCount: repairedBytes.filter((b, i) => b !== corruptedBytes[i]).length,
    patchedRowCount: hexRows.filter((r) => r.fixed.some(Boolean)).length,
  }
}

function breakdownFor(total: number, intactRatio: number, reconstructedRatio: number): BreakdownItem[] {
  const intact = Math.round(total * intactRatio)
  const reconstructed = Math.round(total * reconstructedRatio)
  return [
    { label: 'Intact bytes', value: intact, tone: 'primary' },
    { label: 'AI-reconstructed', value: reconstructed, tone: 'info' },
    { label: 'Unrecoverable', value: Math.max(0, total - intact - reconstructed), tone: 'destructive' },
  ]
}

const PDF_SOURCE = [
  '%PDF-1.7',
  '%\u00e2\u00e3\u00cf\u00d3',
  '1 0 obj',
  '<< /Type /Catalog /Pages 2 0 R /Metadata 7 0 R >>',
  'endobj',
  '2 0 obj',
  '<< /Type /Pages /Kids [3 0 R] /Count 4 >>',
  'endobj',
  '3 0 obj',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>',
  'endobj',
  '4 0 obj',
  '<< /Length 1840 /Filter /FlateDecode >>',
  'stream',
  'BT /F1 14 Tf 72 720 Td (MASTER SERVICES AGREEMENT v2) Tj ET',
  'endstream',
  'endobj',
  'xref',
  '0 8',
].join('\n')

const JPEG_BYTES = hex(`
  FF D8 FF E0 00 10 4A 46 49 46 00 01 01 01 00 48 00 48 00 00
  FF E1 00 3A 45 78 69 66 00 00 4D 4D 00 2A 00 00 00 08 00 02
  01 0F 00 02 00 00 00 06 00 00 00 26 01 32 00 02 00 00 00 14
  00 00 00 2C 43 61 6E 6F 6E 00 32 30 32 36 3A 30 39 3A 31 34
  20 32 31 3A 34 32 3A 30 37 00
  FF DB 00 43 00 10 0B 0C 0E 0C 0A 10 0E 0D 0E 12 11 10 13 18 28 1A 18 16 16 18 31 23 25 1D 28 3A 33
  3D 3C 39 33 38 37 40 48 5C 4E 40 44 57 45 37 38 50 6D 51 57 5F 62 67 68 67 3E 4D 71 79 70 64 78 5C
  65 67 63
  FF C0 00 11 08 0B B8 0F A0 03 01 22 00 02 11 01 03 11 01
  FF C4 00 1F 00 00 01 05 01 01 01 01 01 01 00 00 00 00 00 00 00 00 01 02 03 04 05 06 07 08 09 0A 0B
  FF DA 00 0C 03 01 00 02 11 03 11 00 3F 00 F9 FE 8A 28 A2 80 0A 28 A2 80
`)

const SQL_SOURCE = [
  '-- ResurrectAI SQL cluster recovery: users_dump.bin',
  'PRAGMA foreign_keys=OFF;',
  'BEGIN TRANSACTION;',
  'CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, role TEXT, last_login TEXT);',
  "INSERT INTO users VALUES(1042,'j.okafor@halcyon.io','finance_admin','2026-08-14 09:12');",
  "INSERT INTO users VALUES(1187,'m.reyes@halcyon.io','approver','2026-08-02 17:48');",
  "INSERT INTO users VALUES(2210,'vendor7731@proton.me','external','2026-08-09 03:21');",
  "UPDATE users SET role='approver' WHERE id=2210;",
  'DELETE FROM audit_log WHERE actor_id=2210;',
  'COMMIT;',
].join('\n')

type SampleTemplate = Omit<
  ScanDataset,
  'repairedBytes' | 'hexRows' | 'textLines' | 'patchedByteCount' | 'patchedRowCount'
> & { build: () => ReturnType<typeof buildBytes> }

const TEMPLATES: Record<SampleKind, SampleTemplate> = {
  pdf: {
    kind: 'pdf',
    fileName: 'contract_v2.corrupted',
    classification: 'PDF / Document Fragment',
    signature: '25 50 44 46 2D 31 2E 37',
    score: 88,
    preRepairScore: 61,
    totalBytes: 2_457_600,
    breakdown: [
      { label: 'Intact bytes', value: 2_162_688, tone: 'primary' },
      { label: 'AI-reconstructed', value: 221_184, tone: 'info' },
      { label: 'Unrecoverable', value: 73_728, tone: 'destructive' },
    ],
    sha256: '9f2c4e81a7d3b06c5e1f8a2d4b9c7e03f6a1d8b25c4e9f07a3b6d1c8e2f5a904',
    model: 'resurrect-struct-v4 · entropy Δ -0.37',
    build: () =>
      buildBytes(ascii(PDF_SOURCE), {
        1: 0x00, 2: 0x00, 3: 0xff, 17: 0x3f, 18: 0x3f, 30: 0x00, 31: 0x00, 32: 0x00, 47: 0xde, 48: 0xad,
        88: 0x00, 89: 0x00, 90: 0x00, 131: 0xff, 132: 0xff, 190: 0x1a, 191: 0x1a, 192: 0x1a, 251: 0x00,
        252: 0x00, 300: 0x3f, 301: 0x3f, 302: 0x3f, 360: 0x00, 361: 0x00,
      }),
  },
  jpeg: {
    kind: 'jpeg',
    fileName: 'evidence_photo.dat',
    classification: 'JPEG / Image Header',
    signature: 'FF D8 FF E0',
    score: 92,
    preRepairScore: 12,
    totalBytes: 4_718_592,
    breakdown: breakdownFor(4_718_592, 0.86, 0.1),
    sha256: '3b7e0a19c4f2d85e6a1b93c07d4e2f68a5c1b8d0e3f7a29c6b4d1e8f0a2c5b73',
    model: 'resurrect-vision-v2 · marker realignment',
    build: () =>
      buildBytes(JPEG_BYTES, {
        0: 0x00, 1: 0x00, 2: 0x00, 3: 0x00, 6: 0x3f, 7: 0x3f, 8: 0x3f, 9: 0x3f, 20: 0x00, 21: 0x00,
        98: 0x00, 99: 0x00, 110: 0xde, 111: 0xad, 145: 0xff, 146: 0xff, 167: 0x00, 168: 0x00, 172: 0x00,
        173: 0x00, 186: 0x1a, 187: 0x1a, 222: 0x00, 223: 0x00,
      }),
  },
  db: {
    kind: 'db',
    fileName: 'users_dump.bin',
    classification: 'SQL / Database Cluster',
    signature: '2D 2D 20 52 65 73 75 72',
    score: 74,
    preRepairScore: 38,
    totalBytes: 8_388_608,
    breakdown: breakdownFor(8_388_608, 0.62, 0.12),
    sha256: 'c81d5f3a0e9b27c46f18a3d5e0b92c7f41a6e8d3b05f9c2a7e14d6b8f3c0a95e',
    model: 'resurrect-sql-v3 · page checksum repair',
    build: () => buildBytes(ascii(SQL_SOURCE), scatterCorruptions(SQL_SOURCE.length, 60, 7731, 4)),
  },
}

export const SAMPLE_OPTIONS: { kind: SampleKind; label: string; fileName: string }[] = [
  { kind: 'pdf', label: 'PDF Document Fragment', fileName: TEMPLATES.pdf.fileName },
  { kind: 'jpeg', label: 'JPEG Photo Header', fileName: TEMPLATES.jpeg.fileName },
  { kind: 'db', label: 'Database Cluster', fileName: TEMPLATES.db.fileName },
]

export function buildDataset(
  kind: SampleKind,
  overrides?: { fileName?: string; totalBytes?: number; sha256?: string | null },
): ScanDataset {
  const { build, ...template } = TEMPLATES[kind]
  const totalBytes = overrides?.totalBytes || template.totalBytes
  const intactShare = template.breakdown[0].value / template.totalBytes
  const reconstructedShare = template.breakdown[1].value / template.totalBytes
  return {
    ...template,
    ...build(),
    fileName: overrides?.fileName ?? template.fileName,
    totalBytes,
    breakdown: overrides?.totalBytes ? breakdownFor(totalBytes, intactShare, reconstructedShare) : template.breakdown,
    sha256: overrides?.sha256 ?? template.sha256,
  }
}

export const baselineDataset = buildDataset('pdf')

export function detectKind(fileName: string, head: Uint8Array): SampleKind {
  if (head[0] === 0xff && head[1] === 0xd8) return 'jpeg'
  const text = new TextDecoder().decode(head).toUpperCase()
  if (text.startsWith('%PDF')) return 'pdf'
  if (/SQLITE|CREATE |INSERT |PRAGMA|--/.test(text)) return 'db'
  const name = fileName.toLowerCase()
  if (name.endsWith('.dat') || /jpe?g|photo|img/.test(name)) return 'jpeg'
  if (name.endsWith('.bin') || /sql|db|dump/.test(name)) return 'db'
  return 'pdf'
}

export const CONTRACT_PREVIEW = [
  'MASTER SERVICES AGREEMENT — VERSION 2',
  'This Agreement is entered into on 02 August 2026 between Halcyon Freight Ltd. ("Client") and Northwind Logistics LLC ("Vendor").',
  '1. Scope. Vendor shall provide freight brokerage and customs clearance services as described in Schedule A.',
  '2. Fees. Client shall pay USD 48,210.00 per quarter, remitted to the account ending in 7731.',
  '3. Term. This Agreement commences on the Effective Date and continues for twenty-four (24) months.',
  '4. Confidentiality. Each party shall protect the other party’s Confidential Information with reasonable care.',
  '[Signature block — 212 bytes unrecoverable, visual reconstruction not attempted]',
]

export const JPEG_HEADER_FIELDS: [string, string][] = [
  ['SOI marker', 'FF D8 · restored'],
  ['APP0 segment', 'JFIF 1.01 · 72 × 72 dpi'],
  ['EXIF APP1', 'Canon · 2026:09:14 21:42:07'],
  ['Frame (SOF0)', '4000 × 3000 · 3 components'],
  ['Quant tables', 'DQT luminance · re-seated'],
  ['Scan data', 'SOS aligned at 0x0000E7'],
]

export const toHex = (n: number, pad = 2) => n.toString(16).toUpperCase().padStart(pad, '0')
export const toAscii = (b: number) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.')

export type FragmentNode = {
  id: string
  label: string
  role: string
  offset: number
  size: number
  x: number
  y: number
  status: 'root' | 'recovered' | 'partial' | 'orphan'
  confidence: number
}

const NODE_LAYOUT = [
  { id: 'A', x: 80, y: 170, status: 'root', confidence: 99 },
  { id: 'B', x: 230, y: 80, status: 'recovered', confidence: 96 },
  { id: 'C', x: 230, y: 260, status: 'recovered', confidence: 93 },
  { id: 'D', x: 390, y: 60, status: 'partial', confidence: 81 },
  { id: 'E', x: 390, y: 200, status: 'recovered', confidence: 90 },
  { id: 'F', x: 530, y: 130, status: 'recovered', confidence: 94 },
  { id: 'G', x: 530, y: 290, status: 'orphan', confidence: 42 },
] as const

const NODE_ROLES: Record<SampleKind, [string, number, number][]> = {
  pdf: [
    ['PDF Header', 0x0, 4096],
    ['Catalog Object', 0x1000, 12288],
    ['Page Tree', 0x4000, 8192],
    ['Content Stream', 0xa000, 655360],
    ['Font Resources', 0xb2000, 98304],
    ['XRef Table', 0x250000, 2048],
    ['Embedded Image', 0x1c4000, 1153434],
  ],
  jpeg: [
    ['SOI / JFIF APP0', 0x0, 20],
    ['EXIF APP1', 0x14, 60],
    ['Quant Tables', 0x5e, 69],
    ['Huffman Tables', 0xb6, 33],
    ['SOF0 Frame', 0xa3, 19],
    ['Scan Data', 0xe7, 4_587_520],
    ['Thumbnail', 0x460000, 131072],
  ],
  db: [
    ['Page 1 Header', 0x0, 4096],
    ['Schema Table', 0x1000, 4096],
    ['users B-tree', 0x2000, 262144],
    ['Index Pages', 0x42000, 131072],
    ['Freelist Pages', 0x62000, 65536],
    ['WAL Frames', 0x72000, 524288],
    ['audit_log (dropped)', 0x5f0000, 1048576],
  ],
}

export function fragmentNodesFor(kind: SampleKind): FragmentNode[] {
  return NODE_LAYOUT.map((n, i) => {
    const [role, offset, size] = NODE_ROLES[kind][i]
    return { ...n, label: `Fragment ${n.id}`, role, offset, size }
  })
}

export type FragmentLink = { from: string; to: string; weak?: boolean }

export const fragmentLinks: FragmentLink[] = [
  { from: 'A', to: 'B' },
  { from: 'A', to: 'C' },
  { from: 'B', to: 'D' },
  { from: 'C', to: 'E' },
  { from: 'D', to: 'F' },
  { from: 'E', to: 'F' },
  { from: 'C', to: 'G', weak: true },
]

export function pseudoSha256(seed: string): string {
  let h1 = 0x6a09e667 ^ seed.length
  let h2 = 0xbb67ae85
  let out = ''
  for (let round = 0; round < 8; round++) {
    for (let i = 0; i < seed.length; i++) {
      const c = seed.charCodeAt(i) + round * 31
      h1 = Math.imul(h1 ^ c, 2654435761)
      h2 = Math.imul(h2 ^ c, 1597334677)
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
    out += (h1 >>> 0).toString(16).padStart(8, '0')
  }
  return out
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}
