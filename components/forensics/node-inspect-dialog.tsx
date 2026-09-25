'use client'

import { BadgeCheck, CheckCircle2, Wrench, XCircle } from 'lucide-react'
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
import { formatBytes, pseudoSha256, toHex, type FragmentNode, type ScanDataset } from '@/lib/forensics-data'
import { cn } from '@/lib/utils'

type BlockState = 'ok' | 'repaired' | 'fail'

const blockStyle: Record<BlockState, { icon: typeof CheckCircle2; className: string; label: string }> = {
  ok: { icon: CheckCircle2, className: 'text-primary', label: 'match' },
  repaired: { icon: Wrench, className: 'text-info', label: 'repaired' },
  fail: { icon: XCircle, className: 'text-destructive', label: 'mismatch' },
}

function blocksFor(status: FragmentNode['status']): BlockState[] {
  if (status === 'orphan') return ['ok', 'fail', 'fail', 'repaired']
  if (status === 'partial') return ['ok', 'ok', 'repaired', 'ok']
  return ['ok', 'ok', 'ok', 'ok']
}

type NodeInspectDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  node: FragmentNode
  data: ScanDataset
}

export function NodeInspectDialog({ open, onOpenChange, node, data }: NodeInspectDialogProps) {
  const expected = pseudoSha256(`${data.sha256}:${data.kind}:${node.id}`)
  const verified = node.status !== 'orphan'
  const computed = verified ? expected : expected.slice(0, 40) + pseudoSha256(`${node.id}:drift`).slice(0, 24)
  const end = node.offset + node.size - 1
  const blocks = blocksFor(node.status)
  const blockSize = Math.ceil(node.size / blocks.length)

  const meta: [string, string][] = [
    ['Start offset', `0x${toHex(node.offset, 8)}`],
    ['End offset', `0x${toHex(end, 8)}`],
    ['Length', `${node.size.toLocaleString('en-US')} B (${formatBytes(node.size)})`],
    ['Disk sector (LBA)', (2048 + Math.floor(node.offset / 512)).toLocaleString('en-US')],
    ['Cluster (4 KiB)', `#${Math.floor(node.offset / 4096)}`],
    ['Alignment', node.offset % 4096 === 0 ? 'cluster-aligned' : `+${node.offset % 4096} B into cluster`],
    ['Carve confidence', `${node.confidence}%`],
    ['Source image', data.fileName],
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary/15 font-mono text-xs text-primary ring-1 ring-primary/40">
              {node.id}
            </span>
            {node.label} · {node.role}
          </DialogTitle>
          <DialogDescription>Byte-offset metadata and SHA-256 hash validation for this fragment.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Byte-offset metadata</p>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
            {meta.map(([k, v]) => (
              <div key={k} className="flex min-w-0 flex-col gap-0.5 bg-card px-3 py-2">
                <dt className="text-[11px] text-muted-foreground">{k}</dt>
                <dd className="truncate font-mono text-xs text-foreground" title={v}>
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
              Hash validation · SHA-256
            </p>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase',
                verified ? 'bg-primary/15 text-primary' : 'bg-destructive/15 text-destructive',
              )}
            >
              {verified ? <BadgeCheck className="size-3" aria-hidden="true" /> : <XCircle className="size-3" aria-hidden="true" />}
              {verified ? 'Verified' : 'Mismatch'}
            </span>
          </div>
          <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3 font-mono text-[11px]">
            <div>
              <p className="text-muted-foreground">Expected (acquisition index)</p>
              <p className="break-all text-foreground/90">{expected}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Computed (reconstructed fragment)</p>
              <p className="break-all">
                <span className="text-foreground/90">{computed.slice(0, 40)}</span>
                <span className={verified ? 'text-foreground/90' : 'text-destructive'}>{computed.slice(40)}</span>
              </p>
            </div>
          </div>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {blocks.map((state, i) => {
              const s = blockStyle[state]
              const Icon = s.icon
              return (
                <li key={i} className="flex flex-col gap-0.5 rounded-md border border-border px-2.5 py-2 text-[11px]">
                  <span className="font-mono text-muted-foreground">
                    0x{toHex(node.offset + i * blockSize, 6)}
                  </span>
                  <span className={cn('flex items-center gap-1 font-medium', s.className)}>
                    <Icon className="size-3" aria-hidden="true" />
                    {s.label}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
