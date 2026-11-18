import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../lib/api.js'
import { ReservationList, StatusBadge } from '../components/AgentCards.jsx'
import { RES_STATUS, RES_TYPE, detailsText } from '../lib/format.js'
import './Reservations.css'

const EMPTY = { type: 'FLIGHT', title: '', details: '', price: '', date: '' }

export default function Reservations() {
  const [params, setParams] = useSearchParams()
  const [trips, setTrips] = useState([])
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterTrip, setFilterTrip] = useState(params.get('trip') || '')
  const [filterStatus, setFilterStatus] = useState('')
  const [form, setForm] = useState(null)       // null = cerrado; {…, tripId, reservationId?}
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [t, r] = await Promise.all([api.getTrips(), api.getReservations()])
      setTrips(t.trips || []); setReservations(r.reservations || [])
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (params.get('trip') && trips.length && !form) openCreate(params.get('trip')) }, [trips]) // eslint-disable-line

  const visible = useMemo(() => reservations.filter(r =>
    (!filterTrip || r.tripId === filterTrip) && (!filterStatus || r.status === filterStatus)), [reservations, filterTrip, filterStatus])

  const counts = useMemo(() => Object.fromEntries(Object.keys(RES_STATUS).map(s => [s, reservations.filter(r => r.status === s).length])), [reservations])

  function openCreate(tripId = filterTrip || trips[0]?.tripId) {
    setForm({ ...EMPTY, tripId: tripId || '' })
  }

  function openEdit(r) {
    setForm({ reservationId: r.reservationId, tripId: r.tripId, type: r.type, title: r.title || '',
      details: detailsText(r.details), price: r.price ?? '', date: r.date || '' })
  }

  async function save(e) {
    e.preventDefault(); setSaving(true); setError('')
    const body = { type: form.type, title: form.title, details: form.details, price: Number(form.price || 0) }
    if (form.date) body.date = form.date
    try {
      if (form.reservationId) await api.updateReservation(form.tripId, form.reservationId, body)
      else await api.createReservation(form.tripId, body)
      setForm(null)
      if (params.get('trip')) setParams({})
      await load()
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  async function setStatus(r, status) {
    setError('')
    try { await api.updateReservation(r.tripId, r.reservationId, { status }); await load() } catch (e) { setError(e.message) }
  }

  return (
    <div className="reservations-page">
      <div className="res-header-row">
        <h1 className="page-title" style={{ marginBottom: 0 }}>📋 Gestión de Reservas</h1>
        <button className="btn btn-primary" onClick={() => (form ? setForm(null) : openCreate())} disabled={!trips.length} type="button">
          {form ? '✕ Cancelar' : '+ Nueva reserva'}
        </button>
      </div>

      <div className="res-legend">
        {Object.entries(RES_STATUS).map(([k, v]) => (
          <button key={k} type="button" className={`res-legend-item ${filterStatus === k ? 'on' : ''}`} onClick={() => setFilterStatus(filterStatus === k ? '' : k)}>
            <StatusBadge status={k} /> <b>{counts[k] || 0}</b> <small>{v.hint}</small>
          </button>
        ))}
      </div>

      {error && <div className="flight-error">⚠️ {error}</div>}

      {form && (
        <div className="res-create-form">
          <h3>{form.reservationId ? '✏️ Editar reserva' : '📋 Nueva reserva'}</h3>
          <form onSubmit={save}>
            <div className="grid-2">
              <div className="form-group">
                <label>Viaje asociado</label>
                <select value={form.tripId} onChange={e => setForm({ ...form, tripId: e.target.value })} disabled={!!form.reservationId} required>
                  {trips.map(t => <option key={t.tripId} value={t.tripId}>{t.origin} → {t.destination} · {t.startDate}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Tipo</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  {Object.entries(RES_TYPE).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Título</label>
                <input value={form.title} maxLength={200} onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="Avianca BOG → CTG · Hotel Caribe · Tour Islas del Rosario" required />
              </div>
              <div className="form-group">
                <label>Fecha</label>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Precio total</label>
                <input type="number" min="0" placeholder="0" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label>Detalles</label>
              <textarea rows={3} maxLength={2000} placeholder="Horarios, número de personas, ubicación… (no incluyas datos de pago)"
                value={form.details} onChange={e => setForm({ ...form, details: e.target.value })} required />
            </div>
            {!form.reservationId && (
              <div className="res-status-info">🔒 Las reservas nuevas se registran como <StatusBadge status="SIMULADA" />: no se contacta a ningún proveedor ni se solicitan datos de pago.</div>
            )}
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Guardando…</> : '💾 Guardar reserva'}
            </button>
          </form>
        </div>
      )}

      {trips.length > 0 && (
        <div className="trip-selector-card animate-fade-in">
          <label>Filtrar por viaje</label>
          <select value={filterTrip} onChange={e => setFilterTrip(e.target.value)}>
            <option value="">Todos los viajes</option>
            {trips.map(t => <option key={t.tripId} value={t.tripId}>{t.origin} → {t.destination} · {t.startDate}</option>)}
          </select>
        </div>
      )}

      {loading ? (
        <div className="loading"><div className="spinner" /> Cargando reservas…</div>
      ) : !trips.length ? (
        <div className="empty-state"><div className="icon">🗺️</div><p>Primero crea un viaje para asociarle reservas.</p></div>
      ) : (
        <ReservationList
          reservations={visible}
          renderActions={r => (
            <>
              <button className="btn btn-secondary" onClick={() => openEdit(r)} type="button">✏️ Editar</button>
              {r.status === 'SIMULADA' && <button className="btn btn-secondary" onClick={() => setStatus(r, 'PENDIENTE')} type="button">Marcar pendiente</button>}
              {r.status === 'PENDIENTE' && <button className="btn btn-ghost" onClick={() => setStatus(r, 'SIMULADA')} type="button">Volver a simulada</button>}
            </>
          )}
        />
      )}
    </div>
  )
}
