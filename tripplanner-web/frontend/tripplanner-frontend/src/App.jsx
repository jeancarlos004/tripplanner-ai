import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Chat from './pages/Chat.jsx'
import Flights from './pages/Flights.jsx'
import Weather from './pages/Weather.jsx'
import MyTrips from './pages/MyTrips.jsx'
import Reservations from './pages/Reservations.jsx'
import './App.css'

const NAV = [
  { to: '/',             icon: '🏠', label: 'Dashboard'  },
  { to: '/chat',         icon: '💬', label: 'Asistente'  },
  { to: '/flights',      icon: '✈️', label: 'Vuelos'     },
  { to: '/weather',      icon: '🌤️', label: 'Clima'      },
  { to: '/trips',        icon: '🗺️', label: 'Mis Viajes' },
  { to: '/reservations', icon: '📋', label: 'Reservas'   },
]

function Shell() {
  const { user, logout } = useAuth()
  if (!user) return <Login />

  const initial = (user.name || user.email || 'U').charAt(0).toUpperCase()
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span className="logo-icon">✈️</span>
          <span className="logo-text">TripPlanner <span className="logo-ai">AI</span></span>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(({ to, icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="nav-icon">{icon}</span>
              <span className="nav-label">{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{initial}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="user-name" title={user.email}>{user.name}</div>
              <button className="logout-btn" onClick={logout} type="button">Cerrar sesión</button>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <Routes>
          <Route path="/"             element={<Dashboard />} />
          <Route path="/chat"         element={<Chat />} />
          <Route path="/flights"      element={<Flights />} />
          <Route path="/weather"      element={<Weather />} />
          <Route path="/trips"        element={<MyTrips />} />
          <Route path="/trips/:tripId" element={<MyTrips />} />
          <Route path="/reservations" element={<Reservations />} />
          <Route path="*"             element={<Navigate to="/" replace />} />
        </Routes>
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
