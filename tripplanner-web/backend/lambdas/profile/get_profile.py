"""Lambda: GetProfile — perfil y preferencias del usuario.  GET /profile"""
from common import api_handler, table, pk, public


@api_handler
def handler(user_id, **_):
    item = table.get_item(Key={"PK": pk(user_id), "SK": "PROFILE"}).get("Item")
    profile = public(item) if item else {"preferences": {}}
    profile["userId"] = user_id
    return 200, {"profile": profile}
