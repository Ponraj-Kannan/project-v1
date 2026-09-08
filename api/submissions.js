/**
 * /api/submissions
 *
 * Serverless API handler and Vite dev middleware for tracking solved questions.
 * A question is marked as solved in Supabase when all test cases are passed.
 *
 * Methods:
 *   - GET: Fetches solved question status for a specific question or aggregated user progress.
 *          Query params: `?question_id=...`, `?question_slug=...`, or `?progress=true`
 *   - POST: Marks question as solved in Supabase when all test cases pass.
 */

import {
  recordQuestionSolved,
  getSolvedQuestions,
  getUserProgress,
  findUserByEmail,
  verifyGoogleToken
} from './_lib/supabase.js'

async function authenticateRequester(req) {
  const authHeader = req.headers.authorization
  const rawEmail = req.headers['x-user-email'] || req.body?.userEmail || req.query?.user_email

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    if (rawEmail) return await findUserByEmail(rawEmail)
    return null
  }

  const token = authHeader.split(' ')[1]
  if (!token) {
    if (rawEmail) return await findUserByEmail(rawEmail)
    return null
  }

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-email')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    const requester = await authenticateRequester(req)

    // ── 1. GET: Retrieve Solved Status or Aggregated Progress ───────────────────
    if (req.method === 'GET') {
      const url = new URL(req.url, 'http://localhost')
      const questionId = url.searchParams.get('question_id') || req.query?.question_id
      const questionSlug = url.searchParams.get('question_slug') || req.query?.question_slug
      const wantsProgress = url.searchParams.get('progress') === 'true' || req.query?.progress === 'true'
      const targetUserId = (requester && requester.role === 'admin')
        ? (url.searchParams.get('user_id') || req.query?.user_id || requester?.id)
        : requester?.id

      if (!requester && !targetUserId) {
        return res.status(401).json({ error: 'Unauthorized: Authentication or user identification required.' })
      }

      if (wantsProgress) {
        const progress = await getUserProgress({ userId: targetUserId, userEmail: requester?.email })
        return res.status(200).json(progress)
      }

      const solvedList = await getSolvedQuestions({
        userId: targetUserId,
        userEmail: requester?.email,
        questionId,
        questionSlug
      })

      const isSolved = solvedList.length > 0
      return res.status(200).json({
        isSolved,
        solvedAt: solvedList[0]?.solved_at || null,
        count: solvedList.length,
        submissions: solvedList // backward-compatibility
      })
    }

    // ── 2. POST: Record Question Solved ─────────────────────────────────────────
    if (req.method === 'POST') {
      const {
        questionId,
        questionSlug,
        casesPassed,
        totalCases,
        allPassed,
        userEmail: bodyEmail
      } = req.body || {}

      const userEmail = requester?.email || bodyEmail
      const userId = requester?.id

      if (!userId && !userEmail) {
        return res.status(401).json({ error: 'Unauthorized: Valid user session required.' })
      }

      if (!questionId && !questionSlug) {
        return res.status(400).json({ error: 'Bad Request: questionId or questionSlug is required.' })
      }

      const passed = parseInt(casesPassed, 10) || 0
      const total = parseInt(totalCases, 10) || 0
      const isQuestionSolved = allPassed === true || (passed >= total && total > 0)

      if (!isQuestionSolved) {
        return res.status(200).json({
          success: false,
          isSolved: false,
          message: 'Question not solved. All test cases must pass to mark as solved.'
        })
      }

      const solvedRecord = await recordQuestionSolved({
        userId,
        userEmail,
        questionId,
        questionSlug
      })

      // Fetch updated progress summary
      const progress = await getUserProgress({ userId: solvedRecord.user_id, userEmail })

      return res.status(200).json({
        success: true,
        isSolved: true,
        message: 'Question solved successfully and saved to database.',
        solved: solvedRecord,
        progress: progress.progress[solvedRecord.question_id] || null
      })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('[api/submissions] Handler error:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
