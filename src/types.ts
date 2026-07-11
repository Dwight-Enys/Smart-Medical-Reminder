export type MedicationForm = 'Tablet' | 'Capsule' | 'Syrup' | 'Injection' | 'Inhaler' | 'Drops' | 'Topical' | 'Other'

export interface Profile {
  id: string
  username: string | null
  full_name: string | null
  date_of_birth: string | null
  gender: string | null
  email: string | null
  phone: string | null
  timezone: string | null
}

export interface Medication {
  id: string
  user_id: string
  name: string
  dosage: string | null
  form: string | null
  reason: string | null
  start_date: string | null
  end_date: string | null
  notes: string | null
  created_at: string
}

export type Frequency = 'daily' | 'every_x_hours' | 'weekly' | 'custom'

export interface Reminder {
  id: string
  user_id: string
  medication_id: string
  reminder_times: string[]
  frequency: Frequency
  interval_hours: number | null
  weekdays: number[]
  meal_relation: string
  enabled: boolean
  snooze_minutes: number
  created_at: string
  medication?: Medication
}

export interface HealthLog {
  id: string
  user_id: string
  log_date: string
  blood_pressure: string | null
  blood_sugar: number | null
  heart_rate: number | null
  weight: number | null
  notes: string | null
  created_at: string
}

export interface Appointment {
  id: string
  user_id: string
  title: string
  doctor_name: string | null
  appointment_date: string
  appointment_time: string | null
  location: string | null
  notes: string | null
  reminder_offset: string | null
  created_at: string
}

export interface EmergencyContact {
  id: string
  user_id: string
  contact_name: string
  relationship: string | null
  phone: string
  email: string | null
  created_at: string
}

export type DoseStatus = 'taken' | 'missed' | 'skipped'

export interface MedicationHistory {
  id: string
  user_id: string
  medication_id: string | null
  scheduled_time: string
  status: DoseStatus
  confirmed_at: string | null
  created_at: string
  medication?: Medication
}