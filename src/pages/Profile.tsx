import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthenContext'
import { supabase } from '../lib/supabase'

export default function ProfilePage() {
  const { profile, user, refreshProfile } = useAuth()
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [updating, setUpdating] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '')
      setPhone(profile.phone || '')
    }
  }, [profile])

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault()
    setUpdating(true)
    setMessage(null)

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        phone: phone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user?.id)

    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'Profile updated successfully!' })
      await refreshProfile()
    }
    setUpdating(false)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-blue-600 rounded-xl px-5 py-4 -mx-1">
        <h1 className="text-2xl font-bold text-white">My Profile</h1>
        <p className="text-blue-100 text-sm mt-1">Manage your personal information</p>
      </div>

      <div className="card p-6">
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Full Name</label>
              <input 
                className="input" 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)} 
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="label">Email Address</label>
              <input className="input bg-slate-50" value={profile?.email || ''} disabled />
            </div>
            <div>
              <label className="label">Phone Number</label>
              <input 
                className="input" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)} 
                placeholder="+1 234 567 890"
              />
            </div>
            <div>
              <label className="label">Account Role</label>
              <div className="input bg-slate-50 flex items-center capitalize font-medium text-slate-700">
                {profile?.role || 'Patient'}
              </div>
            </div>
          </div>

          {/* CAREGIVER SPECIFIC: Show License Number */}
          {profile?.role === 'caregiver' && (
            <div className="bg-primary-50 border border-primary-100 rounded-lg p-4 mt-2">
              <label className="text-xs font-bold text-primary-700 uppercase tracking-wider">Your Caregiver License</label>
              <p className="text-2xl font-mono font-bold text-primary-900 mt-1">{profile.license_number}</p>
              <p className="text-xs text-primary-600 mt-1">Share this code with your patients so they can link you to their account.</p>
            </div>
          )}

          {message && (
            <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-accent-50 text-accent-700 border border-accent-200' : 'bg-error-50 text-error-700 border border-error-200'}`}>
              {message.text}
            </div>
          )}

          <div className="pt-2">
            <button type="submit" disabled={updating} className="btn-primary w-full md:w-auto px-8">
              {updating ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
