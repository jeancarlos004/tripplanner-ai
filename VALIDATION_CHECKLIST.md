# ✅ Lista de Verificación - Trip Planner A2A

Usa esta lista para verificar que el proyecto esté correctamente configurado antes de desplegar.

## 📋 Pre-Despliegue

### Archivos del Proyecto
- [x] `agentcore.json` - Configuración de runtimes
- [x] `requirements.txt` - Dependencias Python
- [x] `app/FlightsAgent/main.py` - Agente de vuelos
- [x] `app/WeatherAgent/main.py` - Agente de clima
- [x] `app/OrchestratorAgent/main.py` - Agente orquestador
- [x] `.gitignore` - Exclusiones de Git
- [x] `deploy.ps1` - Script de automatización
- [x] `README.md` - Documentación completa
- [x] `QUICKSTART.md` - Guía rápida
- [x] `PROJECT_SUMMARY.md` - Resumen del proyecto

### Prerrequisitos del Sistema
- [ ] Python 3.10+ instalado
- [ ] AWS CLI configurado
- [ ] agentcore CLI instalado
- [ ] Credenciales AWS válidas
- [ ] Acceso a Amazon Bedrock habilitado

### Verificar Prerrequisitos
Ejecuta estos comandos para verificar:

```powershell
# Python
python --version

# AWS CLI
aws --version
aws sts get-caller-identity

# agentcore
agentcore --help

# Bedrock (verificar región y modelos disponibles)
aws bedrock list-foundation-models --region us-east-1
```

## 🔍 Validación de Configuración

### 1. Validar agentcore.json
```powershell
agentcore validate
```
**Esperado:** ✅ Configuration is valid

### 2. Validar Estructura de Archivos
```powershell
Get-ChildItem -Recurse -File | Select-Object FullName
```
**Esperado:** 10 archivos en total

### 3. Instalar Dependencias
```powershell
pip install -r requirements.txt
```
**Esperado:** Todas las dependencias instaladas sin errores

### 4. Verificar Sintaxis Python
```powershell
python -m py_compile app/FlightsAgent/main.py
python -m py_compile app/WeatherAgent/main.py
python -m py_compile app/OrchestratorAgent/main.py
```
**Esperado:** Sin errores de sintaxis

## 🚀 Lista de Verificación de Despliegue

### Fase 1: Despliegue Inicial
- [ ] Ejecutar `agentcore validate`
- [ ] Ejecutar `agentcore deploy`
- [ ] Esperar a que los 3 runtimes estén desplegados
- [ ] Verificar estado con `agentcore status`

### Fase 2: Configuración de URLs
- [ ] Copiar URL de FlightsAgent
- [ ] Copiar URL de WeatherAgent
- [ ] Actualizar `agentcore.json` con las URLs
- [ ] Guardar cambios

### Fase 3: Redespliegue del Orquestador
- [ ] Ejecutar `agentcore deploy` de nuevo
- [ ] Verificar que OrchestratorAgent tenga las URLs configuradas
- [ ] Confirmar estado ACTIVE con `agentcore status`

## 🧪 Lista de Verificación de Pruebas

### Pruebas Básicas
- [ ] Invocar con prompt de vuelos + clima
- [ ] Invocar con prompt solo de vuelos
- [ ] Invocar con prompt solo de clima
- [ ] Verificar respuestas consolidadas correctas

### Pruebas de Agent Cards
- [ ] Verificar agent card de FlightsAgent
- [ ] Verificar agent card de WeatherAgent
- [ ] Confirmar que incluyan los skills correctos

### Pruebas de Integración A2A
- [ ] Verificar logs del orquestador
- [ ] Confirmar invocaciones A2A a FlightsAgent
- [ ] Confirmar invocaciones A2A a WeatherAgent
- [ ] Verificar trazas con `agentcore traces list`

### Comandos de Prueba

#### Prueba 1: Integración Completa
```powershell
agentcore invoke --runtime OrchestratorAgent --payload '{\"prompt\": \"Quiero viajar de Bogotá a Cartagena este fin de semana. ¿Qué vuelos hay y cómo estará el clima?\"}'
```
**Esperado:** Respuesta con vuelos Y clima consolidados

#### Prueba 2: Solo Vuelos
```powershell
.\deploy.ps1 -Action invoke -Prompt "Busca vuelos de Bogotá a Medellín"
```
**Esperado:** Solo información de vuelos

#### Prueba 3: Solo Clima
```powershell
.\deploy.ps1 -Action invoke -Prompt "¿Cómo estará el clima en Cartagena?"
```
**Esperado:** Solo información del clima

#### Prueba 4: Agent Card FlightsAgent
```powershell
curl https://[URL-FLIGHTS]/.well-known/agent-card.json
```
**Esperado:** JSON con skill "search_flights"

#### Prueba 5: Agent Card WeatherAgent
```powershell
curl https://[URL-WEATHER]/.well-known/agent-card.json
```
**Esperado:** JSON con skill "get_forecast"

## 📊 Criterios de Éxito

### ✅ Despliegue Exitoso
- Todos los runtimes en estado ACTIVE
- URLs de especialistas configuradas correctamente
- Sin errores en los logs

### ✅ Funcionalidad A2A
- Agent cards publicadas y accesibles
- Orquestador invoca especialistas correctamente
- Respuestas consolidadas coherentes

### ✅ Integración Completa
- LLM decide qué agentes invocar según el contexto
- Streaming de respuestas funciona
- Manejo de errores apropiado

## 🔧 Troubleshooting Rápido

### Problema: agentcore validate falla
**Solución:** Revisar sintaxis JSON en `agentcore.json`

### Problema: Deploy falla
**Solución:** 
1. Verificar credenciales AWS
2. Verificar acceso a Bedrock
3. Revisar logs con `agentcore logs`

### Problema: URLs no se actualizan
**Solución:**
1. Asegurarse de guardar `agentcore.json`
2. Ejecutar `agentcore deploy` de nuevo
3. Verificar con `agentcore status`

### Problema: Agent card no se encuentra
**Solución:**
1. Verificar que el agente esté ACTIVE
2. Verificar URL correcta (incluir el trailing slash)
3. Probar con curl para ver el error exacto

### Problema: Orquestador no invoca especialistas
**Solución:**
1. Verificar que las envVars estén configuradas
2. Revisar logs del orquestador
3. Verificar conectividad de red

## 📈 Métricas de Validación

Al final del despliegue, deberías tener:

- ✅ **3 runtimes** desplegados y ACTIVE
- ✅ **2 agent cards** publicadas y accesibles
- ✅ **4 tools** funcionando (2 en especialistas, 2 en orquestador)
- ✅ **100% de pruebas** pasando
- ✅ **0 errores** en logs críticos

## 🎯 Siguiente Paso

Si todo en esta lista está ✅, estás listo para:

1. **Experimentar** con diferentes prompts
2. **Revisar** logs y trazas para entender el flujo A2A
3. **Extender** el sistema con nuevos especialistas
4. **Probar** los retos adicionales del README

---

## 📞 Referencias Rápidas

- **Ayuda del script:** `.\deploy.ps1`
- **Documentación completa:** `README.md`
- **Inicio rápido:** `QUICKSTART.md`
- **Resumen del proyecto:** `PROJECT_SUMMARY.md`

---

**¡Todo listo para comenzar con A2A!** 🚀

Marca cada casilla a medida que completes los pasos.
