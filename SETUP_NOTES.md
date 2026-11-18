# 🔧 Notas de Configuración - Trip Planner A2A

## ✅ Configuración Completada

El proyecto ahora está correctamente configurado para AWS Bedrock AgentCore.

### Estructura de Archivos de Configuración

```
agentcore/
├── agentcore.json      # Configuración del proyecto y runtimes
└── aws-targets.json    # Configuración de despliegue AWS
```

### agentcore/agentcore.json

Este archivo define:
- **Nombre del proyecto**: `tripplannera2a` (solo alfanuméricos)
- **Versión**: `1`
- **Runtimes**: Los tres agentes (Flights, Weather, Orchestrator)
- **Rutas de código**: Relativas desde `agentcore/` → `../app/[AgentName]/`

### agentcore/aws-targets.json

Este archivo define el destino de despliegue:
- **name**: `"default"` - Nombre del target
- **account**: `"750708765285"` - Tu account ID de AWS
- **region**: `"us-east-1"` - Región de AWS
- **modelId**: `"us.amazon.nova-lite-v1:0"` - Modelo de Bedrock a usar

## 🚀 Verificación Exitosa

```powershell
PS C:\Users\USUARIO\Desktop\WORKSHOP A2A> agentcore validate
Valid
```

✅ La configuración es válida y lista para desplegar.

## 📋 Próximos Pasos

### 1. Desplegar los Agentes Especialistas

```powershell
agentcore deploy
```

Este comando desplegará los tres agentes a AWS.

### 2. Obtener las URLs de los Especialistas

```powershell
agentcore status
```

Busca las URLs de:
- `FlightsAgent`
- `WeatherAgent`

### 3. Actualizar las Variables de Entorno

Edita `agentcore/agentcore.json` y actualiza las `envVars` del `OrchestratorAgent`:

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

### 4. Redesplegar el Orquestador

```powershell
agentcore deploy
```

### 5. Probar el Sistema

```powershell
agentcore invoke --runtime OrchestratorAgent --payload '{"prompt": "Quiero viajar de Bogotá a Cartagena este fin de semana. ¿Qué vuelos hay y cómo estará el clima?"}'
```

## ⚠️ Notas Importantes

### Cambios Realizados

1. **Estructura de directorios**: Se creó el directorio `agentcore/` que contiene los archivos de configuración
2. **agentcore.json**: Ajustado al formato requerido por el CLI
   - Agregado `name` y `version` a nivel raíz
   - Modificadas las rutas de código para ser relativas desde `agentcore/`
   - Removidos campos no soportados (`schemaVersion`, `metadata`)
3. **aws-targets.json**: Creado con tu account ID y configuración de región/modelo

### Formato del Nombre del Proyecto

El nombre debe:
- Comenzar con una letra
- Contener solo caracteres alfanuméricos (sin guiones ni guiones bajos)
- En nuestro caso: `tripplannera2a`

### Rutas de Código

Las rutas en `codeLocation` son relativas al directorio `agentcore/`:
- `../app/FlightsAgent/` apunta a `WORKSHOP A2A/app/FlightsAgent/`
- `../app/WeatherAgent/` apunta a `WORKSHOP A2A/app/WeatherAgent/`
- `../app/OrchestratorAgent/` apunta a `WORKSHOP A2A/app/OrchestratorAgent/`

## 🎯 Estado Actual

✅ Configuración válida  
✅ Dependencias instaladas  
✅ Código de los agentes implementado  
⏭️ Listo para desplegar

---

Para más detalles, consulta:
- `README.md` - Documentación completa
- `QUICKSTART.md` - Guía rápida de 15 minutos
- `VALIDATION_CHECKLIST.md` - Lista de verificación paso a paso
