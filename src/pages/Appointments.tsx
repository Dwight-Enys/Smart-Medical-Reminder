import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthenContext'
import Modal from '../components/Modal'
import type { Appointment } from '../types'

const REMINDER_OFFSETS = [
  { value: '', label: 'No reminder' },
  { value: '15 minutes', label: '15 minutes before' },
  { value: '30 minutes', label: '30 minutes before' },
  { value: '1 hour', label: '1 hour before' },
  { value: '1 day', label: '1 day before' },
]

function formatDate(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function formatTime(timeStr: string | null) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

export default function Appointments() {
  const { user } = useAuth()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Appointment | null>(null)

  const [form, setForm] = useState({
    title: '',
    doctor_name: '',
    location: '',
    appointment_date: '',
    appointment_time: '',
    reminder_offset: '',
    notes: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const today = new Date().toISOString().slice(0, 10)
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .gte('appointment_date', today)
      .order('appointment_date', { ascending: true })
      .order('appointment_time', { ascending: true })

    if (error) {
      console.error('load appointments error:', error)
      setError(error.message)
      setAppointments([])
    } else {
      setAppointments(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setEditing(null)
    setForm({
      title: '', doctor_name: '', location: '',
      appointment_date: new Date().toISOString().slice(0, 10),
      appointment_time: '09:00', reminder_offset: '1 hour', notes: '',
    })
    setModalOpen(true)
  }

  function openEdit(a: Appointment) {
    setEditing(a)
    setForm({
      title: a.title ?? '',
      doctor_name: a.doctor_name ?? '',
      location: a.location ?? '',
      appointment_date: a.appointment_date ?? '',
      appointment_time: a.appointment_time ?? '',
      reminder_offset: a.reminder_offset ?? '',
      notes: (a as any).notes ?? '',
    })
    setModalOpen(true)
  }

  async function save() {
    if (!form.title.trim() || !form.appointment_date) return

    const payload = {
      title: form.title.trim(),
      doctor_name: form.doctor_name.trim() || null,
      location: form.location.trim() || null,
      appointment_date: form.appointment_date,
      appointment_time: form.appointment_time || null,
      reminder_offset: form.reminder_offset || null,
      notes: form.notes.trim() || null,
    }

    const { error } = editing
      ? await supabase.from('appointments').update(payload).eq('id', editing.id)
      : await supabase.from('appointments').insert({ ...payload, user_id: user?.id })

    if (error) {
      console.error('save appointment error:', error)
      setError(error.message)
      return
    }

    setModalOpen(false)
    load()
  }

  async function remove(a: Appointment) {
    if (!confirm('Delete this appointment?')) return
    const { error } = await supabase.from('appointments').delete().eq('id', a.id)
    if (error) {
      console.error('delete appointment error:', error)
      setError(error.message)
      return
    }
    load()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Appointments</h1>
          <p className="text-slate-500 text-sm mt-1">{appointments.length} upcoming appointment(s)</p>
        </div>
        <button onClick={openAdd} className="btn-primary"><PlusIcon /> Add Appointment</button>
      </div>

      {error && (
        <div className="card p-4 border border-error-300 bg-error-50 text-error-800 text-sm">
          Couldn't load appointments: {error}
        </div>
      )}

      {!error && appointments.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-slate-400">No upcoming appointments.</p>
          <button onClick={openAdd} className="btn-primary mt-4">Schedule your first appointment</button>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((a) => (
            <div key={a.id} className="card p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary-100 text-primary-700">
                    <CalendarIcon />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">{a.title}</h3>
                    <p className="text-xs text-slate-500">
                      {formatDate(a.appointment_date)}
                      {a.appointment_time && ` · ${formatTime(a.appointment_time)}`}
                    </p>
                    {(a.doctor_name || a.location) && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {a.doctor_name}
                        {a.doctor_name && a.location && ' · '}
                        {a.location}
                      </p>
                    )}
                    {a.reminder_offset && (
                      <span className="badge bg-primary-50 text-primary-700 mt-1.5 inline-block">
                        Reminder {a.reminder_offset} before
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openEdit(a)} className="btn-secondary text-xs">Edit</button>
                  <button onClick={() => remove(a)} className="btn-danger text-xs">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Appointment' : 'Add Appointment'}>
        <div className="space-y-3">
          <div>
            <label className="label">Title *</label>
            <input
              type="text" className="input" placeholder="e.g. Cardiology Checkup"
              value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Doctor</label>
            <input
              type="text" className="input" placeholder="e.g. Dr. Smith"
              value={form.doctor_name} onChange={(e) => setForm({ ...form, doctor_name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Location</label>
            <input
              type="text" className="input" placeholder="e.g. City Medical Center"
              value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date *</label>
              <input
                type="date" className="input"
                value={form.appointment_date} onChange={(e) => setForm({ ...form, appointment_date: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Time</label>
              <input
                type="time" className="input"
                value={form.appointment_time} onChange={(e) => setForm({ ...form, appointment_time: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label">Reminder</label>
            <select
              className="input" value={form.reminder_offset}
              onChange={(e) => setForm({ ...form, reminder_offset: e.target.value })}
            >
              {REMINDER_OFFSETS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea
              className="input" rows={3} placeholder="Optional notes"
              value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={save} className="btn-primary flex-1">{editing ? 'Save Changes' : 'Add Appointment'}</button>
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function PlusIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4"><path d="M12 5v14M5 12h14" /></svg>
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}
