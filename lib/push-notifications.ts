export async function subscribeToNotifications(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!('Notification' in window)) {
      return { success: false, error: 'Notifications not supported in this browser' }
    }
    if (!('serviceWorker' in navigator)) {
      return { success: false, error: 'Service Workers not supported' }
    }

    // Step 1: Request permission
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return { success: false, error: 'Notification permission denied' }
    }

    // Step 2: Register service worker
    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    // Step 3: Unsubscribe from existing subscription
    const existingSub = await reg.pushManager.getSubscription()
    if (existingSub) await existingSub.unsubscribe()

    // Step 4: Create new subscription with VAPID public key
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      return { success: false, error: 'VAPID public key not configured' }
    }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    })

    // Step 5: Send subscription to backend API
    const response = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        subscription: sub.toJSON()
      })
    })

    if (!response.ok) {
      const data = await response.json()
      return { success: false, error: data.error || 'Failed to save subscription' }
    }

    return { success: true }
  } catch (err) {
    console.error('Push subscription error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error occurred' }
  }
}
