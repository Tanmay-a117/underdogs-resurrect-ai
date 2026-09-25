import { Plus, ScanSearch } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function DashboardHeader({ onNewScan }: { onNewScan: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/30">
            <ScanSearch className="size-5 text-primary" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold tracking-tight md:text-base">
              ResurrectAI
              <span className="hidden font-normal text-muted-foreground sm:inline">
                {' - Forensic Reconstruction Workbench'}
              </span>
            </h1>
            <p className="font-mono text-[11px] text-muted-foreground">case #RX-2026-0925 · examiner: j.doe</p>
          </div>
        </div>

        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {['Workbench', 'Evidence Locker', 'Chain of Custody', 'Reports'].map((item, i) => (
            <a
              key={item}
              href="#"
              aria-current={i === 0 ? 'page' : undefined}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground"
            >
              {item}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-3">
          <div
            role="status"
            className="hidden items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 sm:flex"
          >
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
            <span className="text-xs font-medium text-primary">System Active</span>
          </div>
          <Button onClick={onNewScan} size="lg" className="font-semibold">
            <Plus data-icon="inline-start" aria-hidden="true" />
            New Scan
          </Button>
        </div>
      </div>
    </header>
  )
}
