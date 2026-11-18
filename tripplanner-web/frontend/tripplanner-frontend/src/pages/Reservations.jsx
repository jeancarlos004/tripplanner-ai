import { useState, useEffect } from 'react'
import { API_URL } from '../config.js'
import './Reservations.css'

const TYPE_ICONS  = { FLIGHT: '✈️', HOTEL: '🏨', ACTIVITY: '🎭' }

export default function Reservations() {
  const [trips, setTrips]           = useState([])
  const [selectedTrip, setSelectedTrip] = useState('')
  const [reservations, setReservations] = useState([])
  const [loading, setLoading]       = useState(false)
  const [showForm, setShowForm]     = useState(false)
  const [form, setForm]             = useState({ type: 'FLIGHT', details: '', price: '' })
  const [saving, setSaving]         = useState(false)

  useEffect(() => {
    fetch(`${API_URL}/trips`).then(r => r.json()).then(d => {
      const t = d.trips || []
      setTrips(t)
      if (t.length > 0) setSelectedTrip(t[0].tripId)
    })
  }, [])

  useEffect(() => { if (selectedTrip) loadReservations() }, [selectedTrip])

  async function loadReservations() {
    if (!selectedTrip) return
    setLoading(true)
    try {
      const r = await fetch(`${API_URL}/trips/${selectedTrip}/reservations`)
      const d = await r.json()
      setReservations(d.reservations || [])
    } finally { setLoading(false) }
  }

  async function createReservation(e) {
    e.preventDefault(); setSaving(true)
    try {
      const r = await fetch(`${API_URL}/trips/${selectedTrip}/reservations`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: form.type, details: form.details, price: parseFloat(form.price || 0) })
      })
      if (r.ok) {
        setShowForm(false)
        setForm({ type: 'FLIGHT', details: '', price: '' })
        await loadReservations()
      }
    } finally { setSaving(false) }
  }

  async function updateStatus(res, status) {
    await fetch(`${API_URL}/trips/${selectedTrip}/reservations/${res.reservationId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    })
    await loadReservations()
  }

  const currentTrip = trips.find(t => t.tripId === selectedTrip)

  return (
    <div className="reservations-page">
      <div className="res-header-row">
        <h1 className="page-title" style={{marginBottom:0}}>📋 Gestión de Reservas</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)} disabled={!selectedTrip}>
          {showForm ? '✕ Cancelar' : '+ Nueva reserva'}
        </button>
      </div>

      {trips.length > 0 && (
        <div className="trip-selector-card animate-fade-in">
          <label>Viaje asociado</label>
          <select value={selectedTrip} onChange={e => setSelectedTrip(e.target.value)}>
            {trips.map(t => (
              <option key={t.tripId} value={t.tripId}>
                {t.origin} → {t.destination} · {t.startDate}
              </option>
            ))}
          </select>
        </div>
      )}

      {showForm && selectedTrip && (
        <div className="res-create-form">
          <h3>📋 Nueva reserva {currentTrip ? `· ${currentTrip.destination}` : ''}</h3>
          <form onSubmit={createReservation}>
            <div className="grid-2">
              <div className="form-group">
                <label>Tipo</label>
                <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                  <option value="FLIGHT">✈️ Vuelo</option>
                  <option value="HOTEL">🏨 Hotel</option>
                  <option value="ACTIVITY">🎭 Actividad</option>
                </select>
              </div>
              <div className="form-group">
                <label>Precio (COP)</label>
                <input type="number" placeholder="0" value={form.price}
                  onChange={e => setForm({...form, price: e.target.value})} />
              </div>
            </div>
            <div className="form-group">
              <label>Detalles</label>
              <textarea rows={3} placeholder="Describe los detalles de la reserva..." value={form.details}
                onChange={e => setForm({...form, details: e.target.value})} required />
            </div>
            <div className="res-status-info">
              🔒 Las reservas nuevas se crean con estado <span className="badge badge-simulada" style={{marginLeft:4}}>SIMULADA</span>
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><div className="spinner" style={{width:16,height:16}} /> Guardando...</> : '💾 Registrar reserva'}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="loading"><div className="spinner" /> Cargando reservas...</div>
      ) : !selectedTrip ? (
        <div className="empty-state"><div className="icon">📋</div><p>Selecciona un viaje</p></div>
      ) : reservations.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📋</div>
          <p>No hay reservas para este viaje</p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>Crear primera reserva</button>
        </div>
      ) : (
        <div className="reservations-list stagger">
          {reservations.map((res, i) => (
            <div key={res.reservationId}
              className={`reservation-card type-${res.type} animate-fade-up`}
              style={{animationDelay:`${i*0.07}s`}}
            >
              <div className="res-type-icon">{TYPE_ICONS[res.type] || '📋'}</div>
              <div className="res-body">
                <div className="res-top">
                  <span className="res-type-label">{res.type}</span>
                  <span className={`badge badge-${res.status?.toLowerCase()}`}>{res.status}</span>
                </div>
                <div className="res-details">{res.details}</div>
                <div className="res-meta">
                  <span className="res-price">💰 ${parseFloat(res.price||0).toLocaleString()}</span>
                  <span>📅 {res.createdAt?.slice(0,10)}</span>
                </div>
              </div>
              <div className="res-actions">
                {res.status === 'SIMULADA' && (
                  <button className="btn btn-secondary" onClick={() => updateStatus(res,'PENDIENTE')}>
                    Pendiente →
                  </button>
                )}
                {res.status === 'PENDIENTE' && (
                  <button className="btn btn-secondary" onClick={() => updateStatus(res,'CONFIRMADA')}>
                    ✅ Confirmar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
