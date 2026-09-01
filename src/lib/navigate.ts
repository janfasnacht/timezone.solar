/**
 * The app routes on `window.location.pathname` and listens for `popstate`, so a
 * programmatic navigation has to announce itself. One helper, so every caller
 * does it the same way.
 */
export function navigate(to: string) {
  if (to === window.location.pathname + window.location.hash) return
  history.pushState(null, '', to)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
