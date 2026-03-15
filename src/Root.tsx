import { parseLandingPath } from '@/engine/landing-routes'
import { getEntityBySlug } from '@/engine/city-entities'
import App from './App.tsx'

// On landing page paths, set ?q= for the app pipeline but keep the path visible
const landing = parseLandingPath(window.location.pathname)
if (landing) {
  const fromEntity = getEntityBySlug(landing.fromSlug)
  const toEntity = getEntityBySlug(landing.toSlug)
  if (fromEntity && toEntity) {
    const url = new URL(window.location.href)
    // Keep the landing path (e.g. /new-york-to-london) — don't change to /
    url.searchParams.set('q', `${fromEntity.displayName} to ${toEntity.displayName}`)
    history.replaceState(null, '', url.toString())
  }
}

export default function Root() {
  const path = window.location.pathname
  if (path === '/map') {
    window.location.replace('/?view=map')
    return null
  }
  return <App />
}
