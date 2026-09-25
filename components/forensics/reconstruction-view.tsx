'use client'

import { useState } from 'react'
import { Binary, FileText, Sparkles } from 'lucide-react'
import { toAscii, toHex, type HexRow, type ScanDataset } from '@/lib/forensics-data'
import { cn } from '@/lib/utils'

type Mode = 'hex' | 'text'

function PendingCell({ offset }: { offset: number }) {
  return (
    <div className="flex items-center gap-3 border-l-2 border-transparent px-3 py-1 font-mono text-xs leading-5">
      <span className="w-12 shrink-0 text-muted-foreground/70">{toHex(offset, 6)}</span>
      <span className="flex animate-pulse gap-1.5 text-muted-foreground/50">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i}>{'··'}</span>
        ))}
      </span>
    </div>
  )
}

function HexCell({ row, side }: { row: HexRow; side: 'original' | 'repaired' }) {
  const bytes = row[side]
  const rowFixed = row.fixed.some(Boolean)
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-1 font-mono text-xs leading-5',
        rowFixed && side === 'repaired' && 'border-l-2 border-primary bg-primary/10',
        rowFixed && side === 'original' && 'border-l-2 border-destructive/70 bg-destructive/5',
        !rowFixed && 'border-l-2 border-transparent',
      )}
    >
      <span className="w-12 shrink-0 text-muted-foreground/70">{toHex(row.offset, 6)}</span>
      <span className="flex gap-1.5">
        {bytes.map((b, i) => (
          <span
            key={i}
            className={cn(
              row.fixed[i] && side === 'original' && 'text-destructive',
              row.fixed[i] && side === 'repaired' && 'font-semibold text-primary',
              !row.fixed[i] && 'text-foreground/85',
            )}
          >
            {toHex(b)}
          </span>
        ))}
      </span>
      <span className="ml-auto w-16 shrink-0 tracking-wider text-muted-foreground">
        {bytes.map((b, i) => (
          <span
            key={i}
            className={cn(
              row.fixed[i] && side === 'original' && 'text-destructive',
              row.fixed[i] && side === 'repaired' && 'text-primary',
            )}
          >
            {toAscii(b)}
          </span>
        ))}
      </span>
    </div>
  )
}

type ReconstructionViewProps = { data: ScanDataset; scanning: boolean; restored: boolean }

export function ReconstructionView({ data, scanning, restored }: ReconstructionViewProps) {
  const [mode, setMode] = useState<Mode>('hex')
  const { hexRows, textLines, patchedByteCount, patchedRowCount } = data

  return (
    <section
      aria-labelledby="reconstruction-heading"
      className="flex flex-col overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 id="reconstruction-heading" className="flex items-center gap-2 text-sm font-semibold">
            Reconstruction View
            {restored && (
              <span className="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] font-medium text-primary uppercase">
                Patched
              </span>
            )}
          </h2>
          <p className="truncate text-xs text-muted-foreground">
            {data.fileName} ·{' '}
            {scanning ? 'reconstructing byte stream…' : `${patchedByteCount} bytes patched across ${patchedRowCount} rows`}
          </p>
        </div>
        <div role="tablist" aria-label="Viewer mode" className="flex rounded-lg bg-muted p-0.5">
          {(
            [
              { id: 'hex', label: 'Hex', icon: Binary },
              { id: 'text', label: 'Text', icon: FileText },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={mode === id}
              onClick={() => setMode(id)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                mode === id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-x-auto">
        <div className="min-w-[680px]">
          <div className="grid grid-cols-2 border-b border-border bg-muted/40 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
            <div className="flex items-center gap-2 px-4 py-2">
              <span className="size-1.5 rounded-full bg-destructive" aria-hidden="true" />
              Original Corrupted Bytes
            </div>
            <div className="flex items-center gap-2 border-l border-border px-4 py-2">
              <Sparkles className="size-3 text-primary" aria-hidden="true" />
              AI-Repaired Output
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto py-1">
            {mode === 'hex'
              ? hexRows.map((row) => (
                  <div key={row.offset} className="grid grid-cols-2">
                    <HexCell row={row} side="original" />
                    <div className="border-l border-border">
                      {scanning ? <PendingCell offset={row.offset} /> : <HexCell row={row} side="repaired" />}
                    </div>
                  </div>
                ))
              : textLines.map((line, i) => (
                  <div key={i} className="grid grid-cols-2 font-mono text-xs leading-6">
                    <div
                      className={cn(
                        'flex gap-3 border-l-2 px-3',
                        line.fixed ? 'border-destructive/70 bg-destructive/5 text-destructive' : 'border-transparent',
                      )}
                    >
                      <span className="w-6 shrink-0 text-right text-muted-foreground/60">{i + 1}</span>
                      <span className="truncate">{line.original || ' '}</span>
                    </div>
                    <div
                      className={cn(
                        'flex gap-3 border-l-2 px-3',
                        line.fixed ? 'border-primary bg-primary/10 text-primary' : 'border-transparent',
                      )}
                    >
                      <span className="w-6 shrink-0 text-right text-muted-foreground/60">
                        {line.fixed ? '+' : i + 1}
                      </span>
                      <span className="truncate">{line.repaired || ' '}</span>
                    </div>
                  </div>
                ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-destructive/70" aria-hidden="true" /> Corrupted byte
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-primary" aria-hidden="true" /> AI fix applied
        </span>
        <span className="ml-auto font-mono">model: {data.model}</span>
      </div>
    </section>
  )
}
