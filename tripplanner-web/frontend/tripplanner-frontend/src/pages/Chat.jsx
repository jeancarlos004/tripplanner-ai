import { useState, useRef, useEffect } from 'react'
import { streamAgent, getChatSessionId } from '../lib/agent.js'
import { renderMarkdown } from '../lib/format.js'
import { AgentUI } from '../components/AgentCards.jsx'
import { useAuth } from '../lib/AuthContext.jsx'
import './Chat.css'

const SUGGESTED = [
  'Quiero organizar unas vacaciones de cuatro días en Cartagena. Salgo desde Bogotá, viajo con dos personas más y tengo un presupuesto de 5 millones de pesos. Quiero conocer el clima, encontrar vuelos y organizar algunas actividades turísticas.',
  'Muéstrame mis viajes guardados',
  '¿Qué reservas tengo registradas?',
]

const HISTORY_KEY = 'tripplanner.chatHistory'

function welcome(name) {
  return { role: 'assistant', text: `¡Hola${name ? `, ${name}` : ''}! Soy **TripPlanner AI** 🌍. Puedo buscar vuelos, consultar el clima, crear tu viaje con itinerario y registrar reservas. ¿A dónde quieres viajar?`, ui: [] }
}

function loadHistory(sessionId) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || 'null')
    if (saved?.sessionId === sessionId && Array.isArray(saved.messages)) return saved.messages
  } catch { /* noop */ }
  return null
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

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages])
  useEffect(() => {
    if (loading) return
    try { sessionStorage.setItem(HISTORY_KEY, JSON.stringify({ sessionId, messages })) } catch { /* noop */ }
  }, [messages, loading, sessionId])
  useEffect(() => () => abortRef.current?.abort(), [])

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

  return (
    <div className="chat-page">
      <div className="chat-header">
        <h1 className="chat-title">💬 Asistente TripPlanner AI</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="chat-status"><span className="status-dot" />{loading ? 'Procesando…' : 'En línea'}</div>
          <button className="btn btn-ghost" style={{ padding: '7px 12px', fontSize: 12 }} onClick={newConversation} type="button">＋ Nueva conversación</button>
        </div>
      </div>

      <div className="chat-container">
        <div className="messages-area" aria-live="polite">
          {messages.map((msg, i) => (
            <div key={i} className={`message message-${msg.role}`}>
              {msg.role === 'assistant' && <div className="message-avatar">🤖</div>}
              <div className={`message-bubble ${msg.ui?.length ? 'has-ui' : ''}`}>
                {msg.steps?.length > 0 && (
                  <ul className="agent-steps">
                    {msg.steps.map((s, j) => (
                      <li key={j} className={msg.streaming && j === msg.steps.length - 1 ? 'active' : 'done'}>
                        <span className="step-dot" />{s}
                      </li>
                    ))}
                  </ul>
                )}
                {msg.streaming && !msg.text && !msg.steps?.length && (
                  <div className="typing-indicator"><span /><span /><span /></div>
                )}
                {msg.role === 'user'
                  ? <div className="message-text">{msg.text}</div>
                  : msg.text && <div className="message-text md" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }} />}
                {msg.ui?.map((u, j) => <AgentUI key={j} component={u.component} data={u.data} />)}
                {msg.streaming && msg.text && <span className="stream-caret" />}
                {msg.error && <div className="chat-error">⚠️ {msg.error}</div>}
              </div>
              {msg.role === 'user' && <div className="message-avatar user-avatar-chat">{(user?.name || 'U').charAt(0).toUpperCase()}</div>}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {messages.length <= 1 && (
          <div className="suggestions">
            {SUGGESTED.map((s, i) => (
              <button key={i} className="suggestion-btn" onClick={() => sendMessage(s)} type="button">{s}</button>
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
            placeholder="Escribe tu mensaje… (Enter para enviar, Shift+Enter nueva línea)"
            rows={2}
            maxLength={4000}
            disabled={loading}
            aria-label="Mensaje para el asistente"
          />
          <button className="btn btn-primary send-btn" onClick={() => sendMessage()} disabled={loading || !input.trim()} type="button" aria-label="Enviar">
            {loading ? <div className="spinner" /> : '➤'}
          </button>
        </div>
      </div>
    </div>
  )
}
