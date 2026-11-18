"""Lambda: CreateItinerary — Crea el itinerario de un viaje en DynamoDB."""
import json
import os
from datetime import datetime, timezone
import boto3

TABLE_NAME = os.environ["TABLE_NAME"]
dynamodb = boto3.resource("dynamodb", region_name=os.environ.get("REGION", "us-east-2"))
table = dynamodb.Table(TABLE_NAME)

HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
}


def handler(event, context):
    try:
        trip_id = event.get("pathParameters", {}).get("tripId")
        user_id = event.get("requestContext", {}).get("authorizer", {}).get("userId", "default-user")
        body = json.loads(event.get("body") or "{}")

        if not trip_id:
            return _error(400, "tripId es requerido")

        if "date" not in body or "activities" not in body:
            return _error(400, "Campos requeridos: date, activities")

        now = datetime.now(timezone.utc).isoformat()

        item = {
            "PK": f"TRIP#{trip_id}",
            "SK": f"ITINERARY#{body['date']}",
            "tripId": trip_id,
            "userId": user_id,
            "date": body["date"],
            "activities": body["activities"],
            "notes": body.get("notes", ""),
            "createdAt": now,
            "updatedAt": now,
        }

        table.put_item(Item=item)

        return {
            "statusCode": 201,
            "headers": HEADERS,
            "body": json.dumps({
                "message": "Itinerario creado",
                "tripId": trip_id,
                "date": body["date"]
            })
        }

    except Exception as e:
        return _error(500, f"Error interno: {str(e)}")


def _error(status, message):
    return {
        "statusCode": status,
        "headers": HEADERS,
        "body": json.dumps({"error": message})
    }
