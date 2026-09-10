/**
 * /api/questions
 *
 * Serverless API handler and Vite dev middleware for Question Bank queries and maintenance.
 *
 * Methods:
 *   - GET: Retrieves questions from Supabase (ordered by display_order).
 *          Optional query params: `?slug=...` or `?id=...` or `?include_inactive=true`
 *   - POST: (Admin only) Creates or updates a question.
 */

import {
  getQuestions,
  getQuestionByIdOrSlug,
  getTopics,
  createTopic,
  upsertQuestion,
  deleteQuestion,
  reorderQuestions,
  findUserByEmail,
  verifyGoogleToken
} from './_lib/supabase.js'

async function authenticateRequester(req) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const rawEmail = req.headers['x-user-email'] || req.body?.requesterEmail
    if (rawEmail) return await findUserByEmail(rawEmail)
    return null
  }

  const token = authHeader.split(' ')[1]
  if (!token) return null

  if (token.startsWith('zoho:')) {
    const rawEmail = req.headers['x-user-email'] || req.body?.requesterEmail
    if (rawEmail) {
      return await findUserByEmail(rawEmail)
    }
  }

  const googlePayload = await verifyGoogleToken(token)
  if (googlePayload && googlePayload.email) {
    const isVerified = googlePayload.email_verified === 'true' || googlePayload.email_verified === true
    if (!isVerified) return null
    return await findUserByEmail(googlePayload.email)
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
    // ── 1. GET: Fetch Question(s) ─────────────────────────────────────────────
    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost')
      const id = url.searchParams.get('id') || req.query?.id
      const slug = url.searchParams.get('slug') || req.query?.slug
      const wantsTopics = (url.searchParams.get('topics') || req.query?.topics) === 'true'
      if (wantsTopics) {
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

      const includeInactive = (url.searchParams.get('include_inactive') || req.query?.include_inactive) === 'true'
      const topic = url.searchParams.get('topic') || req.query?.topic

      if (id || slug) {
        const question = await getQuestionByIdOrSlug(id || slug)
        if (!question) {
          return res.status(404).json({ error: 'Question not found' })
        }
        return res.status(200).json({ question })
      }

      const questions = await getQuestions({ includeInactive, topic })

      return res.status(200).json({
        count: questions.length,
        questions
      })
    }

    // ── 2. Admin Authentication check for modifying requests ──────────────────
    const requester = await authenticateRequester(req)

    if (!requester) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required.' })
    }

    if (requester.role !== 'admin') {
      return res.status(403).json({
        error: `Forbidden: Administrator role required to manage questions. Current role: '${requester.role}'.`
      })
    }

    // ── 3. DELETE Question ───────────────────────────────────────────────────
    if (req.method === 'DELETE') {
      const url = new URL(req.url, 'http://localhost')
      const id = url.searchParams.get('id') || req.query?.id || req.body?.id
      const slug = url.searchParams.get('slug') || req.query?.slug || req.body?.slug
      const target = id || slug

      if (!target) {
        return res.status(400).json({ error: 'Missing required field: id or slug to delete.' })
      }

      const updatedQuestions = await deleteQuestion(target)
      return res.status(200).json({
        message: 'Question deleted successfully.',
        questions: updatedQuestions
      })
    }

    // ── 4. POST: Create, Update, Reorder, or Delete Action ────────────────────
    if (req.method === 'POST') {
      const body = req.body || {}

      // Action: Reorder questions
      if (body.action === 'reorder') {
        const orderedIds = body.orderedIds || body.orderedSlugs
        if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
          return res.status(400).json({ error: 'Missing orderedIds array for reordering.' })
        }

        const updatedQuestions = await reorderQuestions(orderedIds)
        return res.status(200).json({
          message: 'Questions reordered successfully.',
          questions: updatedQuestions
        })
      }

      // Action: Delete question
      if (body.action === 'delete') {
        const target = body.id || body.slug
        if (!target) {
          return res.status(400).json({ error: 'Missing id or slug to delete.' })
        }

        const updatedQuestions = await deleteQuestion(target)
        return res.status(200).json({
          message: 'Question deleted successfully.',
          questions: updatedQuestions
        })
      }

      // Action: Upsert Question (Create or Update)
      const questionData = body
      if (!questionData.title) {
        return res.status(400).json({ error: 'Missing required field: title' })
      }

      const savedQuestion = await upsertQuestion(questionData)
      const allQuestions = await getQuestions({ includeInactive: true })

      return res.status(200).json({
        message: 'Question saved successfully.',
        question: savedQuestion,
        questions: allQuestions
      })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('[api/questions] Handler error:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
