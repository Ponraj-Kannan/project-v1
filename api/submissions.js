/**
 * /api/submissions
 *
 * Serverless API handler and Vite dev middleware for recording code submissions and tracking progress.
 *
 * Methods:
 *   - GET: Fetches submissions history for the authenticated user, or aggregated progress across questions.
 *          Optional query params: `?question_id=...` or `?progress=true`
 *   - POST: Records a new submission with test case evaluation results and derives status.
 */

import {
  recordSubmission,
  getSubmissions,
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

    // ── 1. GET: Retrieve Submissions or Progress ──────────────────────────────
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

      const submissions = await getSubmissions({
        userId: targetUserId,
        userEmail: requester?.email,
        questionId,
        questionSlug
      })

      return res.status(200).json({
        count: submissions.length,
        submissions
      })
    }

    // ── 2. POST: Record Code Submission ───────────────────────────────────────
    if (req.method === 'POST') {
      const {
        questionId,
        questionSlug,
        casesPassed,
        totalCases,
        submittedCode = '',
        userEmail: bodyEmail
      } = req.body || {}

      const userEmail = requester?.email || bodyEmail
      const userId = requester?.id

      if (!userId && !userEmail) {
        return res.status(401).json({ error: 'Unauthorized: Valid user session required to record submission.' })
      }

      if (!questionId && !questionSlug) {
        return res.status(400).json({ error: 'Bad Request: questionId or questionSlug is required.' })
      }

      if (casesPassed === undefined || casesPassed === null) {
        return res.status(400).json({ error: 'Bad Request: casesPassed is required.' })
      }

      const submission = await recordSubmission({
        userId,
        userEmail,
        questionId,
        questionSlug,
        casesPassed,
        totalCases,
        submittedCode: submittedCode || null
      })

      // Fetch updated progress summary
      const progress = await getUserProgress({ userId: submission.user_id, userEmail })

      return res.status(200).json({
        success: true,
        message: `Submission recorded with status '${submission.status}'.`,
        submission,
        progress: progress.progress[submission.question_id] || null
      })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('[api/submissions] Handler error:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
