import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import { useAuth } from '../lib/AuthContext.jsx'
import { useCountUp, useReveal } from '../lib/motion.js'
import { TripCard, ReservationList } from '../components/AgentCards.jsx'
import RouteMap from '../components/RouteMap.jsx'
import Icon from '../components/Icon.jsx'
import { money, fmtDate, nights } from '../lib/format.js'
import './Dashboard.css'

const QUICK = [
  { to: '/chat',    icon: 'sparkles', tone: 'agent', label: 'Planear con IA',  desc: 'Conversa con los tres agentes' },
  { to: '/flights', icon: 'plane',    tone: 'sky',   label: 'Buscar vuelos',   desc: 'Tarifas reales vía MCP' },
  { to: '/weather', icon: 'weather',  tone: 'sun',   label: 'Consultar clima', desc: 'Pronóstico por fechas' },
  { to: '/trips',   icon: 'map',      tone: 'sea',   label: 'Mis viajes',      desc: 'Itinerarios y preferencias' },
]

function Stat({ value, label, tone, icon }) {
  const ref = useRef(null)
  useCountUp(ref, value)
  return (
    <div className={`stat tone-${tone}`} data-reveal>
      <span className="stat-icon"><Icon name={icon} size={18} /></span>
      <span className="stat-value mono" ref={ref}>{Number.isFinite(value) ? value : '—'}</span>
      <span className="stat-label">{label}</span>
    </div>
  )
}

function daysUntil(iso) {
  const ms = new Date(`${iso}T00:00:00`) - new Date(new Date().toDateString())
  return Math.max(0, Math.round(ms / 86_400_000))
}

function Countdown({ days }) {
  const ref = useRef(null)
  useCountUp(ref, days || NaN, { duration: 1.6 })
  if (days === 0) return <span className="countdown"><b className="today">¡Hoy despegas!</b></span>
  return <span className="countdown"><b className="mono" ref={ref}>{days}</b><small>{days === 1 ? 'día' : 'días'} para despegar</small></span>
}

export default function Dashboard() {
  const { user } = useAuth()
  const [trips, setTrips] = useState([])
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const listRef = useRef(null)

  useEffect(() => {
    Promise.all([api.getTrips(), api.getReservations()])
      .then(([t, r]) => { setTrips(t.trips || []); setReservations(r.reservations || []) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])
  useReveal(listRef, [loading])

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = trips
    .filter(t => t.endDate >= today && !['COMPLETED', 'CANCELLED'].includes(t.status))
    .sort((a, b) => (a.startDate > b.startDate ? 1 : -1))
  const next = upcoming[0]
  const plannedDays = trips.reduce((n, t) => n + nights(t.startDate, t.endDate) + 1, 0)

  return (
    <div className="dashboard">
      <section className="dash-hero" data-reveal>
        <div className="dash-hero-copy">
          <div className="page-kicker">{next ? 'Próximo despegue' : 'Tu bitácora de viaje'}</div>
          <h1 className="dash-title">
            {next ? <>Rumbo a <span>{next.destination}</span></> : <>Hola{user?.name ? `, ${user.name}` : ''}. ¿A dónde vamos?</>}
          </h1>
          {next ? (
            <>
              <div className="dash-facts">
                <span><Icon name="calendar" size={15} /> {fmtDate(next.startDate)} – {fmtDate(next.endDate)}</span>
                <span><Icon name="users" size={15} /> {next.travelers} viajero{next.travelers > 1 ? 's' : ''}</span>
                <span><Icon name="wallet" size={15} /> {money(next.budget, next.currency || 'COP')}</span>
              </div>
              <Countdown days={daysUntil(next.startDate)} />
            </>
          ) : (
            <p className="dash-subtitle">Cuéntale al asistente tu idea de viaje: buscará vuelos y clima en paralelo y armará el itinerario contigo.</p>
          )}
          <div className="dash-hero-actions">
            <Link to="/chat" className="btn btn-primary"><Icon name="sparkles" /> Hablar con el asistente</Link>
            {next
              ? <Link to={`/trips/${next.tripId}`} className="btn btn-ghost">Ver itinerario <Icon name="arrow" /></Link>
              : <Link to="/trips" className="btn btn-ghost"><Icon name="plus" /> Crear viaje</Link>}
          </div>
        </div>
        <div className="dash-hero-map">
          <RouteMap from={next?.origin || 'Bogotá'} to={next?.destination || 'Cartagena'}
            caption={next ? `${nights(next.startDate, next.endDate)} noches` : 'Tu próxima ruta'} />
        </div>
      </section>

      {error && <div className="flight-error">{error}</div>}

      <div className="stats-grid">
        <Stat value={loading ? NaN : trips.length}        label="Viajes guardados" tone="sea"   icon="map" />
        <Stat value={loading ? NaN : upcoming.length}     label="Próximos"         tone="sky"   icon="plane" />
        <Stat value={loading ? NaN : reservations.length} label="Reservas"         tone="coral" icon="ticket" />
        <Stat value={loading ? NaN : plannedDays}         label="Días planificados" tone="sun"  icon="calendar" />
      </div>

      <div className="section-title" data-reveal>Accesos rápidos</div>
      <div className="quick-actions">
        {QUICK.map(({ to, icon, tone, label, desc }) => (
          <Link key={to} to={to} className={`quick-card tone-${tone}`} data-reveal>
            <span className="quick-icon"><Icon name={icon} size={22} /></span>
            <span className="quick-label">{label}</span>
            <span className="quick-desc">{desc}</span>
            <Icon name="arrow" size={18} className="quick-arrow" />
          </Link>
        ))}
      </div>

      <div ref={listRef}>
        <div className="section-title">Próximos viajes</div>
        {loading ? (
          <div className="loading"><div className="spinner" /> Cargando tu bitácora…</div>
        ) : upcoming.length === 0 ? (
          <div className="empty-state" data-reveal>
            <div className="icon">🧭</div>
            <p>Aún no tienes viajes próximos.</p>
            <Link to="/chat" className="btn btn-primary"><Icon name="sparkles" /> Planear con el asistente</Link>
          </div>
        ) : (
          <div className="ac-trips">
            {upcoming.slice(0, 3).map(t => (
              <Link key={t.tripId} to={`/trips/${t.tripId}`} className="trip-link" data-reveal><TripCard trip={t} compact /></Link>
            ))}
          </div>
        )}

        {!loading && (
          <>
            <div className="section-title">Reservas recientes</div>
            <div data-reveal><ReservationList reservations={reservations.slice(0, 4)} /></div>
          </>
        )}
      </div>
    </div>
  )
}
