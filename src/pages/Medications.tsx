import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthenContext'
import { formatDate } from '../lib/time'
import { playBeep } from '../lib/alert'
import type { Medication } from '../types'
import Modal from '../components/Modal'

const FORMS = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Inhaler', 'Drops', 'Topical', 'Other']

function nextDay(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

export default function Medications() {
  const { user } = useAuth()
  const [meds, setMeds] = useState<Medication[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Medication | null>(null)
  const [form, setForm] = useState({ name: '', dosage: '', form: 'Tablet', reason: '', start_date: '', end_date: '', notes: '' })
  const [dateError, setDateError] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase.from('medications').select('*').order('created_at', { ascending: false })
    setMeds(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setEditing(null)
    setForm({ name: '', dosage: '', form: 'Tablet', reason: '', start_date: '', end_date: '', notes: '' })
    setDateError('')
    setModalOpen(true)
  }

  function openEdit(m: Medication) {
    setEditing(m)
    setForm({ name: m.name, dosage: m.dosage ?? '', form: m.form ?? 'Tablet', reason: m.reason ?? '', start_date: m.start_date ?? '', end_date: m.end_date ?? '', notes: m.notes ?? '' })
    setDateError('')
    setModalOpen(true)
  }

  async function save() {
    if (!form.name.trim()) return
    if (form.start_date && form.end_date && form.end_date <= form.start_date) {
      setDateError('End date must be after the start date.')
      return
    }
    setDateError('')
    const payload = {
      name: form.name.trim(), dosage: form.dosage || null, form: form.form,
      reason: form.reason || null, start_date: form.start_date || null, end_date: form.end_date || null, notes: form.notes || null,
    }
    if (editing) {
      await supabase.from('medications').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('medications').insert({ ...payload, user_id: user?.id })
    }
    playBeep()
    setModalOpen(false)
    load()
  }

  async function remove(m: Medication) {
    if (!confirm(`Delete ${m.name}? This also removes its reminders and history.`)) return
    await supabase.from('medications').delete().eq('id', m.id)
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
          <h1 className="text-2xl font-bold text-slate-800">Medications</h1>
          <p className="text-slate-500 text-sm mt-1">{meds.length} medication(s) registered</p>
        </div>
        <button onClick={openAdd} className="btn-primary"><PlusIcon /> Add Medication</button>
      </div>

      {meds.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-slate-400">No medications yet.</p>
          <button onClick={openAdd} className="btn-primary mt-4">Add your first medication</button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {meds.map((m) => (
            <div key={m.id} className="card p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center text-primary-700">
                  <PillIcon />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">{m.name}</h3>
                  <p className="text-xs text-slate-500">{m.dosage ?? 'No dosage'} · {m.form ?? 'N/A'}</p>
                </div>
              </div>
              {m.reason && <p className="text-sm text-slate-600 mt-3">For: {m.reason}</p>}
              <div className="text-xs text-slate-400 mt-2 space-y-0.5">
                {m.start_date && <p>Started: {formatDate(m.start_date)}</p>}
                {m.end_date && <p>Ends: {formatDate(m.end_date)}</p>}
              </div>
              {m.notes && <p className="text-xs text-slate-500 mt-2 italic line-clamp-2">{m.notes}</p>}
              <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
                <button onClick={() => openEdit(m)} className="btn-secondary text-xs flex-1">Edit</button>
                <button onClick={() => remove(m)} className="btn-danger text-xs">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Medication' : 'Add Medication'}>
        <div className="space-y-3">
          <div>
            <label className="label">Medication Name *</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Amoxicillin" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Dosage</label>
              <input className="input" value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })} placeholder="e.g. 500 mg" />
            </div>
            <div>
              <label className="label">Form</label>
              <select className="input" value={form.form} onChange={(e) => setForm({ ...form, form: e.target.value })}>
                {FORMS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Reason / Purpose</label>
            <input className="input" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Infection" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Start Date</label>
              <input
                type="date" className="input" value={form.start_date}
                onChange={(e) => {
                  const start_date = e.target.value
                  setDateError('')
                  setForm((f) => ({
                    ...f,
                    start_date,
                    end_date: start_date && f.end_date && f.end_date <= start_date ? '' : f.end_date,
                  }))
                }}
              />
            </div>
            <div>
              <label className="label">End Date</label>
              <input
                type="date" className="input" value={form.end_date}
                min={form.start_date ? nextDay(form.start_date) : undefined}
                onChange={(e) => { setDateError(''); setForm({ ...form, end_date: e.target.value }) }}
              />
            </div>
          </div>
          {dateError && <p className="text-xs text-red-600 -mt-1">{dateError}</p>}
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes..." />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={save} className="btn-primary flex-1">{editing ? 'Save Changes' : 'Add Medication'}</button>
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function PillIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M10.5 20.5a7 7 0 0 1-9.9-9.9l9.9-9.9a7 7 0 0 1 9.9 9.9l-9.9 9.9z" />
      <path d="M8.5 8.5l7 7" />
    </svg>
  )
}