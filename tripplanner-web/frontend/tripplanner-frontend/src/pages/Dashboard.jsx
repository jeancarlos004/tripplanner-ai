import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { API_URL } from '../config.js'
import './Dashboard.css'

const QUICK = [
  { to: '/chat',         icon: '💬', label: 'Asistente IA',    desc: 'Planifica con inteligencia artificial' },
  { to: '/flights',      icon: '✈️', label: 'Buscar vuelos',   desc: 'Tarifas reales en tiempo real' },
  { to: '/weather',      icon: '🌤️', label: 'Consultar clima', desc: 'Pronóstico de tu destino' },
  { to: '/trips',        icon: '🗺️', label: 'Nuevo viaje',     desc: 'Organiza tu itinerario' },
]

export default function Dashboard() {
  const [trips, setTrips]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_URL}/trips`)
      .then(r => r.json())
      .then(d => setTrips(d.trips || []))
      .catch(() => setTrips([]))
      .finally(() => setLoading(false))
  }, [])

  const upcoming   = trips.filter(t => t.status !== 'COMPLETED').slice(0, 3)
  const completed  = trips.filter(t => t.status === 'COMPLETED').length

  return (
    <div className="dashboard">

      {/* Hero */}
      <div className="dash-hero">
        <div className="hero-plane">✈️</div>
        <div className="dash-hero-content">
          <h1 className="dash-title">
            Bienvenido a <span>TripPlanner AI</span>
          </h1>
          <p className="dash-subtitle">
            Tu asistente inteligente para planificar, organizar y gestionar viajes ✨
          </p>
          <div className="dash-hero-actions">
            <Link to="/chat" className="btn btn-primary">💬 Hablar con el asistente</Link>
            <Link to="/trips" className="btn btn-ghost">+ Crear viaje</Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid stagger">
        {[
          { icon: '🗺️', value: trips.length,     label: 'Viajes totales'    },
          { icon: '📅', value: upcoming.length,  label: 'Próximos viajes'   },
          { icon: '✅', value: completed,         label: 'Completados'       },
          { icon: '🤖', value: 'IA',              label: 'Asistente activo'  },
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

      {/* Quick actions */}
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

      {/* Upcoming trips */}
      <div className="section-title">Próximos viajes</div>
      {loading ? (
        <div className="loading"><div className="spinner" /> Cargando viajes...</div>
      ) : upcoming.length === 0 ? (
        <div className="empty-state">
          <div className="icon">🗺️</div>
          <p>No tienes viajes próximos aún</p>
          <Link to="/trips" className="btn btn-primary">Crear primer viaje</Link>
        </div>
      ) : (
        <div className="trips-preview stagger">
          {upcoming.map(trip => (
            <Link to="/trips" key={trip.tripId} className="trip-preview-card animate-fade-up">
              <div className="trip-dest">{trip.destination}</div>
              <div className="trip-dates">{trip.startDate} → {trip.endDate}</div>
              <div className="trip-meta">
                <span>👥 {trip.travelers} viajeros</span>
                <span className={`badge badge-${trip.status?.toLowerCase()}`}>{trip.status}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
