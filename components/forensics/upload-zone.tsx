'use client'

import { useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileText,
  FileWarning,
  FlaskConical,
  HardDriveUpload,
  ImageIcon,
  Loader2,
  ScanLine,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SAMPLE_OPTIONS, type SampleKind } from '@/lib/forensics-data'
import { cn } from '@/lib/utils'

const ACCEPTED = ['.bin', '.dat', '.corrupted']

export type ScanPhase = 'idle' | 'scanning' | 'complete'

type QueuedFile = { id: string; name: string; size: number }

const STAGES = [
  { until: 35, label: 'Matching magic numbers & file carving signatures' },
  { until: 70, label: 'Rebuilding structure tables & offset maps' },
  { until: 101, label: 'Patching corrupted byte ranges with AI reconstruction' },
]

const SAMPLE_ICONS: Record<SampleKind, typeof FileText> = { pdf: FileText, jpeg: ImageIcon, db: Database }

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

type UploadZoneProps = {
  phase: ScanPhase
  progress: number
  activeFile: string | null
  sampleKind: SampleKind | null
  onScan: (file: File) => void
  onLoadSample: (kind: SampleKind) => void
}

export function UploadZone({ phase, progress, activeFile, sampleKind, onScan, onLoadSample }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [files, setFiles] = useState<QueuedFile[]>([])
  const [rejected, setRejected] = useState<string[]>([])
  const scanning = phase === 'scanning'

  const addFiles = (list: FileList | null) => {
    if (!list || scanning) return
    const accepted: File[] = []
    const bad: string[] = []
    for (const file of Array.from(list)) {
      if (ACCEPTED.some((ext) => file.name.toLowerCase().endsWith(ext))) accepted.push(file)
      else bad.push(file.name)
    }
    setRejected(bad)
    if (accepted.length === 0) return
    setFiles((prev) => {
      const next = accepted
        .map((f) => ({ id: `${f.name}-${f.size}-${f.lastModified}`, name: f.name, size: f.size }))
        .filter((f) => !prev.some((p) => p.id === f.id))
      return [...prev, ...next]
    })
    onScan(accepted[0])
  }

  const stage = STAGES.find((s) => progress < s.until) ?? STAGES[STAGES.length - 1]

  return (
    <section aria-labelledby="upload-heading" className="flex flex-col gap-3">
      <h2 id="upload-heading" className="sr-only">
        Upload evidence
      </h2>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!scanning) setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          addFiles(e.dataTransfer.files)
        }}
        className={cn(
          'relative flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors md:flex-row md:justify-between md:text-left',
          isDragging && 'border-primary bg-primary/5',
          scanning && 'border-primary/60 bg-primary/5',
          !isDragging && !scanning && 'border-border bg-card/50 hover:border-muted-foreground/40',
        )}
      >
        <div className="flex flex-col items-center gap-4 md:flex-row">
          <div
            className={cn(
              'flex size-14 items-center justify-center rounded-xl ring-1 transition-colors',
              isDragging || scanning ? 'bg-primary/15 ring-primary/40' : 'bg-muted ring-border',
            )}
          >
            {scanning ? (
              <ScanLine className="size-6 animate-pulse text-primary" aria-hidden="true" />
            ) : (
              <HardDriveUpload
                className={cn('size-6', isDragging ? 'text-primary' : 'text-muted-foreground')}
                aria-hidden="true"
              />
            )}
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-base font-medium text-balance">
              {isDragging ? 'Release to ingest evidence' : 'Drop raw disk dumps or corrupted fragments here'}
            </p>
            <p className="text-sm text-muted-foreground">
              Accepted formats:{' '}
              {ACCEPTED.map((ext) => (
                <code key={ext} className="mx-0.5 rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                  {ext}
                </code>
              ))}{' '}
              · SHA-256 hashed on ingest · max 64 GB
            </p>
          </div>
        </div>
        <Button variant="outline" size="lg" disabled={scanning} onClick={() => inputRef.current?.click()}>
          {scanning ? <Loader2 data-icon="inline-start" className="animate-spin" aria-hidden="true" /> : null}
          {scanning ? 'Scanning…' : 'Browse files'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED.join(',')}
          className="sr-only"
          tabIndex={-1}
          aria-label="Upload disk dump or corrupted file fragments"
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <FlaskConical className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div>
            <p id="sample-label" className="text-sm font-medium">
              Load Sample Corrupted File
            </p>
            <p className="text-xs text-muted-foreground">No evidence handy? Run the pipeline on a predefined fragment.</p>
          </div>
        </div>
        <Select
          value={sampleKind}
          onValueChange={(value) => value && onLoadSample(value as SampleKind)}
          disabled={scanning}
        >
          <SelectTrigger aria-labelledby="sample-label" className="h-9 w-full sm:w-80">
            <SelectValue>
              {(value: SampleKind | null) => {
                const option = SAMPLE_OPTIONS.find((o) => o.kind === value)
                if (!option) return <span className="text-muted-foreground">Choose a sample file…</span>
                const Icon = SAMPLE_ICONS[option.kind]
                return (
                  <>
                    <Icon className="size-4 text-primary" aria-hidden="true" />
                    <span>{option.label}</span>
                    <span className="truncate font-mono text-xs text-muted-foreground">{option.fileName}</span>
                  </>
                )
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SAMPLE_OPTIONS.map((option) => {
              const Icon = SAMPLE_ICONS[option.kind]
              return (
                <SelectItem key={option.kind} value={option.kind}>
                  <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                  <span className="flex flex-col">
                    <span>{option.label}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">{option.fileName}</span>
                  </span>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </div>

      {phase !== 'idle' && (
        <div
          className="flex flex-col gap-2.5 rounded-xl border border-border bg-card px-4 py-3"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              {scanning ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
              )}
              <p className="truncate text-sm font-medium">
                {scanning ? 'AI Reconstructing Hex Signatures...' : 'Scan complete · reconstruction applied'}
              </p>
            </div>
            <span className="font-mono text-xs tabular-nums text-primary">{Math.round(progress)}%</span>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Scan progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
          >
            <div
              className="h-full rounded-full bg-primary shadow-[0_0_12px_var(--color-primary)]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="truncate font-mono text-[11px] text-muted-foreground">
            {activeFile} · {scanning ? stage.label : 'patched bytes written to restored output'}
          </p>
        </div>
      )}

      {rejected.length > 0 && (
        <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="size-4" aria-hidden="true" />
          Unsupported format skipped: {rejected.join(', ')}
        </p>
      )}

      {files.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {files.map((file) => {
            const isActive = file.name === activeFile
            const status = isActive ? (scanning ? 'scanning' : phase === 'complete' ? 'restored' : 'queued') : 'queued'
            return (
              <li key={file.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
                {status === 'restored' ? (
                  <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
                ) : (
                  <FileWarning className="size-4 shrink-0 text-warning" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-xs">{file.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatSize(file.size)} ·{' '}
                    {status === 'restored' ? 'restored' : status === 'scanning' ? 'analyzing…' : 'queued for analysis'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={status === 'scanning'}
                  aria-label={`Remove ${file.name}`}
                  onClick={() => setFiles((prev) => prev.filter((f) => f.id !== file.id))}
                >
                  <X aria-hidden="true" />
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
