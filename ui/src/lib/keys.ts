type KeyLike = Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'altKey' | 'metaKey' | 'shiftKey'>

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true
  if (target instanceof HTMLInputElement) {
    return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image'].includes(target.type)
  }
  return target.getAttribute('role') === 'combobox' || target.getAttribute('role') === 'textbox'
}

export const hasModifier = (e: KeyLike) => e.ctrlKey || e.altKey || e.metaKey

export function mods(e: KeyLike, want: { ctrl?: boolean; alt?: boolean; shift?: boolean } = {}): boolean {
  return e.ctrlKey === !!want.ctrl && e.altKey === !!want.alt && e.shiftKey === !!want.shift && !e.metaKey
}

export const isPlain = (e: KeyLike, code: string) => e.code === code && mods(e)
export const isCtrl = (e: KeyLike, code: string) => e.code === code && mods(e, { ctrl: true })
export const isCtrlShift = (e: KeyLike, code: string) => e.code === code && mods(e, { ctrl: true, shift: true })

export function dayFromCode(code: string): number | null {
  const m = /^(?:Digit|Numpad)([1-7])$/.exec(code)
  return m ? Number(m[1]) : null
}

export const ARROWS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] } as const
export const isArrow = (code: string): code is keyof typeof ARROWS => code in ARROWS

export const KEY_LABELS = { ctrl: 'Ctrl', shift: 'Shift', alt: 'Alt', esc: 'Esc', del: 'Del', enter: '↵', up: '↑', down: '↓', left: '←', right: '→' } as const
