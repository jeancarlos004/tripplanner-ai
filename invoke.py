#!/usr/bin/env python3
"""
invoke.py — Cliente de consola para el Trip Planner A2A
Renderiza la respuesta del OrchestratorAgent de forma legible en la terminal.

Uso:
    python invoke.py "Vuelos de Bogota a Cartagena el 21 de septiembre y clima"
    python invoke.py --runtime WeatherAgent "Clima en Medellin mañana"
"""

import sys
import json
import uuid
import argparse
import textwrap

import boto3
import botocore.auth
import botocore.awsrequest
import urllib.request

# ── Configuración ─────────────────────────────────────────────────────────────

REGION = "us-east-2"

RUNTIMES = {
    "OrchestratorAgent": "arn:aws:bedrock-agentcore:us-east-2:750708765285:runtime/tripplannera2a_OrchestratorAgent-IPoKfoDSPk",
    "FlightsAgent":      "arn:aws:bedrock-agentcore:us-east-2:750708765285:runtime/tripplannera2a_FlightsAgent-MZwYNpFz5J",
    "WeatherAgent":      "arn:aws:bedrock-agentcore:us-east-2:750708765285:runtime/tripplannera2a_WeatherAgent-0uRzDWA45L",
}

# ── Colores ANSI ───────────────────────────────────────────────────────────────

RESET  = "\033[0m"
BOLD   = "\033[1m"
CYAN   = "\033[96m"
GREEN  = "\033[92m"
YELLOW = "\033[93m"
GREY   = "\033[90m"
WHITE  = "\033[97m"


def color(text, *codes):
    return "".join(codes) + text + RESET


# ── Invocación ─────────────────────────────────────────────────────────────────

def invoke_runtime(runtime_arn: str, prompt: str) -> str:
    """Invoca un runtime AgentCore y devuelve el texto de la respuesta."""
    from urllib.parse import quote
    encoded = quote(runtime_arn, safe="")
    url = f"https://bedrock-agentcore.{REGION}.amazonaws.com/runtimes/{encoded}/invocations"

    # El OrchestratorAgent recibe {"prompt": "..."}
    # Los especialistas reciben el formato JSON-RPC A2A
    # Detectamos por el ARN qué formato usar
    if "OrchestratorAgent" in runtime_arn:
        payload = json.dumps({"prompt": prompt}).encode()
    else:
        payload = json.dumps({
            "jsonrpc": "2.0",
            "id": str(uuid.uuid4()),
            "method": "message/send",
            "params": {
                "message": {
                    "messageId": str(uuid.uuid4()),
                    "role": "user",
                    "parts": [{"kind": "text", "text": prompt}],
                },
                "configuration": {"acceptedOutputModes": ["text"]},
            },
        }).encode()

    session = boto3.Session()
    creds   = session.get_credentials().get_frozen_credentials()

    aws_req = botocore.awsrequest.AWSRequest(
        method="POST", url=url, data=payload,
        headers={
            "Content-Type": "application/json",
            "X-Amzn-Bedrock-AgentCore-Runtime-Session-Id": str(uuid.uuid4()),
        },
    )
    botocore.auth.SigV4Auth(creds, "bedrock-agentcore", REGION).add_auth(aws_req)

    req = urllib.request.Request(url=url, data=payload, headers=dict(aws_req.headers), method="POST")
    with urllib.request.urlopen(req, timeout=120) as resp:
        raw = resp.read().decode("utf-8")
        content_type = resp.headers.get("Content-Type", "")

    # Respuesta SSE (text/event-stream): "data: {...}\n\ndata: {...}\n\n"
    if "event-stream" in content_type or raw.startswith("data:"):
        texts = []
        for line in raw.splitlines():
            line = line.strip()
            if line.startswith("data:"):
                json_str = line[5:].strip()
                try:
                    obj = json.loads(json_str)
                    # Formato directo: {"text": "..."}
                    if isinstance(obj, dict) and "text" in obj:
                        val = obj["text"]
                        if isinstance(val, str):
                            texts.append(val)
                    elif isinstance(obj, dict) and "error" in obj:
                        return f"Error del agente: {obj['error']}"
                except json.JSONDecodeError:
                    pass
        return "\n".join(texts) if texts else raw

    # Respuesta JSON directa (agentes especialistas A2A)
    data   = json.loads(raw)
    result = data.get("result", {})

    for artifact in result.get("artifacts", []):
        texts = [p["text"] for p in artifact.get("parts", []) if p.get("kind") == "text"]
        if texts:
            return "\n".join(texts)

    for part in result.get("parts", []):
        if part.get("kind") == "text":
            return part["text"]

    return json.dumps(result, ensure_ascii=False, indent=2)


# ── Renderizado ────────────────────────────────────────────────────────────────

def render(text: str, runtime: str):
    """Imprime la respuesta del agente de forma ordenada en la terminal."""
    width = 70

    print()
    print(color("━" * width, CYAN))
    print(color(f"  🌍 Trip Planner A2A  ·  {runtime}", CYAN, BOLD))
    print(color("━" * width, CYAN))
    print()

    # Renderizar línea a línea respetando markdown básico
    for line in text.split("\n"):
        stripped = line.strip()

        # Encabezados ### y ##
        if stripped.startswith("### "):
            print(color(f"\n  {stripped[4:]}", YELLOW, BOLD))
        elif stripped.startswith("## "):
            print(color(f"\n  {stripped[3:]}", CYAN, BOLD))

        # Ítems de lista numerados: 1. **Texto**
        elif stripped and stripped[0].isdigit() and ". " in stripped:
            num, rest = stripped.split(". ", 1)
            # limpiar ** de negrita
            rest = rest.replace("**", "")
            print(color(f"  {num}. ", GREEN, BOLD) + color(rest, WHITE))

        # Ítems de lista con guion: - **Key**: value
        elif stripped.startswith("- "):
            content = stripped[2:].replace("**", "")
            if ": " in content:
                key, val = content.split(": ", 1)
                print(color(f"    • {key}: ", GREEN) + color(val, WHITE))
            else:
                print(color(f"    • {content}", WHITE))

        # Línea de texto normal (con wrapping)
        elif stripped:
            wrapped = textwrap.fill(stripped.replace("**", ""), width=width - 4)
            for wline in wrapped.split("\n"):
                print(f"  {wline}")

        # Línea vacía
        else:
            print()

    print()
    print(color("━" * width, GREY))
    print()


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Cliente de consola para el Trip Planner A2A",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""
        Ejemplos:
          python invoke.py "Vuelos de Bogota a Cartagena el 21 de septiembre"
          python invoke.py "Quiero viajar de Bogota a Medellin el proximo viernes"
          python invoke.py --runtime FlightsAgent "Busca vuelos BOG-CTG"
        """),
    )
    parser.add_argument("prompt", help="Petición en lenguaje natural")
    parser.add_argument(
        "--runtime", "-r",
        default="OrchestratorAgent",
        choices=list(RUNTIMES.keys()),
        help="Runtime a invocar (default: OrchestratorAgent)",
    )
    args = parser.parse_args()

    runtime_arn = RUNTIMES[args.runtime]

    print(color(f"\n  ⏳ Consultando {args.runtime}...", GREY))

    try:
        response_text = invoke_runtime(runtime_arn, args.prompt)
        render(response_text, args.runtime)
    except KeyboardInterrupt:
        print("\n  Cancelado.")
        sys.exit(0)
    except Exception as e:
        print(color(f"\n  ❌ Error: {e}\n", "\033[91m"))
        sys.exit(1)


if __name__ == "__main__":
    main()
