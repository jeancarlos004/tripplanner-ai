import os, json, uuid, urllib.request, urllib.error
import boto3, botocore.auth, botocore.awsrequest

REGION = "us-east-2"
URL = os.environ["FLIGHTS_AGENT_URL"].rstrip("/") + "/invocations"
PROFILE = os.environ.get("TEST_PROFILE")  # vacío = tu perfil por defecto

session = boto3.Session(profile_name=PROFILE) if PROFILE else boto3.Session()
print("Identidad:", session.client("sts").get_caller_identity()["Arn"])
creds = session.get_credentials().get_frozen_credentials()

payload = json.dumps({
    "jsonrpc": "2.0", "id": "1", "method": "message/send",
    "params": {"message": {"messageId": "1", "role": "user",
               "parts": [{"kind": "text", "text": "vuelos BAQ a BOG"}]}}
}).encode()

req = botocore.awsrequest.AWSRequest(
    method="POST", url=URL, data=payload,
    headers={"Content-Type": "application/json",
             "X-Amzn-Bedrock-AgentCore-Runtime-Session-Id": str(uuid.uuid4())},
)
botocore.auth.SigV4Auth(creds, "bedrock-agentcore", REGION).add_auth(req)

http_req = urllib.request.Request(URL, data=payload, headers=dict(req.headers), method="POST")
try:
    with urllib.request.urlopen(http_req, timeout=60) as r:
        print(f"HTTP {r.status}: la identidad TIENE acceso")
        print(r.read().decode()[:500])
except urllib.error.HTTPError as e:
    print(f"HTTP {e.code}: la identidad NO tiene acceso o la URL es incorrecta")
    print(e.read().decode())