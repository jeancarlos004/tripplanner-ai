"""
Utilidades compartidas por todas las Lambdas de TripPlanner AI.

- Identidad del usuario: se toma SOLO del token Cognito validado por el
  autorizador de API Gateway (claims.sub). Nunca del body ni de query params.
- Modelo de datos (tabla única, todo bajo la partición del usuario):
    PK = USER#<sub>   SK = PROFILE                      -> perfil + preferencias
    PK = USER#<sub>   SK = TRIP#<tripId>                -> viaje
    PK = USER#<sub>   SK = ITIN#<tripId>#<YYYY-MM-DD>   -> día de itinerario
    PK = USER#<sub>   SK = RES#<tripId>#<reservationId> -> reserva
  Al estar todo bajo USER#<sub>, el control de acceso por usuario es
  estructural: una Lambda jamás puede leer la partición de otro usuario.
- Errores: códigos HTTP correctos y mensajes claros, sin detalles internos.
"""

import json
import logging
import os
import re
from datetime import date
from decimal import Decimal
from functools import wraps

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

TABLE_NAME = os.environ["TABLE_NAME"]
# Orígenes permitidos para CORS (lista separada por comas). Nunca "*".
ALLOWED_ORIGINS = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip()]

_dynamodb = boto3.resource("dynamodb")
table = _dynamodb.Table(TABLE_NAME)
ConditionalCheckFailed = _dynamodb.meta.client.exceptions.ConditionalCheckFailedException

RESERVATION_TYPES = ("FLIGHT", "HOTEL", "ACTIVITY")
RESERVATION_STATUSES = ("SIMULADA", "PENDIENTE", "CONFIRMADA")
TRIP_STATUSES = ("PLANNING", "CONFIRMED", "COMPLETED", "CANCELLED")

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
# Número de tarjeta: 13-19 dígitos seguidos, o bloques de 4 (1234 5678 9012 3456)
_CARD_RE = re.compile(r"\b\d{13,19}\b|\b\d{4}([ -])\d{4}\1\d{4}\1\d{1,7}\b")
_FORBIDDEN_KEYS = {"cardnumber", "card_number", "cvv", "cvc", "pan", "creditcard", "tarjeta"}


# ── Errores de negocio ───────────────────────────────────────────────────────

class ApiError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def bad_request(msg):  return ApiError(400, msg)
def not_found(msg):    return ApiError(404, msg)


# ── Respuestas HTTP ──────────────────────────────────────────────────────────

class _Encoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, Decimal):
            return int(o) if o == o.to_integral_value() else float(o)
        return super().default(o)


def cors_headers(event) -> dict:
    """Devuelve el Origin de la petición solo si está en la lista permitida."""
    headers = {k.lower(): v for k, v in ((event or {}).get("headers") or {}).items()}
    origin = headers.get("origin", "")
    allowed = origin if origin in ALLOWED_ORIGINS else (ALLOWED_ORIGINS[0] if ALLOWED_ORIGINS else "")
    return {
        "Access-Control-Allow-Origin": allowed,
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
        "Access-Control-Max-Age": "600",
        "Vary": "Origin",
    }


def response(status: int, body, event=None) -> dict:
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json", **cors_headers(event)},
        "body": json.dumps(body, cls=_Encoder, ensure_ascii=False),
    }


def api_handler(fn):
    """Decorador: identidad, parseo, manejo uniforme de errores."""
    @wraps(fn)
    def wrapper(event, context):
        try:
            user_id = get_user_id(event)
            body = parse_body(event)
            path = event.get("pathParameters") or {}
            query = event.get("queryStringParameters") or {}
            status, payload = fn(user_id=user_id, body=body, path=path, query=query)
            return response(status, payload, event)
        except ApiError as e:
            return response(e.status, {"error": e.message}, event)
        except ConditionalCheckFailed:
            return response(404, {"error": "Recurso no encontrado"}, event)
        except Exception:  # noqa: BLE001 — se registra, no se expone
            logger.exception("Error no controlado")
            return response(500, {"error": "Error interno. Intenta de nuevo más tarde."}, event)
    return wrapper


# ── Identidad ────────────────────────────────────────────────────────────────

def get_user_id(event) -> str:
    claims = ((event.get("requestContext") or {}).get("authorizer") or {}).get("claims") or {}
    sub = claims.get("sub")
    if not sub:
        raise ApiError(401, "No autenticado")
    return sub


def get_user_email(event) -> str:
    claims = ((event.get("requestContext") or {}).get("authorizer") or {}).get("claims") or {}
    return claims.get("email", "")


def pk(user_id: str) -> str:
    return f"USER#{user_id}"


# ── Parseo y validación ──────────────────────────────────────────────────────

def parse_body(event) -> dict:
    raw = event.get("body")
    if not raw:
        return {}
    try:
        data = json.loads(raw, parse_float=Decimal)
    except (ValueError, TypeError):
        raise bad_request("El cuerpo debe ser JSON válido")
    if not isinstance(data, dict):
        raise bad_request("El cuerpo debe ser un objeto JSON")
    return data


def require(body: dict, *fields):
    missing = [f for f in fields if body.get(f) in (None, "")]
    if missing:
        raise bad_request(f"Campos requeridos: {', '.join(missing)}")


def text(value, field, max_len=200, required=True) -> str:
    if value is None or value == "":
        if required:
            raise bad_request(f"{field} es requerido")
        return ""
    if not isinstance(value, str):
        raise bad_request(f"{field} debe ser texto")
    value = value.strip()
    if len(value) > max_len:
        raise bad_request(f"{field} supera {max_len} caracteres")
    return value


def iso_date(value, field) -> str:
    if not isinstance(value, str) or not _DATE_RE.match(value):
        raise bad_request(f"{field} debe tener formato YYYY-MM-DD")
    try:
        date.fromisoformat(value)
    except ValueError:
        raise bad_request(f"{field} no es una fecha válida")
    return value


def int_range(value, field, lo, hi) -> int:
    try:
        n = int(value)
    except (TypeError, ValueError):
        raise bad_request(f"{field} debe ser un número entero")
    if isinstance(value, (float, Decimal)) and n != value:
        raise bad_request(f"{field} debe ser un número entero")
    if not lo <= n <= hi:
        raise bad_request(f"{field} debe estar entre {lo} y {hi}")
    return n


def money(value, field, required=True) -> Decimal:
    if value in (None, ""):
        if required:
            raise bad_request(f"{field} es requerido")
        return Decimal("0")
    try:
        d = Decimal(str(value))
    except Exception:
        raise bad_request(f"{field} debe ser numérico")
    if d < 0 or d > Decimal("100000000000"):
        raise bad_request(f"{field} fuera de rango")
    return d


def one_of(value, field, allowed):
    if value not in allowed:
        raise bad_request(f"{field} inválido. Valores permitidos: {', '.join(allowed)}")
    return value


def date_range(start: str, end: str):
    if end < start:
        raise bad_request("endDate no puede ser anterior a startDate")
    if (date.fromisoformat(end) - date.fromisoformat(start)).days > 90:
        raise bad_request("El viaje no puede durar más de 90 días")


def no_payment_data(obj, field="details"):
    """Rechaza cualquier dato que parezca de tarjeta bancaria (requisito §8)."""
    def walk(v, key=""):
        if key.lower().replace("-", "").replace(" ", "") in _FORBIDDEN_KEYS:
            raise bad_request("No se permite enviar datos de tarjetas o pagos")
        if isinstance(v, str) and _CARD_RE.search(v):
            raise bad_request("No se permite enviar datos de tarjetas o pagos")
        if isinstance(v, dict):
            for k, x in v.items():
                walk(x, str(k))
        elif isinstance(v, list):
            for x in v:
                walk(x)
    walk(obj, field)
    return obj


def clean_json(value, field, max_bytes=20000):
    """Valida estructuras libres (details, activities) y limita su tamaño."""
    if not isinstance(value, (dict, list, str)):
        raise bad_request(f"{field} debe ser objeto, lista o texto")
    if len(json.dumps(value, cls=_Encoder)) > max_bytes:
        raise bad_request(f"{field} es demasiado grande")
    return value


# ── Acceso a datos ───────────────────────────────────────────────────────────

def get_trip_or_404(user_id: str, trip_id: str) -> dict:
    if not trip_id:
        raise bad_request("tripId es requerido")
    item = table.get_item(Key={"PK": pk(user_id), "SK": f"TRIP#{trip_id}"}).get("Item")
    if not item:
        raise not_found("Viaje no encontrado")
    return item


def query_prefix(user_id: str, prefix: str) -> list:
    from boto3.dynamodb.conditions import Key
    items, kwargs = [], {
        "KeyConditionExpression": Key("PK").eq(pk(user_id)) & Key("SK").begins_with(prefix)
    }
    while True:
        resp = table.query(**kwargs)
        items.extend(resp.get("Items", []))
        if "LastEvaluatedKey" not in resp:
            return items
        kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]


def public(item: dict) -> dict:
    """Quita las claves internas de DynamoDB antes de devolver al cliente."""
    return {k: v for k, v in item.items() if k not in ("PK", "SK")}


def build_update(fields: dict):
    """Construye UpdateExpression a partir de un dict campo->valor."""
    names, values, parts = {}, {}, []
    for i, (k, v) in enumerate(fields.items()):
        names[f"#f{i}"] = k
        values[f":v{i}"] = v
        parts.append(f"#f{i} = :v{i}")
    return "SET " + ", ".join(parts), names, values
