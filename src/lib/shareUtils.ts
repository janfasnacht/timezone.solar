/** Compact time: "3:00 PM" → "3pm", "11:30 AM" → "11.30am", "15:00" → "15.00" */
export function compactTime(time: string, is24h: boolean): string {
  if (is24h) return time.replace(':', '.')
  return time
    .replace(/:00\s*/i, '')       // drop :00
    .replace(/:/g, '.')           // 11:30 → 11.30
    .replace(/\s*(AM|PM)/i, (_, p: string) => p.toLowerCase()) // 3 PM → 3pm
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const mon = d.toLocaleDateString('en-US', { month: 'short' })
  return `${mon}${d.getDate()}`
}
