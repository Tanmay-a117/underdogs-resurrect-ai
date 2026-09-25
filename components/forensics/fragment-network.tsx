'use client'

import { useState } from 'react'
import { Network, ScanSearch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatBytes, fragmentLinks, fragmentNodesFor, toHex, type FragmentNode, type ScanDataset } from '@/lib/forensics-data'
import { cn } from '@/lib/utils'
import { NodeInspectDialog } from './node-inspect-dialog'

const statusStyle: Record<FragmentNode['status'], { fill: string; stroke: string; label: string; dot: string }> = {
  root: { fill: 'fill-primary/20', stroke: 'stroke-primary', label: 'Root', dot: 'bg-primary' },
  recovered: { fill: 'fill-info/15', stroke: 'stroke-info', label: 'Recovered', dot: 'bg-info' },
  partial: { fill: 'fill-warning/15', stroke: 'stroke-warning', label: 'Partial', dot: 'bg-warning' },
  orphan: { fill: 'fill-destructive/15', stroke: 'stroke-destructive', label: 'Orphan', dot: 'bg-destructive' },
}

export function FragmentNetwork({ data, scanning }: { data: ScanDataset; scanning: boolean }) {
  const fragmentNodes = fragmentNodesFor(data.kind)
  const nodeById = Object.fromEntries(fragmentNodes.map((n) => [n.id, n]))
  const [selectedId, setSelectedId] = useState('A')
  const [inspecting, setInspecting] = useState(false)
  const selected = nodeById[selectedId]
  const connected = new Set(
    fragmentLinks.flatMap((l) => (l.from === selectedId ? [l.to] : l.to === selectedId ? [l.from] : [])),
  )

  return (
    <section aria-labelledby="network-heading" className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Network className="size-4 text-muted-foreground" aria-hidden="true" />
          <div>
            <h2 id="network-heading" className="text-sm font-semibold">
              Relationship Network
            </h2>
            <p className="text-xs text-muted-foreground">
              {fragmentNodes.length} fragments · {fragmentLinks.length} structural links resolved
            </p>
          </div>
        </div>
        <ul className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          {Object.values(statusStyle).map((s) => (
            <li key={s.label} className="flex items-center gap-1.5">
              <span className={cn('size-2 rounded-full', s.dot)} aria-hidden="true" />
              {s.label}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid lg:grid-cols-[1fr_280px]">
        <div
          className="relative bg-[radial-gradient(circle,var(--color-border)_1px,transparent_1px)] [background-size:18px_18px]"
        >
          <svg viewBox="0 0 610 350" className="mx-auto h-auto max-h-[380px] w-full" role="group" aria-label="Fragment relationship graph">
            {fragmentLinks.map((link) => {
              const a = nodeById[link.from]
              const b = nodeById[link.to]
              const active = link.from === selectedId || link.to === selectedId
              return (
                <line
                  key={`${link.from}-${link.to}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  strokeWidth={active ? 2 : 1.25}
                  strokeDasharray={link.weak ? '5 5' : undefined}
                  className={cn(
                    'transition-all',
                    active ? (link.weak ? 'stroke-destructive' : 'stroke-primary') : 'stroke-muted-foreground/30',
                  )}
                />
              )
            })}
            {fragmentNodes.map((node) => {
              const s = statusStyle[node.status]
              const isSelected = node.id === selectedId
              const dim = !isSelected && !connected.has(node.id)
              return (
                <g
                  key={node.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${node.label}, ${node.role}, ${node.confidence}% confidence`}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedId(node.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelectedId(node.id)
                    }
                  }}
                  className={cn('cursor-pointer outline-none transition-opacity', dim && 'opacity-45')}
                >
                  {isSelected && (
                    <circle cx={node.x} cy={node.y} r={30} className={cn('fill-none opacity-40', s.stroke)} strokeWidth={1} />
                  )}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={22}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    className={cn(s.fill, s.stroke, 'transition-all')}
                  />
                  <text
                    x={node.x}
                    y={node.y + 5}
                    textAnchor="middle"
                    className="fill-foreground font-mono text-[14px] font-semibold"
                  >
                    {node.id}
                  </text>
                  <text
                    x={node.x}
                    y={node.y + 42}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[11px]"
                  >
                    {node.role}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        <aside
          aria-live="polite"
          className="flex flex-col gap-4 border-t border-border p-4 lg:border-t-0 lg:border-l"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{selected.label}</p>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium',
              )}
            >
              <span className={cn('size-1.5 rounded-full', statusStyle[selected.status].dot)} aria-hidden="true" />
              {statusStyle[selected.status].label}
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-xs">
            {[
              ['Role', selected.role],
              ['Size', formatBytes(selected.size)],
              ['Offset', `0x${toHex(selected.offset, 8)}`],
              ['Confidence', `${selected.confidence}%`],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-mono text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-medium tracking-wider text-muted-foreground uppercase">Linked to</p>
            <ul className="flex flex-col gap-1.5">
              {[...connected].map((id) => {
                const n = nodeById[id]
                const weak = fragmentLinks.some(
                  (l) => l.weak && ((l.from === id && l.to === selectedId) || (l.to === id && l.from === selectedId)),
                )
                return (
                  <li key={id}>
                    <button
                      onClick={() => setSelectedId(id)}
                      className="flex w-full items-center justify-between rounded-md bg-muted/60 px-2.5 py-1.5 text-left text-xs transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span>
                        <span className="font-mono text-foreground">{`${selected.id} → ${n.id}`}</span>
                        <span className="ml-2 text-muted-foreground">{n.role}</span>
                      </span>
                      <span className={cn('font-mono', weak ? 'text-destructive' : 'text-primary')}>
                        {weak ? 'weak' : 'linked'}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
          <Button variant="outline" className="mt-auto w-full" disabled={scanning} onClick={() => setInspecting(true)}>
            <ScanSearch data-icon="inline-start" aria-hidden="true" />
            Inspect Fragment Node
          </Button>
        </aside>
      </div>
      <NodeInspectDialog open={inspecting} onOpenChange={setInspecting} node={selected} data={data} />
    </section>
  )
}
