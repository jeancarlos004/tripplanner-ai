# 🚀 Guía de Inicio Rápido - Trip Planner A2A

Esta guía te llevará de cero a tener el sistema funcionando en AWS en ~15 minutos.

## ⚡ Pasos Rápidos

### 1. Verificar Prerrequisitos

```powershell
# Verificar Python
python --version  # Debe ser 3.10+

# Verificar AWS CLI
aws --version

# Verificar agentcore
agentcore --help

# Verificar credenciales AWS
aws sts get-caller-identity
```

### 2. Instalar Dependencias

```powershell
# Navegar al proyecto
cd "C:\Users\USUARIO\Desktop\WORKSHOP A2A"

# Instalar dependencias
pip install -r requirements.txt
```

### 3. Validar y Desplegar (Método Manual)

```powershell
# Paso 1: Validar configuración
agentcore validate

# Paso 2: Desplegar todos los agentes
agentcore deploy

# Paso 3: Obtener URLs de los especialistas
agentcore status
```

**Copia las URLs** que aparecen para `FlightsAgent` y `WeatherAgent`.

### 4. Actualizar URLs del Orquestador

Edita `agentcore.json` y actualiza estas líneas:

```json
"envVars": [
  {
    "name": "FLIGHTS_AGENT_URL",
    "value": "https://xxxxx.execute-api.us-east-1.amazonaws.com/"
  },
  {
    "name": "WEATHER_AGENT_URL",
    "value": "https://yyyyy.execute-api.us-east-1.amazonaws.com/"
  }
]
```

### 5. Redesplegar Orquestador

```powershell
agentcore deploy
```

### 6. Probar el Sistema

```powershell
agentcore invoke --runtime OrchestratorAgent --payload '{\"prompt\": \"Quiero viajar de Bogotá a Cartagena este fin de semana. ¿Qué vuelos hay y cómo estará el clima?\"}'
```

---

## 🎯 Usando el Script de Ayuda (Alternativa Rápida)

El proyecto incluye un script PowerShell que automatiza el proceso:

```powershell
# Ver ayuda
.\deploy.ps1

# Validar configuración
.\deploy.ps1 -Action validate

# Desplegar todos los agentes
.\deploy.ps1 -Action deploy

# Ver estado y URLs
.\deploy.ps1 -Action status

# Actualizar URLs interactivamente
.\deploy.ps1 -Action update-urls

# Probar el sistema
.\deploy.ps1 -Action invoke

# Ver logs
.\deploy.ps1 -Action logs
```

---

## 🧪 Ejemplos de Pruebas

### Prueba 1: Vuelos y Clima

```powershell
.\deploy.ps1 -Action invoke -Prompt "Quiero viajar de Bogotá a Cartagena este fin de semana"
```

### Prueba 2: Solo Vuelos

```powershell
.\deploy.ps1 -Action invoke -Prompt "Busca vuelos de Bogotá a Medellín para mañana"
```

### Prueba 3: Solo Clima

```powershell
.\deploy.ps1 -Action invoke -Prompt "¿Cómo estará el clima en Cartagena el sábado?"
```

### Prueba 4: Consulta Compleja

```powershell
.\deploy.ps1 -Action invoke -Prompt "Necesito viajar a Medellín la próxima semana, quiero saber vuelos disponibles y si necesito llevar paraguas"
```

---

## 🔍 Verificar Agent Cards

Las agent cards se publican automáticamente en `/.well-known/agent-card.json`:

```powershell
# Ver agent card del FlightsAgent
curl https://[TU-FLIGHTS-URL]/.well-known/agent-card.json

# Ver agent card del WeatherAgent
curl https://[TU-WEATHER-URL]/.well-known/agent-card.json
```

**Deberías ver** la estructura JSON con:
- `name`: Nombre del agente
- `description`: Descripción de sus capacidades
- `skills`: Lista de herramientas que expone

---

## 📊 Monitoreo y Debugging

### Ver Logs en Tiempo Real

```powershell
# Logs del orquestador
agentcore logs --runtime OrchestratorAgent --follow

# Logs de un especialista
agentcore logs --runtime FlightsAgent --follow
```

### Ver Trazas de Invocaciones

```powershell
# Listar todas las trazas
agentcore traces list

# Ver detalles de una traza específica
agentcore traces get --trace-id [ID]
```

### Estado de los Agentes

```powershell
# Estado detallado
agentcore status --verbose

# Estado de un agente específico
agentcore status --runtime OrchestratorAgent
```

---

## 🧹 Limpiar y Eliminar

Cuando termines de probar:

```powershell
# Con el script
.\deploy.ps1 -Action cleanup

# O manualmente
agentcore delete --all
```

---

## ❓ Troubleshooting

### Error: "FLIGHTS_AGENT_URL no está configurado"

**Problema:** Las URLs de los especialistas no están configuradas en el orquestador.

**Solución:**
1. Ejecuta `agentcore status` para obtener las URLs
2. Actualiza `agentcore.json` con las URLs correctas
3. Redespliega: `agentcore deploy`

### Error: "Agent card not found"

**Problema:** El agente especialista no está desplegado o no responde.

**Solución:**
1. Verifica que el agente esté ACTIVE: `agentcore status`
2. Verifica la conectividad: `curl https://[URL]/.well-known/agent-card.json`
3. Revisa los logs: `agentcore logs --runtime [AGENT_NAME]`

### Error: "Timeout waiting for response"

**Problema:** El LLM está tardando mucho en responder.

**Solución:**
1. Verifica que los modelos de Bedrock estén habilitados
2. Simplifica el prompt de prueba
3. Revisa las cuotas y límites de tu cuenta AWS

### Error al desplegar: "ValidationException"

**Problema:** Hay un error en `agentcore.json`.

**Solución:**
1. Ejecuta `agentcore validate` para detalles
2. Verifica la sintaxis JSON
3. Asegúrate de que todas las rutas de archivos existan

---

## 📚 Próximos Pasos

Una vez que todo funcione:

1. **Lee el README completo** para entender la arquitectura A2A
2. **Experimenta con diferentes prompts** para ver cómo el LLM decide qué agentes invocar
3. **Inspecciona las agent cards** para ver el contrato que exponen los agentes
4. **Revisa los logs y trazas** para entender el flujo de mensajes A2A
5. **Prueba los retos adicionales** en el README

---

## 🎓 Conceptos Clave que Aprendiste

✅ **Protocolo A2A**: Estándar para colaboración entre agentes  
✅ **Agent Cards**: Descubrimiento de capacidades  
✅ **Servidor A2A**: Exponer agentes como servicios  
✅ **Cliente A2A**: Invocar agentes remotos  
✅ **Orquestación**: Coordinar múltiples especialistas  
✅ **Separación de responsabilidades**: Un agente, una competencia  

---

¡Listo para comenzar! 🚀

Para más detalles, consulta el [README.md](README.md) completo.
