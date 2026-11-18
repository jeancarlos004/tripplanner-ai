"""
Pruebas de las Lambdas de TripPlanner AI contra DynamoDB simulado (moto).

Ejecutar desde tripplanner-web/backend:
    python -m pytest tests -q
Cubre: flujo completo (viaje → itinerario → reserva → recuperación), validaciones,
control de acceso por usuario, estados de reserva, CORS y rechazo de datos de tarjeta.
"""
import importlib
import json
import os
import sys
from pathlib import Path

import boto3
import pytest
from moto import mock_aws

LAMBDAS = Path(__file__).resolve().parents[1] / "lambdas"
sys.path.insert(0, str(LAMBDAS))

ORIGIN = "https://dxxxx.cloudfront.net"


@pytest.fixture()
def h():
    """Crea la tabla en moto y (re)importa los handlers con la tabla simulada."""
    os.environ.update({
        "TABLE_NAME": "tripplanner-test", "AWS_DEFAULT_REGION": "us-east-2",
        "AWS_ACCESS_KEY_ID": "test", "AWS_SECRET_ACCESS_KEY": "test",
        "ALLOWED_ORIGINS": f"{ORIGIN},http://localhost:5173",
    })
    with mock_aws():
        boto3.client("dynamodb").create_table(
            TableName="tripplanner-test", BillingMode="PAY_PER_REQUEST",
            AttributeDefinitions=[{"AttributeName": "PK", "AttributeType": "S"},
                                  {"AttributeName": "SK", "AttributeType": "S"}],
            KeySchema=[{"AttributeName": "PK", "KeyType": "HASH"},
                       {"AttributeName": "SK", "KeyType": "RANGE"}],
        )
        for name in list(sys.modules):
            if name == "common" or name.split(".")[0] in ("trips", "itineraries", "reservations", "profile", "cors"):
                del sys.modules[name]
        mods = {n: importlib.import_module(n) for n in [
            "trips.create_trip", "trips.get_trips", "trips.get_trip", "trips.update_trip",
            "itineraries.create_itinerary", "itineraries.get_itinerary", "itineraries.update_itinerary",
            "reservations.create_reservation", "reservations.get_reservations", "reservations.update_reservation",
            "profile.get_profile", "profile.update_profile", "cors",
        ]}
        yield lambda mod: mods[mod].handler


def ev(user="user-a", body=None, path=None, query=None, origin=ORIGIN):
    claims = {"sub": user, "email": f"{user}@test.com"} if user else {}
    return {
        "headers": {"Origin": origin},
        "body": json.dumps(body) if body is not None else None,
        "pathParameters": path,
        "queryStringParameters": query,
        "requestContext": {"authorizer": {"claims": claims}},
    }


def call(handler, event):
    res = handler(event, None)
    return res["statusCode"], json.loads(res["body"] or "{}"), res["headers"]


TRIP = {"origin": "Bogotá", "destination": "Cartagena", "startDate": "2027-02-10",
        "endDate": "2027-02-13", "travelers": 3, "budget": 5000000, "preferences": "playa y cultura"}


def make_trip(h, user="user-a"):
    code, body, _ = call(h("trips.create_trip"), ev(user, TRIP))
    assert code == 201, body
    return body["tripId"]


# ── Flujo obligatorio de la demo ────────────────────────────────────────────

def test_flujo_completo(h):
    trip_id = make_trip(h)

    days = [{"date": f"2027-02-1{d}", "activities": [
        {"time": "09:00", "title": "Ciudad Amurallada", "location": "Centro", "estimatedCost": 80000.5},
        "Atardecer en el Café del Mar"]} for d in range(0, 4)]
    code, body, _ = call(h("itineraries.create_itinerary"), ev(body={"days": days}, path={"tripId": trip_id}))
    assert code == 201, body
    assert len(body["itinerary"]) == 4

    code, body, _ = call(h("reservations.create_reservation"), ev(body={
        "type": "FLIGHT", "title": "Avianca BOG→CTG", "details": {"airline": "Avianca", "passengers": 3},
        "price": 1200000, "date": "2027-02-10"}, path={"tripId": trip_id}))
    assert code == 201, body
    assert body["status"] == "SIMULADA"

    # "Vuelve a ingresar y recupera sus datos"
    code, body, _ = call(h("trips.get_trips"), ev())
    assert code == 200 and body["count"] == 1
    code, body, _ = call(h("trips.get_trip"), ev(path={"tripId": trip_id}))
    assert code == 200
    assert body["trip"]["travelers"] == 3 and body["trip"]["budget"] == 5000000
    assert len(body["itinerary"]) == 4 and body["itinerary"][0]["activities"][0]["estimatedCost"] == 80000.5
    assert len(body["reservations"]) == 1
    assert "PK" not in body["trip"] and "SK" not in body["trip"]
    code, body, _ = call(h("reservations.get_reservations"), ev())
    assert code == 200 and body["count"] == 1


# ── Control de acceso por usuario ───────────────────────────────────────────

def test_usuario_no_accede_a_viajes_ajenos(h):
    trip_id = make_trip(h, "user-a")
    assert call(h("trips.get_trips"), ev("user-b"))[1]["count"] == 0
    assert call(h("trips.get_trip"), ev("user-b", path={"tripId": trip_id}))[0] == 404
    assert call(h("trips.update_trip"), ev("user-b", {"budget": 1}, {"tripId": trip_id}))[0] == 404
    assert call(h("reservations.create_reservation"),
                ev("user-b", {"type": "HOTEL", "details": "x"}, {"tripId": trip_id}))[0] == 404
    assert call(h("itineraries.get_itinerary"), ev("user-b", path={"tripId": trip_id}))[0] == 404


def test_sin_token_devuelve_401(h):
    code, body, _ = call(h("trips.get_trips"), ev(user=None))
    assert code == 401


# ── Validaciones ────────────────────────────────────────────────────────────

@pytest.mark.parametrize("bad, msg", [
    ({**TRIP, "startDate": "10/02/2027"}, "YYYY-MM-DD"),
    ({**TRIP, "endDate": "2027-02-01"}, "anterior"),
    ({**TRIP, "travelers": 0}, "entre 1 y 20"),
    ({**TRIP, "travelers": 2.5}, "entero"),
    ({**TRIP, "budget": -5}, "rango"),
    ({**TRIP, "budget": 0}, "mayor a 0"),
    ({k: v for k, v in TRIP.items() if k != "destination"}, "destination"),
])
def test_validaciones_viaje(h, bad, msg):
    code, body, _ = call(h("trips.create_trip"), ev(body=bad))
    assert code == 400 and msg in body["error"], body


def test_json_invalido(h):
    e = ev(); e["body"] = "{no-json"
    assert call(h("trips.create_trip"), e)[0] == 400


def test_itinerario_fuera_de_rango(h):
    trip_id = make_trip(h)
    code, body, _ = call(h("itineraries.create_itinerary"),
                         ev(body={"date": "2027-03-01", "activities": ["x"]}, path={"tripId": trip_id}))
    assert code == 400 and "fuera" in body["error"]


def test_update_itinerary_upsert(h):
    trip_id = make_trip(h)
    code, body, _ = call(h("itineraries.update_itinerary"),
                         ev(body={"activities": [{"title": "Playa Blanca"}]}, path={"tripId": trip_id, "date": "2027-02-11"}))
    assert code == 200 and body["day"]["activities"][0]["title"] == "Playa Blanca"


# ── Reservas: estados y datos de pago ───────────────────────────────────────

def test_estados_de_reserva(h):
    trip_id = make_trip(h)
    rid = call(h("reservations.create_reservation"),
               ev(body={"type": "HOTEL", "details": "3 noches"}, path={"tripId": trip_id}))[1]["reservationId"]
    upd = h("reservations.update_reservation")
    p = {"tripId": trip_id, "reservationId": rid}
    assert call(upd, ev(body={"status": "PENDIENTE"}, path=p))[1]["reservation"]["status"] == "PENDIENTE"
    assert call(upd, ev(body={"status": "CONFIRMADA"}, path=p))[0] == 400          # sin proveedor real
    assert call(upd, ev(body={"status": "PAGADA"}, path=p))[0] == 400
    ok = call(upd, ev(body={"status": "CONFIRMADA", "providerReference": "ABC123"}, path=p))[1]
    assert ok["reservation"]["status"] == "CONFIRMADA"
    assert call(upd, ev(body={"status": "PENDIENTE"}, path={"tripId": trip_id, "reservationId": "nope"}))[0] == 404


@pytest.mark.parametrize("details", [
    "Pago con tarjeta 4111111111111111",
    "4111 1111 1111 1111",
    {"cardNumber": "x"},
    {"pago": {"cvv": "123"}},
])
def test_rechaza_datos_de_tarjeta(h, details):
    trip_id = make_trip(h)
    code, body, _ = call(h("reservations.create_reservation"),
                         ev(body={"type": "FLIGHT", "details": details}, path={"tripId": trip_id}))
    assert code == 400 and "tarjeta" in body["error"]


def test_fechas_no_son_tarjetas(h):
    trip_id = make_trip(h)
    code, _, _ = call(h("reservations.create_reservation"), ev(
        body={"type": "FLIGHT", "details": "Ida 2027-02-10 vuelta 2027-02-13, vuelo AV9500"}, path={"tripId": trip_id}))
    assert code == 201


def test_tipo_reserva_invalido(h):
    trip_id = make_trip(h)
    assert call(h("reservations.create_reservation"),
                ev(body={"type": "CRUCERO", "details": "x"}, path={"tripId": trip_id}))[0] == 400


# ── Perfil / preferencias ───────────────────────────────────────────────────

def test_preferencias(h):
    assert call(h("profile.get_profile"), ev())[1]["profile"]["preferences"] == {}
    code, body, _ = call(h("profile.update_profile"), ev(body={"preferences": {"activityTypes": ["playa"], "budgetLevel": "moderado"}}))
    assert code == 200
    assert call(h("profile.get_profile"), ev())[1]["profile"]["preferences"]["activityTypes"] == ["playa"]
    assert call(h("profile.update_profile"), ev(body={"preferences": {"hack": 1}}))[0] == 400


# ── CORS ────────────────────────────────────────────────────────────────────

def test_cors_solo_origenes_permitidos(h):
    _, _, headers = call(h("trips.get_trips"), ev(origin=ORIGIN))
    assert headers["Access-Control-Allow-Origin"] == ORIGIN
    _, _, headers = call(h("trips.get_trips"), ev(origin="https://evil.example"))
    assert headers["Access-Control-Allow-Origin"] != "https://evil.example"
    res = h("cors")(ev(origin="http://localhost:5173"), None)
    assert res["statusCode"] == 204 and res["headers"]["Access-Control-Allow-Origin"] == "http://localhost:5173"


def test_error_interno_no_expone_detalles(h, monkeypatch):
    import common
    monkeypatch.setattr(common.table, "query", lambda **_: (_ for _ in ()).throw(RuntimeError("secreto interno")))
    code, body, _ = call(h("trips.get_trips"), ev())
    assert code == 500 and "secreto" not in body["error"]
