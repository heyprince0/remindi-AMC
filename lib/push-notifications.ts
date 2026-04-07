import { supabase } from './supabase'

export async function subscribeToNotifications(userId: string): Promise<boolean> {
  try {
    if (!('Notification' in window)) return false
    if (!('serviceWorker' in navigator)) return false

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return false

    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    const existingSub = await reg.pushManager.getSubscription()
    if (existingSub) await existingSub.unsubscribe()

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    })

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({ user_id: userId, subscription: sub.toJSON() }, { onConflict: 'user_id' })

    if (error) throw error
    return true
  } catch (err) {
    console.error('Push subscription error:', err)
    return false
  }
}
