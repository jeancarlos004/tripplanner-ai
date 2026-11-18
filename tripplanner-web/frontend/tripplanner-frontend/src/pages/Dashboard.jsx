import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import { useAuth } from '../lib/AuthContext.jsx'
import { TripCard, ReservationList } from '../components/AgentCards.jsx'
import './Dashboard.css'

const QUICK = [
  { to: '/chat',         icon: '💬', label: 'Asistente IA',    desc: 'Planifica conversando con los agentes' },
  { to: '/flights',      icon: '✈️', label: 'Buscar vuelos',   desc: 'Tarifas reales vía MCP' },
  { to: '/weather',      icon: '🌤️', label: 'Consultar clima', desc: 'Pronóstico por destino y fechas' },
  { to: '/trips',        icon: '🗺️', label: 'Mis viajes',      desc: 'Itinerarios y preferencias' },
]

export default function Dashboard() {
  const { user } = useAuth()
  const [trips, setTrips] = useState([])
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api.getTrips(), api.getReservations()])
      .then(([t, r]) => { setTrips(t.trips || []); setReservations(r.reservations || []) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = trips
    .filter(t => t.endDate >= today && !['COMPLETED', 'CANCELLED'].includes(t.status))
    .sort((a, b) => (a.startDate > b.startDate ? 1 : -1))
  const recent = reservations.slice(0, 4)

  return (
    <div className="dashboard">
      <div className="dash-hero">
        <div className="hero-plane">✈️</div>
        <div className="dash-hero-content">
          <h1 className="dash-title">Hola{user?.name ? `, ${user.name}` : ''} 👋 <span>TripPlanner AI</span></h1>
          <p className="dash-subtitle">Tu asistente inteligente para planificar, organizar y gestionar viajes ✨</p>
          <div className="dash-hero-actions">
            <Link to="/chat" className="btn btn-primary">💬 Hablar con el asistente</Link>
            <Link to="/trips" className="btn btn-ghost">+ Crear viaje</Link>
          </div>
        </div>
      </div>

      {error && <div className="flight-error">⚠️ {error}</div>}

      <div className="stats-grid stagger">
        {[
          { icon: '🗺️', value: trips.length,        label: 'Viajes totales' },
          { icon: '📅', value: upcoming.length,     label: 'Próximos viajes' },
          { icon: '📋', value: reservations.length, label: 'Reservas' },
          { icon: '🤖', value: '3',                 label: 'Agentes activos' },
        ].map((s, i) => (
          <div key={i} className="stat-card animate-fade-up">
            <div className="stat-icon">{s.icon}</div>
            <div>
              <div className="stat-value">{loading && i < 3 ? '—' : s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="section-title">Accesos rápidos</div>
      <div className="quick-actions stagger">
        {QUICK.map(({ to, icon, label, desc }) => (
          <Link key={to} to={to} className="quick-card animate-fade-up">
            <span className="quick-icon">{icon}</span>
            <span className="quick-label">{label}</span>
            <span className="quick-desc">{desc}</span>
            <span className="quick-arrow">→</span>
          </Link>
        ))}
      </div>

      <div className="section-title">Próximos viajes</div>
      {loading ? (
        <div className="loading"><div className="spinner" /> Cargando…</div>
      ) : upcoming.length === 0 ? (
        <div className="empty-state">
          <div className="icon">🗺️</div>
          <p>No tienes viajes próximos aún</p>
          <Link to="/chat" className="btn btn-primary">Planear con el asistente</Link>
        </div>
      ) : (
        <div className="ac-trips stagger">
          {upcoming.slice(0, 3).map(t => (
            <Link key={t.tripId} to={`/trips/${t.tripId}`} className="trip-link animate-fade-up"><TripCard trip={t} compact /></Link>
          ))}
        </div>
      )}

      {!loading && (
        <>
          <div className="section-title" style={{ marginTop: 28 }}>Reservas recientes</div>
          <ReservationList reservations={recent} />
        </>
      )}
    </div>
  )
}
