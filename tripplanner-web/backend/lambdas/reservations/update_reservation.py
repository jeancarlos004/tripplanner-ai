"""Lambda: UpdateReservation — Actualiza una reserva o su estado."""
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

ALLOWED_STATUSES = ["SIMULADA", "PENDIENTE", "CONFIRMADA"]


def handler(event, context):
    try:
        trip_id = event.get("pathParameters", {}).get("tripId")
        reservation_id = event.get("pathParameters", {}).get("reservationId")
        body = json.loads(event.get("body") or "{}")

        if not trip_id or not reservation_id:
            return _error(400, "tripId y reservationId son requeridos")

        if "status" in body and body["status"] not in ALLOWED_STATUSES:
            return _error(400, f"Estado inválido. Valores: {ALLOWED_STATUSES}")

        update_parts = []
        expr_values = {":updatedAt": datetime.now(timezone.utc).isoformat()}
        expr_names = {"#updatedAt": "updatedAt"}
        update_parts.append("#updatedAt = :updatedAt")

        if "status" in body:
            expr_values[":status"] = body["status"]
            update_parts.append("#status = :status")
            expr_names["#status"] = "status"

        if "details" in body:
            expr_values[":details"] = body["details"]
            update_parts.append("#details = :details")
            expr_names["#details"] = "details"

        if "price" in body:
            expr_values[":price"] = str(body["price"])
            update_parts.append("#price = :price")
            expr_names["#price"] = "price"

        table.update_item(
            Key={"PK": f"TRIP#{trip_id}", "SK": f"RESERVATION#{reservation_id}"},
            UpdateExpression="SET " + ", ".join(update_parts),
            ExpressionAttributeValues=expr_values,
            ExpressionAttributeNames=expr_names,
            ConditionExpression="attribute_exists(PK)"
        )

        return {
            "statusCode": 200,
            "headers": HEADERS,
            "body": json.dumps({
                "message": "Reserva actualizada",
                "reservationId": reservation_id
            })
        }

    except dynamodb.meta.client.exceptions.ConditionalCheckFailedException:
        return _error(404, "Reserva no encontrada")
    except Exception as e:
        return _error(500, f"Error interno: {str(e)}")


def _error(status, message):
    return {
        "statusCode": status,
        "headers": HEADERS,
        "body": json.dumps({"error": message})
    }
