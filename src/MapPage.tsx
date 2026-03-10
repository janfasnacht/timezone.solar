import { usePreferences } from '@/hooks/usePreferences'
import { useMinuteTick } from '@/hooks/useMinuteTick'
import { WorldMap } from '@/components/map/WorldMap'
import { MapNav } from '@/components/map/MapNav'

export default function MapPage() {
  const { timeFormat, homeCity } = usePreferences()
  const now = useMinuteTick()

  return (
    <div className="h-dvh w-screen overflow-hidden bg-background relative flex items-center justify-center">
      <WorldMap now={now} use24h={timeFormat === '24h'} homeCity={homeCity} />
      <MapNav homeCity={homeCity} />
    </div>
  )
}
