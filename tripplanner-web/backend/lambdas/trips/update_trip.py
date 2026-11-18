"""Lambda: UpdateTrip — actualiza datos de un viaje.  PUT /trips/{tripId}"""
from datetime import datetime, timezone

from common import (api_handler, table, pk, get_trip_or_404, text, iso_date, int_range,
                    money, one_of, date_range, clean_json, build_update, bad_request,
                    TRIP_STATUSES, public)


@api_handler
def handler(user_id, body, path, **_):
    trip_id = path.get("tripId")
    current = get_trip_or_404(user_id, trip_id)

    fields = {}
    if "name" in body:        fields["name"] = text(body["name"], "name", 120)
    if "origin" in body:      fields["origin"] = text(body["origin"], "origin", 100)
    if "destination" in body: fields["destination"] = text(body["destination"], "destination", 100)
    if "startDate" in body:   fields["startDate"] = iso_date(body["startDate"], "startDate")
    if "endDate" in body:     fields["endDate"] = iso_date(body["endDate"], "endDate")
    if "travelers" in body:   fields["travelers"] = int_range(body["travelers"], "travelers", 1, 20)
    if "budget" in body:
        fields["budget"] = money(body["budget"], "budget")
        if fields["budget"] <= 0:
            raise bad_request("El presupuesto debe ser mayor a 0")
    if "preferences" in body:
        p = body["preferences"]
        fields["preferences"] = p if isinstance(p, str) else clean_json(p, "preferences", 4000)
    if "status" in body:      fields["status"] = one_of(body["status"], "status", TRIP_STATUSES)

    if not fields:
        raise bad_request("No hay campos para actualizar")

    date_range(fields.get("startDate", current["startDate"]), fields.get("endDate", current["endDate"]))
    fields["updatedAt"] = datetime.now(timezone.utc).isoformat()

    expr, names, values = build_update(fields)
    updated = table.update_item(
        Key={"PK": pk(user_id), "SK": f"TRIP#{trip_id}"},
        UpdateExpression=expr,
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
        ConditionExpression="attribute_exists(PK)",
        ReturnValues="ALL_NEW",
    )["Attributes"]
    return 200, {"message": "Viaje actualizado", "tripId": trip_id, "trip": public(updated)}
