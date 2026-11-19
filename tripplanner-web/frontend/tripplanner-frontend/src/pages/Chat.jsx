import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { streamAgent, getChatSessionId } from '../lib/agent.js'
import { renderMarkdown } from '../lib/format.js'
import { AgentUI } from '../components/AgentCards.jsx'
import { useAuth } from '../lib/AuthContext.jsx'
import { useEnter, gsap, prefersReducedMotion } from '../lib/motion.js'
import Icon, { BrandMark } from '../components/Icon.jsx'
import './Chat.css'

const SUGGESTED = [
  { icon: 'plane',    tone: 'sky',   label: 'Escenario Cartagena', prompt: 'Quiero organizar unas vacaciones de cuatro días en Cartagena. Salgo desde Bogotá, viajo con dos personas más y tengo un presupuesto de 5 millones de pesos. Quiero conocer el clima, encontrar vuelos y organizar algunas actividades turísticas.' },
  { icon: 'compass',  tone: 'agent', label: 'Destinos para mí',    prompt: 'Recomiéndame destinos para mi próximo viaje según mis preferencias' },
  { icon: 'food',     tone: 'sun',   label: 'Qué comer en Cartagena', prompt: '¿Qué comida típica me recomiendas probar en Cartagena y dónde?' },
  { icon: 'map',      tone: 'sea',   label: 'Mis viajes',          prompt: 'Muéstrame mis viajes guardados' },
  { icon: 'ticket',   tone: 'coral', label: 'Mis reservas',        prompt: '¿Qué reservas tengo registradas?' },
]

const CREW = [
  { key: 'agent', icon: 'sparkles', name: 'Orchestrator' },
  { key: 'sky',   icon: 'plane',    name: 'Flight' },
  { key: 'sun',   icon: 'weather',  name: 'Weather' },
  { key: 'sea',   icon: 'map',      name: 'Tools' },
]

// Color del paso según el agente o la herramienta que lo produce
function stepTone(text = '') {
  if (/flight|vuelo/i.test(text)) return 'sky'
  if (/weather|clima/i.test(text)) return 'sun'
  if (/orchestrator|interpret/i.test(text)) return 'agent'
  if (/gastron|comer/i.test(text)) return 'sun'
  if (/recomend|preferencia/i.test(text)) return 'agent'
  if (/reserva/i.test(text)) return 'coral'
  return 'sea'
}

const HISTORY_KEY = 'tripplanner.chatHistory'

function welcome(name) {
  return { role: 'assistant', text: `¡Hola${name ? `, ${name}` : ''}! Soy **TripPlanner AI**. Coordino a un agente de vuelos y otro de clima para planear tu viaje, armar el itinerario y registrar reservas. ¿A dónde quieres ir?`, ui: [] }
}

function loadHistory(sessionId) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || 'null')
    if (saved?.sessionId === sessionId && Array.isArray(saved.messages)) return saved.messages
  } catch { /* noop */ }
  return null
}

function Message({ msg, userInitial }) {
  const ref = useEnter({ from: { y: 14, autoAlpha: 0 } })
  const isUser = msg.role === 'user'
  return (
    <div className={`message message-${msg.role}`} ref={ref}>
      <div className={`message-avatar ${isUser ? 'user-avatar-chat' : ''}`}>{isUser ? userInitial : <BrandMark size={30} />}</div>
      <div className={`message-bubble ${msg.ui?.length ? 'has-ui' : ''}`}>
        {msg.steps?.length > 0 && (
          <ul className="agent-steps">
            {msg.steps.map((s, j) => (
              <li key={j} className={`tone-${stepTone(s)} ${msg.streaming && j === msg.steps.length - 1 ? 'active' : 'done'}`}>
                <span className="step-dot" />{s}
              </li>
            ))}
          </ul>
        )}
        {msg.streaming && !msg.text && !msg.steps?.length && <div className="typing-indicator"><span /><span /><span /></div>}
        {isUser
          ? <div className="message-text">{msg.text}</div>
          : msg.text && <div className="message-text md" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }} />}
        {msg.ui?.map((u, j) => <AgentUI key={j} component={u.component} data={u.data} />)}
        {msg.streaming && msg.text && <span className="stream-caret" />}
        {msg.error && <div className="chat-error">{msg.error}</div>}
      </div>
    </div>
  )
}

export default function Chat() {
  const { user } = useAuth()
  const [sessionId, setSessionId] = useState(() => getChatSessionId())
  const [messages, setMessages] = useState(() => loadHistory(getChatSessionId()) || [welcome(user?.name)])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const abortRef = useRef(null)
  const crewRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages])
  useEffect(() => {
    if (loading) return
    try { sessionStorage.setItem(HISTORY_KEY, JSON.stringify({ sessionId, messages })) } catch { /* noop */ }
  }, [messages, loading, sessionId])
  useEffect(() => () => abortRef.current?.abort(), [])

  // Envío automático de una consulta que llega por URL (?q=...), p. ej. desde "Dónde comer"
  const [params, setParams] = useSearchParams()
  const autoSent = useRef(false)
  useEffect(() => {
    const q = params.get('q')
    if (q && !autoSent.current) {
      autoSent.current = true
      setParams({}, { replace: true })
      sendMessage(q.slice(0, 500))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Agente activo = el del último paso del mensaje en curso
  const last = messages[messages.length - 1]
  const activeTone = loading && last?.steps?.length ? stepTone(last.steps[last.steps.length - 1]) : null
  useEffect(() => {
    if (!activeTone || prefersReducedMotion() || !crewRef.current) return
    const el = crewRef.current.querySelector(`.crew-${activeTone}`)
    if (el) gsap.fromTo(el, { scale: 1 }, { scale: 1.12, duration: 0.25, yoyo: true, repeat: 1, ease: 'power2.out' })
  }, [activeTone, last?.steps?.length])

  const patchLast = fn => setMessages(prev => {
    const copy = [...prev]
    copy[copy.length - 1] = fn({ ...copy[copy.length - 1] })
    return copy
  })

  async function sendMessage(text) {
    const prompt = (text ?? input).trim()
    if (!prompt || loading) return
    setInput('')
    setLoading(true)
    setMessages(prev => [...prev, { role: 'user', text: prompt }, { role: 'assistant', text: '', ui: [], steps: [], streaming: true }])

    const controller = new AbortController()
    abortRef.current = controller
    try {
      await streamAgent(prompt, {
        sessionId,
        signal: controller.signal,
        onEvent: evt => {
          if (evt.type === 'text') patchLast(m => ({ ...m, text: m.text + evt.delta }))
          else if (evt.type === 'status') patchLast(m => ({ ...m, steps: [...(m.steps || []), evt.message] }))
          else if (evt.type === 'ui') patchLast(m => ({ ...m, ui: [...(m.ui || []), { component: evt.component, data: evt.data }] }))
          else if (evt.type === 'error') patchLast(m => ({ ...m, error: evt.message }))
        },
      })
    } catch (err) {
      if (err.name !== 'AbortError') patchLast(m => ({ ...m, error: err.message }))
    } finally {
      patchLast(m => ({ ...m, streaming: false, text: m.text || (m.ui?.length || m.error ? m.text : 'No se obtuvo respuesta.') }))
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function newConversation() {
    abortRef.current?.abort()
    const id = getChatSessionId(true)
    setSessionId(id)
    setMessages([welcome(user?.name)])
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const userInitial = (user?.name || 'U').charAt(0).toUpperCase()

  return (
    <div className="chat-page">
      <div className="chat-header" data-reveal>
        <div>
          <div className="page-kicker">Canal agéntico · streaming</div>
          <h1 className="chat-title">Asistente de viaje</h1>
        </div>
        <div className="chat-header-right">
          <div className="crew" ref={crewRef} aria-label="Agentes">
            {CREW.map(c => (
              <span key={c.key} className={`crew-member crew-${c.key} ${activeTone === c.key ? 'on' : ''}`} title={c.name}>
                <Icon name={c.icon} size={16} /><small>{c.name}</small>
              </span>
            ))}
          </div>
          <button className="btn btn-ghost new-chat" onClick={newConversation} type="button"><Icon name="refresh" size={16} /> Nueva conversación</button>
        </div>
      </div>

      <div className="chat-container">
        <div className="messages-area" aria-live="polite">
          {messages.map((msg, i) => <Message key={i} msg={msg} userInitial={userInitial} />)}
          <div ref={bottomRef} />
        </div>

        {messages.length <= 1 && (
          <div className="suggestions">
            {SUGGESTED.map(s => (
              <button key={s.label} className={`suggestion-btn tone-${s.tone}`} onClick={() => sendMessage(s.prompt)} type="button" title={s.prompt}>
                <Icon name={s.icon} size={16} /> {s.label}
              </button>
            ))}
          </div>
        )}

        <div className="chat-input-area">
          <textarea
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="¿A dónde quieres viajar? (Enter para enviar · Shift+Enter nueva línea)"
            rows={2}
            maxLength={4000}
            disabled={loading}
            aria-label="Mensaje para el asistente"
          />
          <button className="btn btn-primary send-btn" onClick={() => sendMessage()} disabled={loading || !input.trim()} type="button" aria-label="Enviar">
            {loading ? <div className="spinner" style={{ borderTopColor: '#1b0b05' }} /> : <Icon name="send" size={19} />}
          </button>
        </div>
      </div>
    </div>
  )
}
