"""
Lambda: CreateItinerary — crea (o reemplaza) el itinerario de un viaje.
POST /trips/{tripId}/itinerary

Body aceptado:
  {"days": [{"date": "YYYY-MM-DD", "activities": [...], "notes": "..."}, ...]}
  o un único día: {"date": "...", "activities": [...], "notes": "..."}
Cada fecha debe estar dentro del rango del viaje.
"""
from datetime import datetime, timezone

from common import api_handler, table, pk, get_trip_or_404, iso_date, text, bad_request, public
from itineraries.validation import validate_activities


@api_handler
def handler(user_id, body, path, **_):
    trip_id = path.get("tripId")
    trip = get_trip_or_404(user_id, trip_id)

    days = body.get("days")
    if days is None and "date" in body:
        days = [body]
    if not isinstance(days, list) or not days:
        raise bad_request("Envía 'days' (lista) o un día con 'date' y 'activities'")
    if len(days) > 90:
        raise bad_request("Máximo 90 días de itinerario")

    now = datetime.now(timezone.utc).isoformat()
    items, seen = [], set()
    for i, d in enumerate(days):
        if not isinstance(d, dict):
            raise bad_request(f"days[{i}] debe ser un objeto")
        day = iso_date(d.get("date"), f"days[{i}].date")
        if not trip["startDate"] <= day <= trip["endDate"]:
            raise bad_request(f"La fecha {day} está fuera del viaje ({trip['startDate']} a {trip['endDate']})")
        if day in seen:
            raise bad_request(f"Fecha duplicada: {day}")
        seen.add(day)
        items.append({
            "PK": pk(user_id),
            "SK": f"ITIN#{trip_id}#{day}",
            "entity": "ITINERARY_DAY",
            "tripId": trip_id,
            "date": day,
            "activities": validate_activities(d.get("activities")),
            "notes": text(d.get("notes"), f"days[{i}].notes", 1000, required=False),
            "createdAt": now,
            "updatedAt": now,
        })

    with table.batch_writer() as batch:
        for it in items:
            batch.put_item(Item=it)

    return 201, {
        "message": f"Itinerario guardado ({len(items)} días)",
        "tripId": trip_id,
        "itinerary": sorted((public(i) for i in items), key=lambda x: x["date"]),
    }
