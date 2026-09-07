<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { authState, logout, setUserSession } from '../auth'
import {
  isAdmin,
  isTrainer,
  isStudent,
  hasMinRole,
  getRoleWeight,
  normalizeRole,
  ROLE_LABELS,
  ROLES
} from '../roles'

// ── Zoho OAuth configuration ─────────────────────────────────────────────────
// The Client ID is public (safe to embed). Client Secret stays server-side.
const ZOHO_CLIENT_ID = import.meta.env.VITE_ZOHO_CLIENT_ID || ''
const ZOHO_ACCOUNTS_DOMAIN = import.meta.env.VITE_ZOHO_ACCOUNTS_DOMAIN || 'https://accounts.zoho.com'

const isZohoLoading = ref(false)
// Plain variable (NOT a ref) — storing a cross-origin Window in ref() causes a SecurityError
let zohoPopupWindow = null

// Sync auth state with DOM body/html classes to hide/show slides securely.
watch(
  () => authState.isLoggedIn,
  (isLoggedIn) => {
    if (typeof document !== 'undefined') {
      if (isLoggedIn) {
        document.documentElement.classList.add('auth-success')
      } else {
        document.documentElement.classList.remove('auth-success')
      }
    }
  },
  { flush: 'post', immediate: true }
)

// Fullscreen helpers
function enterFullscreen() {
  const el = document.documentElement
  if (el.requestFullscreen) el.requestFullscreen()
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen()
  else if (el.mozRequestFullScreen) el.mozRequestFullScreen()
  else if (el.msRequestFullscreen) el.msRequestFullscreen()
}

const showFullscreenPrompt = ref(false)

const errorMessage = ref('')
const successMessage = ref('')
const newEmail = ref('')
const selectedRole = ref('student')
const isLoading = ref(false)
const isPageLoading = ref(true)
const searchQuery = ref('')

// Real-time email parser for auto-separation
const parsedEmailsPreview = computed(() => {
  if (!newEmail.value) return []
  const emailRegexGlobal = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const matches = newEmail.value.match(emailRegexGlobal) || []
  return [...new Set(matches.map(e => e.trim().toLowerCase()))]
})

// Filtered and sorted users based on role priority (admin > trainer > student)
const filteredUsers = computed(() => {
  const users = [...(authState.registeredUsers || [])]
  const sorted = users.sort((a, b) => {
    // 1. Role hierarchy weight (higher weight first: admin 3, trainer 2, student 1)
    const weightA = getRoleWeight(a.role)
    const weightB = getRoleWeight(b.role)
    if (weightA !== weightB) {
      return weightB - weightA
    }
    // 2. Alphabetical within same role
    return (a.email || '').localeCompare(b.email || '')
  })

  if (!searchQuery.value.trim()) return sorted
  const q = searchQuery.value.trim().toLowerCase()
  return sorted.filter(u =>
    (u.email || '').toLowerCase().includes(q) ||
    (u.role || '').toLowerCase().includes(q)
  )
})

const isNotAllowed = ref(false)
const notAllowedEmail = ref('')
const isAdminPage = ref(false)

function checkIsAdminPage() {
  if (typeof window !== 'undefined') {
    const isPathAdmin = window.location.pathname === '/admin' || window.location.pathname === '/admin.html'
    const isQueryAdmin = window.location.search.includes('admin')
    const isHashAdmin = window.location.hash === '#admin'
    isAdminPage.value = isPathAdmin || isQueryAdmin || isHashAdmin
  }
}

function resetLogin() {
  isNotAllowed.value = false
  notAllowedEmail.value = ''
  errorMessage.value = ''
  isZohoLoading.value = false
  initGoogleSignIn()
}

// ── Zoho OAuth2 popup flow ────────────────────────────────────────────────────

/**
 * Build the Zoho authorization URL and open a popup window.
 * The popup redirects to /zoho-callback.html, which posts the auth code back.
 */
function initiateZohoLogin() {
  errorMessage.value = ''

  if (!ZOHO_CLIENT_ID) {
    errorMessage.value = 'Zoho Sign-In is not configured. Please contact the administrator.'
    return
  }

  const redirectUri = `${window.location.origin}/zoho-callback.html`
  const state = Math.random().toString(36).substring(2, 15)
  sessionStorage.setItem('zoho_oauth_state', state)

  const scope = 'AaaServer.profile.Read openid email profile'
  const authUrl = `${ZOHO_ACCOUNTS_DOMAIN}/oauth/v2/auth` +
    `?response_type=code` +
    `&client_id=${encodeURIComponent(ZOHO_CLIENT_ID)}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}`

  const width = 480
  const height = 600
  const left = Math.max(0, (window.screen.width - width) / 2)
  const top = Math.max(0, (window.screen.height - height) / 2)

  const popup = window.open(
    authUrl,
    'ZohoSignIn',
    `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
  )

  if (!popup || popup.closed) {
    errorMessage.value = 'Popup was blocked. Please allow popups for this site and try again.'
    return
  }

  zohoPopupWindow = popup
  isZohoLoading.value = true

  const pollTimer = setInterval(() => {
    if (zohoPopupWindow && zohoPopupWindow.closed) {
      clearInterval(pollTimer)
      isZohoLoading.value = false
      zohoPopupWindow = null
    }
  }, 800)
}

/**
 * Handles the postMessage from zoho-callback.html.
 * Exchanges the auth code on the backend and retrieves verified Supabase role.
 */
async function handleZohoMessage(event) {
  if (event.origin !== window.location.origin) return

  const { type, code, state, error } = event.data || {}

  if (type === 'ZOHO_AUTH_ERROR') {
    isZohoLoading.value = false
    errorMessage.value = `Zoho sign-in failed: ${error || 'Unknown error'}`
    return
  }

  if (type !== 'ZOHO_AUTH_CODE' || !code) return

  const savedState = sessionStorage.getItem('zoho_oauth_state')
  sessionStorage.removeItem('zoho_oauth_state')
  if (state && savedState && state !== savedState) {
    isZohoLoading.value = false
    errorMessage.value = 'Zoho sign-in failed: Invalid state parameter (possible CSRF).'
    return
  }

  errorMessage.value = ''
  isZohoLoading.value = true

  try {
    const redirectUri = `${window.location.origin}/zoho-callback.html`

    const response = await fetch('/api/zoho-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirect_uri: redirectUri })
    })

    const data = await response.json()

    if (!response.ok || !data.allowed) {
      isNotAllowed.value = true
      notAllowedEmail.value = data.email || ''
      errorMessage.value = data.error || 'Your Zoho account is not registered.'
      isZohoLoading.value = false
      return
    }

    const email = (data.email || '').toLowerCase()
    if (!email) {
      errorMessage.value = 'Zoho account did not return a valid email address.'
      isZohoLoading.value = false
      return
    }

    // Set authenticated session with role from Supabase
    setUserSession({
      email,
      name: data.name || email,
      picture: data.picture || '',
      idToken: `zoho:${code}`,
      role: data.role,
      provider: 'zoho'
    })

    await fetchRegisteredUsers()
    showFullscreenPrompt.value = true
  } catch (err) {
    console.error('[Zoho auth] Exchange error:', err)
    errorMessage.value = 'Network error during Zoho sign-in. Please try again.'
  } finally {
    isZohoLoading.value = false
  }
}

function closeAdminPanel() {
  if (isAdminPage.value) {
    window.location.href = '/'
  } else {
    authState.showAdminPanel = false
  }
}

// Helper to decode JWT on the client
function decodeJwt(token) {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    }).join(''))
    return JSON.parse(jsonPayload)
  } catch (e) {
    console.error('Failed to decode JWT:', e)
    return null
  }
}

// Fetch registered users and roles from Supabase backend
async function fetchRegisteredUsers() {
  try {
    const headers = {}
    if (authState.idToken) {
      headers['Authorization'] = `Bearer ${authState.idToken}`
      headers['x-user-email'] = authState.userEmail
    }

    const response = await fetch('/api/emails', { headers })
    if (response.ok) {
      const data = await response.json()
      authState.allowedEmails = data.emails || []
      authState.registeredUsers = data.users || (data.emails || []).map(e => ({
        email: e,
        role: 'student'
      }))
      localStorage.setItem('fp_allowed_emails', JSON.stringify(authState.allowedEmails))
      localStorage.setItem('fp_registered_users', JSON.stringify(authState.registeredUsers))
    } else {
      throw new Error('API response not ok')
    }
  } catch (error) {
    console.warn('Could not fetch users from server. Falling back to local cache.', error)
    const localEmails = localStorage.getItem('fp_allowed_emails')
    const localUsers = localStorage.getItem('fp_registered_users')
    if (localEmails) {
      authState.allowedEmails = JSON.parse(localEmails)
    }
    if (localUsers) {
      authState.registeredUsers = JSON.parse(localUsers)
    }
  }
}

// Check local storage for existing session
async function checkAuthSession() {
  checkIsAdminPage()
  isPageLoading.value = true
  await fetchRegisteredUsers()

  const savedToken = localStorage.getItem('fp_auth_token')
  const savedEmail = localStorage.getItem('fp_auth_email')
  const savedName = localStorage.getItem('fp_auth_name')
  const savedPicture = localStorage.getItem('fp_auth_picture')
  const savedRole = localStorage.getItem('fp_auth_role')
  const savedProvider = localStorage.getItem('fp_auth_provider')

  if (savedToken && savedEmail) {
    const cleanEmail = savedEmail.toLowerCase().trim()
    const matchingUser = authState.registeredUsers.find(
      u => (u.email || '').toLowerCase() === cleanEmail
    )

    if (matchingUser) {
      setUserSession({
        email: cleanEmail,
        name: savedName || cleanEmail,
        picture: savedPicture || '',
        idToken: savedToken,
        role: matchingUser.role || savedRole || 'student',
        provider: savedProvider || 'google'
      })
    } else {
      logout()
      errorMessage.value = `Session expired: Email '${savedEmail}' is no longer registered in the system.`
    }
  }
  isPageLoading.value = false
}

// Initialize Google Identity Services
function initGoogleSignIn() {
  if (authState.isLoggedIn) return

  nextTick(() => {
    try {
      if (typeof window.google === 'undefined') {
        console.error('Google Identity Services script not loaded')
        return
      }

      window.google.accounts.id.initialize({
        client_id: '207254417956-cgi3av80ac090nqrurpjkdhj19nievvp.apps.googleusercontent.com',
        callback: handleGoogleSignInCallback,
        auto_select: false
      })

      const btnEl = document.getElementById('google-signin-btn')
      if (btnEl) {
        window.google.accounts.id.renderButton(btnEl, {
          theme: 'filled_black',
          size: 'large',
          width: '220',
          text: 'signin_with',
          shape: 'pill',
          border: 'none',
        })
      }
    } catch (err) {
      console.error('Failed to initialize Google Sign In:', err)
    }
  })
}

// Google Sign-In Callback — verified against Supabase backend
async function handleGoogleSignInCallback(response) {
  errorMessage.value = ''
  successMessage.value = ''

  if (!response.credential) {
    errorMessage.value = 'Failed to retrieve login credentials from Google.'
    return
  }

  const payload = decodeJwt(response.credential)
  if (!payload) {
    errorMessage.value = 'Failed to decode identity token.'
    return
  }

  const email = payload.email ? payload.email.toLowerCase().trim() : ''
  const isEmailVerified = payload.email_verified === true || payload.email_verified === 'true'

  if (!email) {
    errorMessage.value = 'Google account did not return a valid email address.'
    return
  }

  if (!isEmailVerified) {
    errorMessage.value = 'Your Google email address is not verified.'
    return
  }

  try {
    // 1. Verify token with backend against Supabase users store
    const verifyRes = await fetch('/api/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'verify',
        idToken: response.credential
      })
    })

    const verifyData = await verifyRes.json()

    if (!verifyRes.ok || !verifyData.allowed) {
      isNotAllowed.value = true
      notAllowedEmail.value = email
      errorMessage.value = verifyData.error || `Email '${email}' is not registered in the system.`
      return
    }

    const dbUser = verifyData.user || {}
    const role = dbUser.role || 'student'

    // 2. Set user session with fresh database role
    setUserSession({
      email,
      name: payload.name || '',
      picture: payload.picture || '',
      idToken: response.credential,
      role,
      provider: 'google'
    })

    await fetchRegisteredUsers()
    showFullscreenPrompt.value = true
  } catch (err) {
    console.error('Google Sign-In verification error:', err)
    errorMessage.value = 'Authentication verification error. Please try again.'
  }
}

// Add new email(s) with selected role (Admin only)
async function addEmail() {
  const emailsToWhitelist = parsedEmailsPreview.value
  if (emailsToWhitelist.length === 0) return

  errorMessage.value = ''
  successMessage.value = ''
  isLoading.value = true

  try {
    const response = await fetch('/api/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authState.idToken}`,
        'x-user-email': authState.userEmail
      },
      body: JSON.stringify({
        emails: emailsToWhitelist,
        role: selectedRole.value
      })
    })

    const data = await response.json()

    if (response.ok) {
      authState.allowedEmails = data.emails || []
      authState.registeredUsers = data.users || []
      localStorage.setItem('fp_allowed_emails', JSON.stringify(authState.allowedEmails))
      localStorage.setItem('fp_registered_users', JSON.stringify(authState.registeredUsers))
      successMessage.value = `Successfully registered ${emailsToWhitelist.length} user(s) as ${ROLE_LABELS[selectedRole.value] || selectedRole.value}.`
      newEmail.value = ''

      setTimeout(() => {
        successMessage.value = ''
      }, 2500)
    } else {
      throw new Error(data.error || 'Failed to add users')
    }
  } catch (error) {
    console.error('Failed to add users: ', error)
    errorMessage.value = error.message || 'Failed to add users'
  } finally {
    isLoading.value = false
  }
}

// Delete user (Admin only)
async function removeEmail(emailToRemove) {
  if (emailToRemove.toLowerCase() === authState.userEmail.toLowerCase()) {
    errorMessage.value = 'You cannot remove your own administrator account.'
    return
  }

  errorMessage.value = ''
  successMessage.value = ''
  isLoading.value = true

  try {
    const response = await fetch('/api/emails', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authState.idToken}`,
        'x-user-email': authState.userEmail
      },
      body: JSON.stringify({ email: emailToRemove })
    })

    const data = await response.json()

    if (response.ok) {
      authState.allowedEmails = data.emails || []
      authState.registeredUsers = data.users || []
      localStorage.setItem('fp_allowed_emails', JSON.stringify(authState.allowedEmails))
      localStorage.setItem('fp_registered_users', JSON.stringify(authState.registeredUsers))
      successMessage.value = `Removed '${emailToRemove}' successfully`

      setTimeout(() => {
        successMessage.value = ''
      }, 2500)
    } else {
      throw new Error(data.error || 'Failed to remove user')
    }
  } catch (error) {
    console.error('Failed to remove user:', error)
    errorMessage.value = error.message || 'Failed to remove user'
  } finally {
    isLoading.value = false
  }
}

// Update user role (Admin only)
async function changeRole(userEmail, newRole) {
  errorMessage.value = ''
  successMessage.value = ''
  isLoading.value = true

  try {
    const response = await fetch('/api/emails', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authState.idToken}`,
        'x-user-email': authState.userEmail
      },
      body: JSON.stringify({
        email: userEmail,
        role: newRole
      })
    })

    const data = await response.json()

    if (response.ok) {
      authState.registeredUsers = data.users || []
      localStorage.setItem('fp_registered_users', JSON.stringify(authState.registeredUsers))
      successMessage.value = `Updated role for '${userEmail}' to ${ROLE_LABELS[newRole] || newRole}.`

      setTimeout(() => {
        successMessage.value = ''
      }, 2500)
    } else {
      throw new Error(data.error || 'Failed to update user role')
    }
  } catch (error) {
    console.error('Failed to update role:', error)
    errorMessage.value = error.message || 'Failed to update role'
  } finally {
    isLoading.value = false
  }
}

// Block Slidev keyboard navigation keys when not logged in
function blockKeyboard(e) {
  if (!authState.isLoggedIn) {
    const blockedKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar', 'Enter']
    if (blockedKeys.includes(e.key)) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        return
      }
      e.preventDefault()
      e.stopImmediatePropagation()
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', blockKeyboard, { capture: true })
  window.addEventListener('keyup', blockKeyboard, { capture: true })
  window.addEventListener('keypress', blockKeyboard, { capture: true })

  // Listen for Zoho popup postMessage
  window.addEventListener('message', handleZohoMessage)

  nextTick(() => {
    checkAuthSession().then(() => {
      if (typeof window.google === 'undefined') {
        const script = document.createElement('script')
        script.src = 'https://accounts.google.com/gsi/client'
        script.async = true
        script.defer = true
        script.onload = () => initGoogleSignIn()
        script.onerror = () => {
          errorMessage.value = 'Could not load Google Sign-In SDK. Check your internet connection.'
        }
        document.head.appendChild(script)
      } else {
        initGoogleSignIn()
      }
    })
  })
})

onUnmounted(() => {
  window.removeEventListener('keydown', blockKeyboard, { capture: true })
  window.removeEventListener('keyup', blockKeyboard, { capture: true })
  window.removeEventListener('keypress', blockKeyboard, { capture: true })
  window.removeEventListener('message', handleZohoMessage)

  if (zohoPopupWindow && !zohoPopupWindow.closed) {
    zohoPopupWindow.close()
    zohoPopupWindow = null
  }
})
</script>

<template>
  <div>
    <!-- FULLSCREEN PROMPT -->
    <Transition name="fade">
      <div v-if="showFullscreenPrompt" class="fs-prompt-overlay">
        <div class="fs-prompt-card">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="fs-prompt-icon">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
          </svg>
          <p class="fs-prompt-text">Click to enter fullscreen for the best experience</p>
          <button class="fs-prompt-btn" @click="enterFullscreen(); showFullscreenPrompt = false">
            Enter Fullscreen
          </button>
          <button class="fs-prompt-skip" @click="showFullscreenPrompt = false">Skip</button>
        </div>
      </div>
    </Transition>

    <!-- 1. FULL-SCREEN LOGIN OVERLAY (shown if not logged in) -->
    <Transition name="fade">
      <div v-if="!authState.isLoggedIn && !isPageLoading" class="login-overlay">
        <div class="login-card">
          <!-- Brand header -->
          <div class="brand-container">
            <div class="brand-logo">
              <img src="../assets/logo.png" style="width: 150px;"/>
            </div>
            <p class="brand-tagline">{{ isAdminPage ? 'Admin User Management' : 'Interactive Slide Deck Portal' }}</p>
          </div>

          <!-- Card Body -->
          <div class="login-body">
            <template v-if="isNotAllowed">
              <div class="not-allowed-icon-container">
                <svg class="not-allowed-large-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              </div>

              <h2 class="login-heading text-red">Access Denied</h2>
              <p class="login-subtext text-center">
                {{ notAllowedEmail ? `'${notAllowedEmail}' is not registered.` : 'This email is not registered in the system.' }}
                Please contact your course administrator.
              </p>
              <div class="not-allowed-actions" style="text-align: center;">
                <button @click="resetLogin" class="action-btn-retry">Go Back</button>
              </div>
            </template>

            <template v-else>
              <h2 class="login-heading">{{ isAdminPage ? 'Admin Sign In' : 'Sign In Required' }}</h2>
              <p class="login-subtext">
                {{ isAdminPage 
                  ? 'Sign in with an authorized Google or Zoho administrator account.' 
                  : 'Access to this course is restricted. Please sign in with your registered account.' }}
              </p>

              <!-- Sign-in buttons -->
              <div class="signin-buttons-stack">
                <!-- Google Button -->
                <div class="signin-button-wrapper">
                  <div id="google-signin-btn"></div>
                </div>

                <!-- Divider -->
                <div class="auth-divider">
                  <span class="auth-divider-line"></span>
                  <span class="auth-divider-text">or</span>
                  <span class="auth-divider-line"></span>
                </div>

                <!-- Zoho Button -->
                <div class="signin-button-wrapper">
                  <button
                    id="zoho-signin-btn"
                    class="zoho-btn"
                    @click="initiateZohoLogin"
                    :disabled="isZohoLoading"
                    :aria-busy="isZohoLoading"
                  >
                    <span v-if="isZohoLoading" class="zoho-btn-spinner"></span>
                    <template v-else>
                      <svg class="zoho-btn-icon" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect width="36" height="36" rx="6" fill="#E42527"/>
                        <path d="M9 10h18v3.5L15.5 26H27v3H9v-3.5L20.5 13H9V10z" fill="white"/>
                      </svg>
                      <span class="zoho-btn-text">Sign in with Zoho</span>
                    </template>
                  </button>
                </div>
              </div>

              <!-- Error Banner -->
              <Transition name="slide-up">
                <div v-if="errorMessage" class="error-banner">
                  <svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <div class="error-text">{{ errorMessage }}</div>
                </div>
              </Transition>
            </template>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Page Loading Indicator -->
    <div v-if="isPageLoading" class="page-loader-overlay">
      <div class="loader-spinner"></div>
      <p class="loader-text">Loading authorization...</p>
    </div>

    <!-- 2. ADMIN DASHBOARD MODAL/PAGE -->
    <Transition name="fade">
      <div v-if="authState.isLoggedIn && authState.isAdmin && (authState.showAdminPanel || isAdminPage)" class="admin-modal-overlay" @click.self="closeAdminPanel">
        <div class="admin-card">
          <!-- Header -->
          <div class="admin-header">
            <div class="admin-header-title">
              <svg class="admin-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <p>User & Role Management (Supabase RBAC)</p>
            </div>
            <button class="close-btn" @click="closeAdminPanel" :title="isAdminPage ? 'Back to Slides' : 'Close'">
              <svg v-if="isAdminPage" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 20px; height: 20px;">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="admin-body">
            <!-- Alert Banners -->
            <div v-if="errorMessage" class="error-banner mb-3">
              <span>{{ errorMessage }}</span>
            </div>
            <div v-if="successMessage" class="success-banner mb-3">
              <svg class="success-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <span>{{ successMessage }}</span>
            </div>

            <!-- Add Email / User Form -->
            <form @submit.prevent="addEmail" class="add-form">
              <textarea 
                v-model="newEmail" 
                placeholder="Add Email Address(es)" 
                required 
                class="form-input form-textarea"
                rows="2"
                :disabled="isLoading"
              ></textarea>

              <div class="form-row-actions">
                <div class="role-selector-wrap">
                  <label class="role-label">Assign Role:</label>
                  <select v-model="selectedRole" class="role-select" :disabled="isLoading">
                    <option value="student">Student (Standard)</option>
                    <option value="trainer">Trainer (Elevated)</option>
                    <option value="admin">Admin (Full Control)</option>
                  </select>
                </div>

                <button type="submit" class="submit-btn" :disabled="isLoading || parsedEmailsPreview.length === 0">
                  <span v-if="isLoading" class="btn-spinner"></span>
                  <span v-else>Register {{ parsedEmailsPreview.length == 0 ? "" : parsedEmailsPreview.length }} User{{ parsedEmailsPreview.length == 1 ? "" : "(s)" }}</span>
                </button>
              </div>
            </form>

            <!-- Whitelisted Heading with Search -->
            <div class="whitelisted-heading">
              <span>Registered Users ({{ authState.registeredUsers.length }})</span>
              <div class="search-wrapper">
                <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Search email or role"
                  class="search-input"
                />
                <button v-if="searchQuery" class="search-clear-btn" @click="searchQuery = ''" title="Clear search">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>

            <!-- Users List -->
            <div class="emails-list-container">
              <div v-if="filteredUsers.length === 0" class="no-emails">
                {{ searchQuery ? `No users match "${searchQuery}"` : 'No registered users found.' }}
              </div>
              <ul v-else class="emails-list">
                <li v-for="user in filteredUsers" :key="user.email" class="email-item">
                  <div class="email-details">
                    <span class="email-text">{{ user.email }}</span>
                    <span
                      class="role-badge"
                      :class="{
                        'badge-admin': user.role === 'admin',
                        'badge-trainer': user.role === 'trainer',
                        'badge-student': user.role === 'student' || !user.role
                      }"
                    >
                      {{ ROLE_LABELS[user.role] || user.role }}
                    </span>
                  </div>

                  <div class="user-item-actions">
                    <!-- Quick Role Switcher -->
                    <select
                      :value="user.role || 'student'"
                      @change="changeRole(user.email, $event.target.value)"
                      class="role-switch-select"
                      :disabled="isLoading || user.email.toLowerCase() === authState.userEmail.toLowerCase()"
                      title="Change user role"
                    >
                      <option value="admin">Admin</option>
                      <option value="trainer">Trainer</option>
                      <option value="student">Student</option>
                    </select>

                    <button 
                      v-if="user.email.toLowerCase() !== authState.userEmail.toLowerCase()"
                      @click="removeEmail(user.email)" 
                      class="delete-btn" 
                      title="Remove access"
                      :disabled="isLoading"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="trash-icon">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        <line x1="10" y1="11" x2="10" y2="17"/>
                        <line x1="14" y1="11" x2="14" y2="17"/>
                      </svg>
                    </button>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 3. ADMIN ACCESS DENIED -->
    <Transition name="fade">
      <div v-if="isAdminPage && authState.isLoggedIn && !authState.isAdmin" class="login-overlay">
        <div class="login-card">
          <div class="brand-container">
            <div class="brand-logo">
              <img src="../assets/logo.png" style="width: 150px;"/>
            </div>
            <p class="brand-tagline">Admin Portal</p>
          </div>
          <div class="login-body">
            <div class="not-allowed-icon-container text-red">
              <svg class="not-allowed-large-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <h2 class="login-heading text-red">Access Denied</h2>
            <p class="login-subtext text-center">
              Administrator privileges required. Currently signed in as <strong>{{ authState.userEmail }}</strong> (Role: {{ ROLE_LABELS[authState.role] || authState.role }}).
            </p>
            <div class="not-allowed-actions">
              <button @click="logout" class="action-btn-retry width-full">Sign Out / Switch Account</button>
              <a href="/" class="action-btn-admin width-full text-center">Back to Slides</a>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.text-red { color: #ef4444 !important; }
.text-center { text-align: center; }
.width-full { width: 100% !important; }

.not-allowed-icon-container {
  display: flex;
  justify-content: center;
  margin-bottom: 10px;
  color: #ef4444;
  margin-top: -10px;
}
.not-allowed-large-icon { width: 40px; height: 40px;}

.not-allowed-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: -10px;
}

.action-btn-admin {
  background: #ef5050;
  color: white !important;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.88rem;
  padding: 0.75rem 1.25rem;
  border-radius: 8px;
  text-align: center;
  transition: background 0.2s ease;
  display: block;
  border: none;
  cursor: pointer;
  box-sizing: border-box;
}
.action-btn-admin:hover { background: #db3b3b; }

.action-btn-retry {
  background: #ffffff;
  font-weight: 500;
  font-size: 0.88rem;
  padding: 5px;
  border-radius: 4px;
  text-align: center;
  transition: all 0.2s ease;
  cursor: pointer;
  box-sizing: border-box;
  color: #475569;
  width: 100px;
}

/* Fullscreen Prompt */
.fs-prompt-overlay {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  background: rgba(241, 245, 249, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
  font-family: 'Inter', system-ui, sans-serif;
  box-sizing: border-box;
}
.fs-prompt-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 2rem 2.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  max-width: 340px;
  text-align: center;
}
.fs-prompt-icon {
  width: 40px;
  height: 40px;
  color: #ef5050;
}
.fs-prompt-text {
  color: #2b2b2b;
  font-size: 0.9rem;
  margin: 0;
  line-height: 1.5;
}
.fs-prompt-btn {
  background: #ef5050;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 10px 28px;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s;
  width: 100%;
}
.fs-prompt-btn:hover { background: #db3b3b; }
.fs-prompt-skip {
  background: none;
  border: none;
  color: #414852;
  font-size: 0.75rem;
  cursor: pointer;
  padding: 0;
}
.fs-prompt-skip:hover { color: #94a3b8; }

/* Layout & Background */
.login-overlay {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: right;
  align-items: center;
  z-index: 10;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  overflow: hidden;
  background-position: center center;
  background-image: url("../assets/Header_Student_placement.webp");
  background-size: 500px;
  background-repeat: no-repeat;
  background-position-x: 10%;
  padding: 50px;
  background-color: #ffffffe1;
}

.page-loader-overlay {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 10;
  font-family: 'Inter', system-ui, sans-serif;
}

.loader-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(239, 80, 80, 0.15);
  border-left-color: #ef5050;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}
.loader-text { color: #64748b; font-size: 0.95rem; }

/* Login Card */
.login-card {
  width: 100%;
  max-width: 360px;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  padding: 1.75rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  position: relative;
  z-index: 10;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.4);
}

.brand-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.brand-logo {
  width: 80%;
  height: auto;
  min-height: 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.5rem;
}
.brand-tagline { color: #383838; font-size: 0.85rem; margin: 0.25rem 0 0 0; }

.login-heading {
  color: #1e293b;
  font-size: 0.95rem;
  font-weight: 600;
  text-align: center;
  margin: 0 0 0.25rem 0;
}
.login-subtext {
  color: #475569;
  font-size: 0.8rem;
  line-height: 1.5;
  text-align: center;
  margin: 0 0 0.5rem 0;
}
.signin-buttons-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0;
}

.signin-button-wrapper {
  display: flex;
  justify-content: center;
}

/* ── Auth divider ──────────────────────────────────────────────── */
.auth-divider {
  display: flex;
  align-items: center;
  width: 100%;
  max-width: 220px;
  gap: 0.75rem;
}
.auth-divider-line {
  flex: 1;
  height: 1px;
  background: #e2e8f0;
}
.auth-divider-text {
  color: #94a3b8;
  font-size: 0.72rem;
  font-weight: 500;
  white-space: nowrap;
}

/* ── Zoho sign-in button ───────────────────────────────────────── */
.zoho-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 220px;
  height: 36px;
  border-radius: 20px;
  border: 1px solid #dadce0;
  background: #fff;
  color: #3c4043;
  font-family: 'Inter', 'Roboto', system-ui, sans-serif;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
  padding: 0 12px;
  letter-spacing: 0.01em;
  box-shadow: 0 1px 2px rgba(60,64,67,.08);
}
.zoho-btn:hover:not(:disabled) {
  background: #f8f9fa;
  border-color: #c5c7ca;
  box-shadow: 0 2px 6px rgba(60,64,67,.12);
}
.zoho-btn:active:not(:disabled) { background: #f1f3f4; }
.zoho-btn:disabled { opacity: 0.75; cursor: not-allowed; }
.zoho-btn-icon { width: 18px; height: 18px; flex-shrink: 0; border-radius: 3px; }
.zoho-btn-text { flex: 1; text-align: center; padding-right: 18px; }
.zoho-btn-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(60,64,67,0.2);
  border-left-color: #E42527;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* Error Banner */
.error-banner {
  background: rgba(239, 68, 68, 0.05);
  border: 1px solid rgba(239, 68, 68, 0.15);
  border-radius: 10px;
  padding: 0.75rem 1rem;
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  margin-top: 1rem;
}
.error-icon { width: 18px; height: 18px; color: #ef4444; flex-shrink: 0; margin-top: 2px; }
.error-text { color: #ef4444; font-size: 0.82rem; line-height: 1.4; text-align: left; }

/* Admin Modal */
.admin-modal-overlay {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  background: rgba(241, 245, 249, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
  font-family: 'Inter', system-ui, sans-serif;
  box-sizing: border-box;
}

.admin-card {
  width: 100%;
  max-width: 540px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 20px 40px -15px rgba(15, 23, 42, 0.12);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.admin-header {
  padding: 0.85rem 1rem;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.admin-header-title { display: flex; align-items: center; gap: 0.5rem; }
.admin-header-title p { 
  color: #1e293b; 
  font-size: 0.85rem; 
  font-weight: 600; 
  margin: 0; 
}
.admin-icon { width: 16px; height: 16px; color: #ef5050; }

.close-btn {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}
.close-btn:hover { 
  background: #ef50503a; 
  color: #ef5050; 
}
.close-btn svg { width: 16px; height: 16px; }

.admin-body {
  padding: 14px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.success-banner {
  background: rgba(34, 197, 94, 0.08);
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: 8px;
  padding: 6px 10px;
  display: flex;
  gap: 0.5rem;
  align-items: center;
  color: #166534;
  font-size: 0.75rem;
}
.success-icon { width: 14px; height: 14px; color: #22c55e; flex-shrink: 0; }
.mb-3 { margin-bottom: 0.5rem; }

/* Add User Form */
.add-form { display: flex; flex-direction: column; gap: 0.5rem; }
.form-textarea { min-height: 48px; resize: vertical; font-family: inherit; line-height: 1.4; }

.form-row-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
}

.role-selector-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.role-label {
  font-size: 0.72rem;
  color: #64748b;
  font-weight: 500;
}
.role-select {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 0.72rem;
  color: #1e293b;
  outline: none;
  cursor: pointer;
}
.role-select:focus { border-color: #ef5050; }

.form-input {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 8px 10px;
  color: #1e293b;
  font-size: 0.75rem;
  outline: none;
  transition: border-color 0.2s ease;
}
.form-input:focus { border-color: #ef5050; }

.submit-btn {
  background: #ef5050;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 6px 14px;
  font-weight: 600;
  font-size: 0.72rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease;
  white-space: nowrap;
}
.submit-btn:hover:not(:disabled) { background: #db3b3b; }
.submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-left-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* Whitelisted heading with search */
.whitelisted-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.7rem;
  color: #64748b;
  letter-spacing: 0.03em;
  font-weight: 600;
  margin-top: 4px;
}

.search-wrapper {
  display: flex;
  flex-direction: row;
  align-items: center;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 3px 8px;
  gap: 4px;
  transition: border-color 0.2s ease;
  width: 180px;
}
.search-wrapper:focus-within { border-color: #ef5050; background: #fff; }
.search-icon { width: 12px; height: 12px; color: #94a3b8; flex-shrink: 0; }
.search-input {
  border: none;
  outline: none;
  background: transparent;
  font-size: 0.68rem;
  color: #1e293b;
  width: 100%;
  padding: 1px 0;
  font-family: inherit;
}
.search-input::placeholder { color: #94a3b8; }
.search-clear-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  color: #94a3b8;
  transition: color 0.2s ease;
}
.search-clear-btn:hover { color: #ef4444; }
.search-clear-btn svg { width: 10px; height: 10px; }

/* Email/User List */
.emails-list-container {
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #f8fafc;
}
.no-emails { padding: 1.5rem; text-align: center; color: #64748b; font-size: 0.75rem; }
.emails-list { list-style: none; padding: 0; margin: 0; }

.email-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  border-bottom: 1px solid #e2e8f0;
  transition: background 0.15s ease;
}
.email-item:last-child { border-bottom: none; }
.email-item:hover { background: #f1f5f9; }

.email-details { display: flex; align-items: center; gap: 0.5rem; }
.email-text { color: #1e293b; font-size: 0.74rem; font-weight: 500; }

.role-badge {
  font-size: 0.62rem;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 12px;
  text-transform: capitalize;
}

.badge-admin {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.25);
}

.badge-trainer {
  background: rgba(14, 165, 233, 0.1);
  color: #0284c7;
  border: 1px solid rgba(14, 165, 233, 0.25);
}

.badge-student {
  background: rgba(100, 116, 139, 0.1);
  color: #64748b;
  border: 1px solid rgba(100, 116, 139, 0.2);
}

.user-item-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.role-switch-select {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  padding: 2px 4px;
  font-size: 0.65rem;
  color: #334155;
  outline: none;
  cursor: pointer;
}
.role-switch-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.delete-btn {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}
.delete-btn:hover:not(:disabled) { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
.delete-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.trash-icon { width: 14px; height: 14px; }

/* Animations */
@keyframes spin { to { transform: rotate(360deg); } }

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.slide-up-enter-active { transition: all 0.3s ease-out; }
.slide-up-enter-from { opacity: 0; transform: translateY(10px); }

.login-body {display: flex; flex-direction: column; justify-content: center; align-items: center;}
</style>
