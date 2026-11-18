import os, json, urllib.request, urllib.error

URL = os.environ["FLIGHTS_AGENT_URL"].rstrip("/") + "/invocations"

payload = json.dumps({
    "jsonrpc": "2.0", "id": "1", "method": "message/send",
    "params": {"message": {"messageId": "1", "role": "user",
               "parts": [{"kind": "text", "text": "vuelos BAQ a BOG"}]}}
}).encode()

req = urllib.request.Request(URL, data=payload,
                             headers={"Content-Type": "application/json"},
                             method="POST")
try:
    urllib.request.urlopen(req, timeout=30)
    print("⚠️ Respondió: el agente NO está protegido")
except urllib.error.HTTPError as e:
    print(f"✅ Rechazado sin firma: HTTP {e.code}")
    print(e.read().decode())