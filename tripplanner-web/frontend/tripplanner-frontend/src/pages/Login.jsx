import { useState } from 'react'
import { useAuth } from '../lib/AuthContext.jsx'
import { CONFIG_OK } from '../config.js'
import './Login.css'

export default function Login() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError(''); setBusy(true)
    try {
      if (mode === 'login') await login(form.email.trim(), form.password)
      else await register(form.email.trim(), form.password, form.name.trim())
    } catch (err) {
      setError(err.message)
    } finally { setBusy(false) }
  }

  return (
    <div className="login-page">
      <div className="login-card animate-scale-in">
        <div className="login-logo">✈️ TripPlanner <span>AI</span></div>
        <p className="login-tagline">Tu compañero inteligente para planificar, organizar y gestionar viajes.</p>

        {!CONFIG_OK && (
          <div className="login-error">⚠️ Falta la configuración del entorno (.env). Ejecuta <code>deploy-frontend.ps1</code>.</div>
        )}

        <div className="login-tabs">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError('') }} type="button">Iniciar sesión</button>
          <button className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError('') }} type="button">Crear cuenta</button>
        </div>

        <form onSubmit={submit}>
          {mode === 'register' && (
            <div className="form-group">
              <label htmlFor="name">Nombre</label>
              <input id="name" autoComplete="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Tu nombre" />
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
            {busy ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Procesando…</> : mode === 'login' ? 'Entrar' : 'Crear cuenta y entrar'}
          </button>
        </form>
        <p className="login-foot">🔒 Autenticación con Amazon Cognito. Nunca te pediremos datos de tarjetas.</p>
      </div>
    </div>
  )
}
