"""Lambda: CreateTrip — Crea un viaje del usuario en DynamoDB."""
import json
import os
import uuid
from datetime import datetime, timezone
import boto3
from boto3.dynamodb.conditions import Key

TABLE_NAME = os.environ["TABLE_NAME"]
dynamodb = boto3.resource("dynamodb", region_name=os.environ.get("REGION", "us-east-2"))
table = dynamodb.Table(TABLE_NAME)

HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
}


def handler(event, context):
    try:
        body = json.loads(event.get("body") or "{}")
        user_id = event.get("requestContext", {}).get("authorizer", {}).get("userId", "default-user")

        # Validaciones
        required = ["destination", "origin", "startDate", "endDate", "travelers", "budget"]
        for field in required:
            if field not in body:
                return _error(400, f"Campo requerido: {field}")

        if body["travelers"] < 1:
            return _error(400, "El número de viajeros debe ser mayor a 0")

        if body["budget"] <= 0:
            return _error(400, "El presupuesto debe ser mayor a 0")

        trip_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        item = {
            "PK": f"USER#{user_id}",
            "SK": f"TRIP#{trip_id}",
            "GSI1PK": user_id,
            "GSI1SK": now,
            "tripId": trip_id,
            "userId": user_id,
            "origin": body["origin"],
            "destination": body["destination"],
            "startDate": body["startDate"],
            "endDate": body["endDate"],
            "travelers": body["travelers"],
            "budget": str(body["budget"]),
            "preferences": body.get("preferences", ""),
            "status": "PLANNING",
            "createdAt": now,
            "updatedAt": now,
        }

        table.put_item(Item=item)

        return {
            "statusCode": 201,
            "headers": HEADERS,
            "body": json.dumps({
                "message": "Viaje creado exitosamente",
                "tripId": trip_id,
                "trip": item
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
