"""Lambda: GetTrips — Consulta los viajes del usuario desde DynamoDB."""
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
        user_id = event.get("requestContext", {}).get("authorizer", {}).get("userId", "default-user")

        response = table.query(
            KeyConditionExpression=Key("PK").eq(f"USER#{user_id}") & Key("SK").begins_with("TRIP#")
        )

        trips = response.get("Items", [])

        return {
            "statusCode": 200,
            "headers": HEADERS,
            "body": json.dumps({
                "trips": trips,
                "count": len(trips)
            }, default=str)
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": HEADERS,
            "body": json.dumps({"error": f"Error interno: {str(e)}"})
        }
