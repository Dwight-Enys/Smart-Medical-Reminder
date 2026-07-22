import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthenContext'
import { fetchNotifications, subscribeToNotifications } from '../lib/Notification'

const baseNavItems = [
  { to: '/', label: 'Dashboard', icon: HomeIcon },
  { to: '/medications', label: 'Medications', icon: PillIcon },
  { to: '/reminders', label: 'Reminders', icon: ClockIcon },
  { to: '/health', label: 'Health', icon: HeartIcon },
  { to: '/appointments', label: 'Appointments', icon: CalendarIcon },
  { to: '/contacts', label: 'Contacts', icon: PhoneIcon },
  { to: '/history', label: 'History', icon: ListIcon },
  { to: '/profile', label: 'Profile', icon: UserIcon },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  useEffect(() => {
    if (profile?.role !== 'caregiver' || !profile.id) {
      setUnreadCount(0)
      return
    }
    fetchNotifications(profile.id).then((rows) => {
      setUnreadCount(rows.filter((n) => !n.is_read).length)
    })
    const unsubscribe = subscribeToNotifications(profile.id, () => {
      setUnreadCount((c) => c + 1)
    })
    return unsubscribe
  }, [profile?.role, profile?.id])

  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const navItems = profile?.role === 'caregiver'
    ? [...baseNavItems.slice(0, 1), { to: '/caregiver', label: 'Caregiver', icon: BellIcon }, ...baseNavItems.slice(1)]
    : baseNavItems

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="hidden md:flex w-60 flex-col bg-white border-r border-slate-200 shrink-0">
        <div className="flex items-center gap-2 px-5 h-16 border-b border-slate-200">
          <div className="w-9 h-9 rounded-lg bg-primary-600 flex items-center justify-center text-white">
            <CrossIcon />
          </div>
          <div>
            <p className="font-semibold text-slate-800 leading-tight">MediRemind</p>
            <p className="text-xs text-slate-400">Smart Medical Reminder</p>
          </div>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.to
            return (
              <Link key={item.to} to={item.to}
                className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}>
                <span className="flex items-center gap-3">
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </span>
                {item.to === '/caregiver' && unreadCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-error-500 text-white text-[10px] font-semibold">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
        <div className="p-3 border-t border-slate-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            <LogoutIcon className="w-5 h-5" />
            Log Out
          </button>
        </div>
      </aside>

      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-slate-200 h-14 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center text-white">
            <CrossIcon />
          </div>
          <span className="font-semibold text-slate-800">MediRemind</span>
        </div>
        <button onClick={() => setMobileOpen((v) => !v)} className="p-2 rounded-lg hover:bg-slate-100" aria-label="Toggle menu">
          <MenuIcon />
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setMobileOpen(false)}>
          <div className="absolute right-0 top-0 bottom-0 w-64 bg-white shadow-xl py-4 px-3 space-y-1" onClick={(e) => e.stopPropagation()}>
            {navItems.map((item) => {
              const active = location.pathname === item.to
              return (
                <Link key={item.to} to={item.to}
                  className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                    active ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50'
                  }`}>
                  <span className="flex items-center gap-3">
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </span>
                  {item.to === '/caregiver' && unreadCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-error-500 text-white text-[10px] font-semibold">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>
              )
            })}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
            >
              <LogoutIcon className="w-5 h-5" />
              Log Out
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 min-w-0 pt-14 md:pt-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 fade-in">{children}</div>
      </main>
    </div>
  )
}

function HomeIcon({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1V9.5z" /></svg>
}
function PillIcon({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 20.5a7 7 0 0 1-9.9-9.9l9.9-9.9a7 7 0 0 1 9.9 9.9l-9.9 9.9z" /><path d="M8.5 8.5l7 7" /></svg>
}
function ClockIcon({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
}
function HeartIcon({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>
}
function CalendarIcon({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
}
function PhoneIcon({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.1-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2z" /></svg>
}
function ListIcon({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
}
function UserIcon({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
}
function BellIcon({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
}
function CrossIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" /></svg>
}
function MenuIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-6 h-6"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
}
function LogoutIcon({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>
}
