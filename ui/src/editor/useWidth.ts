import { useEffect, useState } from 'react'

export function useWindowWidth() {
  const [w, setW] = useState(() => window.innerWidth)
  useEffect(() => {
    const on = () => setW(window.innerWidth)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return w
}

export const BP = { dock: 1180, wide: 960, settingsNav: 1100 } as const
