import Icon from './Icon.jsx'

/** Encabezado de página con el color del dominio (sky, sun, sea, coral, agent). */
export default function PageHeader({ tone = 'sea', icon, kicker, title, children }) {
  return (
    <header className={`page-header tone-${tone}`} data-reveal>
      <div className="page-header-main">
        {icon && <span className="page-header-icon"><Icon name={icon} size={24} /></span>}
        <div>
          {kicker && <div className="page-kicker">{kicker}</div>}
          <h1 className="page-header-title">{title}</h1>
        </div>
      </div>
      {children && <div className="page-header-actions">{children}</div>}
    </header>
  )
}
