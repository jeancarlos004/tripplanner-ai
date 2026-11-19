// Agent-Driven UI: el agente devuelve datos estructurados y aquí se transforman
// en componentes visuales. Cada tipo de dato usa el color de su dominio:
// vuelos = cielo, clima = sol, viaje/itinerario = mar, reservas = coral, recomendaciones = lavanda.
import { Link } from 'react-router-dom'
import { money, fmtDate, nights, safeHref, RES_TYPE, RES_STATUS, TRIP_STATUS, detailsText } from '../lib/format.js'
import { useEnter } from '../lib/motion.js'
import { cityCode } from './RouteMap.jsx'
import Icon from './Icon.jsx'
import './AgentCards.css'

function BlockHead({ tone, icon, title, sub, children }) {
  return (
    <div className="ac-head">
      <span className={`ac-title tone-${tone}`}><span className="ac-title-icon"><Icon name={icon} size={16} /></span>{title}</span>
      {sub && <span className="ac-sub">{sub}</span>}
      {children}
    </div>
  )
}

// ── Vuelos: pases de abordar comparativos ───────────────────────────────────
const toMin = d => { const m = String(d || '').match(/(\d+)\s*h(?:\s*(\d+))?/); return m ? +m[1] * 60 + +(m[2] || 0) : Infinity }

export function FlightCards({ data }) {
  const flights = (data?.flights || []).filter(f => f && f.airline)
  if (!flights.length) return null
  const prices = flights.map(f => Number(f.price)).filter(Number.isFinite)
  const minPrice = prices.length ? Math.min(...prices) : null
  const fastest = flights.reduce((best, f) => (toMin(f.duration) < toMin(best?.duration) ? f : best), null)
  const from = cityCode(data.origin || '')
  const to = cityCode(data.destination || '')

  return (
    <div className="ac-block tone-sky">
      <BlockHead tone="sky" icon="plane" title={`Vuelos ${from} → ${to}`}
        sub={[data.date && fmtDate(data.date), data.passengers && `${data.passengers} pasajeros`, `${flights.length} opción${flights.length > 1 ? 'es' : ''}`].filter(Boolean).join(' · ')} />
      <div className="ac-flights">
        {flights.map((f, i) => {
          const href = safeHref(f.bookingUrl)
          const cheapest = minPrice !== null && Number(f.price) === minPrice && flights.length > 1
          const isFastest = fastest === f && toMin(f.duration) !== Infinity && flights.length > 1
          return (
            <article key={i} className={`pass ${cheapest ? 'best' : ''}`} data-enter>
              <div className="pass-main">
                <div className="pass-top">
                  <span className="pass-airline">{f.airline}</span>
                  <span className="pass-number mono">{f.flightNumber || '—'}</span>
                </div>
                <div className="pass-route">
                  <div><b className="mono">{f.departureTime || '--:--'}</b><span className="mono">{from}</span></div>
                  <div className="pass-line">
                    <small>{f.duration || ''}</small>
                    <i><Icon name="plane" size={14} /></i>
                    <small>{f.stops === 0 ? 'Directo' : f.stops ? `${f.stops} escala${f.stops > 1 ? 's' : ''}` : ''}</small>
                  </div>
                  <div className="right"><b className="mono">{f.arrivalTime || '--:--'}</b><span className="mono">{to}</span></div>
                </div>
                <div className="pass-tags">
                  {cheapest && <span className="tag tag-green">Más barato</span>}
                  {isFastest && <span className="tag tag-cyan">Más rápido</span>}
                </div>
              </div>
              <div className="pass-stub">
                <small>Total</small>
                <span className="pass-price mono">{f.price != null ? money(f.price, f.currency || 'USD') : 'N/D'}</span>
                {href && <a className="pass-link" href={href} target="_blank" rel="noopener noreferrer">Ver oferta ↗</a>}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

// ── Clima: tarjetas por día con rango de temperatura ────────────────────────
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
  const lo = Math.min(...days.map(d => d.tempMin ?? d.tempMax)) - 1
  const hi = Math.max(...days.map(d => d.tempMax ?? d.tempMin)) + 1
  const pct = v => `${((v - lo) / (hi - lo || 1)) * 100}%`
  return (
    <div className="ac-block tone-sun">
      <BlockHead tone="sun" icon="weather" title={`Clima en ${data.city}`} sub={data.country}>
        <span className={`tag ${data.source === 'forecast' ? 'tag-amber' : 'tag-slate'}`}>
          {data.source === 'forecast' ? 'Pronóstico' : 'Estimación histórica'}
        </span>
      </BlockHead>
      <div className="ac-weather">
        {days.map(d => (
          <div key={d.date} className="wx-day" data-enter>
            <div className="wx-date">{fmtDate(d.date)}</div>
            <div className="wx-icon">{weatherIcon(d.weatherCode, d.precipitationProbability)}</div>
            <div className="wx-cond">{d.condition}</div>
            <div className="wx-temps mono"><b>{Math.round(d.tempMax)}°</b><span>{Math.round(d.tempMin)}°</span></div>
            <div className="wx-range" aria-hidden="true">
              <i style={{ left: pct(d.tempMin), right: `calc(100% - ${pct(d.tempMax)})` }} />
            </div>
            <div className="wx-meta mono">
              {d.precipitationProbability != null && <span className="rain">💧 {d.precipitationProbability}%</span>}
              {d.windKph != null && <span>💨 {Math.round(d.windKph)}</span>}
            </div>
          </div>
        ))}
      </div>
      {data.provider && <div className="ac-foot">Fuente: {data.provider} · consultado por el Weather Agent vía MCP</div>}
    </div>
  )
}

// ── Viajes ──────────────────────────────────────────────────────────────────
export function TripCard({ trip, compact = false, children }) {
  if (!trip) return null
  const st = TRIP_STATUS[trip.status] || { label: trip.status, cls: '' }
  return (
    <div className="ac-trip">
      <div className="ac-trip-top">
        <div className="ac-trip-codes mono">
          <span>{cityCode(trip.origin)}</span>
          <i aria-hidden="true"><Icon name="plane" size={14} /></i>
          <span>{cityCode(trip.destination)}</span>
        </div>
        <span className={`badge ${st.cls}`}>{st.label}</span>
      </div>
      <div className="ac-trip-route">{trip.origin} → <b>{trip.destination}</b></div>
      <div className="ac-trip-stats">
        <span><Icon name="calendar" size={14} /> {fmtDate(trip.startDate)} – {fmtDate(trip.endDate)} · {nights(trip.startDate, trip.endDate)} noches</span>
        <span><Icon name="users" size={14} /> {trip.travelers}</span>
        <span className="mono ac-trip-budget"><Icon name="wallet" size={14} /> {money(trip.budget, trip.currency || 'COP')}</span>
      </div>
      {!compact && trip.preferences && typeof trip.preferences === 'string' && (
        <div className="ac-trip-prefs">{trip.preferences}</div>
      )}
      {children}
    </div>
  )
}

export function TripsList({ trips }) {
  if (!trips?.length) return <div className="ac-empty">No tienes viajes guardados todavía.</div>
  return (
    <div className="ac-block tone-sea">
      <BlockHead tone="sea" icon="map" title="Tus viajes"><Link to="/trips" className="ac-link">Ver todos →</Link></BlockHead>
      <div className="ac-trips">{trips.map(t => <div key={t.tripId} data-enter><TripCard trip={t} compact /></div>)}</div>
    </div>
  )
}

// ── Itinerario: ruta con paradas por día ────────────────────────────────────
export function ItineraryAgenda({ days, title = 'Itinerario' }) {
  const list = [...(days || [])].sort((a, b) => (a.date > b.date ? 1 : -1))
  if (!list.length) return <div className="ac-empty">Este viaje aún no tiene itinerario.</div>
  const total = list.flatMap(d => d.activities || []).reduce((s, a) => s + (Number(a.estimatedCost) || 0), 0)
  return (
    <div className="ac-block tone-sea">
      <BlockHead tone="sea" icon="calendar" title={title}
        sub={`${list.length} día${list.length > 1 ? 's' : ''}${total ? ` · ~${money(total)} en actividades` : ''}`} />
      <ol className="route">
        {list.map((d, i) => (
          <li key={d.date} className="route-day" data-enter>
            <div className="route-marker"><span className="mono">{String(i + 1).padStart(2, '0')}</span></div>
            <div className="route-body">
              <div className="route-date">{fmtDate(d.date, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
              <ul className="route-stops">
                {(d.activities || []).map((a, j) => (
                  <li key={j}>
                    <span className="route-time mono">{a.time || '·'}</span>
                    <div>
                      <div className="route-title">{a.title}{a.category && <span className="tag">{a.category}</span>}</div>
                      {a.description && <div className="route-desc">{a.description}</div>}
                      <div className="route-meta">
                        {a.location && <span>📍 {a.location}</span>}
                        {a.estimatedCost != null && <span className="mono">{money(a.estimatedCost)}</span>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {d.notes && <div className="route-notes">{d.notes}</div>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

// ── Reservas: talones con sello de estado ───────────────────────────────────
export function StatusBadge({ status }) {
  const s = RES_STATUS[status] || { label: status, cls: '' }
  return <span className={`badge ${s.cls}`} title={s.hint}>{s.label}</span>
}

const RES_ICON = { FLIGHT: 'plane', HOTEL: 'home', ACTIVITY: 'compass' }

export function ReservationList({ reservations, renderActions }) {
  if (!reservations?.length) return <div className="ac-empty">No hay reservas registradas.</div>
  return (
    <div className="ac-block tone-coral">
      <BlockHead tone="coral" icon="ticket" title="Reservas"><Link to="/reservations" className="ac-link">Gestionar →</Link></BlockHead>
      <div className="ac-res-list">
        {reservations.map(r => {
          const t = RES_TYPE[r.type] || { label: r.type }
          return (
            <article key={r.reservationId} className={`stub type-${r.type} status-${(r.status || '').toLowerCase()}`} data-enter>
              <div className="stub-icon"><Icon name={RES_ICON[r.type] || 'ticket'} size={20} /></div>
              <div className="stub-body">
                <div className="stub-top">
                  <span className="stub-title">{r.title || t.label}</span>
                  <StatusBadge status={r.status} />
                </div>
                {detailsText(r.details) && <div className="stub-details">{detailsText(r.details)}</div>}
                <div className="stub-meta">
                  <span>{t.label}</span>
                  {r.tripName && <span>{r.tripName}</span>}
                  {r.date && <span>{fmtDate(r.date)}</span>}
                </div>
              </div>
              <div className="stub-price mono">{money(r.price, r.currency || 'COP')}</div>
              {renderActions && <div className="stub-actions">{renderActions(r)}</div>}
            </article>
          )
        })}
      </div>
    </div>
  )
}

// ── Preferencias ────────────────────────────────────────────────────────────
const PREF_LABELS = {
  budgetLevel: 'Presupuesto', activityTypes: 'Actividades', dietaryRestrictions: 'Alimentación',
  preferredAirlines: 'Aerolíneas', seatPreference: 'Asiento', accommodationType: 'Alojamiento',
  travelPace: 'Ritmo', homeCity: 'Ciudad de origen', currency: 'Moneda', notes: 'Notas',
}

export function PreferencesCard({ prefs }) {
  const entries = Object.entries(prefs || {}).filter(([, v]) => v && (!Array.isArray(v) || v.length))
  if (!entries.length) return <div className="ac-empty">Sin preferencias guardadas.</div>
  return (
    <div className="ac-block tone-agent">
      <BlockHead tone="agent" icon="sparkles" title="Preferencias guardadas" sub="El asistente las usa para personalizar" />
      <div className="ac-prefs">
        {entries.map(([k, v]) => (
          <div key={k} data-enter><small>{PREF_LABELS[k] || k}</small><span>{Array.isArray(v) ? v.join(', ') : String(v)}</span></div>
        ))}
      </div>
    </div>
  )
}

// ── Recomendaciones personalizadas y gastronómicas ──────────────────────────
const REC_KIND = {
  destinations: { icon: 'compass',  label: 'Destinos recomendados' },
  activities:   { icon: 'sparkles', label: 'Actividades recomendadas' },
  experiences:  { icon: 'sparkles', label: 'Experiencias recomendadas' },
  gastronomy:   { icon: 'food',     label: 'Recomendaciones gastronómicas' },
}
const PRICE_LEVEL = n => (Number(n) >= 1 && Number(n) <= 4 ? Number(n) : null)

export function RecommendationCards({ data }) {
  const items = data?.items || []
  if (!items.length) return null
  const kind = REC_KIND[data.kind] || REC_KIND.experiences
  const food = data.kind === 'gastronomy'
  return (
    <div className={`ac-block ${food ? 'tone-sun' : 'tone-agent'} kind-${data.kind}`}>
      <BlockHead tone={food ? 'sun' : 'agent'} icon={kind.icon} title={data.title || kind.label} sub={data.destination} />
      <div className="ac-rec-grid">
        {items.map((it, i) => (
          <article key={i} className="rec" data-enter>
            <div className="rec-top">
              <span className="rec-name">{it.name}</span>
              {PRICE_LEVEL(it.priceLevel) && (
                <span className="rec-price mono" aria-label={`Nivel de precio ${it.priceLevel} de 4`}>
                  {'$'.repeat(PRICE_LEVEL(it.priceLevel))}<span>{'$'.repeat(4 - PRICE_LEVEL(it.priceLevel))}</span>
                </span>
              )}
            </div>
            {it.dish && <div className="rec-dish"><Icon name="food" size={14} /> {it.dish}</div>}
            {it.description && <div className="rec-desc">{it.description}</div>}
            {it.reason && <div className="rec-reason"><b>Para ti</b>{it.reason}</div>}
            <div className="rec-tags">
              {(it.dietary || []).map(t => <span key={t} className="tag tag-green">✓ {t}</span>)}
              {it.category && it.category !== 'gastronomía' && <span className="tag">{it.category}</span>}
              {(it.tags || [])
                .filter(t => t !== it.category && !(it.dietary || []).some(d => d.toLowerCase() === String(t).toLowerCase()))
                .map(t => <span key={t} className="tag">{t}</span>)}
            </div>
            <div className="rec-foot">
              {it.location && <span>📍 {it.location}</span>}
              {(it.mealTime || it.bestTime) && <span>🕒 {it.mealTime || it.bestTime}</span>}
              {it.estimatedCost != null && <span className="mono">~{money(it.estimatedCost, it.currency || 'COP')}</span>}
            </div>
          </article>
        ))}
      </div>
      <div className="ac-foot">Costos estimados por el asistente · verifica horarios y precios antes de ir.</div>
    </div>
  )
}

// ── Selector: evento "ui" del agente → componente (con entrada animada) ─────
export function AgentUI({ component, data }) {
  const ref = useEnter({ children: '[data-enter]', from: { y: 16, autoAlpha: 0, scale: 0.97 } })
  let content
  switch (component) {
    case 'flights':         content = <FlightCards data={data} />; break
    case 'weather':         content = <WeatherCards data={data} />; break
    case 'trip':            content = (
      <div className="ac-block tone-sea">
        <BlockHead tone="sea" icon="map" title="Viaje guardado"><Link to={`/trips/${data?.tripId || ''}`} className="ac-link">Abrir →</Link></BlockHead>
        <div data-enter><TripCard trip={data} /></div>
      </div>); break
    case 'trips':           content = <TripsList trips={data} />; break
    case 'itinerary':       content = <ItineraryAgenda days={data?.days} />; break
    case 'reservations':    content = <ReservationList reservations={data} />; break
    case 'preferences':     content = <PreferencesCard prefs={data} />; break
    case 'recommendations': content = <RecommendationCards data={data} />; break
    default:                content = null
  }
  return content ? <div ref={ref} className="agent-ui">{content}</div> : null
}
