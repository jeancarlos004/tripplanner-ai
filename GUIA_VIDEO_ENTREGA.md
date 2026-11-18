# 🎬 Guía de Video — Entrega Workshop Trip Planner A2A

Duración sugerida: **10–15 minutos**

---

## PARTE 1 — Código (~5 min)

### 1.1 Abrir en Kiro IDE y mostrar la estructura del proyecto

```
tripplannera2a/
├── agentcore/
│   ├── agentcore.json          ← configuración de los 3 runtimes
│   └── aws-targets.json        ← cuenta AWS y región
├── app/
│   ├── FlightsAgent/main.py    ← Servidor A2A (especialista)
│   ├── WeatherAgent/main.py    ← Servidor A2A (especialista)
│   └── OrchestratorAgent/main.py ← Cliente A2A (coordinador)
└── invoke.py                   ← cliente de demostración
```

### 1.2 Explicar FlightsAgent (abrir app/FlightsAgent/main.py)

Puntos a mencionar:

- **`@tool def search_flights(...)`** — la capacidad que expone el agente.
  Datos simulados (mock) para el workshop, sin dependencias externas.

- **`create_agent(context_id)`** — factory function. Cada `context_id`
  es una conversación independiente → aislamiento de estado.

- **`A2AServer(agent_factory=create_agent)`** — envuelve el agente en un
  servidor A2A que publica automáticamente la agent card y atiende
  mensajes JSON-RPC del protocolo A2A.

- **Protocolo A2A**: este agente NO importa código del orquestador.
  Solo conoce su propia responsabilidad: buscar vuelos.

### 1.3 Explicar WeatherAgent (abrir app/WeatherAgent/main.py)

Puntos a mencionar:

- Mismo patrón que FlightsAgent, distinta competencia.
- **`@tool def get_forecast(city, date)`** — pronóstico simulado por ciudad.
- Independiente: podría estar escrito por otro equipo, en otro lenguaje.

### 1.4 Explicar OrchestratorAgent (abrir app/OrchestratorAgent/main.py)

Puntos clave a mostrar en pantalla:

```python
# 1. Los URLs de los especialistas vienen de variables de entorno
FLIGHTS_URL = os.environ.get("FLIGHTS_AGENT_URL", "")
WEATHER_URL = os.environ.get("WEATHER_AGENT_URL", "")

# 2. Cada tool invoca al especialista via A2A (JSON-RPC + SigV4)
@tool
def ask_flights(request: str) -> str:
    return _invoke_a2a_runtime(FLIGHTS_URL, request)

@tool
def ask_weather(request: str) -> str:
    return _invoke_a2a_runtime(WEATHER_URL, request)

# 3. El LLM decide cuándo llamar a cada tool
def build_agent() -> Agent:
    return Agent(
        system_prompt=SYSTEM_PROMPT,
        tools=[ask_flights, ask_weather],
        ...
    )
```

- **El orquestador NUNCA importa el código de los especialistas.**
  Solo conoce sus URLs. Eso es el desacoplamiento A2A.

- `_invoke_a2a_runtime()` construye un mensaje JSON-RPC A2A y lo firma
  con SigV4 para autenticar ante AgentCore.

- `@app.entrypoint` → punto de entrada del runtime AgentCore.

### 1.5 Mostrar agentcore.json (abrir agentcore/agentcore.json)

```json
{
  "runtimes": [
    { "name": "FlightsAgent",  "protocol": "A2A", ... },
    { "name": "WeatherAgent",  "protocol": "A2A", ... },
    { "name": "OrchestratorAgent", "protocol": "HTTP",
      "additionalPolicies": ["invoke-specialists-policy.json"],
      "envVars": [
        { "name": "FLIGHTS_AGENT_URL", "value": "https://..." },
        { "name": "WEATHER_AGENT_URL", "value": "https://..." }
      ]
    }
  ]
}
```

- Los especialistas usan `protocol: A2A` → AgentCore los expone como
  servidores A2A con agent card pública.
- El orquestador usa `protocol: HTTP` → es el punto de entrada del usuario.
- `additionalPolicies` → IAM policy que permite al orquestador invocar
  a los especialistas.

---

## PARTE 2 — Despliegue en AWS (~4 min)

### 2.1 Mostrar la cuenta AWS

Abrir una terminal y ejecutar:

```powershell
aws sts get-caller-identity
```

Mostrar en pantalla:
- **Account**: `750708765285`
- **UserId** / **Arn**

### 2.2 Mostrar el estado del despliegue

```powershell
cd "C:\Users\USUARIO\Desktop\WORKSHOP A2A\tripplannera2a"
agentcore status
```

Salida esperada:
```
FlightsAgent:      Deployed - Runtime: READY  (arn:...FlightsAgent-MZwYNpFz5J)
WeatherAgent:      Deployed - Runtime: READY  (arn:...WeatherAgent-0uRzDWA45L)
OrchestratorAgent: Deployed - Runtime: READY  (arn:...OrchestratorAgent-IPoKfoDSPk)
```

### 2.3 Abrir la consola AWS y mostrar los runtimes

URL directa a AgentCore Runtime:
```
https://us-east-2.console.aws.amazon.com/bedrock/home?region=us-east-2#/agentcore/runtime
```

Mostrar:
- Los 3 runtimes en estado ACTIVE/READY
- El número de cuenta en la esquina superior derecha

### 2.4 Mostrar el proceso de despliegue (opcional, resumido)

```powershell
# Validar antes de deployar
agentcore validate

# Deployar
agentcore deploy
```

Mencionar el flujo:
1. `agentcore validate` → verifica el esquema JSON
2. CDK sintetiza CloudFormation
3. Se empaqueta el código (CodeZip) y se sube a S3
4. CloudFormation despliega los 3 runtimes en AgentCore

### 2.5 Mostrar el IAM — permisos A2A

Abrir en consola AWS:
```
https://console.aws.amazon.com/iam/home#/roles/AgentCore-tripplannera2a--ApplicationAgentOrchestra-WtdLMpfoUjnj
```

Mostrar la política `AdditionalCustomPolicy` que permite
`bedrock-agentcore:InvokeAgentRuntime` en los runtimes especialistas.

---

## PARTE 3 — Demo del Agente (~4 min)

### 3.1 Playground en la consola AWS

URL directa al playground del OrchestratorAgent:
```
https://us-east-2.console.aws.amazon.com/bedrock/home?region=us-east-2#/agentcore/runtime/tripplannera2a_OrchestratorAgent-IPoKfoDSPk
```

O navegar: **Amazon Bedrock → AgentCore → Runtime → OrchestratorAgent → Test**

### 3.2 Prompts para demostrar en el Playground

**Prompt 1 — Caso principal del workshop:**
```
Quiero viajar de Bogotá a Cartagena el próximo fin de semana.
¿Qué vuelos hay y cómo estará el clima?
```

**Prompt 2 — Solo vuelos:**
```
Busca vuelos de Bogotá a Medellín para el 25 de septiembre
```

**Prompt 3 — Solo clima:**
```
¿Cómo estará el clima en Cartagena este sábado?
```

**Prompt 4 — Consulta completa con fecha explícita:**
```
Vuelos y clima de Bogotá a Cartagena el 21 de septiembre de 2026
```

### 3.3 Demo alternativa desde terminal (invoke.py)

Si el Playground no está disponible, usar el cliente de consola:

```powershell
cd "C:\Users\USUARIO\Desktop\WORKSHOP A2A\tripplannera2a"

# Consulta principal
python invoke.py "Vuelos y clima de Bogota a Cartagena el 21 de septiembre de 2026"

# Ver agent cards de los especialistas
python check_agent_card.py
```

### 3.4 Mostrar los logs para evidenciar la colaboración A2A

```powershell
agentcore logs --runtime OrchestratorAgent --since 5m --limit 20
```

Señalar en los logs:
- Las URLs de FlightsAgent y WeatherAgent configuradas
- Las invocaciones entrantes al orquestador

```powershell
agentcore traces list --runtime OrchestratorAgent
```

### 3.5 Puntos clave a mencionar en la demo

1. **El usuario habla solo con el OrchestratorAgent** — los especialistas
   son invisibles para él.

2. **El LLM del orquestador decide** cuándo llamar a `ask_flights` y
   cuándo a `ask_weather` basándose en el contexto de la petición.

3. **Los especialistas son independientes** — FlightsAgent y WeatherAgent
   podrían estar escritos en otro lenguaje o desplegados por otro equipo.
   Mientras expongan una agent card A2A válida, el orquestador los puede
   invocar sin cambios.

4. **Protocolo estándar A2A** — JSON-RPC sobre HTTPS, con autenticación
   SigV4, entre runtimes en la misma cuenta AWS.

---

## Checklist antes de grabar

- [ ] Terminal abierta en `tripplannera2a/`
- [ ] Kiro IDE con los 3 archivos `main.py` visibles
- [ ] `agentcore status` muestra los 3 runtimes READY
- [ ] `python invoke.py "..."` responde correctamente
- [ ] `python check_agent_card.py` muestra las cards
- [ ] Consola AWS abierta con la cuenta `750708765285` visible
- [ ] Playground de AgentCore abierto y listo

---

## Comandos de referencia rápida

```powershell
# Estado de los agentes
agentcore status

# Demo principal
python invoke.py "Vuelos y clima de Bogota a Cartagena el 21 de septiembre de 2026"

# Agent cards
python check_agent_card.py

# Logs del orquestador
agentcore logs --runtime OrchestratorAgent --since 10m --limit 30

# Trazas
agentcore traces list --runtime OrchestratorAgent

# Cuenta AWS
aws sts get-caller-identity
```
