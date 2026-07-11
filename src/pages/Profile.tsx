import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { playBeep } from '../lib/alert'
import type { Profile } from '../types'

const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say']
const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Anchorage', 'Pacific/Honolulu', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Asia/Dubai', 'Australia/Sydney',
]

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({ full_name: '', date_of_birth: '', gender: '', email: '', phone: '', timezone: 'UTC' })

  const load = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', 1).maybeSingle()
    if (data) {
      setProfile(data)
      setForm({ full_name: data.full_name ?? '', date_of_birth: data.date_of_birth ?? '', gender: data.gender ?? '', email: data.email ?? '', phone: data.phone ?? '', timezone: data.timezone ?? 'UTC' })
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function save() {
    setSaving(true)
    const payload = {
      id: 1, full_name: form.full_name || null, date_of_birth: form.date_of_birth || null,
      gender: form.gender || null, email: form.email || null, phone: form.phone || null,
      timezone: form.timezone, updated_at: new Date().toISOString(),
    }
    if (profile) await supabase.from('profiles').update(payload).eq('id', 1)
    else await supabase.from('profiles').insert(payload)
    playBeep()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    load()
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" /></div>

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">User Profile</h1>
        <p className="text-slate-500 text-sm mt-1">Your basic information and preferences</p>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center text-primary-700">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-slate-800 text-lg">{form.full_name || 'Your Name'}</h2>
            <p className="text-sm text-slate-500">{form.email || 'No email set'}</p>
          </div>
        </div>

        <div className="space-y-4">
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
      </div>
    </div>
  )
}
