import { useRef, useLayoutEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext.jsx'
import { gsap, useGSAP, prefersReducedMotion } from './lib/motion.js'
import Icon, { BrandMark } from './components/Icon.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Chat from './pages/Chat.jsx'
import Flights from './pages/Flights.jsx'
import Weather from './pages/Weather.jsx'
import MyTrips from './pages/MyTrips.jsx'
import Reservations from './pages/Reservations.jsx'
import './App.css'

// Cada sección lleva el color de su dominio (ver index.css)
const NAV = [
  { to: '/',             icon: 'home',    label: 'Inicio',     tone: 'sea'   },
  { to: '/chat',         icon: 'chat',    label: 'Asistente',  tone: 'agent' },
  { to: '/flights',      icon: 'plane',   label: 'Vuelos',     tone: 'sky'   },
  { to: '/weather',      icon: 'weather', label: 'Clima',      tone: 'sun'   },
  { to: '/trips',        icon: 'map',     label: 'Mis viajes', tone: 'sea'   },
  { to: '/reservations', icon: 'ticket',  label: 'Reservas',   tone: 'coral' },
]

function activeIndex(pathname) {
  const i = NAV.findIndex(n => (n.to === '/' ? pathname === '/' : pathname.startsWith(n.to)))
  return i < 0 ? 0 : i
}

function Sidebar() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const navRef = useRef(null)
  const pillRef = useRef(null)
  const idx = activeIndex(pathname)

  // Indicador deslizante: GSAP lo lleva hasta el elemento activo
  useLayoutEffect(() => {
    const nav = navRef.current, pill = pillRef.current
    const item = nav?.querySelectorAll('.nav-item')[idx]
    if (!item || !pill) return
    const props = { y: item.offsetTop, height: item.offsetHeight, x: item.offsetLeft, width: item.offsetWidth }
    if (prefersReducedMotion() || !pill.dataset.ready) { gsap.set(pill, props); pill.dataset.ready = '1' }
    else gsap.to(pill, { ...props, duration: 0.45, ease: 'power3.inOut' })
  }, [idx])

  const initial = (user.name || user.email || 'U').charAt(0).toUpperCase()
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <BrandMark />
        <div className="logo-text">
          <span>TripPlanner</span>
          <small>AI · 3 agentes</small>
        </div>
      </div>

      <nav className="sidebar-nav" ref={navRef} aria-label="Secciones">
        <span className={`nav-pill tone-${NAV[idx].tone}`} ref={pillRef} aria-hidden="true" />
        {NAV.map(({ to, icon, label, tone }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-item tone-${tone} ${isActive ? 'active' : ''}`}>
            <Icon name={icon} className="nav-icon" />
            <span className="nav-label">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-status" aria-label="Estado de los agentes">
        <div className="status-title">Agentes en línea</div>
        <div className="status-row"><span className="dot dot-agent" />Orchestrator</div>
        <div className="status-row"><span className="dot dot-sky" />Flight · MCP</div>
        <div className="status-row"><span className="dot dot-sun" />Weather · MCP</div>
      </div>

      <div className="sidebar-footer">
        <div className="user-avatar">{initial}</div>
        <div className="user-meta">
          <div className="user-name" title={user.email}>{user.name}</div>
          <button className="logout-btn" onClick={logout} type="button"><Icon name="logout" size={14} /> Cerrar sesión</button>
        </div>
      </div>
    </aside>
  )
}

function Page({ children }) {
  const { pathname } = useLocation()
  const ref = useRef(null)
  useGSAP(() => {
    if (prefersReducedMotion()) return
    gsap.from(ref.current, { autoAlpha: 0, y: 14, duration: 0.5, clearProps: 'all' })
    const items = gsap.utils.toArray('[data-reveal]', ref.current)
    if (items.length) gsap.from(items, { autoAlpha: 0, y: 20, stagger: 0.07, duration: 0.6, delay: 0.08, clearProps: 'all' })
  }, { dependencies: [pathname], scope: ref })
  return <div className="page" ref={ref}>{children}</div>
}

function Shell() {
  const { user } = useAuth()
  if (!user) return <Login />
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Page>
          <Routes>
            <Route path="/"              element={<Dashboard />} />
            <Route path="/chat"          element={<Chat />} />
            <Route path="/flights"       element={<Flights />} />
            <Route path="/weather"       element={<Weather />} />
            <Route path="/trips"         element={<MyTrips />} />
            <Route path="/trips/:tripId" element={<MyTrips />} />
            <Route path="/reservations"  element={<Reservations />} />
            <Route path="*"              element={<Navigate to="/" replace />} />
          </Routes>
        </Page>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </AuthProvider>
  )
}
