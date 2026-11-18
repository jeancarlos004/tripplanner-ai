// Configuración central de la aplicación
// Canal 1: API REST para operaciones de negocio
export const API_URL = 'https://azkojnthof.execute-api.us-east-2.amazonaws.com/prod'

// Canal 2: AgentCore para streaming agéntico
export const AGENTCORE_URL = 'https://bedrock-agentcore.us-east-2.amazonaws.com/runtimes/arn%3Aaws%3Abedrock-agentcore%3Aus-east-2%3A750708765285%3Aruntime%2Ftripplannera2a_OrchestratorAgent-IPoKfoDSPk/invocations'

export const AWS_REGION = 'us-east-2'

// Usuario por defecto (en producción vendría de Cognito)
export const DEFAULT_USER_ID = 'default-user'
