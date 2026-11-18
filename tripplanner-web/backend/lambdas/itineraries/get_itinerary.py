"""Lambda: GetItinerary — consulta el itinerario de un viaje.  GET /trips/{tripId}/itinerary"""
from common import api_handler, get_trip_or_404, query_prefix, public


@api_handler
def handler(user_id, path, **_):
    trip_id = path.get("tripId")
    get_trip_or_404(user_id, trip_id)
    days = sorted((public(d) for d in query_prefix(user_id, f"ITIN#{trip_id}#")),
                  key=lambda d: d.get("date", ""))
    return 200, {"tripId": trip_id, "itinerary": days, "count": len(days)}
