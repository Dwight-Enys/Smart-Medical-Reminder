import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthenContext'
import { formatDate } from '../lib/time'
import { playBeep } from '../lib/alert'
import type { HealthLog } from '../types'
import Modal from '../components/Modal'

export default function Health() {
  const { user } = useAuth()
  const [logs, setLogs] = useState<HealthLog[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<HealthLog | null>(null)
  const [form, setForm] = useState({ log_date: new Date().toISOString().slice(0, 10), blood_pressure: '', blood_sugar: '', heart_rate: '', weight: '', notes: '' })

  const load = useCallback(async () => {
    const { data } = await supabase.from('health_logs').select('*').order('log_date', { ascending: false })
    setLogs(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setEditing(null)
    setForm({ log_date: new Date().toISOString().slice(0, 10), blood_pressure: '', blood_sugar: '', heart_rate: '', weight: '', notes: '' })
    setModalOpen(true)
  }

  function openEdit(l: HealthLog) {
    setEditing(l)
    setForm({ log_date: l.log_date, blood_pressure: l.blood_pressure ?? '', blood_sugar: l.blood_sugar?.toString() ?? '', heart_rate: l.heart_rate?.toString() ?? '', weight: l.weight?.toString() ?? '', notes: l.notes ?? '' })
    setModalOpen(true)
  }

  async function save() {
    const payload = {
      log_date: form.log_date, blood_pressure: form.blood_pressure || null,
      blood_sugar: form.blood_sugar ? Number(form.blood_sugar) : null,
      heart_rate: form.heart_rate ? Number(form.heart_rate) : null,
      weight: form.weight ? Number(form.weight) : null, notes: form.notes || null,
    }
    if (editing) {
      await supabase.from('health_logs').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('health_logs').insert({ ...payload, user_id: user?.id })
    }
    playBeep()
    setModalOpen(false)
    load()
  }

  async function remove(l: HealthLog) {
    if (!confirm('Delete this health log?')) return
    await supabase.from('health_logs').delete().eq('id', l.id)
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
          <h1 className="text-2xl font-bold text-slate-800">Health Tracking</h1>
          <p className="text-slate-500 text-sm mt-1">{logs.length} record(s)</p>
        </div>
        <button onClick={openAdd} className="btn-primary"><PlusIcon /> Add Record</button>
      </div>

      {logs.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-slate-400">No health records yet.</p>
          <button onClick={openAdd} className="btn-primary mt-4">Log your first reading</button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Blood Pressure</th>
                  <th className="text-left px-4 py-3 font-medium">Blood Sugar</th>
                  <th className="text-left px-4 py-3 font-medium">Heart Rate</th>
                  <th className="text-left px-4 py-3 font-medium">Weight</th>
                  <th className="text-left px-4 py-3 font-medium">Notes</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{formatDate(l.log_date)}</td>
                    <td className="px-4 py-3 text-slate-600">{l.blood_pressure ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{l.blood_sugar ? `${l.blood_sugar} mg/dL` : '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{l.heart_rate ? `${l.heart_rate} bpm` : '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{l.weight ? `${l.weight} kg` : '—'}</td>
                    <td className="px-4 py-3 text-slate-500 max-w-[150px] truncate">{l.notes ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => openEdit(l)} className="text-primary-600 hover:text-primary-800 text-xs px-2 py-1">Edit</button>
                        <button onClick={() => remove(l)} className="text-error-600 hover:text-error-800 text-xs px-2 py-1">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Health Record' : 'Add Health Record'}>
        <div className="space-y-3">
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={form.log_date} onChange={(e) => setForm({ ...form, log_date: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Blood Pressure</label>
              <input className="input" value={form.blood_pressure} onChange={(e) => setForm({ ...form, blood_pressure: e.target.value })} placeholder="e.g. 120/80" />
            </div>
            <div>
              <label className="label">Blood Sugar (mg/dL)</label>
              <input type="number" className="input" value={form.blood_sugar} onChange={(e) => setForm({ ...form, blood_sugar: e.target.value })} placeholder="e.g. 95" />
            </div>
            <div>
              <label className="label">Heart Rate (bpm)</label>
              <input type="number" className="input" value={form.heart_rate} onChange={(e) => setForm({ ...form, heart_rate: e.target.value })} placeholder="e.g. 72" />
            </div>
            <div>
              <label className="label">Weight (kg)</label>
              <input type="number" step="0.1" className="input" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} placeholder="e.g. 70.5" />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="How are you feeling?" />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={save} className="btn-primary flex-1">{editing ? 'Save Changes' : 'Add Record'}</button>
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