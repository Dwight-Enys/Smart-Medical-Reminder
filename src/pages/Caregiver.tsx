import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthenContext'
import DataGrid, { type DataGridColumn } from '../components/DataGrid'
import {
  fetchLinkedPatients,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
} from '../lib/Notification'
import { playBeep } from '../lib/alert'
import { formatDate, formatDateTime } from '../lib/time'
import type { CaregiverLink, CaregiverNotification } from '../types'

const STATUS_STYLES: Record<string, string> = {
  taken: 'bg-accent-50 text-accent-700',
  missed: 'bg-error-50 text-error-700',
  skipped: 'bg-warning-50 text-warning-700',
}

const STATUS_LABEL: Record<string, string> = {
  taken: 'Taken',
  missed: 'Missed',
  skipped: 'Snoozed',
}

export default function Caregiver() {
  const { profile, profileLoading } = useAuth()
  const [links, setLinks] = useState<CaregiverLink[]>([])
  const [notifications, setNotifications] = useState<CaregiverNotification[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!profile?.id) return
    const [linkRows, notifRows] = await Promise.all([
      fetchLinkedPatients(profile.id),
      fetchNotifications(profile.id),
    ])
    setLinks(linkRows)
    setNotifications(notifRows)
    setLoading(false)
  }, [profile?.id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!profile?.id) return
    const unsubscribe = subscribeToNotifications(profile.id, (n) => {
      setNotifications((prev) => [n, ...prev])
      if (n.status === 'missed') playBeep()
    })
    return unsubscribe
  }, [profile?.id])

  async function handleMarkRead(id: string) {
    await markNotificationRead(id)
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
  }

  async function handleMarkAllRead() {
    if (!profile?.id) return
    await markAllNotificationsRead(profile.id)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  if (profileLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (profile?.role !== 'caregiver') {
    return (
      <div className="card p-8 text-center max-w-lg mx-auto">
        <p className="text-slate-500">This page is only available to caregiver accounts.</p>
      </div>
    )
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  const patientColumns: DataGridColumn<CaregiverLink>[] = [
    { key: 'name', header: 'Name', sortValue: (l) => l.patient?.full_name ?? l.patient?.username ?? '', render: (l) => (
      <span className="font-medium text-slate-800">{l.patient?.full_name || l.patient?.username || 'Unnamed patient'}</span>
    ) },
    { key: 'username', header: 'Username', sortValue: (l) => l.patient?.username ?? '', render: (l) => l.patient?.username ?? '—' },
    { key: 'dob', header: 'Date of Birth', sortValue: (l) => l.patient?.date_of_birth ?? '', render: (l) => formatDate(l.patient?.date_of_birth ?? null) || '—' },
    { key: 'phone', header: 'Phone', sortValue: (l) => l.patient?.phone ?? '', render: (l) => l.patient?.phone ?? '—' },
    { key: 'email', header: 'Email', sortValue: (l) => l.patient?.email ?? '', render: (l) => l.patient?.email ?? '—' },
    { key: 'linked_since', header: 'Linked Since', sortValue: (l) => l.created_at, render: (l) => formatDate(l.created_at) },
  ]

  const notificationColumns: DataGridColumn<CaregiverNotification>[] = [
    {
      key: 'status',
      header: 'Status',
      width: '110px',
      sortValue: (n) => n.status,
      render: (n) => (
        <span className={`badge ${STATUS_STYLES[n.status] ?? 'bg-slate-100 text-slate-600'}`}>{STATUS_LABEL[n.status] ?? n.status}</span>
      ),
    },
    { key: 'message', header: 'Alert', sortValue: (n) => n.message, render: (n) => (
      <span className={n.is_read ? 'text-slate-500' : 'text-slate-800 font-medium'}>{n.message}</span>
    ) },
    { key: 'when', header: 'Received', width: '160px', sortValue: (n) => n.created_at, render: (n) => formatDateTime(n.created_at) },
    {
      key: 'actions', header: '', width: '110px', align: 'right',
      render: (n) => !n.is_read ? (
        <button onClick={(e) => { e.stopPropagation(); handleMarkRead(n.id) }} className="btn-secondary text-xs px-2 py-1">
          Mark read
        </button>
      ) : <span className="text-xs text-slate-300">Read</span>,
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Caregiver Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">
            License <span className="font-mono font-medium text-slate-700">{profile.license_number}</span>
            {' · '}{links.length} patient{links.length === 1 ? '' : 's'} linked
            {unreadCount > 0 && <> · <span className="text-error-600 font-medium">{unreadCount} unread alert{unreadCount === 1 ? '' : 's'}</span></>}
          </p>
        </div>
        {unreadCount > 0 && (
          <button onClick={handleMarkAllRead} className="btn-secondary text-sm">Mark all as read</button>
        )}
      </div>

      <div>
        <h2 className="font-semibold text-slate-800 mb-2">My Patients</h2>
        <DataGrid
          columns={patientColumns}
          rows={links}
          rowKey={(l) => l.id}
          searchPlaceholder="Search patients..."
          emptyMessage="No patients linked yet. Share your license number with a patient so they can link you."
        />
      </div>

      <div>
        <h2 className="font-semibold text-slate-800 mb-2">Medication Alerts</h2>
        <DataGrid
          columns={notificationColumns}
          rows={notifications}
          rowKey={(n) => n.id}
          searchPlaceholder="Search alerts..."
          emptyMessage="No alerts yet. You'll see missed, taken, and snoozed doses here as they happen."
        />
      </div>
    </div>
  )
}