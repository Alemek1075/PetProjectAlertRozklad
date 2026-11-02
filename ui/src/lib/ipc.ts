export function ipcErrorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e ?? '')
  return raw.replace(/^Error invoking remote method '[^']+':\s*/, '').replace(/^(\w*Error):\s*/, '').trim()
}
