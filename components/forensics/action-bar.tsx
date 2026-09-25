'use client'

import { useState } from 'react'
import { Download, FileDown, Loader2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ScanDataset } from '@/lib/forensics-data'
import { restoredFileFor, triggerDownload, type Certificate } from '@/lib/pdf-sample'
import { CertificateDialog, createCertificate } from './certificate-dialog'
import type { ScanPhase } from './upload-zone'

export function ActionBar({ data, phase }: { data: ScanDataset; phase: ScanPhase }) {
  const scanning = phase === 'scanning'
  const [open, setOpen] = useState(false)
  const [certificate, setCertificate] = useState<Certificate | null>(null)

  const downloadRestored = () => {
    const { blob, fileName } = restoredFileFor(data)
    triggerDownload(blob, fileName)
  }

  const openReport = () => {
    setCertificate(createCertificate(data))
    setOpen(true)
  }

  return (
    <section
      aria-label="Actions"
      className="flex flex-col items-start justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4 sm:flex-row sm:items-center"
    >
      <div className="flex min-w-0 items-center gap-3">
        {scanning ? (
          <Loader2 className="size-5 shrink-0 animate-spin text-primary" aria-hidden="true" />
        ) : (
          <ShieldCheck className="size-5 shrink-0 text-primary" aria-hidden="true" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {scanning ? 'Reconstruction in progress…' : 'Reconstruction complete · ready for export'}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {scanning ? 'Exports unlock when the scan finishes' : `${data.fileName} · chain of custody log signed`}
          </p>
        </div>
      </div>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <Button variant="outline" size="lg" disabled={scanning} onClick={openReport}>
          <FileDown data-icon="inline-start" aria-hidden="true" />
          Export Forensic PDF Report
        </Button>
        <Button size="lg" className="font-semibold" disabled={scanning} onClick={downloadRestored}>
          <Download data-icon="inline-start" aria-hidden="true" />
          Download Restored File
        </Button>
      </div>
      <CertificateDialog open={open} onOpenChange={setOpen} data={data} certificate={certificate} />
    </section>
  )
}
