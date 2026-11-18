"""
Lambda: CreateReservation — registra una reserva (vuelo, hotel o actividad)
asociada a un viaje.  POST /trips/{tripId}/reservations

Las reservas se crean SIEMPRE con estado SIMULADA: no hay proveedor real.
Nunca se aceptan datos de tarjeta (número, CVV, etc.).
"""
import uuid
from datetime import datetime, timezone

from common import (api_handler, table, pk, get_trip_or_404, require, one_of, text, money,
                    iso_date, clean_json, no_payment_data, public, RESERVATION_TYPES)


@api_handler
def handler(user_id, body, path, **_):
    trip_id = path.get("tripId")
    trip = get_trip_or_404(user_id, trip_id)
    require(body, "type", "details")

    details = no_payment_data(clean_json(body["details"], "details"))

    reservation_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    item = {
        "PK": pk(user_id),
        "SK": f"RES#{trip_id}#{reservation_id}",
        "entity": "RESERVATION",
        "reservationId": reservation_id,
        "tripId": trip_id,
        "tripName": trip.get("name") or trip.get("destination"),
        "type": one_of(body["type"], "type", RESERVATION_TYPES),
        "title": text(body.get("title"), "title", 200, required=False),
        "details": details,
        "price": money(body.get("price"), "price", required=False),
        "currency": (text(body.get("currency"), "currency", 3, required=False)
                     or trip.get("currency", "COP")).upper(),
        "status": "SIMULADA",
        "provider": "SIMULATED",
        "createdAt": now,
        "updatedAt": now,
    }
    if body.get("date"):
        item["date"] = iso_date(body["date"], "date")

    table.put_item(Item=item)
    return 201, {"message": "Reserva registrada (simulada)", "reservationId": reservation_id,
                 "status": "SIMULADA", "reservation": public(item)}
