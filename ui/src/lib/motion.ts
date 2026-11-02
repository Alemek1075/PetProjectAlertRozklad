import type { Transition } from 'motion/react'

export const spring = {
  snappy:   { type: 'spring', stiffness: 520, damping: 42 },
  layout:   { type: 'spring', stiffness: 450, damping: 40 },
  enter:    { type: 'spring', stiffness: 420, damping: 38 },
  progress: { type: 'spring', stiffness: 180, damping: 30 },
  digit:    { type: 'spring', stiffness: 380, damping: 34 },
  pop:      { type: 'spring', stiffness: 600, damping: 34 },
  sheet:    { type: 'spring', stiffness: 380, damping: 38 },
} as const satisfies Record<string, Transition>

export const tween = {
  fade:    { duration: 0.15, ease: [0.2, 0, 0, 1] },
  fadeOut: { duration: 0.09, ease: [0.4, 0, 1, 1] },
  color:   { duration: 0.3,  ease: 'easeOut' },
  draw:    { duration: 0.24, ease: 'easeOut' },
} as const satisfies Record<string, Transition>

export const appear = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { y: spring.enter, opacity: { ...tween.fade, delay: 0.03 } } },
  exit:    { opacity: 0, transition: tween.fadeOut },
} as const

export const iconSwap = {
  initial: { opacity: 0, scale: 0.6 },
  animate: { opacity: 1, scale: 1, transition: { scale: spring.pop, opacity: tween.fade } },
  exit:    { opacity: 0, transition: tween.fadeOut },
} as const

export const POPUP_SLIDE = false
