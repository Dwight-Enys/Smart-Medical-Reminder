import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getTodayDoses, formatTime, formatDate, type ScheduledDose } from '../lib/time'
import { playBeep } from '../lib/alert'
import type { Medication, Reminder, Appointment, MedicationHistory } from '../types'

export default function Dashboard() {
  const [medications, setMedications] = useState<Medication[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [history, setHistory] = useState<MedicationHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newMed, setNewMed] = useState({ name: '', dosage: '', form: 'Tablet' })

  const loadData = useCallback(async () => {
    const [medsRes, remRes, apptRes, histRes] = await Promise.all([
      supabase.from('medications').select('*').order('created_at', { ascending: false }),
      supabase.from('reminders').select('*, medication:medications(*)').eq('enabled', true),
      supabase.from('appointments').select('*').gte('appointment_date', new Date().toISOString().slice(0, 10)).order('appointment_date', { ascending: true }),
      supabase.from('medication_history').select('*, medication:medications(*)').gte('scheduled_time', new Date().toISOString().slice(0, 10)).order('scheduled_time', { ascending: true }),
    ])
    setMedications(medsRes.data ?? [])
    setReminders(remRes.data ?? [])
    setAppointments(apptRes.data ?? [])
    setHistory(histRes.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
    const id = setInterval(loadData, 30000)
    return () => clearInterval(id)
  }, [loadData])

  const todayDoses = getTodayDoses(reminders)
  const now = Date.now()

  const takenKeys = new Set(
    history.filter((h) => h.status === 'taken').map((h) => {
      const d = new Date(h.scheduled_time)
      return `${h.medication_id}-${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    })
  )

  const upcomingDoses = todayDoses.filter((d) => d.scheduledTimestamp > now - 60000)
  const nextDose = upcomingDoses[0] ?? null
  const missedDoses = todayDoses.filter((d) => d.scheduledTimestamp < now - 60000 && !takenKeys.has(`${d.medicationId}-${d.time}`))
  const takenToday = todayDoses.filter((d) => takenKeys.has(`${d.medicationId}-${d.time}`))
  const nextAppointment = appointments[0] ?? null

  async function quickAddMedication() {
    if (!newMed.name.trim()) return
    const { data } = await supabase.from('medications').insert({
      name: newMed.name.trim(), dosage: newMed.dosage || null, form: newMed.form,
    }).select().single()
    if (data) {
      await supabase.from('reminders').insert({
        medication_id: data.id, reminder_times: ['08:00'], frequency: 'daily', meal_relation: 'none',
      })
    }
    setNewMed({ name: '', dosage: '', form: 'Tablet' })
    setShowAddModal(false)
    playBeep()
    loadData()
  }

  async function markDoseTaken(dose: ScheduledDose) {
    await supabase.from('medication_history').insert({
      medication_id: dose.medicationId,
      scheduled_time: new Date(dose.scheduledTimestamp).toISOString(),
      status: 'taken',
      confirmed_at: new Date().toISOString(),
    })
    playBeep()
    loadData()
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Today's Medications" value={todayDoses.length} color="primary" />
        <StatCard label="Taken" value={takenToday.length} color="accent" />
        <StatCard label="Missed" value={missedDoses.length} color="error" />
        <StatCard label="Upcoming Appts" value={appointments.length} color="warning" />
      </div>

      <div className="flex flex-wrap gap-3">
        <button onClick={() => setShowAddModal(true)} className="btn-primary"><PlusIcon /> Add Medication</button>
        <Link to="/medications" className="btn-secondary">Manage Medications</Link>
        <Link to="/appointments" className="btn-secondary">Add Appointment</Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="font-semibold text-slate-800 mb-3">Next Reminder</h2>
          {nextDose ? (
            <div className="flex items-center gap-4 bg-primary-50 rounded-lg p-4">
              <div className="w-12 h-12 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm font-bold">
                {formatTime(nextDose.time).split(' ')[0]}
              </div>
              <div>
                <p className="font-medium text-slate-800">{nextDose.medicationName}</p>
                <p className="text-sm text-slate-500">{nextDose.dosage} {nextDose.form && `· ${nextDose.form}`}</p>
                <p className="text-sm text-primary-600 font-medium mt-0.5">{formatTime(nextDose.time)}</p>
              </div>
            </div>
          ) : <p className="text-slate-400 text-sm py-4 text-center">No upcoming reminders today.</p>}
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-slate-800 mb-3">Next Appointment</h2>
          {nextAppointment ? (
            <div className="flex items-center gap-4 bg-warning-50 rounded-lg p-4">
              <div className="w-12 h-12 rounded-full bg-warning-500 flex items-center justify-center text-white">
                <CalIcon />
              </div>
              <div>
                <p className="font-medium text-slate-800">{nextAppointment.title}</p>
                <p className="text-sm text-slate-500">
                  {nextAppointment.doctor_name && `${nextAppointment.doctor_name} · `}
                  {formatDate(nextAppointment.appointment_date)}
                  {nextAppointment.appointment_time && ` at ${formatTime(nextAppointment.appointment_time)}`}
                </p>
              </div>
            </div>
          ) : <p className="text-slate-400 text-sm py-4 text-center">No upcoming appointments.</p>}
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-800">Today's Medications</h2>
          <Link to="/history" className="text-sm text-primary-600 hover:underline">View history</Link>
        </div>
        {todayDoses.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-400 text-sm">No medications scheduled for today.</p>
            <button onClick={() => setShowAddModal(true)} className="btn-primary mt-3 text-sm">Add your first medication</button>
          </div>
        ) : (
          <div className="space-y-2">
            {todayDoses.map((dose, i) => {
              const isTaken = takenKeys.has(`${dose.medicationId}-${dose.time}`)
              const isMissed = dose.scheduledTimestamp < now - 60000 && !isTaken
              return (
                <div key={`${dose.medicationId}-${dose.time}-${i}`}
                  className={`flex items-center justify-between rounded-lg border p-3 transition ${
                    isTaken ? 'bg-accent-50 border-accent-200' : isMissed ? 'bg-error-50 border-error-200' : 'bg-white border-slate-200 hover:border-primary-300'
                  }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${
                      isTaken ? 'bg-accent-500 text-white' : isMissed ? 'bg-error-500 text-white' : 'bg-primary-100 text-primary-700'
                    }`}>{dose.time}</div>
                    <div>
                      <p className="font-medium text-slate-800 text-sm">{dose.medicationName}</p>
                      <p className="text-xs text-slate-500">{dose.dosage} {dose.form && `· ${dose.form}`} · {formatTime(dose.time)}</p>
                    </div>
                  </div>
                  {isTaken ? <span className="badge bg-accent-100 text-accent-700">Taken</span>
                    : isMissed ? <span className="badge bg-error-100 text-error-700">Missed</span>
                    : <button onClick={() => markDoseTaken(dose)} className="btn-accent text-xs px-3 py-1.5">Mark Taken</button>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative card w-full max-w-md p-5 fade-in">
            <h2 className="font-semibold text-slate-800 mb-4">Quick Add Medication</h2>
            <div className="space-y-3">
              <div>
                <label className="label">Medication Name</label>
                <input className="input" value={newMed.name} onChange={(e) => setNewMed({ ...newMed, name: e.target.value })} placeholder="e.g. Amoxicillin" autoFocus />
              </div>
              <div>
                <label className="label">Dosage</label>
                <input className="input" value={newMed.dosage} onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })} placeholder="e.g. 500 mg" />
              </div>
              <div>
                <label className="label">Form</label>
                <select className="input" value={newMed.form} onChange={(e) => setNewMed({ ...newMed, form: e.target.value })}>
                  {['Tablet', 'Capsule', 'Syrup', 'Injection', 'Inhaler', 'Drops', 'Topical', 'Other'].map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={quickAddMedication} className="btn-primary flex-1">Add + Default Reminder</button>
              <button onClick={() => setShowAddModal(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    primary: 'bg-primary-50 text-primary-700', accent: 'bg-accent-50 text-accent-700',
    error: 'bg-error-50 text-error-700', warning: 'bg-warning-50 text-warning-700',
  }
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <div className="w-5 h-5 rounded-full bg-current opacity-30" />
        </div>
      </div>
    </div>
  )
}

function PlusIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4"><path d="M12 5v14M5 12h14" /></svg> }
function CalIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg> }
