import { useState } from 'react'
import { useAgentQuery } from '../lib/useAgentQuery.js'
import { WeatherCards } from '../components/AgentCards.jsx'
import { renderMarkdown } from '../lib/format.js'
import './Weather.css'

const today = () => new Date().toISOString().slice(0, 10)

export default function Weather() {
  const [form, setForm] = useState({ city: 'Cartagena', start: '', end: '' })
  const q = useAgentQuery()
  const weather = q.find('weather')

  function search(e) {
    e.preventDefault()
    if (!form.city) return
    const range = form.start
      ? `del ${form.start} al ${form.end || form.start}`
      : 'para los próximos 3 días'
    q.run(`¿Cuál es el pronóstico del clima en ${form.city} ${range}? Solo el clima, no busques vuelos ni crees viajes.`)
  }

  return (
    <div className="weather-page">
      <h1 className="page-title">🌤️ Información Meteorológica</h1>

      <div className="weather-search-card animate-fade-in">
        <form onSubmit={search}>
          <div className="form-group">
            <label htmlFor="w-city">Ciudad de destino</label>
            <input id="w-city" placeholder="Cartagena, Madrid, Miami…" value={form.city} maxLength={80} required
              onChange={e => setForm({ ...form, city: e.target.value })} />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label htmlFor="w-start">Desde (opcional)</label>
              <input id="w-start" type="date" min={today()} value={form.start}
                onChange={e => setForm({ ...form, start: e.target.value, end: form.end && form.end < e.target.value ? e.target.value : form.end })} />
            </div>
            <div className="form-group">
              <label htmlFor="w-end">Hasta (opcional)</label>
              <input id="w-end" type="date" min={form.start || today()} value={form.end}
                onChange={e => setForm({ ...form, end: e.target.value })} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={q.loading || !form.city}>
            {q.loading ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Consultando…</> : '🔍 Consultar clima'}
          </button>
        </form>
      </div>

      {q.loading && q.steps.length > 0 && (
        <div className="loading" style={{ justifyContent: 'flex-start' }}><div className="spinner" /> {q.steps[q.steps.length - 1]}</div>
      )}
      {q.error && <div className="weather-error">⚠️ {q.error}</div>}

      {weather && <WeatherCards data={weather} />}
      {!q.loading && q.text && (
        <div className="weather-detail" dangerouslySetInnerHTML={{ __html: renderMarkdown(q.text) }} />
      )}
      {!q.loading && !weather && !q.error && !q.text && q.steps.length === 0 && (
        <div className="empty-state"><div className="icon">🌤️</div><p>Temperatura, condiciones y probabilidad de lluvia por destino y fechas.</p></div>
      )}
    </div>
  )
}
