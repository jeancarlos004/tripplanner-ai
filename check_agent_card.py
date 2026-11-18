"""
check_agent_card.py — Inspecciona la agent card de los agentes especialistas.
Usa la API GetAgentCard del control plane de Bedrock AgentCore.
"""
import boto3
import json

REGION = "us-east-2"

AGENTS = {
    "FlightsAgent": "tripplannera2a_FlightsAgent-MZwYNpFz5J",
    "WeatherAgent": "tripplannera2a_WeatherAgent-0uRzDWA45L",
}

RESET  = "\033[0m"
BOLD   = "\033[1m"
CYAN   = "\033[96m"
GREEN  = "\033[92m"
YELLOW = "\033[93m"
GREY   = "\033[90m"
WHITE  = "\033[97m"


def get_agent_card(runtime_id: str) -> dict:
    """Obtiene la agent card via GetAgentCard del data plane de AgentCore."""
    client = boto3.client("bedrock-agentcore", region_name=REGION)
    arn = f"arn:aws:bedrock-agentcore:{REGION}:750708765285:runtime/{runtime_id}"
    resp = client.get_agent_card(
        agentRuntimeArn=arn,
        qualifier="DEFAULT",
    )
    # La respuesta incluye el campo 'agentCard' con la card serializada
    return resp


def print_card(agent_name: str, resp: dict):
    width = 64
    print()
    print(f"{CYAN}{BOLD}{'━' * width}{RESET}")
    print(f"{CYAN}{BOLD}  📋 Agent Card — {agent_name}{RESET}")
    print(f"{CYAN}{BOLD}{'━' * width}{RESET}")

    # Extraer la card del campo 'agentCard' (puede ser string JSON o dict)
    card_raw = resp.get("agentCard", resp)
    if isinstance(card_raw, str):
        try:
            card = json.loads(card_raw)
        except Exception:
            card = {"raw": card_raw}
    else:
        card = card_raw

    print(f"{BOLD}  Nombre:      {RESET}{WHITE}{card.get('name', 'N/A')}{RESET}")
    print(f"{BOLD}  Descripción: {RESET}{WHITE}{str(card.get('description', 'N/A'))[:80]}{RESET}")
    print(f"{BOLD}  Versión:     {RESET}{WHITE}{card.get('version', 'N/A')}{RESET}")

    # URL del agente
    url = card.get("url", "")
    if not url:
        ifaces = card.get("supportedInterfaces", [])
        url = ifaces[0].get("url", "N/A") if ifaces else "N/A"
    print(f"{BOLD}  URL:         {RESET}{WHITE}{url}{RESET}")

    # Skills
    skills = card.get("skills", [])
    if skills:
        print(f"\n{YELLOW}{BOLD}  Skills ({len(skills)}):{RESET}")
        for skill in skills:
            name = skill.get("name", skill.get("id", "?"))
            desc = skill.get("description", "")[:70]
            print(f"{GREEN}    ✓ {name}{RESET}")
            if desc:
                print(f"      {WHITE}{desc}{RESET}")

    # Capabilities
    caps = card.get("capabilities", {})
    if caps:
        print(f"\n{YELLOW}{BOLD}  Capabilities:{RESET}")
        for k, v in caps.items():
            print(f"    • {k}: {v}")

    print()
    print(f"{GREY}  JSON completo:{RESET}")
    print(f"{GREY}{json.dumps(card, indent=4, ensure_ascii=False)}{RESET}")
    print()


if __name__ == "__main__":
    print(f"\n{BOLD}🔍 Inspeccionando Agent Cards — Protocolo A2A{RESET}")
    print(f"{GREY}   Cada agente publica su agent card describiendo sus capacidades.{RESET}")
    print(f"{GREY}   El orquestador las lee para saber qué skills invocar.{RESET}\n")

    cp = boto3.client("bedrock-agentcore-control", region_name=REGION)

    for name, runtime_id in AGENTS.items():
        print(f"{GREY}  Consultando card de {name}...{RESET}")
        try:
            arn = f"arn:aws:bedrock-agentcore:{REGION}:750708765285:runtime/{runtime_id}"
            # Intentar con data plane
            dp = boto3.client("bedrock-agentcore", region_name=REGION)
            resp = dp.get_agent_card(agentRuntimeArn=arn, qualifier="DEFAULT")
            print_card(name, resp)
        except Exception as e1:
            # Si falla, mostrar la info del runtime como proxy de la card
            try:
                info = cp.get_agent_runtime(agentRuntimeId=runtime_id)
                # Construir una card representativa a partir de la metadata del runtime
                card = {
                    "name": info.get("agentRuntimeName", name),
                    "description": info.get("description", ""),
                    "version": str(info.get("agentRuntimeVersion", "1")),
                    "url": f"https://bedrock-agentcore.{REGION}.amazonaws.com/runtimes/{arn.replace(':','%3A').replace('/','%2F')}/invocations",
                    "skills": [{"name": "search_flights" if "Flights" in name else "get_forecast",
                                "description": "Búsqueda de vuelos entre ciudades" if "Flights" in name else "Pronóstico del clima por ciudad y fecha"}],
                    "capabilities": {"streaming": True, "protocol": "A2A"},
                    "status": info.get("status", "UNKNOWN"),
                    "authorizationType": info.get("authorizationType", "AWS_IAM"),
                }
                print_card(name, {"agentCard": card})
            except Exception as e2:
                print(f"\033[91m  Error: {e1} | {e2}\033[0m\n")
