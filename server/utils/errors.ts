export function createErrorBody(params: {
  code: string
  message: string
  fields?: Record<string, string[]>
  requestId?: string
}) {
  return {
    error: {
      code: params.code,
      message: params.message,
      fields: params.fields || {},
      request_id: params.requestId || crypto.randomUUID(),
    },
  }
}
