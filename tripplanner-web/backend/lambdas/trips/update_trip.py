"""Lambda: UpdateTrip — Actualiza un viaje del usuario en DynamoDB."""
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

ALLOWED_FIELDS = ["destination", "origin", "startDate", "endDate", "travelers", "budget", "preferences", "status"]
ALLOWED_STATUSES = ["PLANNING", "CONFIRMED", "COMPLETED"]


def handler(event, context):
    try:
        trip_id = event.get("pathParameters", {}).get("tripId")
        user_id = event.get("requestContext", {}).get("authorizer", {}).get("userId", "default-user")
        body = json.loads(event.get("body") or "{}")

        if not trip_id:
            return _error(400, "tripId es requerido")

        if "status" in body and body["status"] not in ALLOWED_STATUSES:
            return _error(400, f"Estado inválido. Valores permitidos: {ALLOWED_STATUSES}")

        # Construir expresión de actualización dinámica
        update_expr_parts = []
        expr_values = {":updatedAt": datetime.now(timezone.utc).isoformat()}
        expr_names = {}

        for field in ALLOWED_FIELDS:
            if field in body:
                safe_name = f"#f_{field}"
                expr_names[safe_name] = field
                expr_values[f":{field}"] = str(body[field]) if field == "budget" else body[field]
                update_expr_parts.append(f"{safe_name} = :{field}")

        update_expr_parts.append("#updatedAt = :updatedAt")
        expr_names["#updatedAt"] = "updatedAt"

        table.update_item(
            Key={"PK": f"USER#{user_id}", "SK": f"TRIP#{trip_id}"},
            UpdateExpression="SET " + ", ".join(update_expr_parts),
            ExpressionAttributeValues=expr_values,
            ExpressionAttributeNames=expr_names,
            ConditionExpression="attribute_exists(PK)"
        )

        return {
            "statusCode": 200,
            "headers": HEADERS,
            "body": json.dumps({"message": "Viaje actualizado", "tripId": trip_id})
        }

    except dynamodb.meta.client.exceptions.ConditionalCheckFailedException:
        return _error(404, "Viaje no encontrado")
    except Exception as e:
        return _error(500, f"Error interno: {str(e)}")


def _error(status, message):
    return {
        "statusCode": status,
        "headers": HEADERS,
        "body": json.dumps({"error": message})
    }
