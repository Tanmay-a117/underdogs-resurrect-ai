import { AlertTriangle, CheckCircle2, Database, FileText, ImageIcon, Loader2 } from 'lucide-react'
import { CONTRACT_PREVIEW, JPEG_HEADER_FIELDS, type ScanDataset } from '@/lib/forensics-data'
import { cn } from '@/lib/utils'

const staggered = (i: number) => ({ animationDelay: `${i * 90}ms` })
const fadeLine = 'animate-in fade-in slide-in-from-bottom-1 fill-mode-both duration-500'

function Shell({
  icon: Icon,
  title,
  meta,
  children,
}: {
  icon: typeof FileText
  title: string
  meta: string
  children: React.ReactNode
}) {
  return (
    <section aria-label={title} className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="size-4 text-primary" aria-hidden="true" />
          {title}
        </h2>
        <span className="truncate font-mono text-[11px] text-muted-foreground">{meta}</span>
      </div>
      {children}
    </section>
  )
}

function ContractPreview() {
  return (
    <Shell icon={FileText} title="Live Text Preview" meta="reconstructed contract text · UTF-8">
      <div className="flex max-h-72 flex-col gap-2.5 overflow-y-auto bg-background/40 px-5 py-4 text-sm leading-relaxed">
        {CONTRACT_PREVIEW.map((line, i) => {
          const damaged = line.startsWith('[')
          return (
            <p
              key={i}
              style={staggered(i)}
              className={cn(
                fadeLine,
                i === 0 && 'font-semibold tracking-wide text-foreground',
                i > 0 && !damaged && 'text-foreground/85',
                damaged && 'rounded-md border border-dashed border-destructive/40 bg-destructive/5 px-2 py-1 font-mono text-xs text-destructive',
              )}
            >
              {line}
              {i === CONTRACT_PREVIEW.length - 2 && (
                <span className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 animate-pulse bg-primary" aria-hidden="true" />
              )}
            </p>
          )
        })}
      </div>
    </Shell>
  )
}

function JpegBanner() {
  return (
    <section aria-label="Image header status" className="overflow-hidden rounded-xl border border-primary/40 bg-primary/5">
      <div role="status" className="flex items-start gap-3 border-b border-primary/20 px-4 py-3.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/40">
          <ImageIcon className="size-4.5 text-primary" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-primary">
            <CheckCircle2 className="size-4" aria-hidden="true" />
            Image Header Recovered
          </p>
          <p className="text-xs text-muted-foreground">
            SOI + JFIF APP0 signature restored to{' '}
            <code className="rounded bg-muted px-1 font-mono text-foreground">FF D8 FF E0</code> · file is decodable by
            standard viewers
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-1 gap-px bg-primary/10 sm:grid-cols-2 lg:grid-cols-3">
        {JPEG_HEADER_FIELDS.map(([k, v], i) => (
          <div key={k} style={staggered(i)} className={cn(fadeLine, 'flex flex-col gap-0.5 bg-card px-4 py-2.5')}>
            <dt className="text-[11px] text-muted-foreground">{k}</dt>
            <dd className="font-mono text-xs text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function QueryLines({ data }: { data: ScanDataset }) {
  const queries = data.textLines.map((l) => l.repaired).filter((l) => l && !l.startsWith('--'))
  return (
    <Shell icon={Database} title="Extracted Query Lines" meta={`${queries.length} statements recovered`}>
      <ol className="flex max-h-72 flex-col overflow-y-auto py-1 font-mono text-xs">
        {queries.map((q, i) => {
          const suspicious = /^(UPDATE|DELETE)/.test(q)
          const verb = q.split(/[\s(]/)[0]
          return (
            <li
              key={i}
              style={staggered(i)}
              className={cn(
                fadeLine,
                'flex items-center gap-3 border-l-2 px-4 py-1.5',
                suspicious ? 'border-warning bg-warning/5' : 'border-transparent',
              )}
            >
              <span className="w-5 shrink-0 text-right text-muted-foreground/60">{i + 1}</span>
              <span
                className={cn(
                  'w-16 shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-medium',
                  suspicious ? 'bg-warning/15 text-warning' : 'bg-info/10 text-info',
                )}
              >
                {verb}
              </span>
              <span className="min-w-0 flex-1 truncate text-foreground/90" title={q}>
                {q}
              </span>
              {suspicious && (
                <AlertTriangle className="size-3.5 shrink-0 text-warning" aria-label="Flagged for review" />
              )}
            </li>
          )
        })}
      </ol>
    </Shell>
  )
}

export function RecoveryInsight({ data, scanning }: { data: ScanDataset; scanning: boolean }) {
  if (scanning) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-4 py-5 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
        AI Reconstructing Hex Signatures... recovered content will appear here.
      </div>
    )
  }
  if (data.kind === 'jpeg') return <JpegBanner />
  if (data.kind === 'db') return <QueryLines data={data} />
  return <ContractPreview />
}
