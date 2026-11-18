import { useState, useRef, useEffect } from 'react'
import { AGENTCORE_URL, AWS_REGION } from '../config.js'
import './Chat.css'

const SUGGESTED = [
  'Quiero organizar unas vacaciones de 4 días en Cartagena saliendo desde Bogotá con 3 personas y presupuesto de 5 millones',
  'Busca vuelos de BOG a MAD para el 2027-03-15 y dime el clima en Madrid',
  'Busca vuelos de BAQ a MIA para el 2027-02-20',
]

export default function Chat() {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: '¡Hola! Soy TripPlanner AI 🌍 Puedo ayudarte a buscar vuelos, consultar el clima, planificar viajes y crear itinerarios. ¿A dónde quieres viajar?' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId] = useState(() => crypto.randomUUID())
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text) {
    const prompt = text || input.trim()
    if (!prompt || loading) return

    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: prompt }])
    setLoading(true)

    // Agregar mensaje del asistente vacío que iremos llenando
    setMessages(prev => [...prev, { role: 'assistant', text: '', streaming: true }])

    try {
      const payload = {
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'message/send',
        params: {
          message: {
            messageId: crypto.randomUUID(),
            role: 'user',
            parts: [{ kind: 'text', text: prompt }],
          },
          configuration: { acceptedOutputModes: ['text'] },
        },
      }

      const { AwsClient } = await import('aws4fetch')
      const aws = new AwsClient({
        accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
        secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
        region: AWS_REGION,
        service: 'bedrock-agentcore',
      })

      const response = await aws.fetch(AGENTCORE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id': sessionId,
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      let responseText = ''

      // Extraer texto de la respuesta A2A
      const result = data?.result || {}
      for (const artifact of result.artifacts || []) {
        for (const part of artifact.parts || []) {
          if (part.kind === 'text') responseText += part.text
        }
      }
      for (const part of result.parts || []) {
        if (part.kind === 'text') responseText += part.text
      }

      // Limpiar thinking tags
      responseText = responseText.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim()

      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', text: responseText || 'No se pudo obtener respuesta.' }
        return updated
      })
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          text: `Error al conectar con el asistente: ${err.message}`
        }
        return updated
      })
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <div className="chat-page">
      <div className="chat-header">
        <h1 className="chat-title">💬 Asistente TripPlanner AI</h1>
        <div className="chat-status"><span className="status-dot" />En línea</div>
      </div>

      <div className="chat-container">
        <div className="messages-area">
          {messages.map((msg, i) => (
            <div key={i} className={`message message-${msg.role}`}>
              {msg.role === 'assistant' && (
                <div className="message-avatar">🤖</div>
              )}
              <div className="message-bubble">
                {msg.streaming && !msg.text ? (
                  <div className="typing-indicator">
                    <span /><span /><span />
                  </div>
                ) : (
                  <div className="message-text" dangerouslySetInnerHTML={{
                    __html: formatMessage(msg.text)
                  }} />
                )}
              </div>
              {msg.role === 'user' && (
                <div className="message-avatar user-avatar-chat">U</div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Sugerencias */}
        {messages.length <= 1 && (
          <div className="suggestions">
            {SUGGESTED.map((s, i) => (
              <button key={i} className="suggestion-btn" onClick={() => sendMessage(s)}>
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="chat-input-area">
          <textarea
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Escribe tu mensaje... (Enter para enviar)"
            rows={2}
            disabled={loading}
          />
          <button
            className="btn btn-primary send-btn"
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
          >
            {loading ? <div className="spinner" /> : '➤'}
          </button>
        </div>
      </div>
    </div>
  )
}

function formatMessage(text) {
  if (!text) return ''
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br/>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
}
