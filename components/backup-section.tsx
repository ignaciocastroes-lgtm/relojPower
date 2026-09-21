"use client"

import { useEffect, useRef, useState } from "react"
import { Download, Share2, Upload } from "lucide-react"
import {
  LAST_BACKUP_KEY,
  MAX_BACKUP_BYTES,
  backupFileName,
  countBackup,
  createBackup,
  daysSinceBackup,
  parseBackup,
  type BackupData,
  type BackupCounts,
} from "@/lib/backup"

interface BackupSectionProps {
  /** Foto actual de todos los datos (se pide al pulsar, no en cada render). */
  getData: () => BackupData
  /** Aplica la copia elegida por el usuario. */
  onRestore: (data: BackupData, mode: "merge" | "replace") => void
}

interface PendingImport {
  fileName: string
  data: BackupData
  counts: BackupCounts
  dropped: number
  exportedAt: string | null
}

const readLastBackup = (): string | null => {
  try {
    return window.localStorage.getItem(LAST_BACKUP_KEY)
  } catch {
    return null
  }
}

const describe = (c: BackupCounts) =>
  `${c.routines} ${c.routines === 1 ? "rutina" : "rutinas"}, ${c.sessions} ${c.sessions === 1 ? "sesión" : "sesiones"} y ${c.sets} ${c.sets === 1 ? "serie" : "series"}`

/** Exportar y restaurar TODOS los datos. Los datos viven solo en este navegador: sin copia, limpiar los datos del navegador los borra. */
export function BackupSection({ getData, onRestore }: BackupSectionProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null)
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null)
  const [lastBackup, setLastBackup] = useState<string | null>(null)
  const [canShare, setCanShare] = useState(false)

  useEffect(() => {
    setLastBackup(readLastBackup())
    try {
      const probe = new File(["{}"], "probe.json", { type: "application/json" })
      setCanShare(typeof navigator.canShare === "function" && typeof navigator.share === "function" && navigator.canShare({ files: [probe] }))
    } catch {
      setCanShare(false)
    }
  }, [])

  const markBackup = () => {
    const iso = new Date().toISOString()
    try {
      window.localStorage.setItem(LAST_BACKUP_KEY, iso)
    } catch {
      // sin almacenamiento: la copia se hizo igual
    }
    setLastBackup(iso)
  }

  const handleDownload = () => {
    const now = new Date()
    const data = getData()
    const blob = new Blob([createBackup(data, now)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = backupFileName(now)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
    markBackup()
    setStatus({ kind: "ok", text: `Copia descargada: ${describe(countBackup(data))}.` })
  }

  const handleShare = async () => {
    const now = new Date()
    const data = getData()
    const file = new File([createBackup(data, now)], backupFileName(now), { type: "application/json" })
    try {
      await navigator.share({ files: [file], title: "Copia de POWERLOCK" })
      markBackup()
      setStatus({ kind: "ok", text: "Copia compartida." })
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setStatus({ kind: "error", text: "No se pudo compartir la copia. Usa «Descargar copia»." })
    }
  }

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = "" // permite elegir el mismo archivo otra vez
    if (!file) return
    setStatus(null)
    setPendingImport(null)
    if (file.size > MAX_BACKUP_BYTES) {
      setStatus({ kind: "error", text: "El archivo es demasiado grande para ser una copia de POWERLOCK." })
      return
    }
    let text: string
    try {
      text = await file.text()
    } catch {
      setStatus({ kind: "error", text: "No se pudo leer el archivo." })
      return
    }
    const parsed = parseBackup(text)
    if (!parsed.ok) {
      setStatus({ kind: "error", text: parsed.error })
      return
    }
    setPendingImport({ fileName: file.name, data: parsed.data, counts: parsed.counts, dropped: parsed.dropped, exportedAt: parsed.exportedAt })
  }

  const apply = (mode: "merge" | "replace") => {
    if (!pendingImport) return
    if (mode === "replace") {
      const now = describe(countBackup(getData()))
      if (!window.confirm(`Se borrará todo lo actual (${now}) y se sustituirá por la copia. ¿Continuar?`)) return
    }
    onRestore(pendingImport.data, mode)
    setStatus({ kind: "ok", text: `${mode === "merge" ? "Copia combinada" : "Copia restaurada"}: ${describe(pendingImport.counts)}.` })
    setPendingImport(null)
  }

  const counts = countBackup(getData())
  const hasData = counts.routines + counts.sessions + counts.sets > 0
  const days = daysSinceBackup(lastBackup, new Date())

  return (
    <div data-testid="backup-section">
      <p className="text-xs text-muted-foreground" data-testid="backup-last">
        {lastBackup === null ? "Todavía no has hecho ninguna copia." : days === 0 ? "Última copia: hoy." : `Última copia: hace ${days} ${days === 1 ? "día" : "días"}.`}
        {hasData && (days === null || days > 30) && " Conviene hacer una: si borras los datos del navegador se pierde todo."}
      </p>

      <div className="mt-3 grid gap-2">
        <button onClick={handleDownload} data-testid="backup-download" className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-secondary font-semibold text-foreground hover:bg-secondary/80">
          <Download className="w-4 h-4" aria-hidden="true" />
          Descargar copia
        </button>
        {canShare && (
          <button onClick={handleShare} data-testid="backup-share" className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-secondary font-semibold text-foreground hover:bg-secondary/80">
            <Share2 className="w-4 h-4" aria-hidden="true" />
            Compartir copia
          </button>
        )}
        <button onClick={() => fileRef.current?.click()} data-testid="backup-restore" className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-secondary font-semibold text-foreground hover:bg-secondary/80">
          <Upload className="w-4 h-4" aria-hidden="true" />
          Restaurar copia…
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={handleFile} className="hidden" data-testid="backup-file" aria-label="Archivo de copia de seguridad" />
      </div>

      {pendingImport && (
        <div className="mt-3 rounded-2xl border border-primary/30 bg-primary/10 p-4" data-testid="backup-preview">
          <p className="text-sm font-semibold text-foreground">Copia lista para restaurar</p>
          <p className="mt-1 text-xs text-muted-foreground break-words">
            {pendingImport.fileName}
            {pendingImport.exportedAt && ` · creada el ${new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(new Date(pendingImport.exportedAt))}`}
          </p>
          <p className="mt-2 text-sm text-foreground">{describe(pendingImport.counts)}.</p>
          {pendingImport.dropped > 0 && <p className="mt-1 text-xs text-yellow-300">{pendingImport.dropped} elemento(s) dañado(s) se omitirán.</p>}
          <div className="mt-3 grid gap-2">
            <button onClick={() => apply("merge")} data-testid="backup-merge" className="min-h-12 rounded-xl bg-primary font-bold text-primary-foreground">
              Combinar con lo que tengo
            </button>
            <button onClick={() => apply("replace")} data-testid="backup-replace" className="min-h-12 rounded-xl bg-secondary font-semibold text-destructive">
              Reemplazar todo
            </button>
            <button onClick={() => setPendingImport(null)} className="min-h-10 text-xs text-muted-foreground underline">
              Cancelar
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-muted-foreground">«Combinar» añade lo que falte sin borrar nada. «Reemplazar» sustituye todo lo actual por la copia.</p>
        </div>
      )}

      {status && (
        <p role="status" data-testid="backup-status" className={`mt-3 text-sm ${status.kind === "ok" ? "text-primary" : "text-red-300"}`}>
          {status.text}
        </p>
      )}
    </div>
  )
}
