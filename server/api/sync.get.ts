import { requireUser } from '../utils/auth'
import { getAllDocuments } from '../repositories/documents'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  const config = useRuntimeConfig(event)
  const configured = Boolean(config.public.supabaseUrl && config.public.supabaseAnonKey)
  if (!configured) {
    setResponseStatus(event, 503)
    return {
      mode: 'unconfigured',
      user,
      documents: null,
    }
  }
  const documents = await getAllDocuments(user.id, event.context.accessToken)
  return {
    mode: 'supabase',
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    },
    documents,
  }
})
