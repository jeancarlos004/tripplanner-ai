"""Lambda: UpdateItinerary — modifica un día del itinerario.  PUT /trips/{tripId}/itinerary/{date}"""
from datetime import datetime, timezone

from common import (api_handler, table, pk, get_trip_or_404, iso_date, text,
                    build_update, bad_request, public)
from itineraries.validation import validate_activities


@api_handler
def handler(user_id, body, path, **_):
    trip_id = path.get("tripId")
    trip = get_trip_or_404(user_id, trip_id)
    day = iso_date(path.get("date"), "date")
    if not trip["startDate"] <= day <= trip["endDate"]:
        raise bad_request("La fecha está fuera del rango del viaje")

    fields = {}
    if "activities" in body:
        fields["activities"] = validate_activities(body["activities"])
    if "notes" in body:
        fields["notes"] = text(body["notes"], "notes", 1000, required=False)
    if not fields:
        raise bad_request("Envía 'activities' y/o 'notes'")
    now = datetime.now(timezone.utc).isoformat()
    fields.update({"updatedAt": now, "entity": "ITINERARY_DAY", "tripId": trip_id, "date": day})

    # Upsert: si el día no existía, se crea (permite añadir días a un itinerario)
    expr, names, values = build_update(fields)
    expr += ", createdAt = if_not_exists(createdAt, :now)"
    values[":now"] = now
    updated = table.update_item(
        Key={"PK": pk(user_id), "SK": f"ITIN#{trip_id}#{day}"},
        UpdateExpression=expr,
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
        ReturnValues="ALL_NEW",
    )["Attributes"]
    return 200, {"message": "Itinerario actualizado", "tripId": trip_id, "day": public(updated)}
