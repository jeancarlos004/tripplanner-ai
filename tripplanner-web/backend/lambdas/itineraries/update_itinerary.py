"""Lambda: UpdateItinerary — Modifica el itinerario de un día."""
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
        date = event.get("pathParameters", {}).get("date")
        body = json.loads(event.get("body") or "{}")

        if not trip_id or not date:
            return _error(400, "tripId y date son requeridos")

        update_parts = []
        expr_values = {":updatedAt": datetime.now(timezone.utc).isoformat()}
        expr_names = {"#updatedAt": "updatedAt"}
        update_parts.append("#updatedAt = :updatedAt")

        if "activities" in body:
            expr_values[":activities"] = body["activities"]
            update_parts.append("#activities = :activities")
            expr_names["#activities"] = "activities"

        if "notes" in body:
            expr_values[":notes"] = body["notes"]
            update_parts.append("#notes = :notes")
            expr_names["#notes"] = "notes"

        table.update_item(
            Key={"PK": f"TRIP#{trip_id}", "SK": f"ITINERARY#{date}"},
            UpdateExpression="SET " + ", ".join(update_parts),
            ExpressionAttributeValues=expr_values,
            ExpressionAttributeNames=expr_names,
            ConditionExpression="attribute_exists(PK)"
        )

        return {
            "statusCode": 200,
            "headers": HEADERS,
            "body": json.dumps({"message": "Itinerario actualizado", "tripId": trip_id, "date": date})
        }

    except dynamodb.meta.client.exceptions.ConditionalCheckFailedException:
        return _error(404, "Itinerario no encontrado")
    except Exception as e:
        return _error(500, f"Error interno: {str(e)}")


def _error(status, message):
    return {
        "statusCode": status,
        "headers": HEADERS,
        "body": json.dumps({"error": message})
    }
