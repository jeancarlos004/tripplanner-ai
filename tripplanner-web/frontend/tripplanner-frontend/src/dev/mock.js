// MODO DEMO — solo en desarrollo (npm run dev, abrir http://localhost:5173/?mock).
// Simula la API y el streaming del Orchestrator con respuestas reales capturadas
// (src/dev/mock-data.json, ignorado por Git) para revisar la interfaz sin iniciar sesión.
// Vite elimina todas las referencias a este archivo en el build de producción.

const files = import.meta.glob('./mock-data.json', { eager: true, import: 'default' })
const DATA = Object.values(files)[0] || { trip: null, profile: { preferences: {} }, turns: {} }

const db = {
  trips: DATA.trip ? [DATA.trip.trip] : [],
  itinerary: { [DATA.trip?.trip?.tripId]: DATA.trip?.itinerary || [] },
  reservations: DATA.trip?.reservations || [],
  profile: { userId: 'mock-user', ...DATA.profile },
}

const wait = ms => new Promise(r => setTimeout(r, ms))
const uuid = () => crypto.randomUUID()

export async function mockRequest(method, path, body) {
  await wait(250)
  const m = path.match(/^\/trips\/([^/]+)(?:\/(itinerary|reservations)(?:\/([^/]+))?)?$/)
  if (path === '/profile') {
    if (method === 'PUT') db.profile = { ...db.profile, ...body }
    return { profile: db.profile }
  }
  if (path === '/trips' && method === 'GET') return { trips: db.trips, count: db.trips.length }
  if (path === '/trips' && method === 'POST') {
    const trip = { ...body, tripId: uuid(), status: 'PLANNING', createdAt: new Date().toISOString() }
    db.trips.push(trip); db.itinerary[trip.tripId] = []
    return { tripId: trip.tripId, trip }
  }
  if (path === '/reservations') return { reservations: db.reservations, count: db.reservations.length }
  if (m) {
    const [, id, sub, extra] = m
    const trip = db.trips.find(t => t.tripId === id)
    if (!trip) throw Object.assign(new Error('Viaje no encontrado'), { status: 404 })
    if (!sub && method === 'GET') return { trip, itinerary: db.itinerary[id] || [], reservations: db.reservations.filter(r => r.tripId === id) }
    if (!sub && method === 'PUT') { Object.assign(trip, body); return { trip } }
    if (sub === 'itinerary' && method === 'GET') return { itinerary: db.itinerary[id] || [] }
    if (sub === 'itinerary' && extra && method === 'PUT') {
      const days = db.itinerary[id] || (db.itinerary[id] = [])
      const day = days.find(d => d.date === extra)
      if (day) Object.assign(day, body); else days.push({ date: extra, ...body })
      return { day: days.find(d => d.date === extra) }
    }
    if (sub === 'reservations' && method === 'GET') return { reservations: db.reservations.filter(r => r.tripId === id) }
    if (sub === 'reservations' && method === 'POST') {
      const r = { ...body, reservationId: uuid(), tripId: id, tripName: trip.name || trip.destination,
                  status: 'SIMULADA', createdAt: new Date().toISOString() }
      db.reservations.unshift(r); return { reservationId: r.reservationId, status: r.status, reservation: r }
    }
    if (sub === 'reservations' && extra && method === 'PUT') {
      const r = db.reservations.find(x => x.reservationId === extra); Object.assign(r, body); return { reservation: r }
    }
  }
  throw new Error(`Ruta no simulada: ${method} ${path}`)
}

function pickTurn(prompt) {
  const p = prompt.toLowerCase()
  const trip = DATA.trip
  if (/(comer|comida|gastron|restaurant)/.test(p) && DATA.turns.food) return DATA.turns.food
  if (/(recomi|destino)/.test(p) && DATA.turns.recs) return DATA.turns.recs
  if (/(crea|guarda).*(viaje|itinerario)/.test(p) && trip) return {
    steps: ['🧭 Orchestrator interpretando tu solicitud…', '🗺️ Creando tu viaje…'],
    text: '¡Listo! Guardé tu viaje a Cartagena con un itinerario de 4 días pensado para el clima y tu presupuesto. ¿Quieres que reserve el vuelo más barato?',
    ui: [{ component: 'trip', data: trip.trip }, { component: 'itinerary', data: { tripId: trip.trip.tripId, days: trip.itinerary } }],
  }
  if (/reserv/.test(p) && trip) return {
    steps: ['🧭 Orchestrator interpretando tu solicitud…', '📋 Registrando la reserva (simulada)…'],
    text: 'Registré la reserva del vuelo para los tres viajeros. Es una reserva **simulada**: no se contactó a la aerolínea ni se pidió ningún pago.',
    ui: [{ component: 'reservations', data: trip.reservations }],
  }
  if (/mis viajes|viajes guardados/.test(p)) return {
    steps: ['🧭 Orchestrator interpretando tu solicitud…', '📂 Recuperando tus viajes…'],
    text: 'Estos son tus viajes guardados.', ui: [{ component: 'trips', data: db.trips }],
  }
  return DATA.turns.plan || { steps: [], text: 'No hay datos de demostración. Crea src/dev/mock-data.json.', ui: [] }
}

/** Reproduce un turno real con tiempos parecidos a los del agente desplegado. */
export async function mockStream(prompt, { onEvent, signal }) {
  const turn = pickTurn(prompt)
  const guard = () => { if (signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' }) }
  for (const s of turn.steps || []) { await wait(700); guard(); onEvent({ type: 'status', message: s }) }
  await wait(600)
  for (const u of turn.ui || []) { guard(); onEvent({ type: 'ui', component: u.component, data: u.data }); await wait(380) }
  const text = turn.text || ''
  for (let i = 0; i < text.length; i += 6) { guard(); onEvent({ type: 'text', delta: text.slice(i, i + 6) }); await wait(18) }
  onEvent({ type: 'done' })
}
