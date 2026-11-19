import { useState, useRef } from 'react'
import { useAuth } from '../lib/AuthContext.jsx'
import { CONFIG_OK } from '../config.js'
import { gsap, useGSAP, prefersReducedMotion } from '../lib/motion.js'
import RouteMap from '../components/RouteMap.jsx'
import Icon, { BrandMark } from '../components/Icon.jsx'
import './Login.css'

const AGENTS = [
  { tone: 'agent', icon: 'sparkles', name: 'Orchestrator', desc: 'Entiende lo que pides y coordina' },
  { tone: 'sky',   icon: 'plane',    name: 'Flight Agent', desc: 'Vuelos reales vía MCP' },
  { tone: 'sun',   icon: 'weather',  name: 'Weather Agent', desc: 'Pronóstico vía MCP' },
]

export default function Login() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const root = useRef(null)
  const cardRef = useRef(null)

  useGSAP(() => {
    if (prefersReducedMotion()) return
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
    tl.from('.login-brand', { y: -16, autoAlpha: 0, duration: 0.6 })
      .from('.login-headline .line', { yPercent: 110, autoAlpha: 0, stagger: 0.12, duration: 0.8 }, '-=0.3')
      .from('.login-lede', { y: 12, autoAlpha: 0, duration: 0.5 }, '-=0.4')
      .from('.agent-chip', { x: -20, autoAlpha: 0, stagger: 0.1, duration: 0.5 }, '-=0.2')
      .from(cardRef.current, { y: 30, autoAlpha: 0, scale: 0.98, duration: 0.8 }, 0.2)
  }, { scope: root })

  function switchMode(next) {
    if (next === mode) return
    setMode(next); setError('')
    if (!prefersReducedMotion()) gsap.fromTo('.login-fields', { autoAlpha: 0, x: next === 'register' ? 16 : -16 }, { autoAlpha: 1, x: 0, duration: 0.35 })
  }

  async function submit(e) {
    e.preventDefault()
    setError(''); setBusy(true)
    try {
      if (mode === 'login') await login(form.email.trim(), form.password)
      else await register(form.email.trim(), form.password, form.name.trim())
    } catch (err) {
      setError(err.message)
      if (!prefersReducedMotion()) gsap.fromTo(cardRef.current, { x: -8 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.3)' })
    } finally { setBusy(false) }
  }

  return (
    <div className="login-page" ref={root}>
      <section className="login-story">
        <div className="login-brand"><BrandMark size={40} /><span>TripPlanner <em>AI</em></span></div>

        <h1 className="login-headline">
          <span className="line-wrap"><span className="line">Tres agentes,</span></span>
          <span className="line-wrap"><span className="line accent">un solo viaje.</span></span>
        </h1>
        <p className="login-lede">
          Cuéntale al asistente a dónde quieres ir. Él consulta vuelos y clima en paralelo, arma tu itinerario y guarda tus reservas.
        </p>

        <div className="login-map"><RouteMap from="Bogotá" to="Cartagena" caption="4 días · 3 viajeros" /></div>

        <ul className="agent-chips">
          {AGENTS.map(a => (
            <li key={a.name} className={`agent-chip tone-${a.tone}`}>
              <span className="agent-chip-icon"><Icon name={a.icon} size={18} /></span>
              <span><b>{a.name}</b><small>{a.desc}</small></span>
            </li>
          ))}
        </ul>
      </section>

      <section className="login-panel">
        <div className="login-card" ref={cardRef}>
          <div className="login-card-head">
            <span className="page-kicker">Embarque</span>
            <h2>{mode === 'login' ? 'Bienvenido de nuevo' : 'Crea tu cuenta'}</h2>
          </div>

          {!CONFIG_OK && (
            <div className="login-error">Falta la configuración del entorno (.env). Ejecuta <code>deploy-all.ps1 -Step frontend</code>.</div>
          )}

          <div className="login-tabs" role="tablist">
            <button role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')} type="button">Iniciar sesión</button>
            <button role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')} type="button">Crear cuenta</button>
            <span className={`login-tab-pill ${mode}`} aria-hidden="true" />
          </div>

          <form onSubmit={submit} className="login-fields">
            {mode === 'register' && (
              <div className="form-group">
                <label htmlFor="name">Nombre</label>
                <input id="name" autoComplete="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Cómo quieres que te llame" />
              </div>
            )}
            <div className="form-group">
              <label htmlFor="email">Correo electrónico</label>
              <input id="email" type="email" autoComplete="email" required value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })} placeholder="tu@correo.com" />
            </div>
            <div className="form-group">
              <label htmlFor="password">Contraseña</label>
              <input id="password" type="password" required minLength={8}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder={mode === 'register' ? 'Mínimo 8 caracteres, con números' : '••••••••'} />
            </div>
            {error && <div className="login-error" role="alert">{error}</div>}
            <button className="btn btn-primary login-submit" disabled={busy || !CONFIG_OK} type="submit">
              {busy ? <><div className="spinner" style={{ width: 16, height: 16, borderTopColor: '#1b0b05' }} /> Procesando…</>
                    : <>{mode === 'login' ? 'Entrar' : 'Crear cuenta y entrar'} <Icon name="arrow" /></>}
            </button>
          </form>
          <p className="login-foot">Autenticación con Amazon Cognito. Nunca te pediremos datos de tarjetas.</p>
        </div>
      </section>
    </div>
  )
}
