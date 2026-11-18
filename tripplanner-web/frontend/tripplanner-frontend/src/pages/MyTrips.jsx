import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import { TripCard, ItineraryAgenda, ReservationList, PreferencesCard } from '../components/AgentCards.jsx'
import { fmtDate, TRIP_STATUS } from '../lib/format.js'
import './MyTrips.css'

const EMPTY = { origin: '', destination: '', startDate: '', endDate: '', travelers: 1, budget: '', currency: 'COP', preferences: '' }

function daysBetween(start, end) {
  const out = []
  for (let d = new Date(`${start}T12:00:00`); d <= new Date(`${end}T12:00:00`); d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

// "09:00 Título - Lugar"  ⇄  {time, title, location}
const toLines = acts => (acts || []).map(a => `${a.time ? a.time + ' ' : ''}${a.title}${a.location ? ' - ' + a.location : ''}`).join('\n')
const fromLines = text => text.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
  const m = l.match(/^(\d{1,2}:\d{2})\s+(.*)$/)
  const [title, location] = (m ? m[2] : l).split(/\s+-\s+/, 2)
  return { ...(m ? { time: m[1] } : {}), title: title.trim(), ...(location ? { location: location.trim() } : {}) }
})

export default function MyTrips() {
  const { tripId } = useParams()
  return tripId ? <TripDetail tripId={tripId} /> : <TripList />
}

// ── Listado + creación + preferencias ───────────────────────────────────────
function TripList() {
  const navigate = useNavigate()
  const [trips, setTrips] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [editPrefs, setEditPrefs] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [t, p] = await Promise.all([api.getTrips(), api.getProfile()])
      setTrips(t.trips || []); setProfile(p.profile)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  async function createTrip(e) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const res = await api.createTrip({ ...form, travelers: parseInt(form.travelers, 10), budget: Number(form.budget) })
      setForm(EMPTY); setShowForm(false)
      navigate(`/trips/${res.tripId}`)
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="mytrips-page">
      <div className="trips-header">
        <h1 className="page-title" style={{ marginBottom: 0 }}>🗺️ Mis Viajes</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)} type="button">
          {showForm ? '✕ Cancelar' : '+ Nuevo viaje'}
        </button>
      </div>

      {error && <div className="flight-error">⚠️ {error}</div>}

      {showForm && (
        <div className="trip-create-form">
          <h3>✈️ Crear nuevo viaje</h3>
          <form onSubmit={createTrip}>
            <div className="grid-2">
              <Field label="Ciudad de origen"><input placeholder="Bogotá" value={form.origin} maxLength={100} onChange={e => setForm({ ...form, origin: e.target.value })} required /></Field>
              <Field label="Ciudad de destino"><input placeholder="Cartagena" value={form.destination} maxLength={100} onChange={e => setForm({ ...form, destination: e.target.value })} required /></Field>
              <Field label="Fecha de salida"><input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} required /></Field>
              <Field label="Fecha de regreso"><input type="date" min={form.startDate} value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} required /></Field>
              <Field label="Número de viajeros"><input type="number" min="1" max="20" value={form.travelers} onChange={e => setForm({ ...form, travelers: e.target.value })} required /></Field>
              <Field label="Presupuesto total">
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="number" min="1" placeholder="5000000" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} required />
                  <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} style={{ width: 100 }}>
                    <option>COP</option><option>USD</option><option>EUR</option>
                  </select>
                </div>
              </Field>
            </div>
            <Field label="Preferencias">
              <textarea placeholder="Actividades culturales, playas, gastronomía…" value={form.preferences} maxLength={1000}
                onChange={e => setForm({ ...form, preferences: e.target.value })} rows={2} />
            </Field>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Guardando…</> : '💾 Crear viaje'}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="loading"><div className="spinner" /> Cargando viajes…</div>
      ) : trips.length === 0 ? (
        <div className="empty-state">
          <div className="icon">🗺️</div>
          <p>No tienes viajes aún. Créalo aquí o pídeselo al asistente.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => setShowForm(true)} type="button">Crear viaje</button>
            <Link className="btn btn-ghost" to="/chat">💬 Planear con IA</Link>
          </div>
        </div>
      ) : (
        <div className="trips-grid stagger">
          {trips.map(trip => (
            <Link key={trip.tripId} to={`/trips/${trip.tripId}`} className="trip-link animate-fade-up">
              <TripCard trip={trip} />
            </Link>
          ))}
        </div>
      )}

      <div className="section-title" style={{ marginTop: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Preferencias de viaje</span>
        <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setEditPrefs(!editPrefs)} type="button">
          {editPrefs ? 'Cancelar' : '✏️ Editar'}
        </button>
      </div>
      {editPrefs
        ? <PreferencesForm prefs={profile?.preferences || {}} onSaved={p => { setProfile({ ...profile, preferences: p }); setEditPrefs(false) }} />
        : <PreferencesCard prefs={profile?.preferences} />}
    </div>
  )
}

function Field({ label, children }) {
  return <div className="form-group"><label>{label}</label>{children}</div>
}

function PreferencesForm({ prefs, onSaved }) {
  const [p, setP] = useState({
    homeCity: prefs.homeCity || '', budgetLevel: prefs.budgetLevel || '', travelPace: prefs.travelPace || '',
    accommodationType: prefs.accommodationType || '', seatPreference: prefs.seatPreference || '',
    activityTypes: (prefs.activityTypes || []).join(', '), preferredAirlines: (prefs.preferredAirlines || []).join(', '),
    dietaryRestrictions: prefs.dietaryRestrictions || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const list = s => s.split(',').map(x => x.trim()).filter(Boolean)

  async function save(e) {
    e.preventDefault(); setSaving(true); setError('')
    try {
      const body = { ...p, activityTypes: list(p.activityTypes), preferredAirlines: list(p.preferredAirlines) }
      const res = await api.updateProfile({ preferences: body })
      onSaved(res.profile.preferences)
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  return (
    <form className="card" onSubmit={save}>
      <div className="grid-2">
        <Field label="Ciudad de origen habitual"><input value={p.homeCity} maxLength={80} onChange={e => setP({ ...p, homeCity: e.target.value })} /></Field>
        <Field label="Nivel de presupuesto">
          <select value={p.budgetLevel} onChange={e => setP({ ...p, budgetLevel: e.target.value })}>
            <option value="">—</option><option>económico</option><option>moderado</option><option>premium</option>
          </select>
        </Field>
        <Field label="Tipos de actividades (separadas por coma)"><input value={p.activityTypes} maxLength={300} onChange={e => setP({ ...p, activityTypes: e.target.value })} placeholder="playa, cultura, gastronomía" /></Field>
        <Field label="Aerolíneas preferidas"><input value={p.preferredAirlines} maxLength={200} onChange={e => setP({ ...p, preferredAirlines: e.target.value })} placeholder="Avianca, LATAM" /></Field>
        <Field label="Alojamiento"><input value={p.accommodationType} maxLength={80} onChange={e => setP({ ...p, accommodationType: e.target.value })} placeholder="hotel boutique" /></Field>
        <Field label="Ritmo de viaje">
          <select value={p.travelPace} onChange={e => setP({ ...p, travelPace: e.target.value })}>
            <option value="">—</option><option>relajado</option><option>equilibrado</option><option>intenso</option>
          </select>
        </Field>
        <Field label="Asiento"><input value={p.seatPreference} maxLength={40} onChange={e => setP({ ...p, seatPreference: e.target.value })} placeholder="ventana" /></Field>
        <Field label="Restricciones alimentarias"><input value={p.dietaryRestrictions} maxLength={200} onChange={e => setP({ ...p, dietaryRestrictions: e.target.value })} /></Field>
      </div>
      {error && <div className="flight-error">⚠️ {error}</div>}
      <button className="btn btn-primary" disabled={saving} type="submit">{saving ? 'Guardando…' : '💾 Guardar preferencias'}</button>
    </form>
  )
}

// ── Detalle: viaje + itinerario (agenda) + reservas ─────────────────────────
function TripDetail({ tripId }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [editingDay, setEditingDay] = useState(null)
  const [dayText, setDayText] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try { setData(await api.getTrip(tripId)) } catch (e) { setError(e.message) }
  }, [tripId])
  useEffect(() => { load() }, [load])

  async function setStatus(status) {
    setBusy(true)
    try { await api.updateTrip(tripId, { status }); await load() } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  async function saveDay(e) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      await api.updateItinerary(tripId, editingDay, { activities: fromLines(dayText) })
      setEditingDay(null); await load()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  if (error && !data) return <div className="mytrips-page"><BackLink /><div className="flight-error">⚠️ {error}</div></div>
  if (!data) return <div className="mytrips-page"><div className="loading"><div className="spinner" /> Cargando viaje…</div></div>

  const { trip, itinerary, reservations } = data
  const byDate = Object.fromEntries(itinerary.map(d => [d.date, d]))
  const allDays = daysBetween(trip.startDate, trip.endDate)

  return (
    <div className="mytrips-page">
      <BackLink />
      <h1 className="page-title">{trip.name || `${trip.origin} → ${trip.destination}`}</h1>
      {error && <div className="flight-error">⚠️ {error}</div>}

      <TripCard trip={trip}>
        <div className="trip-actions">
          {Object.entries(TRIP_STATUS).filter(([k]) => k !== trip.status).map(([k, v]) => (
            <button key={k} className="btn btn-secondary" disabled={busy} onClick={() => setStatus(k)} type="button">→ {v.label}</button>
          ))}
          <Link className="btn btn-ghost" to={`/reservations?trip=${trip.tripId}`}>📋 Nueva reserva</Link>
        </div>
      </TripCard>

      <ItineraryAgenda days={itinerary} title="📅 Itinerario (agenda)" />

      <div className="section-title" style={{ marginTop: 20 }}>Editar itinerario por día</div>
      <div className="day-chips">
        {allDays.map((d, i) => (
          <button key={d} type="button" className={`day-chip ${byDate[d] ? 'has' : ''} ${editingDay === d ? 'on' : ''}`}
            onClick={() => { setEditingDay(d); setDayText(toLines(byDate[d]?.activities)) }}>
            Día {i + 1} · {fmtDate(d)}
          </button>
        ))}
      </div>
      {editingDay && (
        <form className="card" onSubmit={saveDay} style={{ marginTop: 10 }}>
          <label className="form-group" style={{ display: 'block' }}>
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Una actividad por línea · formato: <code>09:00 Título - Lugar</code></span>
            <textarea rows={6} value={dayText} onChange={e => setDayText(e.target.value)} placeholder={'09:00 Tour por la Ciudad Amurallada - Centro Histórico\n14:00 Playa - Islas del Rosario'} required />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" disabled={busy || !dayText.trim()} type="submit">💾 Guardar día</button>
            <button className="btn btn-ghost" type="button" onClick={() => setEditingDay(null)}>Cancelar</button>
          </div>
        </form>
      )}

      <ReservationList reservations={reservations} />
    </div>
  )
}

function BackLink() {
  return <Link to="/trips" className="ac-link" style={{ display: 'inline-block', marginBottom: 14 }}>← Volver a Mis viajes</Link>
}
