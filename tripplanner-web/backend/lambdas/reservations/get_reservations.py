"""
Lambda: GetReservations — consulta reservas.
  GET /trips/{tripId}/reservations  -> reservas de un viaje
  GET /reservations                 -> todas las reservas del usuario (?status=...)
"""
from common import api_handler, get_trip_or_404, query_prefix, public, one_of, RESERVATION_STATUSES


@api_handler
def handler(user_id, path, query, **_):
    trip_id = path.get("tripId")
    if trip_id:
        get_trip_or_404(user_id, trip_id)
        items = query_prefix(user_id, f"RES#{trip_id}#")
    else:
        items = query_prefix(user_id, "RES#")

    status = (query or {}).get("status")
    if status:
        one_of(status, "status", RESERVATION_STATUSES)
        items = [r for r in items if r.get("status") == status]

    reservations = sorted((public(r) for r in items), key=lambda r: r.get("createdAt", ""), reverse=True)
    return 200, {"reservations": reservations, "count": len(reservations)}
