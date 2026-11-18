// Vista SOLO de desarrollo (npm run dev → /__preview): renderiza los componentes de
// Agent-Driven UI con eventos reales capturados del Orchestrator (src/dev/fixtures.json,
// ignorado por Git). No se incluye en el build de producción.
import { BrowserRouter } from 'react-router-dom'
import { AgentUI } from '../components/AgentCards.jsx'
import { renderMarkdown } from '../lib/format.js'
import '../App.css'
import '../pages/Chat.css'

const fixtures = import.meta.glob('./fixtures.json', { eager: true, import: 'default' })
const data = Object.values(fixtures)[0] || { turns: [] }

export default function Preview() {
  return (
    <BrowserRouter>
      <div style={{ maxWidth: 980, margin: '0 auto', padding: 24 }}>
        <h1 className="page-title">🧪 Vista previa · Agent-Driven UI</h1>
        {!data.turns.length && <p>Sin fixtures: crea src/dev/fixtures.json.</p>}
        {data.turns.map((t, i) => (
          <div key={i} className="messages-area" style={{ padding: 0, marginBottom: 28 }}>
            <div className="message message-user">
              <div className="message-avatar user-avatar-chat">U</div>
              <div className="message-bubble"><div className="message-text">{t.prompt}</div></div>
            </div>
            <div className="message message-assistant">
              <div className="message-avatar">🤖</div>
              <div className="message-bubble has-ui">
                <ul className="agent-steps">{(t.steps || []).map((s, j) => <li key={j} className="done"><span className="step-dot" />{s}</li>)}</ul>
                <div className="message-text md" dangerouslySetInnerHTML={{ __html: renderMarkdown(t.text) }} />
                {(t.ui || []).map((u, j) => <AgentUI key={j} component={u.component} data={u.data} />)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </BrowserRouter>
  )
}
