import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthenContext'
import { getTodayDoses, type ScheduledDose } from '../lib/time'
import { playAlertSound, primeAudio } from '../lib/alert'
import type { Appointment } from '../types'

interface AlertState {
  activeDose: ScheduledDose | null
  dismiss: () => void
  markTaken: () => Promise<void>
  snooze: () => void
}

const AlertContext = createContext<AlertState>({
  activeDose: null,
  dismiss: () => {},
  markTaken: async () => {},
  snooze: () => {},
})

export const useAlert = () => useContext(AlertContext)

const dismissed = new Set<string>()
const snoozedUntil = new Map<string, number>()
const apptDismissed = new Set<string>()
const apptSnoozedUntil = new Map<string, number>()

function offsetToMinutes(offset: string | null): number | null {
  if (!offset) return null
  if (offset.includes('15 minutes')) return 15
  if (offset.includes('30 minutes')) return 30
  if (offset.includes('1 hour')) return 60
  if (offset.includes('1 day')) return 1440
  return null
}

interface ActiveAppointment {
  id: string
  title: string
  doctorName: string | null
  location: string | null
  kind: 'upcoming' | 'now'
  label: string
}

export default function AlertProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [activeDose, setActiveDose] = useState<ScheduledDose | null>(null)
  const [reminders, setReminders] = useState<any[]>([])
  const [listening, setListening] = useState(false)
  const [heardText, setHeardText] = useState('')
  const soundIntervalRef = useRef<number | null>(null)
  const recognitionRef = useRef<any>(null)

  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [activeAppt, setActiveAppt] = useState<ActiveAppointment | null>(null)
  const apptSoundIntervalRef = useRef<number | null>(null)

  useEffect(() => {
    const prime = () => {
      primeAudio()
      window.removeEventListener('click', prime)
      window.removeEventListener('keydown', prime)
    }
    window.addEventListener('click', prime)
    window.addEventListener('keydown', prime)
    return () => {
      window.removeEventListener('click', prime)
      window.removeEventListener('keydown', prime)
    }
  }, [])

  async function loadReminders() {
    const { data } = await supabase
      .from('reminders')
      .select('*, medication:medications(*)')
      .eq('enabled', true)
    if (data) setReminders(data as any[])
  }

  useEffect(() => {
    loadReminders()
    const id = window.setInterval(loadReminders, 60000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const check = () => {
      if (activeDose) return
      const doses = getTodayDoses(reminders)
      const now = Date.now()
      for (const dose of doses) {
        const key = `${dose.medicationId}-${dose.time}`
        if (dismissed.has(key)) continue
        const snoozeUntil = snoozedUntil.get(key)
        if (snoozeUntil && snoozeUntil > now) continue
        const diffMin = (now - dose.scheduledTimestamp) / 60000
        if (diffMin >= -0.5 && diffMin <= 30) {
          setActiveDose(dose)
          return
        }
      }
    }
    const id = window.setInterval(check, 15000)
    check()
    return () => window.clearInterval(id)
  }, [reminders, activeDose])

  useEffect(() => {
    if (!activeDose) {
      if (soundIntervalRef.current) {
        window.clearInterval(soundIntervalRef.current)
        soundIntervalRef.current = null
      }
      return
    }
    playAlertSound()
    soundIntervalRef.current = window.setInterval(() => playAlertSound(), 3000)
    return () => {
      if (soundIntervalRef.current) {
        window.clearInterval(soundIntervalRef.current)
        soundIntervalRef.current = null
      }
    }
  }, [activeDose])

  useEffect(() => {
    if (!activeDose) return
    if (!('speechSynthesis' in window)) return
    const utterance = new SpeechSynthesisUtterance(
      `It is time for your medication. Please take ${activeDose.medicationName}${activeDose.dosage ? `, ${activeDose.dosage}` : ''}.`
    )
    utterance.rate = 0.95
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }, [activeDose])

  useEffect(() => {
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!activeDose || !SpeechRecognitionCtor) {
      setListening(false)
      return
    }

    const recognition = new SpeechRecognitionCtor()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'
    recognitionRef.current = recognition

    recognition.onresult = (event: any) => {
      const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim()
      setHeardText(transcript)
      if (/\btaken\b/.test(transcript)) markTaken()
      else if (/\bsnooze\b/.test(transcript)) snooze()
      else if (/\bdismiss\b/.test(transcript)) dismiss()
    }

    recognition.onerror = () => setListening(false)
    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        try { recognition.start() } catch {}
      }
    }

    try {
      recognition.start()
      setListening(true)
    } catch {
      setListening(false)
    }

    return () => {
      recognitionRef.current = null
      setListening(false)
      try { recognition.stop() } catch {}
    }
  }, [activeDose])

  useEffect(() => {
    if (!activeDose) return
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Medication Reminder', {
        body: `Time to take ${activeDose.medicationName} ${activeDose.dosage ?? ''}`,
      })
    }
  }, [activeDose])

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }, [])

  async function dismiss() {
    if (!activeDose) return
    const key = `${activeDose.medicationId}-${activeDose.time}`
    dismissed.add(key)
    await supabase.from('medication_history').insert({
      user_id: user?.id,
      medication_id: activeDose.medicationId,
      scheduled_time: new Date(activeDose.scheduledTimestamp).toISOString(),
      status: 'missed',
    })
    setActiveDose(null)
    setHeardText('')
  }

  async function snooze() {
    if (!activeDose) return
    const key = `${activeDose.medicationId}-${activeDose.time}`
    snoozedUntil.set(key, Date.now() + 5 * 60 * 1000)
    await supabase.from('medication_history').insert({
      user_id: user?.id,
      medication_id: activeDose.medicationId,
      scheduled_time: new Date(activeDose.scheduledTimestamp).toISOString(),
      status: 'skipped',
    })
    setActiveDose(null)
    setHeardText('')
  }

  async function markTaken() {
    if (!activeDose) return
    const key = `${activeDose.medicationId}-${activeDose.time}`
    dismissed.add(key)
    await supabase.from('medication_history').insert({
      user_id: user?.id,
      medication_id: activeDose.medicationId,
      scheduled_time: new Date(activeDose.scheduledTimestamp).toISOString(),
      status: 'taken',
      confirmed_at: new Date().toISOString(),
    })
    setActiveDose(null)
    setHeardText('')
  }

  async function loadAppointments() {
    const today = new Date().toISOString().slice(0, 10)
    const { data } = await supabase
      .from('appointments')
      .select('*')
      .gte('appointment_date', today)
    if (data) setAppointments(data as Appointment[])
  }

  useEffect(() => {
    loadAppointments()
    const id = window.setInterval(loadAppointments, 60000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const check = () => {
      if (activeAppt) return
      const now = Date.now()

      for (const appt of appointments) {
        if (!appt.appointment_time) continue
        const apptTimestamp = new Date(`${appt.appointment_date}T${appt.appointment_time}`).getTime()

        const minutesBefore = offsetToMinutes(appt.reminder_offset)
        if (minutesBefore !== null) {
          const upcomingKey = `${appt.id}-upcoming`
          const triggerTimestamp = apptTimestamp - minutesBefore * 60000
          const snoozeUntil = apptSnoozedUntil.get(upcomingKey)
          const diffMin = (now - triggerTimestamp) / 60000
          if (!apptDismissed.has(upcomingKey) && (!snoozeUntil || snoozeUntil <= now) && diffMin >= -0.5 && diffMin <= 30) {
            setActiveAppt({
              id: appt.id,
              title: appt.title,
              doctorName: appt.doctor_name,
              location: appt.location,
              kind: 'upcoming',
              label: `${appt.reminder_offset}`,
            })
            return
          }
        }

        const nowKey = `${appt.id}-now`
        const diffMinNow = (now - apptTimestamp) / 60000
        if (!apptDismissed.has(nowKey) && diffMinNow >= -0.5 && diffMinNow <= 30) {
          setActiveAppt({
            id: appt.id,
            title: appt.title,
            doctorName: appt.doctor_name,
            location: appt.location,
            kind: 'now',
            label: 'now',
          })
          return
        }
      }
    }
    const id = window.setInterval(check, 15000)
    check()
    return () => window.clearInterval(id)
  }, [appointments, activeAppt])

  useEffect(() => {
    if (!activeAppt) {
      if (apptSoundIntervalRef.current) {
        window.clearInterval(apptSoundIntervalRef.current)
        apptSoundIntervalRef.current = null
      }
      return
    }
    playAlertSound()
    apptSoundIntervalRef.current = window.setInterval(() => playAlertSound(), 3000)
    return () => {
      if (apptSoundIntervalRef.current) {
        window.clearInterval(apptSoundIntervalRef.current)
        apptSoundIntervalRef.current = null
      }
    }
  }, [activeAppt])

  useEffect(() => {
    if (!activeAppt) return
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Appointment Reminder', {
        body: activeAppt.kind === 'now'
          ? `${activeAppt.title} is starting now`
          : `${activeAppt.title} in ${activeAppt.label.replace(' before', '')}`,
      })
    }
  }, [activeAppt])

  function apptDismiss() {
    if (!activeAppt) return
    apptDismissed.add(`${activeAppt.id}-${activeAppt.kind}`)
    setActiveAppt(null)
  }

  function apptSnooze() {
    if (!activeAppt) return
    apptSnoozedUntil.set(`${activeAppt.id}-${activeAppt.kind}`, Date.now() + 5 * 60 * 1000)
    setActiveAppt(null)
  }

  return (
    <AlertContext.Provider value={{ activeDose, dismiss, markTaken, snooze }}>
      {children}
      {activeAppt && (
        <AppointmentBanner appt={activeAppt} onDismiss={apptDismiss} onSnooze={apptSnooze} />
      )}
      {activeDose && (
        <AlertBanner
          dose={activeDose}
          onDismiss={dismiss}
          onTaken={markTaken}
          onSnooze={snooze}
          listening={listening}
          heardText={heardText}
        />
      )}
    </AlertContext.Provider>
  )
}

function AlertBanner({
  dose, onDismiss, onTaken, onSnooze, listening, heardText,
}: {
  dose: ScheduledDose; onDismiss: () => void; onTaken: () => void; onSnooze: () => void
  listening: boolean; heardText: string
}) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
      <div className="card alert-pulse border-error-300 bg-error-50 p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-error-500 flex items-center justify-center text-white shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <path d="M12 2a7 7 0 0 0-7 7c0 3 2 5 2 7h10c0-2 2-4 2-7a7 7 0 0 0-7-7z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 21h6" strokeLinecap="round" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-error-900">Medication Reminder</p>
            <p className="text-sm text-error-800 mt-0.5">
              Time to take <strong>{dose.medicationName}</strong>
              {dose.dosage && ` ${dose.dosage}`}
              {dose.form && ` (${dose.form})`}
            </p>
            {listening && (
              <p className="text-xs text-error-600 mt-1.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-error-500 animate-pulse" />
                Listening... say "taken", "snooze", or "dismiss"
                {heardText && <span className="italic ml-1">— heard: "{heardText}"</span>}
              </p>
            )}
            <div className="flex gap-2 mt-3">
              <button onClick={onTaken} className="btn-accent text-xs px-3 py-1.5">Mark as Taken</button>
              <button onClick={onSnooze} className="btn-secondary text-xs px-3 py-1.5">Snooze 5 min</button>
              <button onClick={onDismiss} className="btn-secondary text-xs px-3 py-1.5">Dismiss</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AppointmentBanner({
  appt, onDismiss, onSnooze,
}: {
  appt: ActiveAppointment; onDismiss: () => void; onSnooze: () => void
}) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
      <div className="card alert-pulse border-warning-300 bg-warning-50 p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-warning-500 flex items-center justify-center text-white shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-warning-900">Appointment Reminder</p>
            <p className="text-sm text-warning-800 mt-0.5">
              <strong>{appt.title}</strong>
              {appt.doctorName && ` with ${appt.doctorName}`}
              {appt.location && ` · ${appt.location}`}
            </p>
            <p className="text-xs text-warning-700 mt-1">
              {appt.kind === 'now' ? 'Starting now' : `Coming up: ${appt.label}`}
            </p>
            <div className="flex gap-2 mt-3">
              <button onClick={onSnooze} className="btn-secondary text-xs px-3 py-1.5">Snooze 5 min</button>
              <button onClick={onDismiss} className="btn-secondary text-xs px-3 py-1.5">Dismiss</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}