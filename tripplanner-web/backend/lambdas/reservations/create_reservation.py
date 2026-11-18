"""Lambda: CreateReservation — Registra una reserva asociada a un viaje."""
import json
import os
import uuid
from datetime import datetime, timezone
import boto3

TABLE_NAME = os.environ["TABLE_NAME"]
dynamodb = boto3.resource("dynamodb", region_name=os.environ.get("REGION", "us-east-2"))
table = dynamodb.Table(TABLE_NAME)

HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
}

ALLOWED_TYPES = ["FLIGHT", "HOTEL", "ACTIVITY"]


def handler(event, context):
    try:
        trip_id = event.get("pathParameters", {}).get("tripId")
        user_id = event.get("requestContext", {}).get("authorizer", {}).get("userId", "default-user")
        body = json.loads(event.get("body") or "{}")

        if not trip_id:
            return _error(400, "tripId es requerido")

        if "type" not in body or body["type"] not in ALLOWED_TYPES:
            return _error(400, f"type es requerido. Valores: {ALLOWED_TYPES}")

        if "details" not in body:
            return _error(400, "details es requerido")

        reservation_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        item = {
            "PK": f"TRIP#{trip_id}",
            "SK": f"RESERVATION#{reservation_id}",
            "reservationId": reservation_id,
            "tripId": trip_id,
            "userId": user_id,
            "type": body["type"],
            "status": "SIMULADA",   # Estado inicial siempre SIMULADA
            "details": body["details"],
            "price": str(body.get("price", "0")),
            "createdAt": now,
            "updatedAt": now,
        }

        table.put_item(Item=item)

        return {
            "statusCode": 201,
            "headers": HEADERS,
            "body": json.dumps({
                "message": "Reserva registrada",
                "reservationId": reservation_id,
                "status": "SIMULADA",
                "reservation": item
            }, default=str)
        }

    except Exception as e:
        return _error(500, f"Error interno: {str(e)}")


def _error(status, message):
    return {
        "statusCode": status,
        "headers": HEADERS,
        "body": json.dumps({"error": message})
    }
