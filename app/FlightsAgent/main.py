# app/FlightsAgent/main.py
"""
Flights Agent - Servidor A2A
Las tools vienen de Ignav via servidor MCP remoto (Streamable HTTP).

Solución al problema de conexión cerrada:
  - No compartimos httpx2.AsyncClient entre el hilo principal y uvicorn.
  - Pasamos la API key via HTTP Basic auth en la URL, que Ignav soporta.
  - El MCPClient crea su propio httpx2.AsyncClient interno por sesión.
"""

import json
import os
import boto3
from strands import Agent
from strands.models import BedrockModel
from strands.multiagent.a2a import A2AServer
from mcp.client.streamable_http import streamable_http_client
from strands.tools.mcp import MCPClient

MODEL_ID       = os.environ.get("BEDROCK_MODEL_ID", "us.amazon.nova-lite-v1:0")
AWS_REGION     = os.environ.get("AWS_DEFAULT_REGION", "us-east-2")

SYSTEM_PROMPT = """Eres un agente especializado en búsqueda de vuelos.

Tienes acceso a estas herramientas MCP:
- search_airports: resuelve nombres de ciudades a códigos IATA (ej: Barranquilla → BAQ)
- search_flights: busca vuelos reales entre dos códigos IATA para una fecha dada

Flujo recomendado:
1. Si el usuario da nombres de ciudades, usa search_airports primero para obtener los códigos IATA.
2. Luego usa search_flights con los códigos IATA y la fecha en formato YYYY-MM-DD.
3. Presenta los resultados agrupados por aerolínea, mostrando solo la opción más barata por aerolínea.

FORMATO DE RESPUESTA (dos partes):
A) 1-2 líneas de resumen en el idioma del usuario (opción más barata y más rápida).
B) Un bloque ```json``` con EXACTAMENTE esta estructura (datos reales de las herramientas):
```json
{
  "origin": "BOG", "destination": "CTG", "date": "2027-02-10", "passengers": 3,
  "flights": [
    {"airline": "Avianca", "flightNumber": "AV9500", "departureTime": "06:15", "arrivalTime": "07:40",
     "duration": "1h 25m", "stops": 0, "price": 385, "currency": "USD", "bookingUrl": "https://..."}
  ]
}
```

REGLAS:
- Agrupa por aerolínea y muestra solo el vuelo más barato de cada una.
- Máximo 5 aerolíneas distintas, ordenadas de menor a mayor precio.
- "price" es numérico (sin símbolos). Si un dato no existe, usa null. NUNCA inventes vuelos ni precios.
- Si no hay resultados, explícalo y devuelve "flights": [].
"""


def get_ignav_api_key() -> str:
    """Lee la API key de Ignav. Local: IGNAV_API_KEY. AWS: Secrets Manager."""
    local_key = os.environ.get("IGNAV_API_KEY", "")
    if local_key:
        return local_key

    secret_arn = os.environ.get(
        "IGNAV_SECRET_ARN",
        "arn:aws:secretsmanager:us-east-2:750708765285:secret:"
        "bedrock-agentcore-identity!default/apikey/IgnavApiKey-df72bec2"
    )
    client = boto3.client("secretsmanager", region_name=AWS_REGION)
    response = client.get_secret_value(SecretId=secret_arn)
    secret = response.get("SecretString", "")
    if secret.startswith("{"):
        data = json.loads(secret)
        return data.get("api_key_value") or data.get("apiKey") or secret
    return secret


def load_model() -> BedrockModel:
    return BedrockModel(model_id=MODEL_ID, region_name=AWS_REGION)


def main():
    api_key = get_ignav_api_key()
    print(f"[OK] API key cargada (primeros 6 chars): {api_key[:6]}...")

    # Ignav soporta HTTP Basic auth en la URL: https://ignav:API_KEY@ignav.com/mcp
    # Esto evita compartir un httpx2.AsyncClient entre hilos/event loops.
    mcp_url = f"https://ignav:{api_key}@ignav.com/mcp"

    mcp = MCPClient(lambda: streamable_http_client(
        mcp_url,
        terminate_on_close=False
    ))

    with mcp:
        tools = mcp.list_tools_sync()
        print(f"[OK] MCP conectado — tools: {[t.tool_name for t in tools]}")

        agent = Agent(
            name="Flights Agent",
            model=load_model(),
            description=(
                "Agente especializado en buscar vuelos reales entre ciudades. "
                "Usa herramientas MCP de Ignav para tarifas actuales y "
                "enlaces de reserva."
            ),
            system_prompt=SYSTEM_PROMPT,
            tools=tools,
            callback_handler=None,
        )

        server = A2AServer(
            agent=agent,
            host="0.0.0.0",
            port=9000
        )

        print("Starting Flights Agent A2A Server on port 9000...")
        print("Agent card available at: /.well-known/agent-card.json")
        server.serve()


if __name__ == "__main__":
    main()
