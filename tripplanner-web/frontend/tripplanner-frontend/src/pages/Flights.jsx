import { useState } from 'react'
import { useAgentQuery } from '../lib/useAgentQuery.js'
import { FlightCards } from '../components/AgentCards.jsx'
import { renderMarkdown } from '../lib/format.js'
import './Flights.css'

const tomorrow = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)

export default function Flights() {
  const [form, setForm] = useState({ origin: 'Bogotá', destination: 'Cartagena', date: '', passengers: 1 })
  const q = useAgentQuery()
  const flights = q.find('flights')

  function search(e) {
    e.preventDefault()
    if (!form.origin || !form.destination || !form.date) return
    q.run(`Busca y compara vuelos de ${form.origin} a ${form.destination} para el ${form.date}, ` +
          `${form.passengers} pasajero(s). Solo vuelos, no consultes el clima ni crees viajes.`)
  }

  return (
    <div className="flights-page">
      <h1 className="page-title">✈️ Búsqueda de Vuelos</h1>

      <div className="flight-search-card animate-fade-in">
        <form onSubmit={search}>
          <div className="search-route">
            <div className="route-input">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="f-origin">Origen (ciudad o IATA)</label>
                <input id="f-origin" placeholder="Bogotá o BOG" value={form.origin} maxLength={60} required
                  onChange={e => setForm({ ...form, origin: e.target.value })} />
              </div>
            </div>
            <div className="route-arrow">→</div>
            <div className="route-input">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="f-dest">Destino (ciudad o IATA)</label>
                <input id="f-dest" placeholder="Cartagena o CTG" value={form.destination} maxLength={60} required
                  onChange={e => setForm({ ...form, destination: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label htmlFor="f-date">Fecha de salida</label>
              <input id="f-date" type="date" min={tomorrow()} value={form.date} required
                onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="form-group">
              <label htmlFor="f-pax">Pasajeros</label>
              <input id="f-pax" type="number" min={1} max={9} value={form.passengers}
                onChange={e => setForm({ ...form, passengers: Math.max(1, Math.min(9, +e.target.value || 1)) })} />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={q.loading}>
            {q.loading ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Buscando vuelos…</> : '🔍 Buscar vuelos'}
          </button>
        </form>
      </div>

      {q.loading && q.steps.length > 0 && (
        <div className="loading" style={{ justifyContent: 'flex-start' }}><div className="spinner" /> {q.steps[q.steps.length - 1]}</div>
      )}
      {q.error && <div className="flight-error">⚠️ {q.error}</div>}

      {flights && <FlightCards data={flights} />}
      {!q.loading && q.text && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="message-text md" dangerouslySetInnerHTML={{ __html: renderMarkdown(q.text) }} />
        </div>
      )}
      {!q.loading && !flights && !q.error && q.text === '' && q.steps.length === 0 && (
        <div className="empty-state"><div className="icon">✈️</div><p>Busca vuelos reales con el Flight Agent (MCP de vuelos).</p></div>
      )}
    </div>
  )
}
