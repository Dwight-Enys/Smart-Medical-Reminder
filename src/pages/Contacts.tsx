import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthenContext'
import { playBeep } from '../lib/alert'
import type { EmergencyContact } from '../types'
import Modal from '../components/Modal'

export default function Contacts() {
  const { user } = useAuth()
  const [contacts, setContacts] = useState<EmergencyContact[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<EmergencyContact | null>(null)
  const [form, setForm] = useState({ contact_name: '', relationship: '', phone: '', email: '' })

  const load = useCallback(async () => {
    const { data } = await supabase.from('emergency_contacts').select('*').order('created_at', { ascending: false })
    setContacts(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setEditing(null)
    setForm({ contact_name: '', relationship: '', phone: '', email: '' })
    setModalOpen(true)
  }

  function openEdit(c: EmergencyContact) {
    setEditing(c)
    setForm({ contact_name: c.contact_name, relationship: c.relationship ?? '', phone: c.phone, email: c.email ?? '' })
    setModalOpen(true)
  }

  async function save() {
    if (!form.contact_name.trim() || !form.phone.trim()) return
    const payload = { contact_name: form.contact_name.trim(), relationship: form.relationship || null, phone: form.phone.trim(), email: form.email || null }
    if (editing) {
      await supabase.from('emergency_contacts').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('emergency_contacts').insert({ ...payload, user_id: user?.id })
    }
    playBeep()
    setModalOpen(false)
    load()
  }

  async function remove(c: EmergencyContact) {
    if (!confirm(`Delete ${c.contact_name}?`)) return
    await supabase.from('emergency_contacts').delete().eq('id', c.id)
    load()
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Emergency Contacts</h1>
          <p className="text-slate-500 text-sm mt-1">{contacts.length} contact(s)</p>
        </div>
        <button onClick={openAdd} className="btn-primary"><PlusIcon /> Add Contact</button>
      </div>

      {contacts.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-slate-400">No emergency contacts yet.</p>
          <button onClick={openAdd} className="btn-primary mt-4">Add your first contact</button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {contacts.map((c) => (
            <div key={c.id} className="card p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-error-100 flex items-center justify-center text-error-600"><PhoneIcon /></div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-800 truncate">{c.contact_name}</h3>
                  {c.relationship && <p className="text-xs text-slate-500">{c.relationship}</p>}
                  <a href={`tel:${c.phone}`} className="text-sm text-primary-600 hover:underline block mt-1">{c.phone}</a>
                  {c.email && <a href={`mailto:${c.email}`} className="text-xs text-slate-500 hover:underline block truncate">{c.email}</a>}
                </div>
              </div>
              <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
                <button onClick={() => openEdit(c)} className="btn-secondary text-xs flex-1">Edit</button>
                <button onClick={() => remove(c)} className="btn-danger text-xs">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Contact' : 'Add Contact'}>
        <div className="space-y-3">
          <div>
            <label className="label">Contact Name *</label>
            <input className="input" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} placeholder="e.g. Jane Doe" autoFocus />
          </div>
          <div>
            <label className="label">Relationship</label>
            <input className="input" value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} placeholder="e.g. Spouse, Parent" />
          </div>
          <div>
            <label className="label">Phone Number *</label>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="e.g. +1 555 000 0000" />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="e.g. jane@example.com" />
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={save} className="btn-primary flex-1">{editing ? 'Save Changes' : 'Add Contact'}</button>
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function PlusIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4"><path d="M12 5v14M5 12h14" /></svg> }
function PhoneIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.1-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6a2 2 0 0 1 1.7 2z" /></svg> }