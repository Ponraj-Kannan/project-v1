/**
 * /api/topics
 *
 * Serverless API handler and Vite dev middleware for Topic management.
 * The topics table contains only: id, name, display_order.
 *
 * Methods:
 *   - GET: Retrieves all topics (ordered by display_order).
 *   - POST: (Admin only) Creates a new topic.
 *   - DELETE: (Admin only) Deletes an existing topic.
 */

import {
  getTopics,
  createTopic,
  deleteTopic,
  findUserByEmail,
  verifyGoogleToken
} from './_lib/supabase.js'

async function authenticateRequester(req) {
  const authHeader = req.headers.authorization
  const rawEmail = req.headers['x-user-email'] || req.body?.requesterEmail

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    if (rawEmail) return await findUserByEmail(rawEmail)
    return null
  }

  const token = authHeader.split(' ')[1]
  if (!token) return null

  if (token.startsWith('zoho:')) {
    if (rawEmail) return await findUserByEmail(rawEmail)
  }

  const googlePayload = await verifyGoogleToken(token)
  if (googlePayload && googlePayload.email) {
    const isVerified = googlePayload.email_verified === 'true' || googlePayload.email_verified === true
    if (!isVerified) return null
    return await findUserByEmail(googlePayload.email)
  }

  if (rawEmail) {
    return await findUserByEmail(rawEmail)
  }

  return null
}

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-email')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    // ── 1. GET: Fetch Topics ──────────────────────────────────────────────────
    if (req.method === 'GET') {
      const topics = await getTopics()
      return res.status(200).json({
        count: topics.length,
        topics: topics.map(t => ({
          id: t.id,
          name: t.name,
          display_order: t.display_order ?? 0
        }))
      })
    }

    // ── 2. Admin Authentication Check for Modifying Requests ──────────────────
    const requester = await authenticateRequester(req)

    if (!requester) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required.' })
    }

    if (requester.role !== 'admin') {
      return res.status(403).json({
        error: `Forbidden: Administrator role required to manage topics. Current role: '${requester.role}'.`
      })
    }

    // ── 3. POST: Create Topic ─────────────────────────────────────────────────
    if (req.method === 'POST') {
      const { name, display_order } = req.body || {}

      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Bad Request: Topic name is required.' })
      }

      const cleanName = name.trim()
      const topic = await createTopic({
        name: cleanName,
        display_order: Number.isInteger(display_order) ? display_order : undefined
      })

      return res.status(201).json({
        success: true,
        message: 'Topic created successfully.',
        topic: {
          id: topic.id,
          name: topic.name,
          display_order: topic.display_order ?? 0
        }
      })
    }

    // ── 4. DELETE: Remove Topic ───────────────────────────────────────────────
    if (req.method === 'DELETE') {
      const url = new URL(req.url, 'http://localhost')
      const id = url.searchParams.get('id') || req.query?.id || req.body?.id

      if (!id) {
        return res.status(400).json({ error: 'Bad Request: Topic id is required.' })
      }

      await deleteTopic(id)
      return res.status(200).json({
        success: true,
        message: 'Topic deleted successfully.'
      })
    }

    res.setHeader('Allow', 'GET, POST, DELETE')
    return res.status(405).json({ error: `Method '${req.method}' Not Allowed` })
  } catch (err) {
    console.error('Unhandled error in /api/topics:', err)
    return res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || String(err)
    })
  }
}
