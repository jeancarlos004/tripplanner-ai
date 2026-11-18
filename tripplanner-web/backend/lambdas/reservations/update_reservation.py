"""
Lambda: UpdateReservation — actualiza una reserva o su estado.
PUT /trips/{tripId}/reservations/{reservationId}

Reglas de estado:
  SIMULADA <-> PENDIENTE  (permitido)
  -> CONFIRMADA solo con 'providerReference' (confirmación de un proveedor real)
"""
from datetime import datetime, timezone

from common import (api_handler, table, pk, get_trip_or_404, one_of, text, money, iso_date,
                    clean_json, no_payment_data, build_update, bad_request, public,
                    RESERVATION_STATUSES, RESERVATION_TYPES)


@api_handler
def handler(user_id, body, path, **_):
    trip_id = path.get("tripId")
    reservation_id = path.get("reservationId")
    get_trip_or_404(user_id, trip_id)
    if not reservation_id:
        raise bad_request("reservationId es requerido")

    fields = {}
    if "status" in body:
        status = one_of(body["status"], "status", RESERVATION_STATUSES)
        if status == "CONFIRMADA":
            ref = text(body.get("providerReference"), "providerReference", 100, required=False)
            if not ref:
                raise bad_request("CONFIRMADA requiere providerReference de un proveedor real")
            fields["providerReference"] = ref
            fields["provider"] = text(body.get("provider"), "provider", 60, required=False) or "EXTERNAL"
        fields["status"] = status
    if "type" in body:    fields["type"] = one_of(body["type"], "type", RESERVATION_TYPES)
    if "title" in body:   fields["title"] = text(body["title"], "title", 200, required=False)
    if "details" in body: fields["details"] = no_payment_data(clean_json(body["details"], "details"))
    if "price" in body:   fields["price"] = money(body["price"], "price")
    if "date" in body:    fields["date"] = iso_date(body["date"], "date")

    if not fields:
        raise bad_request("No hay campos para actualizar")
    fields["updatedAt"] = datetime.now(timezone.utc).isoformat()

    expr, names, values = build_update(fields)
    updated = table.update_item(
        Key={"PK": pk(user_id), "SK": f"RES#{trip_id}#{reservation_id}"},
        UpdateExpression=expr,
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
        ConditionExpression="attribute_exists(PK)",
        ReturnValues="ALL_NEW",
    )["Attributes"]
    return 200, {"message": "Reserva actualizada", "reservationId": reservation_id,
                 "reservation": public(updated)}
