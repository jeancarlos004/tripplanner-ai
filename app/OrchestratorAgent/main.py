# app/OrchestratorAgent/main.py
"""
Orchestrator Agent — TripPlanner AI (Bedrock AgentCore Runtime, protocolo HTTP)

Canal 2 · Interacción agéntica:
    Frontend ──HTTP streaming (SSE)──▶ AgentCore ──▶ este agente
        ├─ ask_flights  ─A2A─▶ Flights Agent ─MCP─▶ Ignav (vuelos reales)
        ├─ ask_weather  ─A2A─▶ Weather Agent ─MCP─▶ servidor MCP de clima (Open-Meteo)
        └─ Tools de negocio ─HTTPS─▶ API Gateway (autorizador Cognito) ─▶ Lambda ─▶ DynamoDB

Contrato de entrada (POST /invocations):
    {"prompt": "texto del usuario", "idToken": "<JWT de Cognito>"}

Contrato de salida (text/event-stream). Cada evento SSE es un JSON:
    {"type": "status", "message": "Consultando vuelos…"}       indicador de procesamiento
    {"type": "text",   "delta": "…"}                           texto incremental del agente
    {"type": "ui",     "component": "flights", "data": {...}}  datos estructurados → componente visual
    {"type": "error",  "message": "…"}
    {"type": "done"}

Agent-Driven UI: el agente decide qué herramienta usar; las herramientas devuelven
datos estructurados que se emiten como eventos "ui" y el frontend los transforma
en tarjetas (vuelos, clima, viaje, itinerario, reservas).

Seguridad: el idToken se reenvía tal cual a API Gateway, que lo valida con el
autorizador de Cognito. Así el agente NUNCA decide a qué usuario pertenecen los
datos: la identidad la impone el backend (control de acceso por usuario).
"""

import functools
import json
import logging
import os
import queue
import re
import urllib.error
import urllib.request
import uuid
from datetime import date

import boto3
import botocore.auth
import botocore.awsrequest

from strands import Agent, tool
from strands.models import BedrockModel
from strands.handlers.callback_handler import null_callback_handler
from bedrock_agentcore.runtime import BedrockAgentCoreApp

from bedrock_agentcore.memory.integrations.strands.config import (
    AgentCoreMemoryConfig,
    RetrievalConfig,
)
from bedrock_agentcore.memory.integrations.strands.session_manager import (
    AgentCoreMemorySessionManager,
)

# ── Configuración ────────────────────────────────────────────────────────────

app = BedrockAgentCoreApp()

AWS_REGION  = os.environ.get("AWS_DEFAULT_REGION", "us-east-2")
MODEL_ID    = os.environ.get("BEDROCK_MODEL_ID", "us.amazon.nova-pro-v1:0")
FLIGHTS_URL = os.environ.get("FLIGHTS_AGENT_URL", "")
WEATHER_URL = os.environ.get("WEATHER_AGENT_URL", "")
API_URL     = os.environ.get("TRIPPLANNER_API_URL", "").rstrip("/")


def _memory_id() -> str | None:
    """Acepta el ID o el ARN de la memoria (memory/<id>)."""
    raw = os.environ.get("TRIP_MEMORY_ID", "").strip()
    if not raw:
        return None
    return raw.split("memory/", 1)[1] if "memory/" in raw else raw


MEMORY_ID = _memory_id()

STATUS_BY_TOOL = {
    "ask_flights": "✈️ Flight Agent consultando vuelos (MCP)…",
    "ask_weather": "🌤️ Weather Agent consultando el clima (MCP)…",
    "create_trip": "🗺️ Creando tu viaje…",
    "get_trips": "📂 Recuperando tus viajes…",
    "get_trip_details": "📂 Recuperando el detalle del viaje…",
    "update_trip": "✏️ Actualizando el viaje…",
    "create_itinerary": "📅 Guardando el itinerario…",
    "update_itinerary": "✏️ Actualizando el itinerario…",
    "create_reservation": "📋 Registrando la reserva (simulada)…",
    "get_reservations": "📋 Consultando reservas…",
    "update_reservation": "✏️ Actualizando la reserva…",
    "save_preferences": "💾 Guardando tus preferencias…",
    "get_traveler_profile": "⭐ Revisando tus preferencias e historial de viajes…",
    "show_recommendations": "✨ Preparando recomendaciones para ti…",
}


# ── Invocación A2A a los especialistas (SigV4) ───────────────────────────────

def _invoke_a2a_runtime(base_url: str, message: str) -> str:
    """Invoca un runtime AgentCore A2A firmando la petición con SigV4."""
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
    creds = boto3.Session().get_credentials().get_frozen_credentials()

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

    http_request = urllib.request.Request(
        url=invocation_url, data=payload_bytes, headers=dict(aws_request.headers), method="POST"
    )
    with urllib.request.urlopen(http_request, timeout=120) as resp:
        data = json.loads(resp.read())

    result = data.get("result", {})
    for artifact in result.get("artifacts", []):
        texts = [p["text"] for p in artifact.get("parts", []) if p.get("kind") == "text"]
        if texts:
            return "\n".join(texts)
    for part in result.get("parts", []):
        if part.get("kind") == "text":
            return part["text"]
    return json.dumps(result)


_JSON_BLOCK = re.compile(r"```(?:json)?\s*(\{.*?\})\s*```", re.DOTALL)
_THINKING = re.compile(r"<thinking>.*?</thinking>", re.DOTALL)


def _extract_json_block(text: str) -> dict | None:
    """Extrae el último bloque ```json {...}``` de la respuesta de un especialista."""
    for raw in reversed(_JSON_BLOCK.findall(text or "")):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            continue
    return None


# ── Cliente de la API de negocio (Canal 1 reutilizado por las Tools) ─────────

class BusinessApi:
    """Llama a API Gateway con el token del usuario. La Lambda valida y persiste."""

    def __init__(self, id_token: str):
        self.id_token = id_token

    def call(self, method: str, path: str, body: dict | None = None) -> dict:
        if not API_URL:
            raise RuntimeError("TRIPPLANNER_API_URL no configurado")
        data = json.dumps(body).encode("utf-8") if body is not None else None
        req = urllib.request.Request(
            API_URL + path,
            data=data,
            method=method,
            headers={"Content-Type": "application/json", "Authorization": self.id_token},
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                return json.loads(resp.read() or b"{}")
        except urllib.error.HTTPError as e:
            try:
                msg = json.loads(e.read()).get("error", "")
            except Exception:
                msg = ""
            raise ApiCallError(e.code, msg or f"HTTP {e.code}") from None


class ApiCallError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


# ── Construcción de Tools por petición ───────────────────────────────────────

def _build_tools(api: BusinessApi, ui_events: "queue.Queue[dict]"):
    """
    Crea las Tools para esta invocación. Cada Tool:
      1) llama a su Lambda (vía API Gateway) o al agente especialista,
      2) emite un evento "ui" con datos estructurados para el frontend,
      3) devuelve al LLM un resultado compacto en JSON.
    """

    def emit(component: str, data):
        ui_events.put({"type": "ui", "component": component, "data": data})

    def safe(fn):
        """Convierte errores de negocio en texto legible para el LLM."""
        @functools.wraps(fn)
        def run(*args, **kwargs):
            try:
                return fn(*args, **kwargs)
            except ApiCallError as e:
                return json.dumps({"ok": False, "status": e.status, "error": e.message}, ensure_ascii=False)
            except Exception as e:  # noqa: BLE001
                return json.dumps({"ok": False, "error": f"{type(e).__name__}: {e}"}, ensure_ascii=False)
        return run

    # ── Especialistas (A2A) ──────────────────────────────────────────────────

    @tool
    def ask_flights(request: str) -> str:
        """
        Delega en el Flight Agent la búsqueda de vuelos reales (MCP de vuelos).

        Args:
            request: Petición en lenguaje natural con origen, destino, fecha (YYYY-MM-DD)
                     y número de pasajeros. Ej: "Vuelos de Bogotá a Cartagena el 2027-02-10 para 3 adultos".
        """
        if not FLIGHTS_URL:
            return "Error: FLIGHTS_AGENT_URL no configurado."
        try:
            text = _THINKING.sub("", _invoke_a2a_runtime(FLIGHTS_URL, request)).strip()
        except Exception as e:  # noqa: BLE001
            return f"Error al consultar el Flight Agent: {type(e).__name__}: {e}"
        data = _extract_json_block(text)
        if data and data.get("flights"):
            emit("flights", data)
        return text

    @tool
    def ask_weather(request: str) -> str:
        """
        Delega en el Weather Agent la consulta del pronóstico del clima (MCP de clima).

        Args:
            request: Petición con ciudad y rango de fechas (YYYY-MM-DD).
                     Ej: "Clima en Cartagena del 2027-02-10 al 2027-02-13".
        """
        if not WEATHER_URL:
            return "Error: WEATHER_AGENT_URL no configurado."
        try:
            text = _THINKING.sub("", _invoke_a2a_runtime(WEATHER_URL, request)).strip()
        except Exception as e:  # noqa: BLE001
            return f"Error al consultar el Weather Agent: {type(e).__name__}: {e}"
        data = _extract_json_block(text)
        if data and data.get("days"):
            emit("weather", data)
        return text

    # ── Viajes ───────────────────────────────────────────────────────────────

    @tool
    @safe
    def create_trip(origin: str, destination: str, start_date: str, end_date: str,
                    travelers: int, budget: float, currency: str = "COP",
                    preferences: str = "", name: str = "",
                    itinerary_days: list[dict] | None = None) -> str:
        """
        CreateTrip — crea y guarda un viaje del usuario en DynamoDB.

        Args:
            origin: Ciudad de origen (ej. "Bogotá").
            destination: Ciudad de destino (ej. "Cartagena").
            start_date: Fecha de inicio YYYY-MM-DD.
            end_date: Fecha de fin YYYY-MM-DD.
            travelers: Número TOTAL de viajeros (el usuario + acompañantes).
            budget: Presupuesto total numérico (ej. 5000000).
            currency: Moneda ISO de 3 letras (por defecto COP).
            preferences: Preferencias o restricciones del viaje en texto.
            name: Nombre corto del viaje (opcional).
            itinerary_days: Itinerario a guardar junto con el viaje (recomendado). Lista de días
                  con el mismo formato que create_itinerary:
                  [{"date": "YYYY-MM-DD", "activities": [{"time": "09:00", "title": "...",
                    "description": "...", "location": "...", "category": "...", "estimatedCost": 0}]}]
        """
        res = api.call("POST", "/trips", {
            "origin": origin, "destination": destination, "startDate": start_date,
            "endDate": end_date, "travelers": travelers, "budget": budget,
            "currency": currency, "preferences": preferences, "name": name or None,
        })
        emit("trip", res["trip"])
        result = {"ok": True, "tripId": res["tripId"], "trip": res["trip"]}
        if itinerary_days:
            # Se guarda DESPUÉS de crear el viaje: evita que el modelo llame a
            # create_itinerary en paralelo con un tripId que aún no existe.
            try:
                it = api.call("POST", f"/trips/{res['tripId']}/itinerary", {"days": itinerary_days})
                emit("itinerary", {"tripId": res["tripId"], "days": it["itinerary"]})
                result["itinerary"] = {"ok": True, "days": len(it["itinerary"])}
            except ApiCallError as e:
                result["itinerary"] = {"ok": False, "error": e.message}
        return json.dumps(result, ensure_ascii=False)

    @tool
    @safe
    def get_trips() -> str:
        """GetTrips — lista los viajes guardados del usuario (destino, fechas, presupuesto, estado)."""
        res = api.call("GET", "/trips")
        emit("trips", res["trips"])
        return json.dumps({"ok": True, "trips": res["trips"]}, ensure_ascii=False)

    @tool
    @safe
    def get_trip_details(trip_id: str) -> str:
        """
        Recupera un viaje con su itinerario y sus reservas.

        Args:
            trip_id: Identificador del viaje (obtenido de get_trips o create_trip).
        """
        res = api.call("GET", f"/trips/{trip_id}")
        emit("trip", res["trip"])
        if res.get("itinerary"):
            emit("itinerary", {"trip": res["trip"], "days": res["itinerary"]})
        if res.get("reservations"):
            emit("reservations", res["reservations"])
        return json.dumps({"ok": True, **res}, ensure_ascii=False)

    @tool
    @safe
    def update_trip(trip_id: str, changes: dict) -> str:
        """
        UpdateTrip — actualiza datos de un viaje.

        Args:
            trip_id: Identificador del viaje.
            changes: Campos a cambiar. Claves válidas: name, origin, destination, startDate,
                     endDate (YYYY-MM-DD), travelers, budget, preferences,
                     status (PLANNING | CONFIRMED | COMPLETED | CANCELLED).
        """
        res = api.call("PUT", f"/trips/{trip_id}", changes)
        emit("trip", res["trip"])
        return json.dumps({"ok": True, "trip": res["trip"]}, ensure_ascii=False)

    # ── Itinerarios ──────────────────────────────────────────────────────────

    @tool
    @safe
    def create_itinerary(trip_id: str, days: list[dict]) -> str:
        """
        CreateItinerary — guarda el itinerario completo de un viaje (un elemento por día).

        Args:
            trip_id: Identificador del viaje.
            days: Lista de días. Cada día:
                  {"date": "YYYY-MM-DD", "notes": "texto opcional",
                   "activities": [{"time": "09:00", "title": "...", "description": "...",
                                   "location": "...", "category": "cultura|playa|gastronomía|...",
                                   "estimatedCost": 120000}]}
                  Las fechas deben estar dentro del rango del viaje.
        """
        res = api.call("POST", f"/trips/{trip_id}/itinerary", {"days": days})
        emit("itinerary", {"tripId": trip_id, "days": res["itinerary"]})
        return json.dumps({"ok": True, "message": res["message"], "days": len(res["itinerary"])}, ensure_ascii=False)

    @tool
    @safe
    def update_itinerary(trip_id: str, day: str, activities: list[dict], notes: str = "") -> str:
        """
        UpdateItinerary — reemplaza las actividades de un día del itinerario.

        Args:
            trip_id: Identificador del viaje.
            day: Día a modificar (YYYY-MM-DD).
            activities: Nueva lista de actividades del día (mismo formato que create_itinerary).
            notes: Notas del día (opcional).
        """
        body = {"activities": activities}
        if notes:
            body["notes"] = notes
        res = api.call("PUT", f"/trips/{trip_id}/itinerary/{day}", body)
        emit("itinerary", {"tripId": trip_id, "days": [res["day"]]})
        return json.dumps({"ok": True, "day": res["day"]}, ensure_ascii=False)

    # ── Reservas ─────────────────────────────────────────────────────────────

    @tool
    @safe
    def create_reservation(trip_id: str, reservation_type: str, title: str, details: dict,
                           price: float = 0, currency: str = "", reservation_date: str = "") -> str:
        """
        CreateReservation — registra una reserva SIMULADA asociada a un viaje.
        NUNCA incluyas datos de tarjeta ni de pago.

        Args:
            trip_id: Identificador del viaje.
            reservation_type: FLIGHT | HOTEL | ACTIVITY.
            title: Título corto (ej. "Avianca BOG→CTG", "Hotel Caribe 3 noches").
            details: Datos de la reserva (aerolínea, horarios, hotel, pasajeros, etc.).
            price: Precio TOTAL (todos los viajeros), numérico.
            currency: Moneda ISO del precio (ej. "USD" si el vuelo se cotizó en dólares, "COP").
                      Obligatoria si difiere de la moneda del viaje.
            reservation_date: Fecha de la reserva YYYY-MM-DD (opcional).
        """
        body = {"type": reservation_type.upper(), "title": title, "details": details, "price": price}
        if currency:
            body["currency"] = currency.upper()[:3]
        if reservation_date:
            body["date"] = reservation_date
        res = api.call("POST", f"/trips/{trip_id}/reservations", body)
        emit("reservations", [res["reservation"]])
        return json.dumps({"ok": True, "reservationId": res["reservationId"], "status": res["status"]},
                          ensure_ascii=False)

    @tool
    @safe
    def get_reservations(trip_id: str = "") -> str:
        """
        GetReservations — consulta reservas del usuario.

        Args:
            trip_id: Si se indica, solo las de ese viaje; vacío = todas las reservas.
        """
        path = f"/trips/{trip_id}/reservations" if trip_id else "/reservations"
        res = api.call("GET", path)
        emit("reservations", res["reservations"])
        return json.dumps({"ok": True, "reservations": res["reservations"]}, ensure_ascii=False)

    @tool
    @safe
    def update_reservation(trip_id: str, reservation_id: str, changes: dict) -> str:
        """
        UpdateReservation — actualiza una reserva o su estado.

        Args:
            trip_id: Identificador del viaje.
            reservation_id: Identificador de la reserva.
            changes: Campos a cambiar: status (SIMULADA | PENDIENTE), title, details, price, date.
                     CONFIRMADA solo es posible con providerReference de un proveedor real.
        """
        res = api.call("PUT", f"/trips/{trip_id}/reservations/{reservation_id}", changes)
        emit("reservations", [res["reservation"]])
        return json.dumps({"ok": True, "reservation": res["reservation"]}, ensure_ascii=False)

    # ── Preferencias ─────────────────────────────────────────────────────────

    @tool
    @safe
    def save_preferences(preferences: dict) -> str:
        """
        Guarda preferencias de viaje persistentes del usuario en su perfil.

        Args:
            preferences: Claves válidas: budgetLevel, activityTypes (lista), dietaryRestrictions,
                         preferredAirlines (lista), seatPreference, accommodationType,
                         travelPace, homeCity, currency, notes.
        """
        current = api.call("GET", "/profile").get("profile", {}).get("preferences", {}) or {}
        merged = {**current, **preferences}
        res = api.call("PUT", "/profile", {"preferences": merged})
        emit("preferences", res["profile"].get("preferences", {}))
        return json.dumps({"ok": True, "preferences": merged}, ensure_ascii=False)

    # ── Recomendaciones personalizadas ──────────────────────────────────────

    @tool
    @safe
    def get_traveler_profile() -> str:
        """
        Obtiene el perfil del viajero para PERSONALIZAR recomendaciones: preferencias guardadas
        (actividades, presupuesto, ritmo, alojamiento, restricciones alimentarias, aerolíneas)
        e historial de viajes (destinos, fechas, viajeros, presupuesto). Llámala antes de recomendar.
        """
        profile = api.call("GET", "/profile").get("profile", {})
        trips = api.call("GET", "/trips").get("trips", [])
        history = [{
            "destination": t.get("destination"), "origin": t.get("origin"),
            "startDate": t.get("startDate"), "endDate": t.get("endDate"),
            "travelers": t.get("travelers"), "budget": t.get("budget"),
            "currency": t.get("currency"), "status": t.get("status"),
            "preferences": t.get("preferences") if isinstance(t.get("preferences"), str) else "",
        } for t in trips]
        return json.dumps({"ok": True, "name": profile.get("name"),
                           "preferences": profile.get("preferences", {}),
                           "tripHistory": history}, ensure_ascii=False, default=str)

    @tool
    def show_recommendations(kind: str, title: str, items: list[dict], destination: str = "") -> str:
        """
        Muestra recomendaciones personalizadas como tarjetas visuales en la interfaz.

        Args:
            kind: "destinations" (a dónde viajar), "activities" (qué hacer en un destino)
                  o "experiences" (planes especiales).
            title: Título corto del bloque (ej. "Destinos para ti", "Qué hacer en Cartagena").
            destination: Ciudad a la que aplican (vacío para destinos).
            items: 3 a 6 recomendaciones. Cada una:
                   {"name": "...", "description": "1-2 frases",
                    "reason": "por qué encaja con ESTE usuario (cita su preferencia o historial)",
                    "category": "playa|cultura|naturaleza|aventura|gastronomía|...",
                    "estimatedCost": 150000, "currency": "COP", "bestTime": "mañana|tarde|noche|diciembre-abril",
                    "location": "barrio o zona", "tags": ["...", "..."]}
        """
        return _show_recommendations(kind, title, items, destination)

    def _show_recommendations(kind, title, items, destination=""):
        clean = []
        for it in (items or [])[:8]:
            if not isinstance(it, dict) or not it.get("name"):
                continue
            item = {k: it.get(k) for k in ("name", "description", "reason", "category", "estimatedCost",
                                            "currency", "bestTime", "location", "tags",
                                            "dish", "priceLevel", "dietary", "mealTime")
                    if it.get(k) not in (None, "", [])}
            for k in ("name", "description", "reason", "category", "bestTime", "location", "dish", "mealTime"):
                if k in item:
                    item[k] = str(item[k])[:300]
            for k in ("tags", "dietary"):
                if k in item:
                    item[k] = [str(t)[:30] for t in item[k]][:5] if isinstance(item[k], list) else []
            clean.append(item)
        if not clean:
            return json.dumps({"ok": False, "error": "items vacío o inválido"})
        emit("recommendations", {"kind": str(kind)[:20], "title": str(title)[:120],
                                 "destination": str(destination)[:80], "items": clean})
        return json.dumps({"ok": True, "shown": len(clean)}, ensure_ascii=False)

    return [
        ask_flights, ask_weather,
        create_trip, get_trips, get_trip_details, update_trip,
        create_itinerary, update_itinerary,
        create_reservation, get_reservations, update_reservation,
        save_preferences, get_traveler_profile, show_recommendations,
    ]


# ── System prompt ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """Eres TripPlanner AI, un asistente experto que ayuda a planificar, organizar y gestionar viajes.
Hoy es {today}. Responde SIEMPRE en español, con un tono cercano y profesional.

Perfil persistente del usuario (DynamoDB): {profile}

HERRAMIENTAS
- ask_flights → Flight Agent (vuelos reales vía MCP). Incluye origen, destino, fecha y nº de pasajeros.
- ask_weather → Weather Agent (pronóstico vía MCP). Incluye ciudad y rango de fechas.
- create_trip, get_trips, get_trip_details, update_trip → viajes.
- create_itinerary, update_itinerary → itinerario día a día.
- create_reservation, get_reservations, update_reservation → reservas SIMULADAS.
- save_preferences → guarda preferencias que el usuario exprese (presupuesto, actividades, aerolíneas…).
- get_traveler_profile → preferencias + historial de viajes del usuario (para personalizar).
- show_recommendations → muestra recomendaciones como tarjetas.

FLUJO
1. Si el usuario quiere planear un viaje: identifica origen, destino, fechas, viajeros y presupuesto.
   - "viajo con dos personas más" = 3 viajeros en total.
   - Si no da fechas, propón fechas concretas que empiecen al menos 14 días después de hoy
     y dilo explícitamente.
   - Llama a ask_flights y ask_weather (puedes llamarlas en paralelo).
2. Resume los resultados en 3-6 líneas: mejor opción de vuelo según precio/horario, clima esperado
   y si el plan encaja en el presupuesto. Termina preguntando si quiere que cree el viaje con su itinerario.
   En este primer paso NO llames create_trip, create_itinerary ni create_reservation.
3. SOLO cuando el usuario pida explícitamente crear/guardar el viaje: llama UNA vez a create_trip
   pasando itinerary_days con 2-4 actividades por día (coherentes con el clima, el presupuesto y las
   preferencias). Así el viaje y su itinerario se guardan juntos.
   create_itinerary / update_itinerary solo se usan después, con un tripId YA devuelto por una herramienta.
   Nunca llames en paralelo herramientas que dependan del resultado de otra.
4. Si el usuario pide reservar: create_reservation (tipo FLIGHT, HOTEL o ACTIVITY) con estado simulado.
   Aclara que la reserva es SIMULADA (no hay proveedor real).
5. Para "mis viajes", "mis reservas" o retomar un viaje anterior usa get_trips / get_trip_details / get_reservations.
6. RECOMENDACIONES PERSONALIZADAS ("recomiéndame", "¿a dónde puedo ir?", "¿qué hago en X?"):
   a) Llama a get_traveler_profile.
   b) Elige 3-6 opciones coherentes con sus preferencias, presupuesto, ritmo e historial
      (no repitas destinos que ya visitó salvo que lo pida; usa su ciudad de origen habitual).
   c) Llama a show_recommendations. En cada item, "reason" debe citar explícitamente algo del
      perfil (p. ej. "Te gusta la playa y viajas con presupuesto moderado").
   d) NO escribas texto antes de llamar a show_recommendations. Después, responde con 1-2 líneas
      (sin volver a listar las opciones: ya se ven en las tarjetas) y UNA sola pregunta ofreciendo
      buscar vuelos/clima o crear el viaje para la opción que elija.
   Si no hay preferencias guardadas, recomienda opciones variadas y pregunta 1-2 preferencias clave.
   Los costos son ESTIMADOS: indícalo.

REGLAS
- La interfaz muestra los resultados de las herramientas como tarjetas visuales (vuelos, clima, viaje,
  itinerario, reservas). NO repitas tablas ni listados completos: comenta lo importante.
- Usa los tripId devueltos por las herramientas; nunca inventes identificadores, precios ni vuelos.
- Si una herramienta devuelve error, explícalo en lenguaje sencillo y propone cómo seguir.
- NUNCA pidas ni guardes datos de tarjetas, CVV ni información de pago.
- Fechas siempre en formato YYYY-MM-DD al llamar herramientas.
- Al reservar, indica la moneda real del precio (currency), p. ej. USD si el vuelo se cotizó en dólares.
"""


# ── Memoria (AgentCore Memory) ────────────────────────────────────────────────

def _build_session_manager(session_id: str, actor_id: str):
    """
    Memoria conversacional (≠ persistencia de negocio):
      - corto plazo: historial de la sesión,
      - largo plazo: preferencias, hechos y resúmenes extraídos por las estrategias
        USER_PREFERENCE, SEMANTIC y SUMMARIZATION, que se inyectan como contexto.
    """
    if not MEMORY_ID:
        return None
    config = AgentCoreMemoryConfig(
        memory_id=MEMORY_ID,
        session_id=session_id,
        actor_id=actor_id,
        retrieval_config={
            "/preferences/{actorId}/": RetrievalConfig(top_k=5, relevance_score=0.3),
            "/facts/{actorId}/": RetrievalConfig(top_k=5, relevance_score=0.4),
        },
    )
    return AgentCoreMemorySessionManager(config, region_name=AWS_REGION)


# ── Entrypoint AgentCore (HTTP streaming) ─────────────────────────────────────

class ThinkingFilter:
    """
    Elimina los bloques <thinking>…</thinking> del stream de texto aunque la
    etiqueta llegue partida en varios fragmentos (p. ej. "<", "thinking", ">").
    """
    OPEN, CLOSE = "<thinking>", "</thinking>"

    def __init__(self):
        self.buf = ""
        self.inside = False

    @staticmethod
    def _partial_tail(text: str, tag: str) -> int:
        """Longitud del sufijo de text que es prefijo de tag (posible etiqueta incompleta)."""
        for n in range(min(len(tag) - 1, len(text)), 0, -1):
            if tag.startswith(text[-n:]):
                return n
        return 0

    def feed(self, chunk: str) -> str:
        self.buf += chunk
        out = []
        while True:
            if self.inside:
                i = self.buf.find(self.CLOSE)
                if i < 0:
                    keep = self._partial_tail(self.buf, self.CLOSE)
                    self.buf = self.buf[len(self.buf) - keep:] if keep else ""
                    break
                self.buf = self.buf[i + len(self.CLOSE):].lstrip("\n")
                self.inside = False
            else:
                i = self.buf.find(self.OPEN)
                if i < 0:
                    keep = self._partial_tail(self.buf, self.OPEN)
                    out.append(self.buf[:len(self.buf) - keep])
                    self.buf = self.buf[len(self.buf) - keep:]
                    break
                out.append(self.buf[:i])
                self.buf = self.buf[i + len(self.OPEN):]
                self.inside = True
        return "".join(out)

    def flush(self) -> str:
        rest, self.buf = ("" if self.inside else self.buf), ""
        return rest


def _sanitize_actor(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_-]", "-", value)[:100] or "anonymous"


@app.entrypoint
async def invoke(payload, context):
    prompt = payload.get("prompt") if isinstance(payload, dict) else None
    id_token = payload.get("idToken") if isinstance(payload, dict) else None

    if not isinstance(prompt, str) or not prompt.strip():
        yield {"type": "error", "message": "El campo 'prompt' debe ser un texto no vacío."}
        yield {"type": "done"}
        return
    if len(prompt) > 4000:
        yield {"type": "error", "message": "El mensaje es demasiado largo (máx. 4000 caracteres)."}
        yield {"type": "done"}
        return
    if not isinstance(id_token, str) or not id_token:
        yield {"type": "error", "message": "Sesión no válida. Inicia sesión de nuevo."}
        yield {"type": "done"}
        return

    yield {"type": "status", "message": "🧭 Orchestrator interpretando tu solicitud…"}

    # La identidad del usuario la valida API Gateway (Cognito). Nunca se toma del payload.
    api = BusinessApi(id_token)
    try:
        profile = api.call("GET", "/profile").get("profile", {})
    except ApiCallError as e:
        msg = "Tu sesión expiró. Inicia sesión de nuevo." if e.status in (401, 403) else \
              "No se pudo validar tu sesión en este momento."
        yield {"type": "error", "message": msg}
        yield {"type": "done"}
        return

    actor_id = _sanitize_actor(profile.get("userId", "anonymous"))
    session_id = getattr(context, "session_id", None) or str(uuid.uuid4())

    ui_events: "queue.Queue[dict]" = queue.Queue()
    system_prompt = SYSTEM_PROMPT.format(
        today=date.today().isoformat(),
        profile=json.dumps({"name": profile.get("name"), "preferences": profile.get("preferences", {})},
                           ensure_ascii=False),
    )

    agent_kwargs = {
        "name": "TripPlanner Orchestrator",
        "model": BedrockModel(model_id=MODEL_ID, region_name=AWS_REGION, temperature=0.3),
        "system_prompt": system_prompt,
        "tools": _build_tools(api, ui_events),
        "callback_handler": null_callback_handler,
    }
    session_manager = _build_session_manager(session_id, actor_id)
    if session_manager is not None:
        agent_kwargs["session_manager"] = session_manager
    agent = Agent(**agent_kwargs)

    announced: set[str] = set()

    def drain():
        while True:
            try:
                yield ui_events.get_nowait()
            except queue.Empty:
                return

    thinking = ThinkingFilter()
    text_sent = False          # ya se emitió texto visible en esta respuesta
    tool_since_text = False    # hubo una herramienta desde el último texto
    try:
        async for event in agent.stream_async(prompt.strip()):
            for ui in drain():
                yield ui

            tool_use = event.get("current_tool_use") if isinstance(event, dict) else None
            if tool_use and tool_use.get("toolUseId") not in announced and tool_use.get("name"):
                announced.add(tool_use["toolUseId"])
                tool_since_text = True
                yield {"type": "status",
                       "message": STATUS_BY_TOOL.get(tool_use["name"], f"Usando {tool_use['name']}…")}

            chunk = event.get("data") if isinstance(event, dict) else None
            if isinstance(chunk, str) and chunk:
                visible = thinking.feed(chunk)
                if visible:
                    # Separa los bloques de texto que el modelo escribe antes y después de una herramienta
                    if text_sent and tool_since_text:
                        visible = "\n\n" + visible.lstrip()
                    tool_since_text = False
                    text_sent = True
                    yield {"type": "text", "delta": visible}
        rest = thinking.flush()
        if rest:
            yield {"type": "text", "delta": rest}
    except Exception as e:  # noqa: BLE001
        logging.getLogger(__name__).exception("Error en el Orchestrator")
        yield {"type": "error", "message": f"Ocurrió un problema procesando tu solicitud ({type(e).__name__})."}

    for ui in drain():
        yield ui
    yield {"type": "done"}


if __name__ == "__main__":
    print("🚀 TripPlanner Orchestrator")
    print(f"📡 Flights : {FLIGHTS_URL or '(no configurado)'}")
    print(f"📡 Weather : {WEATHER_URL or '(no configurado)'}")
    print(f"🔗 API     : {API_URL or '(no configurado)'}")
    print(f"🧠 Memory  : {MEMORY_ID or '(sin memoria)'}")
    app.run()
