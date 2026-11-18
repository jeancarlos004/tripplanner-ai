import { useState } from 'react'
import './Weather.css'

const WEATHER_URL = 'https://bedrock-agentcore.us-east-2.amazonaws.com/runtimes/arn%3Aaws%3Abedrock-agentcore%3Aus-east-2%3A750708765285%3Aruntime%2Ftripplannera2a_WeatherAgent-0uRzDWA45L/invocations'
const AWS_REGION = 'us-east-2'

function getWeatherMeta(text = '') {
  const t = text.toLowerCase()
  if (t.includes('lluvi') || t.includes('rain')) return { icon: '🌧️', cls: 'rainy',  label: 'Lluvioso' }
  if (t.includes('tormenta') || t.includes('storm')) return { icon: '⛈️', cls: 'rainy',  label: 'Tormenta' }
  if (t.includes('nublad') || t.includes('cloud')) return { icon: '☁️', cls: 'cloudy', label: 'Nublado' }
  if (t.includes('parcial') || t.includes('partly')) return { icon: '⛅', cls: 'cloudy', label: 'Parcialmente nublado' }
  if (t.includes('nieve') || t.includes('snow')) return { icon: '❄️', cls: 'cloudy', label: 'Nevado' }
  return { icon: '☀️', cls: 'sunny', label: 'Soleado' }
}

export default function Weather() {
  const [form, setForm]     = useState({ city: '', date: '' })
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  async function search(e) {
    e.preventDefault()
    if (!form.city) return
    setLoading(true); setError(''); setResult(null)

    try {
      const prompt = form.date
        ? `What is the weather in ${form.city} on ${form.date}?`
        : `What is the weather forecast in ${form.city} for the next days?`

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

      const resp = await aws.fetch(WEATHER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id': crypto.randomUUID() },
        body: JSON.stringify(payload),
      })
      const data = await resp.json()
      let text = ''
      for (const a of data?.result?.artifacts || [])
        for (const p of a.parts || []) if (p.kind === 'text') text += p.text
      for (const p of data?.result?.parts || []) if (p.kind === 'text') text += p.text

      setResult({ city: form.city, date: form.date, raw: text })
    } catch(err) {
      setError(`Error: ${err.message}`)
    } finally { setLoading(false) }
  }

  const meta = result ? getWeatherMeta(result.raw) : null

  return (
    <div className="weather-page">
      <h1 className="page-title">🌤️ Información Meteorológica</h1>

      <div className="weather-search-card animate-fade-in">
        <form onSubmit={search}>
          <div className="grid-2">
            <div className="form-group">
              <label>Ciudad de destino</label>
              <input placeholder="Madrid, Cartagena, Miami..." value={form.city}
                onChange={e => setForm({...form, city: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Fecha (opcional)</label>
              <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading || !form.city}>
            {loading
              ? <><div className="spinner" style={{width:16,height:16}} /> Consultando...</>
              : '🔍 Consultar clima'}
          </button>
        </form>
      </div>

      {error && <div className="weather-error">⚠️ {error}</div>}

      {result && meta && (
        <>
          <div className={`weather-hero ${meta.cls}`}>
            <div className="weather-hero-inner">
              <div className="weather-icon-wrap">
                <span className="weather-icon-big">{meta.icon}</span>
              </div>
              <div>
                <div className="weather-city-name">{result.city}</div>
                {result.date && <div className="weather-date-label">📅 {result.date}</div>}
                <div className="weather-condition">{meta.label}</div>
              </div>
            </div>
          </div>

          <div className="weather-detail"
            dangerouslySetInnerHTML={{ __html:
              result.raw
                .replace(/<thinking>[\s\S]*?<\/thinking>/g, '')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br/>')
            }}
          />
        </>
      )}
    </div>
  )
}
