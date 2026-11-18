import { useState } from 'react'
import './Flights.css'

const FLIGHTS_URL = 'https://bedrock-agentcore.us-east-2.amazonaws.com/runtimes/arn%3Aaws%3Abedrock-agentcore%3Aus-east-2%3A750708765285%3Aruntime%2Ftripplannera2a_FlightsAgent-MZwYNpFz5J/invocations'
const AWS_REGION = 'us-east-2'

const AIRLINE_ICONS = {
  'copa': '🇵🇦', 'avianca': '🇨🇴', 'latam': '🌎', 'delta': '🔷',
  'iberia': '🇪🇸', 'american': '🦅', 'united': '🌐', 'air europa': '🇪🇸',
  'easemytrip': '✈️',
}

function getAirlineIcon(name = '') {
  const key = name.toLowerCase()
  for (const [k, v] of Object.entries(AIRLINE_ICONS)) if (key.includes(k)) return v
  return '✈️'
}

export default function Flights() {
  const [form, setForm]       = useState({ origin: '', destination: '', date: '' })
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function search(e) {
    e.preventDefault()
    if (!form.origin || !form.destination || !form.date) return
    setLoading(true); setError(''); setResults(null)

    try {
      const prompt = `Search flights from ${form.origin} to ${form.destination} on ${form.date}`
      const payload = {
        jsonrpc: '2.0', id: crypto.randomUUID(), method: 'message/send',
        params: {
          message: { messageId: crypto.randomUUID(), role: 'user', parts: [{ kind: 'text', text: prompt }] },
          configuration: { acceptedOutputModes: ['text'] },
        },
      }

      const { AwsClient } = await import('aws4fetch')
      const aws = new AwsClient({
        accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
        secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
        region: AWS_REGION, service: 'bedrock-agentcore',
      })

      const resp = await aws.fetch(FLIGHTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id': crypto.randomUUID() },
        body: JSON.stringify(payload),
      })
      const data = await resp.json()
      let text = ''
      for (const a of data?.result?.artifacts || [])
        for (const p of a.parts || []) if (p.kind === 'text') text += p.text
      for (const p of data?.result?.parts || []) if (p.kind === 'text') text += p.text

      setResults(parseFlights(text))
    } catch(err) {
      setError(`Error al conectar con el agente: ${err.message}`)
    } finally { setLoading(false) }
  }

  function parseFlights(text) {
    const lines = text.split('\n')
    const flights = []
    for (const line of lines) {
      const m = line.match(/\|\s*\d+\s*\|\s*([^|]+)\|\s*USD\s*([\d,.]+)\s*\|\s*\[Reservar\]\(([^)]+)\)/)
      if (m) flights.push({ airline: m[1].trim(), price: m[2].replace(',',''), bookingUrl: m[3] })
    }
    return { raw: text, flights }
  }

  const rankClass = (i) => i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''

  return (
    <div className="flights-page">
      <h1 className="page-title">✈️ Búsqueda de Vuelos</h1>

      <div className="flight-search-card animate-fade-in">
        <form onSubmit={search}>
          <div className="search-route">
            <div className="route-input">
              <div className="form-group" style={{marginBottom:0}}>
                <label>Origen (IATA)</label>
                <input placeholder="BOG" value={form.origin}
                  onChange={e => setForm({...form, origin: e.target.value.toUpperCase().slice(0,3)})}
                  maxLength={3} style={{textTransform:'uppercase', letterSpacing:'2px', fontWeight:700, fontSize:16}} />
              </div>
            </div>
            <div className="route-arrow">→</div>
            <div className="route-input">
              <div className="form-group" style={{marginBottom:0}}>
                <label>Destino (IATA)</label>
                <input placeholder="MAD" value={form.destination}
                  onChange={e => setForm({...form, destination: e.target.value.toUpperCase().slice(0,3)})}
                  maxLength={3} style={{textTransform:'uppercase', letterSpacing:'2px', fontWeight:700, fontSize:16}} />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>Fecha de salida</label>
            <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading
              ? <><div className="spinner" style={{width:16,height:16}} /> Buscando vuelos...</>
              : '🔍 Buscar vuelos'}
          </button>
        </form>
      </div>

      {error && <div className="flight-error">⚠️ {error}</div>}

      {results && (
        <div className="animate-fade-in">
          <div className="results-header">
            <span className="results-title">
              {form.origin} → {form.destination} · {form.date}
            </span>
            {results.flights.length > 0 && (
              <span className="results-count">{results.flights.length} vuelos</span>
            )}
          </div>

          {results.flights.length > 0 ? (
            <div className="flight-cards stagger">
              {results.flights.map((f, i) => (
                <div key={i} className="flight-card animate-fade-up" style={{animationDelay:`${i*0.06}s`}}>
                  <div className={`flight-rank ${rankClass(i)}`}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}
                  </div>
                  <div className="flight-airline-logo">{getAirlineIcon(f.airline)}</div>
                  <div className="flight-airline">
                    <div>{f.airline}</div>
                    <div className="flight-airline-sub">Vuelo disponible</div>
                  </div>
                  <div className="flight-price">USD {parseFloat(f.price).toLocaleString()}</div>
                  {f.bookingUrl
                    ? <a href={f.bookingUrl} target="_blank" rel="noopener" className="btn btn-primary book-btn">Reservar →</a>
                    : <span className="btn btn-ghost book-btn">Sin enlace</span>
                  }
                </div>
              ))}
            </div>
          ) : (
            <div className="flight-raw">{results.raw}</div>
          )}
        </div>
      )}
    </div>
  )
}
