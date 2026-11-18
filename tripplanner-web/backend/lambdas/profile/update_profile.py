"""
Lambda: UpdateProfile — guarda datos básicos y preferencias de viaje.  PUT /profile
Body: {"name": "...", "preferences": {"budgetLevel": "...", "activityTypes": [...], ...}}
"""
from datetime import datetime, timezone

from common import (api_handler, table, pk, text, clean_json, no_payment_data, build_update,
                    bad_request, public)

ALLOWED_PREF_KEYS = {
    "budgetLevel", "activityTypes", "dietaryRestrictions", "preferredAirlines",
    "seatPreference", "accommodationType", "travelPace", "homeCity", "currency", "notes",
}


@api_handler
def handler(user_id, body, **_):
    fields = {}
    if "name" in body:
        fields["name"] = text(body["name"], "name", 100, required=False)
    if "preferences" in body:
        prefs = body["preferences"]
        if not isinstance(prefs, dict):
            raise bad_request("preferences debe ser un objeto")
        unknown = set(prefs) - ALLOWED_PREF_KEYS
        if unknown:
            raise bad_request(f"Preferencias no soportadas: {', '.join(sorted(unknown))}")
        fields["preferences"] = no_payment_data(clean_json(prefs, "preferences", 4000), "preferences")
    if not fields:
        raise bad_request("Envía 'name' y/o 'preferences'")

    now = datetime.now(timezone.utc).isoformat()
    fields.update({"updatedAt": now, "entity": "PROFILE", "userId": user_id})
    expr, names, values = build_update(fields)
    expr += ", createdAt = if_not_exists(createdAt, :now)"
    values[":now"] = now

    updated = table.update_item(
        Key={"PK": pk(user_id), "SK": "PROFILE"},
        UpdateExpression=expr,
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
        ReturnValues="ALL_NEW",
    )["Attributes"]
    return 200, {"message": "Perfil actualizado", "profile": public(updated)}
