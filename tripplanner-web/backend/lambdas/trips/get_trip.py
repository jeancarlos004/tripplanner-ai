"""Lambda: GetTrip — detalle de un viaje con itinerario y reservas.  GET /trips/{tripId}"""
from common import api_handler, get_trip_or_404, query_prefix, public


@api_handler
def handler(user_id, path, **_):
    trip_id = path.get("tripId")
    trip = public(get_trip_or_404(user_id, trip_id))
    itinerary = sorted((public(d) for d in query_prefix(user_id, f"ITIN#{trip_id}#")),
                       key=lambda d: d.get("date", ""))
    reservations = sorted((public(r) for r in query_prefix(user_id, f"RES#{trip_id}#")),
                          key=lambda r: r.get("createdAt", ""))
    return 200, {"trip": trip, "itinerary": itinerary, "reservations": reservations}
