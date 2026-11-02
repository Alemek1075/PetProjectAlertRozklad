import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react'

export function naturalHeight(header: HTMLElement | null, content: HTMLElement | null): number {
  if (!header || !content) return 0
  return Math.ceil(header.offsetHeight + content.scrollHeight)
}

export function useReportHeight(headerRef: RefObject<HTMLElement | null>, contentRef: RefObject<HTMLElement | null>) {
  const last = useRef(0)

  const send = useCallback(() => {
    const h = naturalHeight(headerRef.current, contentRef.current)
    if (h && Math.abs(h - last.current) >= 2) {
      last.current = h
      window.api.popupHeight(h)
    }
  }, [headerRef, contentRef])

  useLayoutEffect(() => {
    const header = headerRef.current
    const content = contentRef.current
    if (!header || !content) return
    let raf = 0
    const measure = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(send)
    }
    const ro = new ResizeObserver(measure)
    ro.observe(header)
    ro.observe(content)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [headerRef, contentRef, send])

  return send
}
