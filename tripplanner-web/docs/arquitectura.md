# TripPlanner AI — Documentación de Arquitectura

## 1. Visión general

TripPlanner AI es una aplicación web que combina inteligencia agéntica con arquitectura
distribuida sobre AWS. Evoluciona los tres agentes existentes (Orchestrator, Flights, Weather)
hacia una plataforma completa de planificación de viajes.

## 2. Dos canales independientes

### Canal 1 · Operaciones de negocio
```
Frontend → API Gateway → AWS Lambda → DynamoDB
```
Gestiona viajes, itinerarios y reservas mediante REST/JSON.

### Canal 2 · Interacción agéntica
```
Frontend → HTTP Streaming → Amazon Bedrock AgentCore → Orchestrator Agent
                                                      → Flight Agent (MCP Ignav)
                                                      → Weather Agent (MCP clima)
                                                      → Tools de negocio (Lambdas)
```
Chat con el asistente en tiempo real. El streaming va directo al OrchestratorAgent,
sin API Gateway como intermediario.

## 3. Componentes y responsabilidades

| Componente | Responsabilidad |
|---|---|
| Frontend (React) | Experiencia de usuario |
| Amazon S3 | Hosting del frontend |
| Amazon CloudFront | CDN y HTTPS (opcional) |
| Amazon API Gateway | Expone APIs REST del Canal 1 |
| AWS Lambda | Lógica de negocio y validaciones |
| Amazon DynamoDB | Persistencia compartida |
| Amazon Bedrock AgentCore | Ejecución de agentes |
| Strands Agents | Coordinación y comportamiento agéntico |
| MCP Ignav | Herramienta especializada de vuelos |
| MCP Clima | Herramienta especializada de clima |
| IAM | Seguridad y privilegios mínimos |

## 4. Modelo de datos DynamoDB

### Decisión de diseño: Single Table Design

Se usa una tabla única `tripplanner-main` con el patrón Single Table Design.
Justificación: reduce costos (una sola tabla), simplifica IAM y aprovecha
los patrones de acceso de DynamoDB con SK compuestas.

### Tabla: `tripplanner-main`

| PK | SK | Tipo de entidad |
|---|---|---|
| `USER#<userId>` | `PROFILE` | Perfil de usuario |
| `USER#<userId>` | `PREFS` | Preferencias del usuario |
| `USER#<userId>` | `TRIP#<tripId>` | Viaje del usuario |
| `TRIP#<tripId>` | `ITINERARY#<date>` | Día del itinerario |
| `TRIP#<tripId>` | `RESERVATION#<reservationId>` | Reserva del viaje |

### Atributos por entidad

**Usuario (PROFILE)**
- `userId` — ID único del usuario
- `email` — Correo electrónico
- `name` — Nombre completo
- `createdAt` — Fecha de registro

**Preferencias (PREFS)**
- `budget` — Presupuesto preferido
- `seatPreference` — Preferencia de asiento
- `airlinePreference` — Aerolínea preferida
- `activityTypes` — Tipos de actividades favoritas

**Viaje (TRIP)**
- `tripId` — ID único del viaje
- `origin` — Ciudad de origen
- `destination` — Ciudad de destino
- `startDate` — Fecha de salida (YYYY-MM-DD)
- `endDate` — Fecha de regreso
- `travelers` — Número de viajeros
- `budget` — Presupuesto total
- `status` — PLANNING | CONFIRMED | COMPLETED
- `createdAt` — Fecha de creación

**Itinerario (ITINERARY)**
- `date` — Fecha del día (YYYY-MM-DD)
- `activities` — Lista de actividades del día
- `notes` — Notas adicionales

**Reserva (RESERVATION)**
- `reservationId` — ID único de la reserva
- `type` — FLIGHT | HOTEL | ACTIVITY
- `status` — SIMULADA | PENDIENTE | CONFIRMADA
- `details` — Detalles específicos (vuelo, hotel o actividad)
- `price` — Precio
- `createdAt` — Fecha de registro

### Índice secundario global (GSI)

**GSI1:** `GSI1PK = userId, GSI1SK = createdAt`
Permite listar todos los viajes de un usuario ordenados por fecha.

## 5. APIs — Canal 1

### Base URL: `https://<api-id>.execute-api.us-east-2.amazonaws.com/prod`

| Método | Endpoint | Lambda | Descripción |
|---|---|---|---|
| POST | `/trips` | CreateTrip | Crear un viaje |
| GET | `/trips` | GetTrips | Listar viajes del usuario |
| PUT | `/trips/{tripId}` | UpdateTrip | Actualizar un viaje |
| POST | `/trips/{tripId}/itinerary` | CreateItinerary | Crear itinerario |
| PUT | `/trips/{tripId}/itinerary/{date}` | UpdateItinerary | Modificar itinerario |
| POST | `/trips/{tripId}/reservations` | CreateReservation | Registrar reserva |
| GET | `/trips/{tripId}/reservations` | GetReservations | Consultar reservas |
| PUT | `/trips/{tripId}/reservations/{id}` | UpdateReservation | Actualizar reserva |

## 6. Lambdas y Tools

Cada Tool del OrchestratorAgent invoca una Lambda via URL directa o API Gateway.

| Tool | Lambda | DynamoDB |
|---|---|---|
| CreateTrip | lambda-create-trip | Escribe TRIP |
| GetTrips | lambda-get-trips | Lee TRIP |
| UpdateTrip | lambda-update-trip | Actualiza TRIP |
| CreateItinerary | lambda-create-itinerary | Escribe ITINERARY |
| UpdateItinerary | lambda-update-itinerary | Actualiza ITINERARY |
| CreateReservation | lambda-create-reservation | Escribe RESERVATION |
| GetReservations | lambda-get-reservations | Lee RESERVATION |
| UpdateReservation | lambda-update-reservation | Actualiza RESERVATION |

## 7. Seguridad

- IAM con privilegios mínimos para cada Lambda y agente
- Sin credenciales AWS en el código del frontend
- Validación de tipos, rangos, fechas y estados en cada Lambda
- Control de acceso por usuario (cada usuario solo ve sus datos)
- CORS restringido y throttling en API Gateway
- Prohibido almacenar datos de tarjetas bancarias

## 8. Instrucciones de despliegue

```bash
# Backend
cd tripplanner-web/backend
sam build
sam deploy --guided

# Frontend
cd tripplanner-web/frontend
npm install
npm run build
aws s3 sync dist/ s3://<bucket-name>
```
