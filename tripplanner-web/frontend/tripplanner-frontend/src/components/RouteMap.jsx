// Mapa de ruta animado: la estela se dibuja y el avión recorre el arco (GSAP MotionPath).
import { useRef } from 'react'
import { gsap, useGSAP, prefersReducedMotion } from '../lib/motion.js'
import './RouteMap.css'

const IATA = {
  'bogota': 'BOG', 'cartagena': 'CTG', 'medellin': 'MDE', 'cali': 'CLO', 'barranquilla': 'BAQ',
  'santa marta': 'SMR', 'san andres': 'ADZ', 'pereira': 'PEI', 'bucaramanga': 'BGA', 'leticia': 'LET',
  'madrid': 'MAD', 'miami': 'MIA', 'cancun': 'CUN', 'lima': 'LIM', 'quito': 'UIO', 'panama': 'PTY',
  'mexico': 'MEX', 'buenos aires': 'EZE', 'santiago': 'SCL', 'new york': 'JFK', 'nueva york': 'JFK',
}
export function cityCode(name = '') {
  const key = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  if (/^[a-z]{3}$/i.test(name.trim())) return name.trim().toUpperCase()
  return IATA[key] || key.replace(/[^a-z]/g, '').slice(0, 3).toUpperCase() || '---'
}

const PATH = 'M 70 196 C 190 40, 400 20, 532 92'

export default function RouteMap({ from = 'Bogotá', to = 'Cartagena', caption, loop = true, compact = false }) {
  const root = useRef(null)

  useGSAP(() => {
    const plane = root.current.querySelector('.rm-plane')
    const trail = root.current.querySelector('.rm-trail')
    const len = trail.getTotalLength()
    if (prefersReducedMotion()) {
      gsap.set(trail, { strokeDasharray: len, strokeDashoffset: 0 })
      gsap.set(plane, { motionPath: { path: trail, align: trail, alignOrigin: [0.5, 0.5], autoRotate: true, start: 0.72, end: 0.72 } })
      return
    }
    gsap.set(trail, { strokeDasharray: len, strokeDashoffset: len })
    const tl = gsap.timeline({ repeat: loop ? -1 : 0, repeatDelay: 1.4, defaults: { ease: 'power1.inOut' } })
    tl.from(root.current.querySelectorAll('.rm-node'), { scale: 0, transformOrigin: '50% 50%', stagger: 0.2, duration: 0.5, ease: 'back.out(2)' })
      .to(trail, { strokeDashoffset: 0, duration: 3.2 }, 0.3)
      .fromTo(plane, { autoAlpha: 0 }, {
        autoAlpha: 1, duration: 3.2,
        motionPath: { path: trail, align: trail, alignOrigin: [0.5, 0.5], autoRotate: true },
      }, 0.3)
      .to(plane, { autoAlpha: 0, duration: 0.4 }, '>-0.1')
      .to(root.current.querySelector('.rm-dest-ring'), { scale: 2.4, autoAlpha: 0, transformOrigin: '50% 50%', duration: 0.9, ease: 'power2.out' }, '<')
      .to(trail, { autoAlpha: 0.35, duration: 0.6 }, '<')
  }, { scope: root, dependencies: [from, to] })

  return (
    <div className={`route-map ${compact ? 'compact' : ''}`} ref={root}>
      <svg viewBox="0 0 600 250" role="img" aria-label={`Ruta de ${from} a ${to}`}>
        <defs>
          <linearGradient id="rm-trail-g" x1="0" x2="1">
            <stop offset="0" stopColor="#2dd4bf" /><stop offset="1" stopColor="#ff7a59" />
          </linearGradient>
        </defs>
        {/* Paralelos y meridianos */}
        <g className="rm-grid">
          {[50, 100, 150, 200].map(y => <path key={y} d={`M0 ${y} Q300 ${y - 18} 600 ${y}`} />)}
          {[120, 240, 360, 480].map(x => <path key={x} d={`M${x} 0 Q${x + 14} 125 ${x} 250`} />)}
        </g>
        <path className="rm-guide" d={PATH} />
        <path className="rm-trail" d={PATH} stroke="url(#rm-trail-g)" />

        <g className="rm-node rm-origin">
          <circle cx="70" cy="196" r="7" />
          <circle cx="70" cy="196" r="13" className="rm-halo" />
        </g>
        <g className="rm-node rm-dest">
          <circle cx="532" cy="92" r="7" />
          <circle cx="532" cy="92" r="13" className="rm-halo" />
          <circle cx="532" cy="92" r="9" className="rm-dest-ring" />
        </g>

        <text x="70" y="232" textAnchor="middle" className="rm-code">{cityCode(from)}</text>
        <text x="532" y="58" textAnchor="middle" className="rm-code">{cityCode(to)}</text>

        <g className="rm-plane">
          <path d="M14 0 L-8 -9 L-4 0 L-8 9 Z" />
        </g>
      </svg>
      <div className="rm-labels">
        <span><b>{from}</b><small>Salida</small></span>
        {caption && <span className="rm-caption">{caption}</span>}
        <span className="rm-right"><b>{to}</b><small>Destino</small></span>
      </div>
    </div>
  )
}
