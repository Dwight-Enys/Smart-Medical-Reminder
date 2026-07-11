import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { formatDateTime } from '../lib/time'
import { playBeep } from '../lib/alert'
import type { MedicationHistory, DoseStatus } from '../types'

const STATUS_FILTERS: { value: DoseStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'taken', label: 'Taken' },
  { value: 'missed', label: 'Missed' },
  { value: 'skipped', label: 'Skipped' },
]

export default function History() {
  const [history, setHistory] = useState<MedicationHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<DoseStatus | 'all'>('all')

  const load = useCallback(async () => {
    const { data } = await supabase.from('medication_history').select('*, medication:medications(*)').order('scheduled_time', { ascending: false }).limit(200)
    setHistory(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function updateStatus(h: MedicationHistory, status: DoseStatus) {
    await supabase.from('medication_history').update({ status, confirmed_at: status === 'taken' ? new Date().toISOString() : null }).eq('id', h.id)
    playBeep()
    load()
  }

  async function remove(h: MedicationHistory) {
    await supabase.from('medication_history').delete().eq('id', h.id)
    load()
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" /></div>

  const filtered = filter === 'all' ? history : history.filter((h) => h.status === filter)
  const today = new Date().toISOString().slice(0, 10)
  const todayCount = history.filter((h) => h.scheduled_time.slice(0, 10) === today && h.status === 'taken').length
  const missedCount = history.filter((h) => h.status === 'missed').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Medication History</h1>
        <p className="text-slate-500 text-sm mt-1">{history.length} total records · {todayCount} taken today · {missedCount} missed</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${filter === f.value ? 'bg-primary-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-slate-400">No records found.</p>
          <p className="text-xs text-slate-400 mt-1">Records are created automatically when you mark a dose as taken, or when a reminder is missed.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((h) => (
            <div key={h.id} className="card p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <StatusBadge status={h.status} />
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 text-sm truncate">{h.medication?.name ?? 'Unknown medication'}</p>
                  <p className="text-xs text-slate-500">
                    Scheduled: {formatDateTime(h.scheduled_time)}{h.confirmed_at && ` · Confirmed: ${formatDateTime(h.confirmed_at)}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {h.status !== 'taken' && <button onClick={() => updateStatus(h, 'taken')} className="btn-accent text-xs px-2 py-1">Taken</button>}
                {h.status !== 'skipped' && <button onClick={() => updateStatus(h, 'skipped')} className="btn-secondary text-xs px-2 py-1">Skip</button>}
                <button onClick={() => remove(h)} className="text-error-600 hover:text-error-800 text-xs px-2 py-1">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: DoseStatus }) {
  const config = {
    taken: { bg: 'bg-accent-100', text: 'text-accent-700', label: 'Taken' },
    missed: { bg: 'bg-error-100', text: 'text-error-700', label: 'Missed' },
    skipped: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Skipped' },
  }[status]
  return <span className={`badge ${config.bg} ${config.text} shrink-0`}>{config.label}</span>
}
