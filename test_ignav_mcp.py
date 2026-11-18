"""
Script de prueba aislada — Paso 4 del taller MCP.
Verifica que la conexión con el servidor MCP de Ignav funciona
antes de modificar el agente Flights.

Uso:
    set IGNAV_API_KEY=tu_key_real
    python test_ignav_mcp.py
"""
import os
import httpx2
from dotenv import load_dotenv
from mcp.client.streamable_http import streamable_http_client
from strands.tools.mcp import MCPClient

# Intentar cargar desde .env.local primero
load_dotenv("agentcore/.env.local")

# La key real debe estar en IGNAV_API_KEY (texto plano, no cifrada)
IGNAV_API_KEY = os.environ.get("IGNAV_API_KEY", "")
TRAVEL_MCP_URL = "https://ignav.com/mcp"

if not IGNAV_API_KEY:
    print("❌ ERROR: Falta IGNAV_API_KEY")
    print("   Ejecuta primero:  $env:IGNAV_API_KEY='tu_api_key_de_ignav'")
    exit(1)

print(f"✅ API key encontrada (primeros 6 chars): {IGNAV_API_KEY[:6]}...")
print(f"🔗 Conectando a: {TRAVEL_MCP_URL}")
print()

# En mcp 2.x los headers se pasan via httpx2.AsyncClient
http_client = httpx2.AsyncClient(
    headers={"Authorization": f"Bearer {IGNAV_API_KEY}"},
    timeout=15.0
)

mcp = MCPClient(lambda: streamable_http_client(
    TRAVEL_MCP_URL,
    http_client=http_client
))

# Abrir sesión, listar tools y cerrar
with mcp:
    tools = mcp.list_tools_sync()
    print(f"✅ Conexión exitosa — {len(tools)} tool(s) disponibles:")
    for t in tools:
        print(f"   • {t.tool_name}: {t.tool_spec.get('description', '')[:80]}")
