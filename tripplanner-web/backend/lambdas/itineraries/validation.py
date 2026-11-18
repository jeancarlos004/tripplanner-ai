"""Validación común de actividades de itinerario."""
from decimal import Decimal

from common import bad_request, text, clean_json, no_payment_data

MAX_ACTIVITIES_PER_DAY = 15


def validate_activities(activities):
    if not isinstance(activities, list) or not activities:
        raise bad_request("activities debe ser una lista no vacía")
    if len(activities) > MAX_ACTIVITIES_PER_DAY:
        raise bad_request(f"Máximo {MAX_ACTIVITIES_PER_DAY} actividades por día")
    out = []
    for i, a in enumerate(activities):
        if isinstance(a, str):
            a = {"title": a}
        if not isinstance(a, dict):
            raise bad_request(f"activities[{i}] debe ser objeto o texto")
        cost = a.get("estimatedCost")
        out.append({
            "time": text(a.get("time"), f"activities[{i}].time", 20, required=False),
            "title": text(a.get("title"), f"activities[{i}].title", 200),
            "description": text(a.get("description"), f"activities[{i}].description", 1000, required=False),
            "location": text(a.get("location"), f"activities[{i}].location", 200, required=False),
            "category": text(a.get("category"), f"activities[{i}].category", 40, required=False),
            "estimatedCost": Decimal(str(cost)) if isinstance(cost, (int, float, Decimal)) and cost >= 0 else None,
        })
    clean_json(out, "activities")
    no_payment_data([{k: v for k, v in a.items() if k != "estimatedCost"} for a in out], "activities")
    return [{k: v for k, v in a.items() if v not in (None, "")} for a in out]
