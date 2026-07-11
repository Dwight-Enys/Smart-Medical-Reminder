export interface ScheduledDose {
  medicationId: string
  medicationName: string
  dosage: string | null
  form: string | null
  time: string
  reminderId: string
  scheduledTimestamp: number
}

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function weekdayName(i: number): string {
  return WEEKDAY_NAMES[i] ?? ''
}

export function getTodayDoses(
  reminders: {
    id: string
    medication_id: string
    reminder_times: string[]
    frequency: string
    interval_hours: number | null
    weekdays: number[]
    enabled: boolean
    medication?: { name: string; dosage: string | null; form: string | null }
  }[]
): ScheduledDose[] {
  const now = new Date()
  const todayDow = now.getDay()
  const doses: ScheduledDose[] = []

  for (const r of reminders) {
    if (!r.enabled || !r.medication) continue

    if (r.frequency === 'weekly' && !r.weekdays.includes(todayDow)) continue

    if (r.frequency === 'every_x_hours' && r.interval_hours) {
      for (let h = 0; h < 24; h += r.interval_hours) {
        const hh = String(h).padStart(2, '0')
        doses.push({
          medicationId: r.medication_id,
          medicationName: r.medication.name,
          dosage: r.medication.dosage,
          form: r.medication.form,
          time: `${hh}:00`,
          reminderId: r.id,
          scheduledTimestamp: timestampFor(`${hh}:00`),
        })
      }
      continue
    }

    for (const t of r.reminder_times) {
      doses.push({
        medicationId: r.medication_id,
        medicationName: r.medication.name,
        dosage: r.medication.dosage,
        form: r.medication.form,
        time: t,
        reminderId: r.id,
        scheduledTimestamp: timestampFor(t),
      })
    }
  }

  return doses.sort((a, b) => a.time.localeCompare(b.time))
}

function timestampFor(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m || 0, 0, 0)
  return d.getTime()
}

export function formatTime(hhmm: string | null): string {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

export function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
