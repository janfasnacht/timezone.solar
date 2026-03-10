import App from './App.tsx'

export default function Root() {
  const path = window.location.pathname
  if (path === '/map') {
    window.location.replace('/?view=map')
    return null
  }
  return <App />
}
