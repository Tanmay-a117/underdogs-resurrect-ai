'use client'

import { useEffect, useRef, useState } from 'react'
import {
  SAMPLE_OPTIONS,
  baselineDataset,
  buildDataset,
  detectKind,
  type SampleKind,
  type ScanDataset,
} from '@/lib/forensics-data'
import { ActionBar } from './action-bar'
import { DashboardHeader } from './dashboard-header'
import { FragmentNetwork } from './fragment-network'
import { IntegrityPanel } from './integrity-panel'
import { ReconstructionView } from './reconstruction-view'
import { RecoveryInsight } from './recovery-insight'
import { UploadZone, type ScanPhase } from './upload-zone'

const SCAN_DURATION_MS = 2000
const MAX_HASH_BYTES = 128 * 1024 ** 2

async function sha256Hex(file: File): Promise<string | null> {
  if (file.size > MAX_HASH_BYTES || !crypto?.subtle) return null
  try {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return null
  }
}

export function Dashboard() {
  const [scanId, setScanId] = useState(0)
  const [phase, setPhase] = useState<ScanPhase>('idle')
  const [progress, setProgress] = useState(0)
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [sampleKind, setSampleKind] = useState<SampleKind | null>('pdf')
  const [dataset, setDataset] = useState<ScanDataset>(baselineDataset)
  const frameRef = useRef<number | null>(null)
  const tokenRef = useRef(0)

  const cancelScan = () => {
    tokenRef.current++
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
  }

  useEffect(() => cancelScan, [])

  const runScan = (fileName: string, resolve: Promise<ScanDataset>) => {
    cancelScan()
    const token = tokenRef.current
    setActiveFile(fileName)
    setPhase('scanning')
    setProgress(0)

    const startedAt = performance.now()
    const tick = async (now: number) => {
      if (token !== tokenRef.current) return
      const ratio = Math.min(1, (now - startedAt) / SCAN_DURATION_MS)
      setProgress(ratio * 100)
      if (ratio < 1) {
        frameRef.current = requestAnimationFrame(tick)
        return
      }
      frameRef.current = null
      const next = await resolve
      if (token !== tokenRef.current) return
      setDataset(next)
      setPhase('complete')
    }
    frameRef.current = requestAnimationFrame(tick)
  }

  const scanFile = (file: File) => {
    setSampleKind(null)
    runScan(
      file.name,
      (async () => {
        const head = new Uint8Array(await file.slice(0, 32).arrayBuffer())
        const kind = detectKind(file.name, head)
        return buildDataset(kind, { fileName: file.name, totalBytes: file.size, sha256: await sha256Hex(file) })
      })(),
    )
  }

  const loadSample = (kind: SampleKind) => {
    const option = SAMPLE_OPTIONS.find((o) => o.kind === kind)
    if (!option) return
    setSampleKind(kind)
    runScan(option.fileName, Promise.resolve(buildDataset(kind)))
  }

  const resetScan = () => {
    cancelScan()
    setPhase('idle')
    setProgress(0)
    setActiveFile(null)
    setSampleKind('pdf')
    setDataset(baselineDataset)
    setScanId((id) => id + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const scanning = phase === 'scanning'

  return (
    <>
      <DashboardHeader onNewScan={resetScan} />
      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-6">
        <UploadZone
          key={scanId}
          phase={phase}
          progress={progress}
          activeFile={activeFile}
          sampleKind={sampleKind}
          onScan={scanFile}
          onLoadSample={loadSample}
        />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-w-0 flex-col gap-6">
            <ReconstructionView data={dataset} scanning={scanning} restored={phase === 'complete'} />
            <RecoveryInsight key={`${dataset.kind}-${scanId}-${phase}`} data={dataset} scanning={scanning} />
          </div>
          <IntegrityPanel data={dataset} scanning={scanning} />
        </div>
        <FragmentNetwork data={dataset} scanning={scanning} />
        <ActionBar data={dataset} phase={phase} />
      </main>
    </>
  )
}
