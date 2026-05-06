import { registerSW } from 'virtual:pwa-register'

export function setupPWAUpdates() {
  // Clear old service workers before registering new one
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => {
        // Unregister all old service workers to force fresh cache
        registration.unregister()
        console.log('Unregistered old service worker')
      })
    })
  }

  // Clear all old caches to force fresh content
  if ('caches' in window) {
    caches.keys().then(cacheNames => {
      cacheNames.forEach(cacheName => {
        caches.delete(cacheName)
        console.log(`Cleared cache: ${cacheName}`)
      })
    })
  }

  const updateSW = registerSW({
    onNeedRefresh() {
      // Show update notification to user
      const confirmed = window.confirm(
        'A new version is available! Click OK to reload and get the latest updates.'
      )
      if (confirmed) {
        updateSW(true)
      }
    },
    onOfflineReady() {
      console.log('PWA is ready to work offline')
    },
    onRegistered(registration) {
      console.log('PWA registered with new cache strategy')
      // Check for updates every 30 seconds for aggressive updates
      setInterval(() => {
        registration?.update()
      }, 30000)
    }
  })

  return updateSW
}
