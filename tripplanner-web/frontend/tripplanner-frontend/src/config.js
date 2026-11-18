// Configuración central (se inyecta en build desde .env.production / .env.local).
// No contiene secretos: solo identificadores públicos. NINGUNA clave AWS en el navegador.

const env = import.meta.env

export const AWS_REGION = env.VITE_AWS_REGION || 'us-east-2'

// Canal 1: API REST (API Gateway → Lambda → DynamoDB), protegida con Cognito
export const API_URL = (env.VITE_API_URL || '').replace(/\/$/, '')

// Canal 2: HTTP streaming directo a AgentCore (sin API Gateway)
const ORCHESTRATOR_ARN = env.VITE_ORCHESTRATOR_ARN || ''
export const AGENTCORE_URL = ORCHESTRATOR_ARN
  ? `https://bedrock-agentcore.${AWS_REGION}.amazonaws.com/runtimes/${encodeURIComponent(ORCHESTRATOR_ARN)}/invocations`
  : ''

// Cognito
export const USER_POOL_ID     = env.VITE_USER_POOL_ID || ''
export const USER_POOL_CLIENT = env.VITE_USER_POOL_CLIENT_ID || ''
export const IDENTITY_POOL_ID = env.VITE_IDENTITY_POOL_ID || ''

export const CONFIG_OK = Boolean(API_URL && ORCHESTRATOR_ARN && USER_POOL_ID && USER_POOL_CLIENT && IDENTITY_POOL_ID)
