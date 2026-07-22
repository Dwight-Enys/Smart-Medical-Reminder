import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { playBeep } from '../lib/alert'
import { useAuth } from '../contexts/AuthenContext'
import DataGrid, { type DataGridColumn } from '../components/DataGrid'
import {
  fetchLinkedCaregivers,
  fetchLinkedPatients,
  linkCaregiverByLicense,
  unlinkCaregiver,
} from '../lib/Notification'
import { formatDate } from '../lib/time'
import type { CaregiverLink, Profile } from '../types'

const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say']
const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Anchorage', 'Pacific/Honolulu', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Asia/Dubai', 'Australia/Sydney',
]

interface ProfileFieldRow {
  field: string
  value: string
}

export default function ProfilePage() {
  const { user, profile: authProfile, refreshProfile } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({ full_name: '', date_of_birth: '', gender: '', email: '', phone: '', timezone: 'UTC' })
  const [editing, setEditing] = useState(false)

  // Caregiver linking (patient side)
  const [linkedCaregivers, setLinkedCaregivers] = useState<CaregiverLink[]>([])
  const [licenseInput, setLicenseInput] = useState('')
  const [linkError, setLinkError] = useState<string | null>(null)
  const [linkSuccess, setLinkSuccess] = useState<string | null>(null)
  const [linking, setLinking] = useState(false)

  // Linked patients (caregiver side)
  const [linkedPatients, setLinkedPatients] = useState<CaregiverLink[]>([])

  const load = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
    if (data) {
      setProfile(data as Profile)
      setForm({
        full_name: data.full_name ?? '', date_of_birth: data.date_of_birth ?? '', gender: data.gender ?? '',
        email: data.email ?? '', phone: data.phone ?? '', timezone: data.timezone ?? 'UTC',
      })

      if (data.role === 'patient') {
        setLinkedCaregivers(await fetchLinkedCaregivers(data.id))
      } else if (data.role === 'caregiver') {
        setLinkedPatients(await fetchLinkedPatients(data.id))
      }
    }
    setLoading(false)
  }, [user?.id])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!user?.id) return
    setSaving(true)
    const payload = {
      id: user.id, full_name: form.full_name || null, date_of_birth: form.date_of_birth || null,
      gender: form.gender || null, email: form.email || null, phone: form.phone || null,
      timezone: form.timezone,
    }
    if (profile) await supabase.from('profiles').update(payload).eq('id', user.id)
    else await supabase.from('profiles').insert(payload)
    playBeep()
    setSaving(false)
    setSaved(true)
    setEditing(false)
    setTimeout(() => setSaved(false), 2000)
    await load()
    await refreshProfile()
  }

  async function handleLinkCaregiver(e: React.FormEvent) {
    e.preventDefault()
    setLinkError(null)
    setLinkSuccess(null)
    if (!licenseInput.trim()) {
      setLinkError('Enter a caregiver license number.')
      return
    }
    if (!profile?.id) {
      setLinkError('Your profile is still loading — try again in a moment.')
      return
    }
    setLinking(true)
    try {
      const result = await linkCaregiverByLicense(profile.id, licenseInput)
      setLinkSuccess(`Linked to caregiver ${result?.caregiver_name ?? ''}.`.trim())
      setLicenseInput('')
      setLinkedCaregivers(await fetchLinkedCaregivers(profile.id))
    } catch (err: any) {
      setLinkError(err.message ?? 'Could not link that caregiver.')
    }
    setLinking(false)
  }

  async function handleUnlink(linkId: string) {
    if (!confirm('Remove this caregiver link?')) return
    await unlinkCaregiver(linkId)
    if (profile) setLinkedCaregivers(await fetchLinkedCaregivers(profile.id))
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" /></div>

  const fieldRows: ProfileFieldRow[] = [
    { field: 'Full Name', value: form.full_name || '—' },
    { field: 'Username', value: profile?.username || '—' },
    { field: 'Date of Birth', value: formatDate(form.date_of_birth || null) || '—' },
    { field: 'Gender', value: form.gender || '—' },
    { field: 'Email', value: form.email || '—' },
    { field: 'Phone', value: form.phone || '—' },
    { field: 'Time Zone', value: form.timezone },
    { field: 'Role', value: profile?.role === 'caregiver' ? 'Caregiver' : 'Patient' },
    ...(profile?.role === 'caregiver' ? [{ field: 'License Number', value: profile.license_number ?? '—' }] : []),
  ]

  const fieldColumns: DataGridColumn<ProfileFieldRow>[] = [
    { key: 'field', header: 'Field', width: '220px', render: (r) => <span className="font-medium text-slate-600">{r.field}</span> },
    { key: 'value', header: 'Value', render: (r) => <span className="text-slate-800">{r.value}</span> },
  ]

  const caregiverColumns: DataGridColumn<CaregiverLink>[] = [
    { key: 'name', header: 'Caregiver', sortValue: (l) => l.caregiver?.full_name ?? l.caregiver?.username ?? '', render: (l) => (
      <span className="font-medium text-slate-800">{l.caregiver?.full_name || l.caregiver?.username || 'Unnamed'}</span>
    ) },
    { key: 'license', header: 'License #', sortValue: (l) => l.caregiver?.license_number ?? '', render: (l) => (
      <span className="font-mono text-xs">{l.caregiver?.license_number ?? '—'}</span>
    ) },
    { key: 'email', header: 'Email', sortValue: (l) => l.caregiver?.email ?? '', render: (l) => l.caregiver?.email ?? '—' },
    { key: 'linked_since', header: 'Linked Since', sortValue: (l) => l.created_at, render: (l) => formatDate(l.created_at) },
    { key: 'actions', header: '', width: '90px', align: 'right', render: (l) => (
      <button onClick={() => handleUnlink(l.id)} className="btn-danger text-xs px-2 py-1">Remove</button>
    ) },
  ]

  const patientColumns: DataGridColumn<CaregiverLink>[] = [
    { key: 'name', header: 'Patient', sortValue: (l) => l.patient?.full_name ?? l.patient?.username ?? '', render: (l) => (
      <span className="font-medium text-slate-800">{l.patient?.full_name || l.patient?.username || 'Unnamed'}</span>
    ) },
    { key: 'dob', header: 'Date of Birth', sortValue: (l) => l.patient?.date_of_birth ?? '', render: (l) => formatDate(l.patient?.date_of_birth ?? null) || '—' },
    { key: 'phone', header: 'Phone', sortValue: (l) => l.patient?.phone ?? '', render: (l) => l.patient?.phone ?? '—' },
    { key: 'linked_since', header: 'Linked Since', sortValue: (l) => l.created_at, render: (l) => formatDate(l.created_at) },
  ]

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">User Profile</h1>
          <p className="text-slate-500 text-sm mt-1">Your basic information and preferences</p>
        </div>
        <span className={`badge ${profile?.role === 'caregiver' ? 'bg-primary-50 text-primary-700' : 'bg-slate-100 text-slate-600'}`}>
          {profile?.role === 'caregiver' ? `Caregiver · ${profile.license_number}` : 'Patient'}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 shrink-0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div>
          <h2 className="font-semibold text-slate-800 text-lg">{form.full_name || 'Your Name'}</h2>
          <p className="text-sm text-slate-500">{form.email || 'No email set'}</p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-slate-800">Profile Details</h2>
          <button onClick={() => setEditing((v) => !v)} className="btn-secondary text-xs">
            {editing ? 'Cancel Edit' : 'Edit Profile'}
          </button>
        </div>

        {!editing ? (
          <DataGrid columns={fieldColumns} rows={fieldRows} rowKey={(r) => r.field} searchable={false} dense />
        ) : (
          <div className="card p-6 space-y-4">
            <div>
              <label className="label">Full Name</label>
              <input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="e.g. John Doe" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Date of Birth</label>
                <input type="date" className="input" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
              </div>
              <div>
                <label className="label">Gender</label>
                <select className="input" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                  <option value="">Select...</option>
                  {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Email Address</label>
                <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="e.g. john@example.com" />
              </div>
              <div>
                <label className="label">Phone Number</label>
                <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="e.g. +1 555 000 0000" />
              </div>
            </div>
            <div>
              <label className="label">Time Zone</label>
              <select className="input" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Profile'}</button>
              {saved && <span className="text-sm text-accent-600 font-medium">Saved!</span>}
            </div>
          </div>
        )}
      </div>

      {profile?.role === 'patient' && (
        <div>
          <h2 className="font-semibold text-slate-800 mb-2">Linked Caregivers</h2>
          <div className="card p-4 mb-3">
            <form onSubmit={handleLinkCaregiver} className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="label">Caregiver License Number</label>
                <input
                  className="input"
                  placeholder="e.g. CG-001"
                  value={licenseInput}
                  onChange={(e) => setLicenseInput(e.target.value)}
                />
              </div>
              <button type="submit" disabled={linking} className="btn-primary">{linking ? 'Linking...' : 'Link Caregiver'}</button>
            </form>
            {linkError && <p className="text-sm text-error-600 bg-error-50 border border-error-200 rounded-lg px-3 py-2 mt-3">{linkError}</p>}
            {linkSuccess && <p className="text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded-lg px-3 py-2 mt-3">{linkSuccess}</p>}
          </div>
          <DataGrid
            columns={caregiverColumns}
            rows={linkedCaregivers}
            rowKey={(l) => l.id}
            searchable={false}
            emptyMessage="No caregiver linked yet. Enter their license number above."
          />
        </div>
      )}

      {profile?.role === 'caregiver' && (
        <div>
          <h2 className="font-semibold text-slate-800 mb-2">My Patients</h2>
          <DataGrid
            columns={patientColumns}
            rows={linkedPatients}
            rowKey={(l) => l.id}
            searchPlaceholder="Search patients..."
            emptyMessage="No patients linked yet. Share your license number so a patient can link you."
          />
        </div>
      )}
    </div>
  )
}
