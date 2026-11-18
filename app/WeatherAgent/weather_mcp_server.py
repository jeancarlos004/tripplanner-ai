"""
MCP de clima — servidor MCP (transporte stdio) sobre la API pública de Open-Meteo.

El Weather Agent lo lanza como subproceso y consume sus herramientas mediante
el protocolo MCP (igual que el Flight Agent consume el MCP remoto de Ignav).

Herramientas:
  - geocode_city(city)                          -> coordenadas de una ciudad
  - get_forecast(city, start_date, end_date)    -> pronóstico diario por fechas

Open-Meteo no requiere API key. El pronóstico cubre ~16 días; para fechas más
lejanas se devuelve una ESTIMACIÓN basada en los mismos días del año anterior
(archivo histórico), marcada con source = "historical_estimate".
"""

import json
import urllib.parse
import urllib.request
from datetime import date, timedelta

try:  # mcp >= 2
    from mcp.server.mcpserver import MCPServer as _Server
except ImportError:  # mcp 1.x
    from mcp.server.fastmcp import FastMCP as _Server

server = _Server("tripplanner-weather")

GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
FORECAST_HORIZON_DAYS = 15

# Códigos WMO -> condición en español
WMO = {
    0: "Despejado", 1: "Mayormente despejado", 2: "Parcialmente nublado", 3: "Nublado",
    45: "Niebla", 48: "Niebla con escarcha",
    51: "Llovizna ligera", 53: "Llovizna", 55: "Llovizna intensa",
    61: "Lluvia ligera", 63: "Lluvia", 65: "Lluvia intensa",
    66: "Lluvia helada", 67: "Lluvia helada intensa",
    71: "Nieve ligera", 73: "Nieve", 75: "Nieve intensa", 77: "Granizo fino",
    80: "Chubascos ligeros", 81: "Chubascos", 82: "Chubascos fuertes",
    85: "Chubascos de nieve", 86: "Chubascos de nieve fuertes",
    95: "Tormenta", 96: "Tormenta con granizo", 99: "Tormenta fuerte con granizo",
}


def _get(url: str, params: dict) -> dict:
    full = f"{url}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(full, headers={"User-Agent": "tripplanner-weather-mcp/1.0"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read())


def _geocode(city: str) -> dict:
    data = _get(GEOCODE_URL, {"name": city, "count": 1, "language": "es", "format": "json"})
    results = data.get("results") or []
    if not results:
        raise ValueError(f"No se encontró la ciudad '{city}'")
    r = results[0]
    return {
        "city": r.get("name", city),
        "country": r.get("country", ""),
        "latitude": r["latitude"],
        "longitude": r["longitude"],
        "timezone": r.get("timezone", "auto"),
    }


@server.tool()
def geocode_city(city: str) -> dict:
    """Obtiene nombre normalizado, país y coordenadas de una ciudad."""
    return _geocode(city)


@server.tool()
def get_forecast(city: str, start_date: str, end_date: str = "") -> dict:
    """
    Pronóstico diario del clima para una ciudad entre dos fechas (YYYY-MM-DD).

    Devuelve por día: temperatura máxima/mínima (°C), condición, probabilidad de
    lluvia (%), precipitación (mm) y viento máximo (km/h).
    """
    start = date.fromisoformat(start_date)
    end = date.fromisoformat(end_date) if end_date else start
    if end < start:
        start, end = end, start
    if (end - start).days > 15:
        end = start + timedelta(days=15)

    place = _geocode(city)
    today = date.today()
    daily_vars = "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max"
    common = {"latitude": place["latitude"], "longitude": place["longitude"], "timezone": place["timezone"]}

    if start >= today and end <= today + timedelta(days=FORECAST_HORIZON_DAYS):
        source = "forecast"
        data = _get(FORECAST_URL, {**common, "start_date": start.isoformat(), "end_date": end.isoformat(),
                                   "daily": daily_vars + ",precipitation_probability_max"})
        shift_years = 0
    else:
        # Fuera del horizonte: mismos días del año anterior como estimación
        source = "historical_estimate"
        shift_years = 1 if start >= today else 0
        s = start.replace(year=start.year - shift_years)
        e = end.replace(year=end.year - shift_years)
        data = _get(ARCHIVE_URL, {**common, "start_date": s.isoformat(), "end_date": e.isoformat(),
                                  "daily": daily_vars})

    d = data.get("daily", {})
    days = []
    for i, day in enumerate(d.get("time", [])):
        code = (d.get("weather_code") or [None])[i]
        rain_mm = (d.get("precipitation_sum") or [None])[i]
        prob = (d.get("precipitation_probability_max") or [None] * len(d["time"]))[i]
        if prob is None and rain_mm is not None:   # estimación a partir de mm históricos
            prob = 80 if rain_mm >= 5 else 50 if rain_mm >= 1 else 15 if rain_mm > 0 else 5
        real_date = date.fromisoformat(day)
        if shift_years:
            real_date = real_date.replace(year=real_date.year + shift_years)
        days.append({
            "date": real_date.isoformat(),
            "tempMax": (d.get("temperature_2m_max") or [None])[i],
            "tempMin": (d.get("temperature_2m_min") or [None])[i],
            "condition": WMO.get(code, "Variable"),
            "weatherCode": code,
            "precipitationProbability": prob,
            "precipitationMm": rain_mm,
            "windKph": (d.get("wind_speed_10m_max") or [None])[i],
        })

    return {
        "city": place["city"],
        "country": place["country"],
        "source": source,
        "provider": "Open-Meteo",
        "days": days,
    }


if __name__ == "__main__":
    server.run()   # transporte stdio
