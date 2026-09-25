'use client'

import { BadgeCheck, Download, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { pseudoSha256, type ScanDataset } from '@/lib/forensics-data'
import { buildCertificatePdf, triggerDownload, type Certificate } from '@/lib/pdf-sample'

const stamp = (d: Date) => d.toISOString().replace('T', ' ').slice(0, 19)

export function createCertificate(data: ScanDataset, now = new Date()): Certificate {
  const at = (minutesAgo: number) => stamp(new Date(now.getTime() - minutesAgo * 60_000))
  const sig = pseudoSha256(`${data.sha256}:${data.fileName}:sig`)
  return {
    id: `RX-2026-0418-${data.kind.toUpperCase()}-${sig.slice(0, 6).toUpperCase()}`,
    issuedAt: stamp(now),
    examiner: 'A. Mensah, GCFA · Digital Forensics Unit',
    tool: 'ResurrectAI Workbench 4.2 · ' + data.model.split(' · ')[0],
    signature: sig.match(/.{1,4}/g)!.slice(0, 8).join(':').toUpperCase(),
    custody: [
      { time: at(96), action: 'Evidence acquired (write-blocked)', actor: 'A. Mensah' },
      { time: at(94), action: 'SHA-256 hashed & sealed', actor: 'ResurrectAI' },
      { time: at(12), action: 'AI reconstruction on working copy', actor: 'ResurrectAI' },
      { time: at(1), action: 'Hash re-verified · match', actor: 'ResurrectAI' },
      { time: stamp(now), action: 'Certificate issued & signed', actor: 'A. Mensah' },
    ],
  }
}

type CertificateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: ScanDataset
  certificate: Certificate | null
}

export function CertificateDialog({ open, onOpenChange, data, certificate }: CertificateDialogProps) {
  if (!certificate) return null

  const download = () =>
    triggerDownload(
      new Blob([buildCertificatePdf(data, certificate)], { type: 'application/pdf' }),
      `${certificate.id}.chain-of-custody.pdf`,
    )

  const fields: [string, string][] = [
    ['Evidence item', data.fileName],
    ['Classification', data.classification],
    ['Integrity score', `${data.score}%`],
    ['Bytes analyzed', data.totalBytes.toLocaleString('en-US')],
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="items-center border-b border-border pb-4 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-primary/15 ring-1 ring-primary/40">
            <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
          </div>
          <DialogTitle className="text-lg">Forensic Chain of Custody Certificate</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            No. {certificate.id} · issued {certificate.issuedAt} UTC
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          {fields.map(([k, v]) => (
            <div key={k} className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">{k}</dt>
              <dd className="truncate font-mono text-xs text-foreground" title={v}>
                {v}
              </dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3 font-mono text-[11px]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted-foreground">SHA-256 · acquisition vs verification</span>
            <span className="inline-flex items-center gap-1 rounded bg-primary/15 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-primary uppercase">
              <BadgeCheck className="size-3" aria-hidden="true" /> Match
            </span>
          </div>
          <p className="break-all text-foreground/90">{data.sha256}</p>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Custody log</p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-[11px] text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Timestamp (UTC)</th>
                  <th scope="col" className="px-3 py-2 font-medium">Action</th>
                  <th scope="col" className="px-3 py-2 font-medium">Custodian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {certificate.custody.map((c) => (
                  <tr key={c.action}>
                    <td className="px-3 py-2 font-mono whitespace-nowrap text-muted-foreground">{c.time}</td>
                    <td className="px-3 py-2">{c.action}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{c.actor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-0.5 text-xs">
            <span className="text-muted-foreground">Certifying examiner</span>
            <span className="font-medium">{certificate.examiner}</span>
            <span className="text-muted-foreground">{certificate.tool}</span>
          </div>
          <div className="flex flex-col gap-0.5 font-mono text-[11px] sm:text-right">
            <span className="font-sans text-muted-foreground">ECDSA P-256 signature</span>
            <span className="text-primary">{certificate.signature}</span>
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
          <Button className="font-semibold" onClick={download}>
            <Download data-icon="inline-start" aria-hidden="true" />
            Download Signed PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
