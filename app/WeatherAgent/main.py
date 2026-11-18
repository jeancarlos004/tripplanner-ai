# app/WeatherAgent/main.py
"""
Weather Agent - Servidor A2A
Expone la capacidad de consultar el pronóstico del clima para una ciudad y fecha.
Publica su agent card en /.well-known/agent-card.json para descubrimiento.
"""

import os
from strands import Agent, tool
from strands.models import BedrockModel
from strands.multiagent.a2a import A2AServer

MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "us.amazon.nova-lite-v1:0")
AWS_REGION = os.environ.get("AWS_DEFAULT_REGION", "us-east-2")


@tool
def get_forecast(city: str, date: str) -> dict:
    """
    Consulta el pronóstico del clima para una ciudad en una fecha específica.
    
    Args:
        city: Nombre de la ciudad (ej: "Cartagena", "Bogotá", "Medellín")
        date: Fecha para el pronóstico en formato legible (ej: "2026-09-20")
    
    Returns:
        Diccionario con información del clima: temperatura, condición, humedad, viento
    """
    # Datos simulados para el workshop
    # En producción, esto consultaría una API real de clima como OpenWeather
    
    # Simulamos diferentes climas según la ciudad
    weather_data = {
        "cartagena": {
            "temp_c": 31,
            "temp_f": 88,
            "condition": "Soleado",
            "humidity": 75,
            "wind_kph": 15,
            "description": "Día perfecto para la playa con cielo despejado"
        },
        "bogota": {
            "temp_c": 14,
            "temp_f": 57,
            "condition": "Nublado",
            "humidity": 80,
            "wind_kph": 10,
            "description": "Clima fresco típico de la sabana"
        },
        "medellin": {
            "temp_c": 22,
            "temp_f": 72,
            "condition": "Parcialmente nublado",
            "humidity": 65,
            "wind_kph": 12,
            "description": "Clima primaveral agradable"
        }
    }
    
    # Buscar la ciudad (case-insensitive)
    city_lower = city.lower()
    forecast = weather_data.get(city_lower, {
        "temp_c": 25,
        "temp_f": 77,
        "condition": "Soleado",
        "humidity": 60,
        "wind_kph": 10,
        "description": "Clima agradable"
    })
    
    # Agregar información de la solicitud
    forecast["city"] = city
    forecast["date"] = date
    
    return forecast


def create_agent(context_id: str) -> Agent:
    """
    Factory function que crea una instancia del agente de clima.
    Cada context_id representa una conversación independiente.
    """
    return Agent(
        name="Weather Agent",
        model=BedrockModel(model_id=MODEL_ID, region_name=AWS_REGION),
        description="Agente especializado en consultar el pronóstico del clima por ciudad y fecha. "
                    "Proporciona temperatura, condiciones meteorológicas y recomendaciones.",
        tools=[get_forecast],
        callback_handler=None,
    )


# Crear el servidor A2A
# Este servidor:
# 1. Expone el agente como servicio HTTP
# 2. Publica automáticamente la agent card en /.well-known/agent-card.json
# 3. Implementa el protocolo A2A para recibir mensajes de otros agentes
a2a_server = A2AServer(
    agent_factory=create_agent,
    host="0.0.0.0",  # Escucha en todas las interfaces
    port=9000         # Puerto por defecto (AgentCore lo gestionará)
)

if __name__ == "__main__":
    # Inicia el servidor y mantiene el proceso activo
    print("🚀 Starting Weather Agent A2A Server on port 9000...")
    print("📋 Agent card available at: /.well-known/agent-card.json")
    a2a_server.serve()
