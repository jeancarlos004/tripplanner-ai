# app/OrchestratorAgent/main.py
"""
Orchestrator Agent - Cliente A2A sobre Bedrock AgentCore Runtime

Invoca los agentes especialistas usando botocore.auth.SigV4Auth para firmar
las requests HTTP directamente, evitando el caché de credenciales de boto3.

Integra AgentCore Memory para persistir preferencias de viaje y resúmenes
de sesión entre conversaciones del mismo usuario.
"""

import os
import json
import uuid
import urllib.request

import boto3
import botocore.auth
import botocore.awsrequest

from strands import Agent, tool
from strands.models import BedrockModel
from strands.handlers.callback_handler import null_callback_handler
from strands.agent.conversation_manager import NullConversationManager
from bedrock_agentcore.runtime import BedrockAgentCoreApp

# ── Importaciones de memoria ─────────────────────────────────────────────────

from bedrock_agentcore.memory.integrations.strands.config import AgentCoreMemoryConfig
from bedrock_agentcore.memory.integrations.strands.session_manager import (
    AgentCoreMemorySessionManager,
)

# ── Configuración ────────────────────────────────────────────────────────────

app = BedrockAgentCoreApp()

AWS_REGION  = os.environ.get("AWS_DEFAULT_REGION", "us-east-2")
MODEL_ID    = os.environ.get("BEDROCK_MODEL_ID", "us.amazon.nova-lite-v1:0")
FLIGHTS_URL = os.environ.get("FLIGHTS_AGENT_URL", "")
WEATHER_URL = os.environ.get("WEATHER_AGENT_URL", "")

# Vacío → el agente sigue funcionando sin memoria gestionada.
MEMORY_ID   = os.environ.get("TRIP_MEMORY_ID") or None


# ── Invocación A2A con botocore SigV4 ────────────────────────────────────────

def _invoke_a2a_runtime(base_url: str, message: str) -> str:
    """
    Invoca un runtime AgentCore con protocolo A2A.

    Usa botocore.auth.SigV4Auth para firmar la request HTTP directamente,
    lo que garantiza que las credenciales se leen frescas del entorno en
    cada llamada (sin el caché de boto3 client).

    Args:
        base_url: URL base del runtime (sin /invocations).
        message:  Texto de la petición al agente especialista.

    Returns:
        Texto de la respuesta del agente especialista.
    """
    invocation_url = base_url.rstrip("/") + "/invocations"

    payload = {
        "jsonrpc": "2.0",
        "id": str(uuid.uuid4()),
        "method": "message/send",
        "params": {
            "message": {
                "messageId": str(uuid.uuid4()),
                "role": "user",
                "parts": [{"kind": "text", "text": message}],
            },
            "configuration": {"acceptedOutputModes": ["text"]},
        },
    }
    payload_bytes = json.dumps(payload).encode("utf-8")

    # Obtener credenciales frescas del entorno
    session = boto3.Session()
    creds   = session.get_credentials().get_frozen_credentials()

    # Firmar la request con botocore SigV4 (implementación correcta y probada)
    aws_request = botocore.awsrequest.AWSRequest(
        method="POST",
        url=invocation_url,
        data=payload_bytes,
        headers={
            "Content-Type": "application/json",
            "X-Amzn-Bedrock-AgentCore-Runtime-Session-Id": str(uuid.uuid4()),
        },
    )
    botocore.auth.SigV4Auth(creds, "bedrock-agentcore", AWS_REGION).add_auth(aws_request)

    # Ejecutar la request HTTP con los headers firmados
    http_request = urllib.request.Request(
        url=invocation_url,
        data=payload_bytes,
        headers=dict(aws_request.headers),
        method="POST",
    )

    with urllib.request.urlopen(http_request, timeout=120) as resp:
        data = json.loads(resp.read())

    result = data.get("result", {})

    # Formato Task: result.artifacts[].parts[].text
    for artifact in result.get("artifacts", []):
        texts = [p["text"] for p in artifact.get("parts", []) if p.get("kind") == "text"]
        if texts:
            return "\n".join(texts)

    # Formato Message: result.parts[].text
    for part in result.get("parts", []):
        if part.get("kind") == "text":
            return part["text"]

    return json.dumps(result)


# ── Tools del orquestador ────────────────────────────────────────────────────

@tool
def ask_flights(request: str) -> str:
    """
    Delega en el Flights Agent la búsqueda de vuelos.

    Args:
        request: Petición en lenguaje natural sobre vuelos.
                 Incluye origen, destino y fecha si están disponibles.

    Returns:
        Lista de vuelos disponibles con horarios y precios.
    """
    if not FLIGHTS_URL:
        return "Error: FLIGHTS_AGENT_URL no configurado."
    try:
        return _invoke_a2a_runtime(FLIGHTS_URL, request)
    except Exception as e:
        return f"Error al consultar el Flights Agent: {type(e).__name__}: {e}"


@tool
def ask_weather(request: str) -> str:
    """
    Delega en el Weather Agent la consulta del pronóstico del clima.

    Args:
        request: Petición en lenguaje natural sobre el clima.
                 Incluye ciudad y fecha si están disponibles.

    Returns:
        Pronóstico del clima con temperatura y condiciones.
    """
    if not WEATHER_URL:
        return "Error: WEATHER_AGENT_URL no configurado."
    try:
        return _invoke_a2a_runtime(WEATHER_URL, request)
    except Exception as e:
        return f"Error al consultar el Weather Agent: {type(e).__name__}: {e}"


# ── Memoria ───────────────────────────────────────────────────────────────────

def _build_session_manager(session_id: str, actor_id: str):
    """
    Crea un AgentCoreMemorySessionManager para la sesión y usuario dados.
    Devuelve None si TRIP_MEMORY_ID no está configurado, en cuyo caso el
    agente funciona igual pero sin memoria gestionada.

    Args:
        session_id: Identificador único de la conversación actual.
        actor_id:   Identidad del usuario (para separar recuerdos por usuario).

    Returns:
        AgentCoreMemorySessionManager o None.
    """
    if not MEMORY_ID:
        return None

    config = AgentCoreMemoryConfig(
        memory_id=MEMORY_ID,
        session_id=session_id,  # una conversación concreta
        actor_id=actor_id,      # la identidad del usuario
    )
    return AgentCoreMemorySessionManager(config, region_name=AWS_REGION)


# ── System prompt ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """Eres Trip Planner, un asistente experto en planificación de viajes.

FLUJO (obligatorio):
1. Detecta origen, destino y fecha en el mensaje del usuario.
2. Invoca ask_flights con esos datos.
3. Invoca ask_weather con destino y fecha.
4. Construye la respuesta final con el formato exacto de abajo.

FORMATO DE RESPUESTA (usa exactamente esta estructura):

---
## ✈️ Vuelos disponibles · {origen} → {destino} · {fecha}

| # | Aerolínea | Precio | Reservar |
|---|-----------|--------|----------|
| 1 | LATAM | USD 694 | [Reservar](url) |
| 2 | Avianca | USD 784 | [Reservar](url) |
(continúa con todos los vuelos recibidos)

---
## 🌤️ Clima en {destino} · {fecha}

| Condición | Temperatura | Humedad | Viento |
|-----------|-------------|---------|--------|
| Soleado ☀️ | 8°C / 46°F | 65% | 15 km/h |

---
## 💡 Recomendación

(2-3 líneas prácticas: mejor opción de vuelo por precio, qué ropa llevar según el clima)

---

REGLAS:
- Responde siempre en español.
- Usa la tabla Markdown para vuelos y clima, sin omitir ningún vuelo recibido.
- No agregues texto fuera del formato.
- Si falta algún dato (ej: horario), pon "—" en esa celda.
"""


def _build_agent(session_id: str, actor_id: str) -> Agent:
    """
    Construye el agente orquestador inyectando el session manager de memoria
    si TRIP_MEMORY_ID está configurado, o NullConversationManager si no.

    Args:
        session_id: ID de la sesión actual (del contexto AgentCore).
        actor_id:   ID del usuario (del contexto AgentCore).

    Returns:
        Instancia de Agent lista para invocar.
    """
    session_manager = _build_session_manager(session_id, actor_id)

    agent_kwargs = {
        "name": "Trip Planner Orchestrator",
        "model": BedrockModel(model_id=MODEL_ID, region_name=AWS_REGION),
        "system_prompt": SYSTEM_PROMPT,
        "tools": [ask_flights, ask_weather],
        "callback_handler": null_callback_handler,
    }

    if session_manager is not None:
        # El session manager gestiona el historial y la memoria automáticamente.
        agent_kwargs["session_manager"] = session_manager
    else:
        # Sin memoria configurada: cada invocación es stateless.
        agent_kwargs["conversation_manager"] = NullConversationManager()

    return Agent(**agent_kwargs)


# ── Validación de payload ─────────────────────────────────────────────────────

def _extract_prompt(payload: dict) -> str:
    """
    Extrae y valida el prompt del payload de entrada.
    Soporta tanto {"prompt": "..."} como historial de mensajes.

    Args:
        payload: Diccionario recibido por el entrypoint.

    Returns:
        String del prompt validado.

    Raises:
        ValueError: Si el prompt está ausente, no es string, o está vacío.
    """
    prompt = payload.get("prompt", "")
    if not isinstance(prompt, str) or not prompt.strip():
        raise ValueError("El campo 'prompt' debe ser un string no vacío.")
    return prompt.strip()


# ── Entrypoint AgentCore ──────────────────────────────────────────────────────

@app.entrypoint
async def invoke(payload, context):
    """
    Punto de entrada del runtime AgentCore.

    Lee session_id y actor_id del contexto para separar correctamente
    los recuerdos por usuario y conversación en AgentCore Memory.
    """
    prompt = _extract_prompt(payload)

    # Leer identidades del contexto AgentCore; usar defaults seguros si no están.
    session_id = getattr(context, "session_id", None) or str(uuid.uuid4())
    actor_id   = getattr(context, "actor_id",   None) or "default-user"

    agent  = _build_agent(session_id, actor_id)
    result = agent(prompt)

    # Extraer el texto final del resultado síncrono.
    # result.message es {"role": "assistant", "content": [{"text": "..."}]}
    text = result.message["content"][0]["text"]
    yield {"text": text}


if __name__ == "__main__":
    print("🚀 Starting Trip Planner Orchestrator...")
    print(f"📡 Flights : {FLIGHTS_URL or '(no configurado)'}")
    print(f"📡 Weather : {WEATHER_URL or '(no configurado)'}")
    print(f"🧠 Memory  : {MEMORY_ID  or '(sin memoria — modo stateless)'}")
    app.run()
