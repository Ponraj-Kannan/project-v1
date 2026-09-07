/**
 * /api/zoho-auth
 *
 * Vercel-compatible serverless function (also handled for Vite local dev via middleware).
 *
 * POST { code, redirect_uri }
 *   → Exchanges Zoho auth code for access token (client secret stays server-side)
 *   → Fetches Zoho user profile (email, name, picture)
 *   → Queries Supabase `users` table to verify authorization and retrieve user's DB role
 *   → Denies access if user is not in Supabase
 *   → Returns { email, name, picture, role }
 */

import { findUserByEmail } from './_lib/supabase.js'

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Exchange the Zoho authorization code for an access token.
 * Returns the full token response JSON from Zoho.
 */
async function exchangeCodeForToken(code, redirectUri, accountsDomain) {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    redirect_uri: redirectUri,
    code
  })

  const tokenUrl = `${accountsDomain}/oauth/v2/token`
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  })

  const data = await response.json()

  if (!response.ok || data.error) {
    throw new Error(data.error || `Zoho token exchange failed (HTTP ${response.status})`)
  }

  if (!data.access_token) {
    throw new Error('Zoho did not return an access_token')
  }

  return data
}

/**
 * Fetch the Zoho user profile using the access token.
 */
async function fetchZohoProfile(accessToken, accountsServer) {
  const headers = { Authorization: `Zoho-oauthtoken ${accessToken}` }
  let merged = {}

  // 1. Try legacy AaaServer endpoint
  try {
    const legacyUrl = `${accountsServer}/oauth/user/info`
    const r = await fetch(legacyUrl, { headers })
    const text = await r.text()
    if (r.ok) {
      const data = JSON.parse(text)
      if (!data.error && data.response !== 'error') {
        merged = { ...merged, ...data }
      }
    }
  } catch (e) {
    console.warn('[zoho-auth] Legacy endpoint failed:', e.message)
  }

  // 2. Try OIDC v2 endpoint
  try {
    const oidcUrl = `${accountsServer}/oauth/v2/userinfo`
    const r = await fetch(oidcUrl, { headers })
    const text = await r.text()
    if (r.ok) {
      const data = JSON.parse(text)
      if (!data.error && data.response !== 'error') {
        merged = { ...merged, ...data }
      }
    }
  } catch (e) {
    console.warn('[zoho-auth] OIDC endpoint failed:', e.message)
  }

  if (Object.keys(merged).length === 0) {
    throw new Error('Both Zoho profile endpoints failed to return valid data.')
  }

  return merged
}

// ── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' })
  }

  // Validate env config
  if (!process.env.ZOHO_CLIENT_ID || !process.env.ZOHO_CLIENT_SECRET) {
    console.error('[zoho-auth] Missing ZOHO_CLIENT_ID or ZOHO_CLIENT_SECRET env vars')
    return res.status(500).json({ error: 'Server is not configured for Zoho authentication.' })
  }

  // Parse request body
  const { code, redirect_uri } = req.body || {}

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid authorization code.' })
  }
  if (!redirect_uri || typeof redirect_uri !== 'string') {
    return res.status(400).json({ error: 'Missing redirect_uri.' })
  }

  // Determine Zoho accounts domain
  const accountsDomain =
    process.env.ZOHO_ACCOUNTS_DOMAIN ||
    process.env.VITE_ZOHO_ACCOUNTS_DOMAIN ||
    'https://accounts.zoho.in'

  try {
    // 1. Exchange auth code for access token
    const tokenData = await exchangeCodeForToken(code, redirect_uri, accountsDomain)
    const accessToken = tokenData.access_token
    const accountsServer = tokenData.accounts_server || accountsDomain

    // 2. Fetch user profile from Zoho
    const profile = await fetchZohoProfile(accessToken, accountsServer)
    const p = profile.data || profile

    const email = (
      p.Email || p.email ||
      p.EmailID || p.emailid ||
      p.email_address ||
      p.primary_email ||
      ''
    ).toLowerCase().trim()

    const name =
      p.Display_Name || p.display_name ||
      p.name ||
      `${p.First_Name || p.first_name || ''} ${p.Last_Name || p.last_name || ''}`.trim() ||
      email

    const picture =
      p.picture || p.Photo_ID || p.photo_url ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=E42527&color=fff&size=96`

    if (!email) {
      return res.status(400).json({
        error: 'Zoho account did not return a valid email address.'
      })
    }

    // 3. Verify user in Supabase users table (Source of Truth)
    const dbUser = await findUserByEmail(email)

    if (!dbUser) {
      return res.status(403).json({
        error: `Access Denied: Email '${email}' is not registered in the system. Please contact an administrator.`,
        allowed: false,
        email
      })
    }

    // 4. Return authenticated user payload with verified DB role
    return res.status(200).json({
      allowed: true,
      email: dbUser.email,
      name,
      picture,
      role: dbUser.role
    })
  } catch (err) {
    console.error('[zoho-auth] Authentication error:', err.message || err)
    const msg = err.message || 'Zoho authentication failed. Please try again.'
    const isZohoError = msg.includes('invalid_code') || msg.includes('expired')
    const statusCode = isZohoError ? 401 : 500

    return res.status(statusCode).json({ error: msg })
  }
}
