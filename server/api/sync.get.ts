import { requireUser } from '../utils/auth'
import { hasDb, useDb } from '../utils/db'
import { getAllDocuments } from '../repositories/documents'

export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  if (!hasDb(event)) {
    return { mode: 'local', user, documents: null }
  }
  const db = useDb(event)
  const documents = await getAllDocuments(db, user.id)
  return {
    mode: 'd1',
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    },
    documents,
  }
})
