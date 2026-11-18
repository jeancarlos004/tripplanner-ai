"""Lambda: CreateTrip — crea un viaje del usuario autenticado.  POST /trips"""
import uuid
from datetime import datetime, timezone

from common import (api_handler, table, pk, require, text, iso_date, int_range,
                    money, date_range, clean_json, public, bad_request)


@api_handler
def handler(user_id, body, **_):
    require(body, "origin", "destination", "startDate", "endDate", "travelers", "budget")
    start = iso_date(body["startDate"], "startDate")
    end = iso_date(body["endDate"], "endDate")
    date_range(start, end)

    budget = money(body["budget"], "budget")
    if budget <= 0:
        raise bad_request("El presupuesto debe ser mayor a 0")

    preferences = body.get("preferences", "")
    if not isinstance(preferences, str):
        preferences = clean_json(preferences, "preferences", 4000)

    trip_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    item = {
        "PK": pk(user_id),
        "SK": f"TRIP#{trip_id}",
        "entity": "TRIP",
        "tripId": trip_id,
        "userId": user_id,
        "name": text(body.get("name"), "name", 120, required=False)
                or f"{body['origin']} → {body['destination']}",
        "origin": text(body["origin"], "origin", 100),
        "destination": text(body["destination"], "destination", 100),
        "startDate": start,
        "endDate": end,
        "travelers": int_range(body["travelers"], "travelers", 1, 20),
        "budget": budget,
        "currency": text(body.get("currency"), "currency", 3, required=False).upper() or "COP",
        "preferences": preferences,
        "status": "PLANNING",
        "createdAt": now,
        "updatedAt": now,
    }
    table.put_item(Item=item)
    return 201, {"message": "Viaje creado exitosamente", "tripId": trip_id, "trip": public(item)}
