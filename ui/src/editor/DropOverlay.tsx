import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from 'sonner'
import { ipcErrorMessage } from '@/lib/ipc'

const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')

export function DropOverlay({ onText, disabled }: { onText: (text: string, source: string) => void; disabled: boolean }) {
  const [over, setOver] = useState(false)
  const depth = useRef(0)
  const onTextRef = useRef(onText)
  onTextRef.current = onText

  useEffect(() => {
    const enter = (e: DragEvent) => {
      if (!hasFiles(e) || disabled) return
      e.preventDefault()
      depth.current++
      setOver(true)
    }
    const overH = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = disabled ? 'none' : 'copy'
    }
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth.current = Math.max(0, depth.current - 1)
      if (!depth.current) setOver(false)
    }
    const drop = async (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth.current = 0
      setOver(false)
      if (disabled) return
      const file = e.dataTransfer?.files?.[0]
      if (!file) return
      if (!/\.(csv|txt|tsv)$/i.test(file.name)) {
        toast.error('Не вдалося відкрити файл', { description: 'Підходять файли .csv або .txt.' })
        return
      }
      try {
        onTextRef.current(await file.text(), file.name)
      } catch (err) {
        toast.error('Не вдалося відкрити файл', { description: ipcErrorMessage(err) })
      }
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragover', overH)
    window.addEventListener('dragleave', leave)
    window.addEventListener('drop', drop)
    return () => {
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragover', overH)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('drop', drop)
    }
  }, [disabled])

  return (
    <AnimatePresence>
      {over ? (
        <motion.div
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.12 } }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          className="pointer-events-none fixed inset-4 z-[60] grid place-items-center rounded-xl border-2 border-dashed border-ring bg-background/95"
        >
          <p className="text-title">Відпустіть, щоб імпортувати CSV</p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
