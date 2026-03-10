import { lazy, Suspense } from 'react'
import App from './App.tsx'

const MapPage = lazy(() => import('./MapPage.tsx'))

export default function Root() {
  const path = window.location.pathname
  if (path === '/map') {
    return (
      <Suspense fallback={<div className="h-dvh bg-background" />}>
        <MapPage />
      </Suspense>
    )
  }
  return <App />
}
