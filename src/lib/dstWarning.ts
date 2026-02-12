import { DateTime } from 'luxon'

export function getDstWarning(
  sourceIana: string,
  targetIana: string,
  referenceDate: DateTime,
): string | null {
  const currentOffset = referenceDate.setZone(targetIana).offset - referenceDate.setZone(sourceIana).offset

  for (let day = 1; day <= 14; day++) {
    const future = referenceDate.plus({ days: day })
    const futureOffset = future.setZone(targetIana).offset - future.setZone(sourceIana).offset

    if (futureOffset !== currentOffset) {
      // Determine which zone changed
      const sourceChanged = future.setZone(sourceIana).offset !== referenceDate.setZone(sourceIana).offset
      const targetChanged = future.setZone(targetIana).offset !== referenceDate.setZone(targetIana).offset

      const dateStr = future.toFormat('MMMM d')
      const newDiffMinutes = futureOffset
      const sign = newDiffMinutes >= 0 ? '+' : '-'
      const absDiff = Math.abs(newDiffMinutes)
      const hours = Math.floor(absDiff / 60)
      const minutes = absDiff % 60
      const offsetStr = minutes === 0 ? `${sign}${hours}h` : `${sign}${hours}h ${minutes}m`

      let zone = ''
      if (sourceChanged && targetChanged) {
        zone = 'both locations'
      } else if (sourceChanged) {
        zone = referenceDate.setZone(sourceIana).toFormat('ZZZZ')
      } else if (targetChanged) {
        zone = referenceDate.setZone(targetIana).toFormat('ZZZZ')
      }

      return `Clocks change ${dateStr}${zone ? ` in ${zone}` : ''} \u2014 offset becomes ${offsetStr}`
    }
  }

  return null
}
