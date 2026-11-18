// Agent-Driven UI: el agente devuelve datos estructurados y aquí se transforman
// en componentes visuales (tarjetas, agenda, listados con estado).
import { Link } from 'react-router-dom'
import { money, fmtDate, nights, safeHref, RES_TYPE, RES_STATUS, TRIP_STATUS, detailsText } from '../lib/format.js'
import './AgentCards.css'

// ── Vuelos: tarjetas comparativas ────────────────────────────────────────────
export function FlightCards({ data }) {
  const flights = (data?.flights || []).filter(f => f && f.airline)
  if (!flights.length) return null
  const prices = flights.map(f => Number(f.price)).filter(Number.isFinite)
  const minPrice = prices.length ? Math.min(...prices) : null
  const toMin = d => { const m = String(d || '').match(/(\d+)\s*h(?:\s*(\d+))?/); return m ? +m[1] * 60 + +(m[2] || 0) : Infinity }
  const fastest = flights.reduce((best, f) => (toMin(f.duration) < toMin(best?.duration) ? f : best), null)

  return (
    <div className="ac-block">
      <div className="ac-head">
        <span className="ac-title">✈️ Vuelos {data.origin && `${data.origin} → ${data.destination}`}</span>
        <span className="ac-sub">{data.date && fmtDate(data.date)}{data.passengers ? ` · ${data.passengers} pasajeros` : ''}</span>
      </div>
      <div className="ac-flights">
        {flights.map((f, i) => {
          const href = safeHref(f.bookingUrl)
          const cheapest = minPrice !== null && Number(f.price) === minPrice
          return (
            <div key={i} className={`ac-flight ${cheapest ? 'best' : ''}`}>
              <div className="ac-flight-tags">
                {cheapest && <span className="tag tag-green">💰 Más barato</span>}
                {fastest === f && toMin(f.duration) !== Infinity && <span className="tag tag-cyan">⚡ Más rápido</span>}
              </div>
              <div className="ac-airline">{f.airline}{f.flightNumber && <span> · {f.flightNumber}</span>}</div>
              <div className="ac-times">
                <div><b>{f.departureTime || '—'}</b><small>{data.origin || 'Salida'}</small></div>
                <div className="ac-line"><span>{f.duration || ''}</span><i /><span>{f.stops === 0 ? 'Directo' : f.stops ? `${f.stops} escala(s)` : ''}</span></div>
                <div><b>{f.arrivalTime || '—'}</b><small>{data.destination || 'Llegada'}</small></div>
              </div>
              <div className="ac-flight-foot">
                <span className="ac-price">{f.price != null ? money(f.price, f.currency || 'USD') : 'Precio no disponible'}</span>
                {href && <a className="btn btn-ghost ac-btn" href={href} target="_blank" rel="noopener noreferrer">Ver oferta ↗</a>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Clima: tarjetas por día ──────────────────────────────────────────────────
function weatherIcon(code, rain) {
  if (code == null) return rain >= 60 ? '🌧️' : '⛅'
  if (code === 0) return '☀️'
  if (code <= 2) return '🌤️'
  if (code === 3) return '☁️'
  if (code <= 48) return '🌫️'
  if (code <= 67 || (code >= 80 && code <= 82)) return '🌧️'
  if (code <= 77 || code === 85 || code === 86) return '❄️'
  return '⛈️'
}

export function WeatherCards({ data }) {
  const days = data?.days || []
  if (!days.length) return null
  return (
    <div className="ac-block">
      <div className="ac-head">
        <span className="ac-title">🌤️ Clima en {data.city}{data.country ? `, ${data.country}` : ''}</span>
        <span className={`tag ${data.source === 'forecast' ? 'tag-cyan' : 'tag-amber'}`}>
          {data.source === 'forecast' ? 'Pronóstico' : 'Estimación histórica'}
        </span>
      </div>
      <div className="ac-weather">
        {days.map(d => (
          <div key={d.date} className="ac-day">
            <div className="ac-day-date">{fmtDate(d.date)}</div>
            <div className="ac-day-icon">{weatherIcon(d.weatherCode, d.precipitationProbability)}</div>
            <div className="ac-day-temp"><b>{Math.round(d.tempMax)}°</b> / {Math.round(d.tempMin)}°</div>
            <div className="ac-day-cond">{d.condition}</div>
            <div className="ac-day-meta">
              {d.precipitationProbability != null && <span>💧 {d.precipitationProbability}%</span>}
              {d.windKph != null && <span>💨 {Math.round(d.windKph)} km/h</span>}
            </div>
          </div>
        ))}
      </div>
      {data.provider && <div className="ac-foot">Fuente: {data.provider} (vía MCP de clima)</div>}
    </div>
  )
}

// ── Viajes: tarjetas con destino, fechas y presupuesto ───────────────────────
export function TripCard({ trip, compact = false, children }) {
  if (!trip) return null
  const st = TRIP_STATUS[trip.status] || { label: trip.status, cls: '' }
  return (
    <div className="ac-trip">
      <div className="ac-trip-top">
        <div>
          <div className="ac-trip-route">{trip.origin} → <b>{trip.destination}</b></div>
          <div className="ac-trip-dates">📅 {fmtDate(trip.startDate)} – {fmtDate(trip.endDate)} · {nights(trip.startDate, trip.endDate)} noches</div>
        </div>
        <span className={`badge ${st.cls}`}>{st.label}</span>
      </div>
      <div className="ac-trip-stats">
        <span>👥 {trip.travelers} viajero{trip.travelers > 1 ? 's' : ''}</span>
        <span>💰 {money(trip.budget, trip.currency || 'COP')}</span>
      </div>
      {!compact && trip.preferences && typeof trip.preferences === 'string' && (
        <div className="ac-trip-prefs">📌 {trip.preferences}</div>
      )}
      {children}
    </div>
  )
}

export function TripsList({ trips }) {
  if (!trips?.length) return <div className="ac-empty">No tienes viajes guardados todavía.</div>
  return (
    <div className="ac-block">
      <div className="ac-head"><span className="ac-title">🗺️ Tus viajes</span><Link to="/trips" className="ac-link">Ver todos →</Link></div>
      <div className="ac-trips">{trips.map(t => <TripCard key={t.tripId} trip={t} compact />)}</div>
    </div>
  )
}

// ── Itinerario: agenda por día ───────────────────────────────────────────────
export function ItineraryAgenda({ days, title = '📅 Itinerario' }) {
  const list = [...(days || [])].sort((a, b) => (a.date > b.date ? 1 : -1))
  if (!list.length) return <div className="ac-empty">Este viaje aún no tiene itinerario.</div>
  return (
    <div className="ac-block">
      <div className="ac-head"><span className="ac-title">{title}</span><span className="ac-sub">{list.length} día(s)</span></div>
      <div className="ac-agenda">
        {list.map((d, i) => (
          <div key={d.date} className="ac-agenda-day">
            <div className="ac-agenda-label">
              <span className="ac-agenda-n">Día {i + 1}</span>
              <span>{fmtDate(d.date, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            </div>
            <ul className="ac-agenda-items">
              {(d.activities || []).map((a, j) => (
                <li key={j}>
                  <span className="ac-time">{a.time || '•'}</span>
                  <div>
                    <div className="ac-act-title">{a.title}{a.category && <span className="tag">{a.category}</span>}</div>
                    {a.description && <div className="ac-act-desc">{a.description}</div>}
                    <div className="ac-act-meta">
                      {a.location && <span>📍 {a.location}</span>}
                      {a.estimatedCost != null && <span>💵 {money(a.estimatedCost)}</span>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {d.notes && <div className="ac-agenda-notes">📝 {d.notes}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Reservas: listado con estados ────────────────────────────────────────────
export function StatusBadge({ status }) {
  const s = RES_STATUS[status] || { label: status, cls: '' }
  return <span className={`badge ${s.cls}`} title={s.hint}>{s.label}</span>
}

export function ReservationList({ reservations, renderActions }) {
  if (!reservations?.length) return <div className="ac-empty">No hay reservas registradas.</div>
  return (
    <div className="ac-block">
      <div className="ac-head"><span className="ac-title">📋 Reservas</span><Link to="/reservations" className="ac-link">Gestionar →</Link></div>
      <div className="ac-res-list">
        {reservations.map(r => {
          const t = RES_TYPE[r.type] || { icon: '📋', label: r.type }
          return (
            <div key={r.reservationId} className={`ac-res type-${r.type}`}>
              <div className="ac-res-icon">{t.icon}</div>
              <div className="ac-res-body">
                <div className="ac-res-top">
                  <span className="ac-res-title">{r.title || t.label}</span>
                  <StatusBadge status={r.status} />
                </div>
                <div className="ac-res-details">{detailsText(r.details)}</div>
                <div className="ac-res-meta">
                  <span>{t.label}</span>
                  {r.tripName && <span>🗺️ {r.tripName}</span>}
                  {r.date && <span>📅 {fmtDate(r.date)}</span>}
                  <span>💰 {money(r.price, r.currency || 'COP')}</span>
                </div>
              </div>
              {renderActions && <div className="ac-res-actions">{renderActions(r)}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Preferencias ─────────────────────────────────────────────────────────────
const PREF_LABELS = {
  budgetLevel: 'Presupuesto', activityTypes: 'Actividades', dietaryRestrictions: 'Restricciones alimentarias',
  preferredAirlines: 'Aerolíneas', seatPreference: 'Asiento', accommodationType: 'Alojamiento',
  travelPace: 'Ritmo de viaje', homeCity: 'Ciudad de origen', currency: 'Moneda', notes: 'Notas',
}

export function PreferencesCard({ prefs }) {
  const entries = Object.entries(prefs || {}).filter(([, v]) => v && (!Array.isArray(v) || v.length))
  if (!entries.length) return <div className="ac-empty">Sin preferencias guardadas.</div>
  return (
    <div className="ac-block">
      <div className="ac-head"><span className="ac-title">⭐ Preferencias guardadas</span></div>
      <div className="ac-prefs">
        {entries.map(([k, v]) => (
          <div key={k}><small>{PREF_LABELS[k] || k}</small><span>{Array.isArray(v) ? v.join(', ') : String(v)}</span></div>
        ))}
      </div>
    </div>
  )
}

// ── Recomendaciones personalizadas ──────────────────────────────────────────
const REC_KIND = {
  destinations: { icon: '🧭', label: 'Destinos recomendados' },
  activities:   { icon: '🎯', label: 'Actividades recomendadas' },
  experiences:  { icon: '✨', label: 'Experiencias recomendadas' },
  gastronomy:   { icon: '🍽️', label: 'Recomendaciones gastronómicas' },
}
const PRICE_LEVEL = n => (Number(n) >= 1 && Number(n) <= 4 ? '$'.repeat(Number(n)) : null)

export function RecommendationCards({ data }) {
  const items = data?.items || []
  if (!items.length) return null
  const kind = REC_KIND[data.kind] || REC_KIND.experiences
  return (
    <div className={`ac-block ac-recs kind-${data.kind}`}>
      <div className="ac-head">
        <span className="ac-title">{kind.icon} {data.title || kind.label}</span>
        {data.destination && <span className="ac-sub">📍 {data.destination}</span>}
      </div>
      <div className="ac-rec-grid">
        {items.map((it, i) => (
          <div key={i} className="ac-rec">
            <div className="ac-rec-top">
              <span className="ac-rec-name">{it.name}</span>
              {PRICE_LEVEL(it.priceLevel) && <span className="ac-rec-price" title="Nivel de precio">{PRICE_LEVEL(it.priceLevel)}</span>}
            </div>
            {it.dish && <div className="ac-rec-dish">🍴 {it.dish}</div>}
            {it.description && <div className="ac-rec-desc">{it.description}</div>}
            {it.reason && <div className="ac-rec-reason"><b>Para ti:</b> {it.reason}</div>}
            <div className="ac-rec-meta">
              {it.category && <span className="tag">{it.category}</span>}
              {(it.dietary || []).map(t => <span key={t} className="tag tag-green">✓ {t}</span>)}
              {(it.tags || []).map(t => <span key={t} className="tag">{t}</span>)}
            </div>
            <div className="ac-rec-foot">
              {it.location && <span>📍 {it.location}</span>}
              {(it.bestTime || it.mealTime) && <span>🕒 {it.mealTime || it.bestTime}</span>}
              {it.estimatedCost != null && <span>💵 ~{money(it.estimatedCost, it.currency || 'COP')}</span>}
            </div>
          </div>
        ))}
      </div>
      <div className="ac-foot">Costos estimados por el asistente · verifica horarios y precios antes de ir.</div>
    </div>
  )
}

// ── Selector: evento "ui" del agente → componente ───────────────────────────
export function AgentUI({ component, data }) {
  switch (component) {
    case 'flights':      return <FlightCards data={data} />
    case 'weather':      return <WeatherCards data={data} />
    case 'trip':         return <div className="ac-block"><div className="ac-head"><span className="ac-title">🗺️ Viaje</span><Link to="/trips" className="ac-link">Mis viajes →</Link></div><TripCard trip={data} /></div>
    case 'trips':        return <TripsList trips={data} />
    case 'itinerary':    return <ItineraryAgenda days={data?.days} />
    case 'reservations': return <ReservationList reservations={data} />
    case 'preferences':  return <PreferencesCard prefs={data} />
    case 'recommendations': return <RecommendationCards data={data} />
    default:             return null
  }
}
