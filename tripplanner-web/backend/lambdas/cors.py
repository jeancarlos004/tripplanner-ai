"""Lambda: CORS preflight (OPTIONS) — responde solo a orígenes permitidos."""
from common import cors_headers


def handler(event, context):
    return {"statusCode": 204, "headers": cors_headers(event), "body": ""}
