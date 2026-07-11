import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthenContext'
import { formatTime, weekdayName } from '../lib/time'
import { playBeep } from '../lib/alert'
import type { Medication, Reminder, Frequency } from '../types'
import Modal from '../components/Modal'

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'every_x_hours', label: 'Every X Hours' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'custom', label: 'Custom' },
]
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6]

export default function Reminders() {
  const { user } = useAuth()
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [medications, setMedications] = useState<Medication[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Reminder | null>(null)
  const [timeInput, setTimeInput] = useState('08:00')
  const [form, setForm] = useState({
    medication_id: '', frequency: 'daily' as Frequency, interval_hours: 8,
    weekdays: [] as number[], meal_relation: 'none', enabled: true, snooze_minutes: 5,
  })

  const load = useCallback(async () => {
    const [remRes, medRes] = await Promise.all([
      supabase.from('reminders').select('*, medication:medications(*)').order('created_at', { ascending: false }),
      supabase.from('medications').select('*').order('name', { ascending: true }),
    ])
    setReminders(remRes.data ?? [])
    setMedications(medRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setEditing(null)
    setForm({ medication_id: medications[0]?.id ?? '', frequency: 'daily', interval_hours: 8, weekdays: [], meal_relation: 'none', enabled: true, snooze_minutes: 5 })
    setTimeInput('08:00')
    setModalOpen(true)
  }

  function openEdit(r: Reminder) {
    setEditing(r)
    setForm({ medication_id: r.medication_id, frequency: r.frequency, interval_hours: r.interval_hours ?? 8, weekdays: r.weekdays ?? [], meal_relation: r.meal_relation, enabled: r.enabled, snooze_minutes: r.snooze_minutes })
    setTimeInput(r.reminder_times[0] ?? '08:00')
    setModalOpen(true)
  }

  async function save() {
    if (!form.medication_id) return
    const times = form.frequency === 'every_x_hours' ? [] : [timeInput]
    const payload = {
      medication_id: form.medication_id, reminder_times: times, frequency: form.frequency,
      interval_hours: form.frequency === 'every_x_hours' ? form.interval_hours : null,
      weekdays: form.frequency === 'weekly' ? form.weekdays : [], meal_relation: form.meal_relation,
      enabled: form.enabled, snooze_minutes: form.snooze_minutes,
    }
    if (editing) {
      await supabase.from('reminders').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('reminders').insert({ ...payload, user_id: user?.id })
    }
    playBeep()
    setModalOpen(false)
    load()
  }

  async function toggleEnabled(r: Reminder) {
    await supabase.from('reminders').update({ enabled: !r.enabled }).eq('id', r.id)
    load()
  }

  async function remove(r: Reminder) {
    if (!confirm('Delete this reminder?')) return
    await supabase.from('reminders').delete().eq('id', r.id)
    load()
  }

  function toggleWeekday(d: number) {
    setForm((f) => ({ ...f, weekdays: f.weekdays.includes(d) ? f.weekdays.filter((w) => w !== d) : [...f.weekdays, d] }))
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
          <h1 className="text-2xl font-bold text-slate-800">Reminder Schedules</h1>
          <p className="text-slate-500 text-sm mt-1">{reminders.length} reminder(s) configured</p>
        </div>
        <button onClick={openAdd} className="btn-primary" disabled={medications.length === 0}><PlusIcon /> Add Reminder</button>
      </div>

      {medications.length === 0 ? (
        <div className="card p-8 text-center"><p className="text-slate-400">Add a medication first before creating reminders.</p></div>
      ) : reminders.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-slate-400">No reminders yet.</p>
          <button onClick={openAdd} className="btn-primary mt-4">Create your first reminder</button>
        </div>
      ) : (
        <div className="space-y-3">
          {reminders.map((r) => (
            <div key={r.id} className="card p-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${r.enabled ? 'bg-primary-100 text-primary-700' : 'bg-slate-100 text-slate-400'}`}><ClockIcon /></div>
                  <div>
                    <h3 className="font-semibold text-slate-800">{r.medication?.name ?? 'Unknown'}</h3>
                    <p className="text-xs text-slate-500">
                      {r.frequency === 'every_x_hours' ? `Every ${r.interval_hours} hours`
                        : r.frequency === 'weekly' ? `Weekly on ${r.weekdays.map(weekdayName).join(', ')}`
                        : r.frequency}
                      {r.meal_relation !== 'none' && ` · ${r.meal_relation} meals`}
                    </p>
                    {r.reminder_times.length > 0 && (
                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        {r.reminder_times.map((t) => <span key={t} className="badge bg-primary-50 text-primary-700">{formatTime(t)}</span>)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleEnabled(r)} className={`relative w-11 h-6 rounded-full transition-colors ${r.enabled ? 'bg-accent-500' : 'bg-slate-300'}`}>
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${r.enabled ? 'translate-x-5' : ''}`} />
                  </button>
                  <button onClick={() => openEdit(r)} className="btn-secondary text-xs">Edit</button>
                  <button onClick={() => remove(r)} className="btn-danger text-xs">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Reminder' : 'Add Reminder'}>
        <div className="space-y-3">
          <div>
            <label className="label">Medication *</label>
            <select className="input" value={form.medication_id} onChange={(e) => setForm({ ...form, medication_id: e.target.value })}>
              {medications.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Frequency</label>
            <select className="input" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value as Frequency })}>
              {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          {form.frequency === 'every_x_hours' ? (
            <div>
              <label className="label">Every X Hours</label>
              <input type="number" min={1} max={24} className="input" value={form.interval_hours} onChange={(e) => setForm({ ...form, interval_hours: Number(e.target.value) })} />
            </div>
          ) : (
            <div>
              <label className="label">Reminder Time</label>
              <input type="time" className="input" value={timeInput} onChange={(e) => setTimeInput(e.target.value)} />
            </div>
          )}
          {form.frequency === 'weekly' && (
            <div>
              <label className="label">Days of Week</label>
              <div className="flex gap-1.5 flex-wrap">
                {WEEKDAYS.map((d) => (
                  <button key={d} onClick={() => toggleWeekday(d)}
                    className={`w-10 h-10 rounded-lg text-xs font-medium transition ${form.weekdays.includes(d) ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    {weekdayName(d)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Meal Relation</label>
              <select className="input" value={form.meal_relation} onChange={(e) => setForm({ ...form, meal_relation: e.target.value })}>
                <option value="none">None</option>
                <option value="before">Before meals</option>
                <option value="after">After meals</option>
              </select>
            </div>
            <div>
              <label className="label">Snooze (minutes)</label>
              <input type="number" min={1} max={30} className="input" value={form.snooze_minutes} onChange={(e) => setForm({ ...form, snooze_minutes: Number(e.target.value) })} />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} className="w-4 h-4 rounded text-primary-600" />
            <span className="text-sm text-slate-700">Reminder enabled</span>
          </label>
          <div className="flex gap-2 pt-2">
            <button onClick={save} className="btn-primary flex-1">{editing ? 'Save Changes' : 'Add Reminder'}</button>
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function PlusIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4"><path d="M12 5v14M5 12h14" /></svg> }
function ClockIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg> }