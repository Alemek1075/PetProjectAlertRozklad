import type { SoundKind } from './api'

let ctx: AudioContext | undefined
const ac = () => (ctx ??= new AudioContext())

function tone(freq: number, at: number, dur: number, { type = 'sine' as OscillatorType, gain = 0.25 } = {}) {
  const c = ac()
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.value = freq
  g.gain.setValueAtTime(0, c.currentTime + at)
  g.gain.linearRampToValueAtTime(gain, c.currentTime + at + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + at + dur)
  osc.connect(g).connect(c.destination)
  osc.start(c.currentTime + at)
  osc.stop(c.currentTime + at + dur + 0.05)
}

function bell(f: number, at: number, dur = 1.2) {
  tone(f, at, dur, { gain: 0.22 })
  tone(f * 2.76, at, dur * 0.5, { gain: 0.05 })
}

const SOUNDS: Record<SoundKind, () => void> = {
  lesson() {
    bell(880, 0)
    bell(1318.5, 0.18)
    bell(1760, 0.36, 1.6)
  },
  alert() {
    for (let i = 0; i < 3; i++) {
      tone(740, i * 0.55, 0.42, { type: 'triangle', gain: 0.3 })
      tone(554, i * 0.55 + 0.2, 0.42, { type: 'triangle', gain: 0.3 })
    }
  },
  clear() {
    bell(659, 0)
    bell(988, 0.22, 1.4)
  },
}

export function playSound(kind: SoundKind) {
  const c = ac()
  if (c.state === 'suspended') void c.resume()
  ;(SOUNDS[kind] ?? SOUNDS.lesson)()
}
