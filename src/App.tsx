import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Medications from './pages/Medications'
import Reminders from './pages/Reminders'
import Health from './pages/Health'
import Appointments from './pages/Appointments'
import Contacts from './pages/Contacts'
import History from './pages/History'
import Profile from './pages/Profile'
import Caregiver from './pages/Caregiver'
import Login from './pages/login'
import AlertProvider from './components/AlertProvider'
import AuthProvider from './contexts/AuthenContext'
import RequireAuth from './components/RequireAuth'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <RequireAuth>
                <AlertProvider>
                  <Layout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/medications" element={<Medications />} />
                      <Route path="/reminders" element={<Reminders />} />
                      <Route path="/health" element={<Health />} />
                      <Route path="/appointments" element={<Appointments />} />
                      <Route path="/contacts" element={<Contacts />} />
                      <Route path="/history" element={<History />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/caregiver" element={<Caregiver />} />
                    </Routes>
                  </Layout>
                </AlertProvider>
              </RequireAuth>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
