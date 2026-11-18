"""Lambda: GetTrips — lista los viajes del usuario autenticado.  GET /trips"""
from common import api_handler, query_prefix, public


@api_handler
def handler(user_id, query, **_):
    trips = [public(t) for t in query_prefix(user_id, "TRIP#")]
    status = (query or {}).get("status")
    if status:
        trips = [t for t in trips if t.get("status") == status]
    trips.sort(key=lambda t: t.get("startDate", ""))
    return 200, {"trips": trips, "count": len(trips)}
