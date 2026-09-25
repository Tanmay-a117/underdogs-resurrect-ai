import { Database, FileText, Fingerprint, ImageIcon, TrendingUp } from 'lucide-react'
import type { SampleKind, ScanDataset } from '@/lib/forensics-data'
import { cn } from '@/lib/utils'

const KIND_ICON: Record<SampleKind, typeof FileText> = { pdf: FileText, jpeg: ImageIcon, db: Database }

function scoreLevel(score: number) {
  if (score >= 90) return { label: 'Very High', text: 'text-primary', stroke: 'stroke-primary', glow: 'var(--color-primary)' }
  if (score >= 80) return { label: 'High', text: 'text-primary', stroke: 'stroke-primary', glow: 'var(--color-primary)' }
  return { label: 'Moderate', text: 'text-warning', stroke: 'stroke-warning', glow: 'var(--color-warning)' }
}

const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const toneClass = {
  primary: { bar: 'bg-primary', text: 'text-primary' },
  info: { bar: 'bg-info', text: 'text-info' },
  destructive: { bar: 'bg-destructive', text: 'text-destructive' },
}

const fmt = new Intl.NumberFormat('en-US')

type IntegrityPanelProps = { data: ScanDataset; scanning: boolean }

export function IntegrityPanel({ data, scanning }: IntegrityPanelProps) {
  const { score: SCORE, breakdown: byteBreakdown, totalBytes: TOTAL_BYTES } = data
  const delta = SCORE - data.preRepairScore
  const level = scoreLevel(SCORE)
  const KindIcon = KIND_ICON[data.kind]
  return (
    <section
      aria-labelledby="integrity-heading"
      className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5"
    >
      <div className="flex flex-col items-start gap-3">
        <div>
          <h2 id="integrity-heading" className="text-sm font-semibold">
            Metadata & Integrity
          </h2>
          <p className="text-xs text-muted-foreground">Post-reconstruction assessment</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-info/30 bg-info/10 px-2 py-1 text-xs font-medium text-info">
          <KindIcon className="size-3.5" aria-hidden="true" />
          {data.classification}
        </span>
      </div>

      <div className="flex flex-col items-center gap-3">
        <div
          className={cn('relative size-40 transition-opacity', scanning && 'animate-pulse opacity-60')}
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={SCORE}
          aria-label="Integrity and recoverability score"
        >
          <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
            <circle cx="60" cy="60" r={RADIUS} fill="none" strokeWidth="9" className="stroke-muted" />
            <circle
              cx="60"
              cy="60"
              r={RADIUS}
              fill="none"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - SCORE / 100)}
              style={{ filter: `drop-shadow(0 0 8px ${level.glow})` }}
              className={cn(level.stroke, 'transition-[stroke-dashoffset,stroke] duration-1000')}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-semibold tabular-nums tracking-tight">
              {SCORE}
              <span className="text-xl text-muted-foreground">%</span>
            </span>
            <span className={cn('text-[10px] font-medium tracking-widest uppercase', level.text)}>
              {scanning ? 'Scanning' : level.label}
            </span>
          </div>
        </div>
        <p className="text-center text-sm font-medium">Integrity & Recoverability Score</p>
        {delta > 0 && !scanning && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[11px] text-primary">
            <TrendingUp className="size-3" aria-hidden="true" />+{delta} pts after AI patching (was {data.preRepairScore}%)
          </span>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex h-2 overflow-hidden rounded-full bg-muted">
          {byteBreakdown.map((item) => (
            <div
              key={item.label}
              className={cn(toneClass[item.tone].bar, 'transition-[width] duration-700')}
              style={{ width: `${(item.value / TOTAL_BYTES) * 100}%` }}
            />
          ))}
        </div>
        <dl className="flex flex-col divide-y divide-border">
          {byteBreakdown.map((item) => (
            <div key={item.label} className="flex items-center justify-between py-2 text-sm">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <span className={cn('size-2 rounded-full', toneClass[item.tone].bar)} aria-hidden="true" />
                {item.label}
              </dt>
              <dd className="flex items-baseline gap-2 font-mono text-xs">
                <span className="text-foreground">{fmt.format(item.value)} B</span>
                <span className={cn('w-10 text-right', toneClass[item.tone].text)}>
                  {((item.value / TOTAL_BYTES) * 100).toFixed(0)}%
                </span>
              </dd>
            </div>
          ))}
          <div className="flex items-center justify-between py-2 text-sm">
            <dt className="font-medium">Total analyzed</dt>
            <dd className="font-mono text-xs">{fmt.format(TOTAL_BYTES)} B</dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-col gap-1.5 rounded-lg bg-muted/50 p-3 font-mono text-[11px]">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Fingerprint className="size-3.5" aria-hidden="true" /> SHA-256 (evidence)
        </div>
        <p className="break-all text-foreground/90">{data.sha256}</p>
      </div>
    </section>
  )
}
