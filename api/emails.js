/**
 * /api/emails (and /api/users)
 *
 * Vercel Serverless Function and Vite dev server handler for user and role management.
 * Connected to Supabase PostgreSQL `users` table as the sole source of truth.
 *
 * Endpoints / Methods:
 *   - POST (with action: 'verify') or POST with idToken:
 *       Verifies Google ID Token or user email and returns user record + DB role from Supabase.
 *   - GET:
 *       Returns whitelisted emails and full user profiles with roles from Supabase.
 *   - POST:
 *       Admin-only. Inserts new user(s) with role ('admin', 'trainer', 'student') into Supabase.
 *   - DELETE:
 *       Admin-only. Removes user from Supabase.
 *   - PATCH:
 *       Admin-only. Updates a user's role in Supabase.
 */

import {
  findUserByEmail,
  getAllUsers,
  addUsers,
  deleteUser,
  updateUserRole,
  verifyGoogleToken
} from './_lib/supabase.js'

/**
 * Authenticates the requester from the Authorization Bearer header.
 * Supports:
 *   1. Google ID Token (verified via Google tokeninfo API)
 *   2. Zoho verified token (zoho:<code> checked against active session/DB)
 * Returns the requester's database record { id, email, role } or null.
 */
async function authenticateRequester(req) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.split(' ')[1]
  if (!token) return null

  // Check if it's a Zoho session token
  if (token.startsWith('zoho:')) {
    const rawEmail = req.headers['x-user-email'] || req.body?.requesterEmail
    if (rawEmail) {
      const user = await findUserByEmail(rawEmail)
      return user
    }
  }

  // Google ID Token verification
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-user-email')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    // ── 1. Google Token Verification Endpoint ─────────────────────────────────
    if (req.method === 'POST' && (req.body?.action === 'verify' || req.body?.idToken)) {
      const idToken = req.body.idToken || req.body.token
      if (!idToken) {
        return res.status(400).json({ error: 'Missing idToken for verification' })
      }

      const googlePayload = await verifyGoogleToken(idToken)
      if (!googlePayload || !googlePayload.email) {
        return res.status(401).json({ error: 'Invalid Google identity token', allowed: false })
      }

      const email = googlePayload.email.toLowerCase().trim()
      const dbUser = await findUserByEmail(email)

      if (!dbUser) {
        return res.status(403).json({
          allowed: false,
          error: `Email '${email}' is not registered. Please contact an administrator.`,
          email
        })
      }

      return res.status(200).json({
        allowed: true,
        user: {
          id: dbUser.id,
          email: dbUser.email,
          role: dbUser.role,
          name: googlePayload.name || '',
          picture: googlePayload.picture || ''
        }
      })
    }

    // ── 2. GET Users / Allowed Emails ─────────────────────────────────────────
    if (req.method === 'GET') {
      const users = await getAllUsers()
      const emails = users.map(u => u.email)
      return res.status(200).json({
        emails,
        users
      })
    }

    // ── 3. Authenticate Requester for Mutations (POST, DELETE, PATCH) ──────────
    const requester = await authenticateRequester(req)

    if (!requester) {
      return res.status(401).json({
        error: 'Unauthorized: Valid Google authentication token or active session required.'
      })
    }

    // Role-based authorization: only admin role can perform mutations
    if (requester.role !== 'admin') {
      return res.status(403).json({
        error: `Forbidden: Administrator role required. Current role: '${requester.role}'.`
      })
    }

    // ── 4. POST: Add User(s) ──────────────────────────────────────────────────
    if (req.method === 'POST') {
      const { email, emails: emailsToAdd, users: usersToAdd, role = 'student' } = req.body || {}

      let items = []
      if (Array.isArray(usersToAdd)) {
        items = usersToAdd
      } else if (Array.isArray(emailsToAdd)) {
        items = emailsToAdd.map(e => ({ email: e, role }))
      } else if (email && typeof email === 'string') {
        items = [{ email, role }]
      } else {
        return res.status(400).json({ error: 'Bad Request: Missing email, emails, or users field' })
      }

      const result = await addUsers(items)
      const allUsers = result.users || await getAllUsers()

      return res.status(200).json({
        message: `Successfully added/updated ${result.count} user(s).`,
        count: result.count,
        users: allUsers,
        emails: allUsers.map(u => u.email)
      })
    }

    // ── 5. DELETE: Remove User ────────────────────────────────────────────────
    if (req.method === 'DELETE') {
      const { email } = req.body || {}
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Bad Request: Missing email field' })
      }

      const targetEmail = email.trim().toLowerCase()

      // Prevent self-deletion
      if (requester.email.toLowerCase() === targetEmail) {
        return res.status(400).json({ error: 'Action not allowed: You cannot delete your own admin account.' })
      }

      // Check if target user exists
      const targetUser = await findUserByEmail(targetEmail)
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' })
      }

      // Check if this is the last admin
      if (targetUser.role === 'admin') {
        const allUsers = await getAllUsers()
        const adminCount = allUsers.filter(u => u.role === 'admin').length
        if (adminCount <= 1) {
          return res.status(400).json({ error: 'Action not allowed: Cannot delete the last remaining administrator.' })
        }
      }

      const result = await deleteUser(targetEmail)
      const allUsers = result.users || await getAllUsers()

      return res.status(200).json({
        message: `User '${targetEmail}' removed successfully.`,
        users: allUsers,
        emails: allUsers.map(u => u.email)
      })
    }

    // ── 6. PATCH: Update User Role ────────────────────────────────────────────
    if (req.method === 'PATCH') {
      const { email, role } = req.body || {}
      if (!email || !role) {
        return res.status(400).json({ error: 'Bad Request: email and role are required' })
      }

      const validRoles = ['admin', 'trainer', 'student']
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: `Invalid role '${role}'. Must be one of: ${validRoles.join(', ')}` })
      }

      const targetEmail = email.trim().toLowerCase()
      const targetUser = await findUserByEmail(targetEmail)
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' })
      }

      // Prevent demoting the last admin
      if (targetUser.role === 'admin' && role !== 'admin') {
        const allUsers = await getAllUsers()
        const adminCount = allUsers.filter(u => u.role === 'admin').length
        if (adminCount <= 1) {
          return res.status(400).json({ error: 'Cannot demote the last remaining administrator.' })
        }
      }

      await updateUserRole(targetEmail, role)
      const allUsers = await getAllUsers()

      return res.status(200).json({
        message: `Updated role for '${targetEmail}' to '${role}'.`,
        users: allUsers,
        emails: allUsers.map(u => u.email)
      })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('[api/emails] Handler error:', err)
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
