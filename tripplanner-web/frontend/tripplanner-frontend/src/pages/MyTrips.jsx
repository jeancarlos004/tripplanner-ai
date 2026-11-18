import { useState, useEffect } from 'react'
import { API_URL } from '../config.js'
import './MyTrips.css'

export default function MyTrips() {
  const [trips, setTrips]     = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ origin:'', destination:'', startDate:'', endDate:'', travelers:1, budget:'', preferences:'' })
  const [saving, setSaving]   = useState(false)
  const [selected, setSelected] = useState(null)

  useEffect(() => { loadTrips() }, [])

  async function loadTrips() {
    setLoading(true)
    try {
      const r = await fetch(`${API_URL}/trips`)
      const d = await r.json()
      setTrips(d.trips || [])
    } finally { setLoading(false) }
  }

  async function createTrip(e) {
    e.preventDefault(); setSaving(true)
    try {
      const r = await fetch(`${API_URL}/trips`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, travelers: parseInt(form.travelers), budget: parseFloat(form.budget) })
      })
      if (r.ok) {
        setShowForm(false)
        setForm({ origin:'', destination:'', startDate:'', endDate:'', travelers:1, budget:'', preferences:'' })
        await loadTrips()
      }
    } finally { setSaving(false) }
  }

  async function updateStatus(trip, status) {
    await fetch(`${API_URL}/trips/${trip.tripId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    })
    await loadTrips()
  }

  return (
    <div className="mytrips-page">
      <div className="trips-header">
        <h1 className="page-title" style={{marginBottom:0}}>🗺️ Mis Viajes</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Cancelar' : '+ Nuevo viaje'}
        </button>
      </div>

      {showForm && (
        <div className="trip-create-form">
          <h3>✈️ Crear nuevo viaje</h3>
          <form onSubmit={createTrip}>
            <div className="grid-2">
              <div className="form-group">
                <label>Ciudad de origen</label>
                <input placeholder="Bogotá" value={form.origin} onChange={e => setForm({...form, origin: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Ciudad de destino</label>
                <input placeholder="Cartagena" value={form.destination} onChange={e => setForm({...form, destination: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Fecha de salida</label>
                <input type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Fecha de regreso</label>
                <input type="date" value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Número de viajeros</label>
                <input type="number" min="1" value={form.travelers} onChange={e => setForm({...form, travelers: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Presupuesto (COP)</label>
                <input type="number" placeholder="5000000" value={form.budget} onChange={e => setForm({...form, budget: e.target.value})} required />
              </div>
            </div>
            <div className="form-group">
              <label>Preferencias</label>
              <textarea placeholder="Actividades culturales, playas, gastronomía..." value={form.preferences}
                onChange={e => setForm({...form, preferences: e.target.value})} rows={2} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><div className="spinner" style={{width:16,height:16}} /> Guardando...</> : '💾 Crear viaje'}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="loading"><div className="spinner" /> Cargando viajes...</div>
      ) : trips.length === 0 ? (
        <div className="empty-state">
          <div className="icon">🗺️</div>
          <p>No tienes viajes aún</p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>Crear primer viaje</button>
        </div>
      ) : (
        <div className="trips-grid stagger">
          {trips.map((trip, i) => (
            <div key={trip.tripId}
              className={`trip-card animate-fade-up ${selected === trip.tripId ? 'selected' : ''}`}
              style={{animationDelay:`${i*0.07}s`}}
              onClick={() => setSelected(selected === trip.tripId ? null : trip.tripId)}
            >
              <div className="trip-card-header">
                <div>
                  <div className="trip-origin">{trip.origin}</div>
                  <div className="trip-route">{trip.destination}</div>
                  <div className="trip-dates-text">{trip.startDate} → {trip.endDate}</div>
                </div>
                <span className={`badge badge-${trip.status?.toLowerCase()}`}>{trip.status}</span>
              </div>

              <div className="trip-card-body">
                <div className="trip-stat">
                  <span className="trip-stat-icon">👥</span>
                  <span>{trip.travelers} viajeros</span>
                </div>
                <div className="trip-stat">
                  <span className="trip-stat-icon">💰</span>
                  <span className="trip-budget">${parseFloat(trip.budget||0).toLocaleString()}</span>
                </div>
              </div>

              {trip.preferences && (
                <div className="trip-prefs">📌 {trip.preferences}</div>
              )}

              {selected === trip.tripId && (
                <div className="trip-actions" onClick={e => e.stopPropagation()}>
                  {trip.status !== 'CONFIRMED' && (
                    <button className="btn btn-secondary" onClick={() => updateStatus(trip,'CONFIRMED')}>✅ Confirmar</button>
                  )}
                  {trip.status !== 'COMPLETED' && (
                    <button className="btn btn-secondary" onClick={() => updateStatus(trip,'COMPLETED')}>🏁 Completar</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
