export class FoodaExceptionInfo {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly service: string = 'ia-service',
  ) {}
}

const SERVICE_PREFIX = 'IA';

export const FoodaExceptionCodes = {
  // Error Generico
  Ex0000: new FoodaExceptionInfo(
    `${SERVICE_PREFIX}-0000`,
    'Ha ocurrido un error desconocido en la solicitud.',
  ),
  Ex0001: new FoodaExceptionInfo(
    `${SERVICE_PREFIX}-0001`,
    'Ruta o recurso no encontrado',
  ),

  // Errores Generales (9000+)
  Ex9999: new FoodaExceptionInfo(
    `${SERVICE_PREFIX}-9999`,
    'Error interno del servidor.',
  ),

  // Errores de Validacion IA (1000-1999)
  Ex1000: new FoodaExceptionInfo(
    `${SERVICE_PREFIX}-1000`,
    'goal tiene que ser un string',
  ),
  Ex1001: new FoodaExceptionInfo(
    `${SERVICE_PREFIX}-1001`,
    'goal no puede estar vacio',
  ),
  Ex1002: new FoodaExceptionInfo(
    `${SERVICE_PREFIX}-1002`,
    'context tiene que ser un objeto',
  ),
  Ex1003: new FoodaExceptionInfo(
    `${SERVICE_PREFIX}-1003`,
    'options tiene que ser un objeto',
  ),
  Ex1004: new FoodaExceptionInfo(
    `${SERVICE_PREFIX}-1004`,
    'tenantId tiene que ser un string',
  ),
  Ex1005: new FoodaExceptionInfo(
    `${SERVICE_PREFIX}-1005`,
    'tenantId no puede estar vacio',
  ),
  Ex1006: new FoodaExceptionInfo(
    `${SERVICE_PREFIX}-1006`,
    'agentId tiene que ser un string',
  ),
  Ex1007: new FoodaExceptionInfo(
    `${SERVICE_PREFIX}-1007`,
    'agentId no puede estar vacio',
  ),
  Ex1008: new FoodaExceptionInfo(
    `${SERVICE_PREFIX}-1008`,
    'options.model tiene que ser un string',
  ),
  Ex1009: new FoodaExceptionInfo(
    `${SERVICE_PREFIX}-1009`,
    'options.temperature tiene que ser un numero',
  ),
  Ex1010: new FoodaExceptionInfo(
    `${SERVICE_PREFIX}-1010`,
    'options.tools tiene que ser un arreglo de strings',
  ),
  Ex1011: new FoodaExceptionInfo(
    `${SERVICE_PREFIX}-1011`,
    'sessionId tiene que ser un string',
  ),
  Ex1012: new FoodaExceptionInfo(
    `${SERVICE_PREFIX}-1012`,
    'sessionId no puede estar vacio',
  ),
  Ex1013: new FoodaExceptionInfo(
    `${SERVICE_PREFIX}-1013`,
    'options.provider tiene que ser un string',
  ),
  Ex1014: new FoodaExceptionInfo(
    `${SERVICE_PREFIX}-1014`,
    'options.fallbackProviders tiene que ser un arreglo de strings',
  ),
  Ex1015: new FoodaExceptionInfo(
    `${SERVICE_PREFIX}-1015`,
    'query from tiene que ser una fecha ISO valida',
  ),
  Ex1016: new FoodaExceptionInfo(
    `${SERVICE_PREFIX}-1016`,
    'query to tiene que ser una fecha ISO valida',
  ),

  // Errores de Ejecucion IA (2000-2999)
  Ex2000: new FoodaExceptionInfo(
    `${SERVICE_PREFIX}-2000`,
    'No existe configuracion para ese tenant y agente',
  ),
  Ex2001: new FoodaExceptionInfo(
    `${SERVICE_PREFIX}-2001`,
    'No se encontro el archivo de configuracion local para IA',
  ),
  Ex2002: new FoodaExceptionInfo(
    `${SERVICE_PREFIX}-2002`,
    'El archivo de configuracion local para IA es invalido',
  ),
  Ex2003: new FoodaExceptionInfo(
    `${SERVICE_PREFIX}-2003`,
    'MONGO_URI no esta configurado para trazabilidad de IA',
  ),
  Ex2004: new FoodaExceptionInfo(
    `${SERVICE_PREFIX}-2004`,
    'No se pudo persistir la traza de ejecucion IA en MongoDB',
  ),

  // Errores de Politicas y Streaming IA (3000-3999)
  Ex3000: new FoodaExceptionInfo(
    `${SERVICE_PREFIX}-3000`,
    'La solicitud fue bloqueada por politicas de guardrail de entrada',
  ),
  Ex3001: new FoodaExceptionInfo(
    `${SERVICE_PREFIX}-3001`,
    'La respuesta fue bloqueada por politicas de guardrail de salida',
  ),
  Ex3002: new FoodaExceptionInfo(
    `${SERVICE_PREFIX}-3002`,
    'Error durante la transmision streaming del agente',
  ),
  Ex3003: new FoodaExceptionInfo(
    `${SERVICE_PREFIX}-3003`,
    'No se pudo persistir memoria de sesion en MongoDB',
  ),

  // Errores de Proveedor/Plantillas/Metricas IA (4000-4999)
  Ex4000: new FoodaExceptionInfo(
    `${SERVICE_PREFIX}-4000`,
    'No hay proveedores disponibles para ejecutar la solicitud',
  ),
  Ex4001: new FoodaExceptionInfo(
    `${SERVICE_PREFIX}-4001`,
    'La plantilla de agente configurada no existe',
  ),
  Ex4002: new FoodaExceptionInfo(
    `${SERVICE_PREFIX}-4002`,
    'No se pudieron persistir metricas de uso por tenant',
  ),
};
