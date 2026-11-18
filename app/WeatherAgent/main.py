# app/WeatherAgent/main.py
"""
Weather Agent — Servidor A2A (Bedrock AgentCore Runtime).

Consulta el clima a través de un servidor MCP (weather_mcp_server.py, transporte
stdio) que expone las herramientas geocode_city y get_forecast sobre Open-Meteo.
Publica su agent card en /.well-known/agent-card.json.

La respuesta termina SIEMPRE con un bloque ```json``` estructurado, que el
Orchestrator reenvía al frontend para pintar tarjetas meteorológicas por día.
"""

import os
import sys
from pathlib import Path

from mcp import StdioServerParameters, stdio_client
from strands import Agent
from strands.models import BedrockModel
from strands.multiagent.a2a import A2AServer
from strands.tools.mcp import MCPClient

MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "us.amazon.nova-lite-v1:0")
AWS_REGION = os.environ.get("AWS_DEFAULT_REGION", "us-east-2")
MCP_SERVER = Path(__file__).with_name("weather_mcp_server.py")

SYSTEM_PROMPT = """Eres el Weather Agent de TripPlanner AI, especialista en meteorología.

Herramientas MCP:
- get_forecast(city, start_date, end_date): pronóstico diario (YYYY-MM-DD).
- geocode_city(city): datos de la ciudad.

FLUJO
1. Identifica ciudad y rango de fechas. Si solo hay una fecha, úsala como inicio y fin.
   Si no hay fechas, usa los próximos 3 días.
2. Llama a get_forecast.
3. Responde en español con 2-3 líneas: resumen del clima y recomendación (ropa, mejores días).
   Si source = "historical_estimate", aclara que es una estimación basada en años anteriores.
4. Termina SIEMPRE con un bloque ```json``` que contenga EXACTAMENTE el objeto devuelto por
   get_forecast (city, country, source, provider, days). No inventes datos.
"""


def main():
    mcp = MCPClient(lambda: stdio_client(
        StdioServerParameters(command=sys.executable, args=[str(MCP_SERVER)])
    ))

    with mcp:
        tools = mcp.list_tools_sync()
        print(f"[OK] MCP de clima conectado — tools: {[t.tool_name for t in tools]}")

        def create_agent(context_id: str = "") -> Agent:
            return Agent(
                name="Weather Agent",
                model=BedrockModel(model_id=MODEL_ID, region_name=AWS_REGION, temperature=0.1),
                description="Agente especializado en el pronóstico del clima por ciudad y fechas: "
                            "temperatura, condiciones y probabilidad de lluvia.",
                system_prompt=SYSTEM_PROMPT,
                tools=tools,
                callback_handler=None,
            )

        server = A2AServer(agent_factory=create_agent, host="0.0.0.0", port=9000)
        print("🚀 Weather Agent A2A Server en el puerto 9000")
        server.serve()


if __name__ == "__main__":
    main()
