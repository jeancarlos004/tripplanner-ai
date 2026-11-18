"""
Cognito PreSignUp trigger — confirma automáticamente a los usuarios nuevos.

Simplifica la demostración académica (no requiere código por correo).
Se desactiva poniendo el parámetro AutoConfirmUsers=false en template.yaml.
"""
import os


def handler(event, context):
    if os.environ.get("AUTO_CONFIRM", "true").lower() == "true":
        event["response"]["autoConfirmUser"] = True
        if event["request"].get("userAttributes", {}).get("email"):
            event["response"]["autoVerifyEmail"] = True
    return event
