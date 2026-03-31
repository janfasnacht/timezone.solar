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
    url.searchParams.set('q', `${fromEntity.displayName} to ${toEntity.displayName}`)
    history.replaceState(null, '', url.toString())
  }
}

// Set canonical link tag based on current route
function setCanonical() {
  const canonical =
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]') ??
    (() => {
      const el = document.createElement('link')
      el.setAttribute('rel', 'canonical')
      document.head.appendChild(el)
      return el
    })()

  const path = window.location.pathname
  if (landing) {
    canonical.href = `https://timezone.solar/${landing.fromSlug}-to-${landing.toSlug}`
  } else if (path === '/about') {
    canonical.href = 'https://timezone.solar/about'
  } else {
    canonical.href = 'https://timezone.solar/'
  }
}
setCanonical()

export default function Root() {
  return <App />
}
