import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

const root = ReactDOM.createRoot(document.getElementById('root'))

// /__preview solo existe en desarrollo (Vite elimina esta rama en el build de producción)
if (import.meta.env.DEV && window.location.pathname === '/__preview') {
  import('./dev/Preview.jsx').then(({ default: Preview }) => root.render(<Preview />))
} else {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}
