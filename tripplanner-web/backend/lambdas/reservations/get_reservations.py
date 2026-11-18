"""Lambda: GetReservations — Consulta las reservas de un viaje."""
import json
import os
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
        trip_id = event.get("pathParameters", {}).get("tripId")

        if not trip_id:
            return _error(400, "tripId es requerido")

        response = table.query(
            KeyConditionExpression=Key("PK").eq(f"TRIP#{trip_id}") & Key("SK").begins_with("RESERVATION#")
        )

        reservations = response.get("Items", [])

        return {
            "statusCode": 200,
            "headers": HEADERS,
            "body": json.dumps({
                "reservations": reservations,
                "count": len(reservations)
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
