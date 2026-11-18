# ✅ Correcciones Aplicadas al Proyecto

## Problema Inicial

```powershell
PS C:\Users\USUARIO\Desktop\WORKSHOP A2A> agentcore validate
No agentcore project found. Run "agentcore create" first.
```

## Causa

El CLI de AgentCore requiere una estructura específica de archivos y formato JSON particular que difiere de la documentación inicial del workshop.

## Soluciones Implementadas

### 1. Estructura de Directorios Corregida

**Antes:**
```
WORKSHOP A2A/
├── agentcore.json
├── requirements.txt
└── app/...
```

**Después:**
```
WORKSHOP A2A/
├── agentcore/
│   ├── agentcore.json      ✅ Movido aquí
│   └── aws-targets.json    ✅ Nuevo archivo requerido
├── requirements.txt
└── app/...
```

### 2. Formato de agentcore.json Corregido

**Antes:**
```json
{
  "runtimes": [...],
  "schemaVersion": "1.0",
  "metadata": {...}
}
```

**Después:**
```json
{
  "name": "tripplannera2a",      ← Requerido: solo alfanumérico
  "version": 1,                  ← Requerido: número
  "runtimes": [...]              ← Sin schemaVersion ni metadata
}
```

### 3. Rutas de Código Ajustadas

Las rutas ahora son relativas al directorio `agentcore/`:

```json
"codeLocation": "../app/FlightsAgent/"     ← Antes: "app/FlightsAgent/"
"codeLocation": "../app/WeatherAgent/"     ← Antes: "app/WeatherAgent/"
"codeLocation": "../app/OrchestratorAgent/" ← Antes: "app/OrchestratorAgent/"
```

### 4. Archivo aws-targets.json Creado

Nuevo archivo requerido por el CLI:

```json
[
  {
    "name": "default",
    "account": "750708765285",              ← Tu AWS Account ID
    "region": "us-east-1",
    "modelId": "us.amazon.nova-lite-v1:0"
  }
]
```

### 5. Variables de Entorno Simplificadas

**Antes:**
```json
"envVars": [
  {
    "name": "FLIGHTS_AGENT_URL",
    "value": "https://",
    "description": "URL del FlightsAgent..."  ← Campo extra no soportado
  }
]
```

**Después:**
```json
"envVars": [
  {
    "name": "FLIGHTS_AGENT_URL",
    "value": "https://"                      ← Solo name y value
  }
]
```

## Restricciones Identificadas

### Nombre del Proyecto
- ❌ No puede contener guiones: `trip-planner-a2a`
- ❌ No puede contener guiones bajos: `trip_planner_a2a`
- ✅ Solo alfanuméricos: `tripplannera2a`
- ✅ Debe comenzar con letra

### Estructura de Archivos
- ✅ `agentcore/agentcore.json` (obligatorio)
- ✅ `agentcore/aws-targets.json` (obligatorio)
- ✅ Los archivos de código pueden estar fuera de `agentcore/`

### Campos en agentcore.json
- ✅ Campos requeridos: `name`, `version`, `runtimes`
- ❌ Campos no soportados: `schemaVersion`, `metadata`, `deploymentNotes`
- ✅ En envVars: solo `name` y `value` (no `description`)

## Resultado Final

```powershell
PS C:\Users\USUARIO\Desktop\WORKSHOP A2A> agentcore validate
Valid
```

✅ **Proyecto listo para desplegar**

## Archivos Actualizados

1. ✅ `agentcore/agentcore.json` - Formato corregido
2. ✅ `agentcore/aws-targets.json` - Archivo nuevo creado
3. ✅ `README.md` - Documentación actualizada
4. ✅ `SETUP_NOTES.md` - Guía de configuración creada

## Comando Siguiente

```powershell
# Desplegar todos los agentes
agentcore deploy

# Ver estado después del despliegue
agentcore status

# Invocar el orquestador
agentcore invoke --runtime OrchestratorAgent --payload '{"prompt": "..."}'
```

## Lecciones Aprendidas

1. **El CLI tiene requisitos estrictos**: No todos los campos JSON son válidos
2. **La estructura de directorios importa**: Los archivos deben estar en `agentcore/`
3. **El nombre del proyecto tiene restricciones**: Solo alfanuméricos, sin separadores
4. **aws-targets.json es obligatorio**: Incluso si usas configuración por defecto
5. **Las rutas son relativas**: Desde el directorio `agentcore/`, no desde la raíz

## Referencias

- Schema oficial: AWS Bedrock AgentCore CLI Documentation
- Comando de ayuda: `agentcore --help`
- Validación: `agentcore validate` (ejecutar antes de cada deploy)

---

**Estado:** ✅ Todas las correcciones aplicadas y validadas  
**Fecha:** 19 de Septiembre, 2026  
**Próximo paso:** `agentcore deploy`
