import { supabase } from './supabase'
import type { CaregiverLink, CaregiverNotification } from '../types'

export async function fetchNotifications(caregiverId: string): Promise<CaregiverNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('caregiver_id', caregiverId)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []) as CaregiverNotification[]
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id)
  if (error) throw error
}

export async function markAllNotificationsRead(caregiverId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('caregiver_id', caregiverId)
    .eq('is_read', false)
  if (error) throw error
}

/**
 * Subscribes to new notification rows for a caregiver in real time.
 * Returns an unsubscribe function - call it on component unmount.
 */
export function subscribeToNotifications(
  caregiverId: string,
  onInsert: (notification: CaregiverNotification) => void
): () => void {
  const channel = supabase
    .channel(`notifications-${caregiverId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `caregiver_id=eq.${caregiverId}` },
      (payload) => onInsert(payload.new as CaregiverNotification)
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

export async function fetchLinkedPatients(caregiverId: string): Promise<CaregiverLink[]> {
  const { data, error } = await supabase
    .from('caregiver_links')
    .select('*, patient:profiles!caregiver_links_patient_id_fkey(*)')
    .eq('caregiver_id', caregiverId)
    .eq('status', 'active')
  if (error) throw error
  return (data ?? []) as CaregiverLink[]
}

export async function fetchLinkedCaregivers(patientId: string): Promise<CaregiverLink[]> {
  const { data, error } = await supabase
    .from('caregiver_links')
    .select('*, caregiver:profiles!caregiver_links_caregiver_id_fkey(*)')
    .eq('patient_id', patientId)
    .eq('status', 'active')
  if (error) throw error
  return (data ?? []) as CaregiverLink[]
}

/** Patient calls this with their own id and a caregiver's CG-### license number to link them. */
export async function linkCaregiverByLicense(
  patientId: string,
  license: string
): Promise<{ caregiver_id: string; caregiver_name: string } | null> {
  const { data, error } = await supabase.rpc('link_caregiver_by_license', {
    p_patient_id: patientId,
    p_license_number: license.trim().toUpperCase(),
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return row ?? null
}

export async function unlinkCaregiver(linkId: string) {
  const { error } = await supabase.from('caregiver_links').update({ status: 'revoked' }).eq('id', linkId)
  if (error) throw error
}