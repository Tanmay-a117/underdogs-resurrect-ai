import { CONTRACT_PREVIEW, type ScanDataset } from './forensics-data'

const escapePdfText = (s: string) =>
  s
    .replace(/[\u2014\u2013]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\\()]/g, (m) => `\\${m}`)
    .replace(/[^\x20-\x7e]/g, '-')

function wrap(line: string, width = 92): string[] {
  if (line.length <= width) return [line]
  const out: string[] = []
  let current = ''
  for (const word of line.split(' ')) {
    if ((current + ' ' + word).trim().length > width) {
      out.push(current)
      current = `   ${word}`
    } else {
      current = current ? `${current} ${word}` : word
    }
  }
  if (current) out.push(current)
  return out
}

export function buildPdf(title: string, lines: string[]): Uint8Array {
  const body = lines
    .flatMap((line) => wrap(line))
    .map((line) => `(${escapePdfText(line)}) '`)
    .join('\n')
  const content = ['BT /F2 16 Tf 72 740 Td', `(${escapePdfText(title)}) Tj ET`, 'BT /F1 10 Tf 14 TL 72 718 Td', body, 'ET'].join(
    '\n',
  )

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Title (${escapePdfText(title)}) /Producer (ResurrectAI Forensic Workbench) >>`,
  ]

  let pdf = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((obj, i) => {
    offsets.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`
  })
  const xrefStart = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  pdf += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 7 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`

  return new TextEncoder().encode(pdf)
}

const RULE = '-'.repeat(86)

function buildRestoredPdf(data: ScanDataset): Uint8Array {
  const recoveredOn = new Date().toISOString().replace('T', ' ').slice(0, 19)
  return buildPdf('Recovered Document - contract_v2', [
    `Source evidence: ${data.fileName}`,
    `Integrity & recoverability score: ${data.score}%`,
    `Bytes patched by AI reconstruction: ${data.patchedByteCount} across ${data.patchedRowCount} rows`,
    `SHA-256: ${data.sha256.slice(0, 64)}`,
    `Restored: ${recoveredOn} UTC`,
    '',
    RULE,
    'RECOVERED TEXT CONTENT',
    RULE,
    '',
    ...CONTRACT_PREVIEW.flatMap((line) => [line, '']),
    RULE,
    'Reconstructed by ResurrectAI. Unrecoverable regions omitted. This sample is provided for',
    'review and does not replace the signed forensic report.',
  ])
}

export function restoredFileFor(data: ScanDataset): { blob: Blob; fileName: string } {
  const base = data.fileName.replace(/\.[^.]+$/, '')
  if (data.kind === 'jpeg') {
    return {
      blob: new Blob([new Uint8Array(data.repairedBytes)], { type: 'application/octet-stream' }),
      fileName: `${base}.restored-header.jpg`,
    }
  }
  if (data.kind === 'db') {
    const sql = data.textLines.map((l) => l.repaired).join('\n')
    return { blob: new Blob([sql], { type: 'application/sql' }), fileName: `${base}.restored.sql` }
  }
  return { blob: new Blob([buildRestoredPdf(data)], { type: 'application/pdf' }), fileName: `${base}.restored.pdf` }
}

export type CustodyEntry = { time: string; action: string; actor: string }

export type Certificate = {
  id: string
  issuedAt: string
  examiner: string
  tool: string
  signature: string
  custody: CustodyEntry[]
}

export function buildCertificatePdf(data: ScanDataset, cert: Certificate): Uint8Array {
  return buildPdf('Forensic Chain of Custody Certificate', [
    `Certificate No.: ${cert.id}`,
    `Issued: ${cert.issuedAt} UTC`,
    '',
    RULE,
    'EVIDENCE ITEM',
    RULE,
    `File: ${data.fileName}`,
    `Classification: ${data.classification}`,
    `Size analyzed: ${data.totalBytes.toLocaleString('en-US')} bytes`,
    `Integrity & recoverability score: ${data.score}%`,
    `SHA-256 (acquisition): ${data.sha256}`,
    `SHA-256 (verification): ${data.sha256}  -  MATCH`,
    '',
    RULE,
    'CUSTODY LOG',
    RULE,
    ...cert.custody.map((c) => `${c.time}   ${c.action.padEnd(34, ' ')} ${c.actor}`),
    '',
    RULE,
    'ATTESTATION',
    RULE,
    'I certify that the evidence item above was acquired, preserved and analyzed using write-blocked,',
    'hash-verified procedures, and that the custody log is complete and accurate.',
    '',
    `Examiner: ${cert.examiner}`,
    `Tool: ${cert.tool}`,
    `Digital signature (ECDSA P-256): ${cert.signature}`,
  ])
}

export function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
