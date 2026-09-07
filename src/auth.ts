import { reactive } from 'vue'
import { UserRole, normalizeRole, isAdmin as checkIsAdmin } from './roles'

export interface RegisteredUser {
  id?: string
  email: string
  role: UserRole
  created_at?: string
}

export const authState = reactive({
  isLoggedIn: false,
  userEmail: '',
  userName: '',
  userPicture: '',
  idToken: '',
  role: 'student' as UserRole,
  isAdmin: false,
  allowedEmails: [] as string[],
  registeredUsers: [] as RegisteredUser[],
  showAdminPanel: false,
  showQuestionAdmin: false,
  activeQuestionSlug: '',
  activeQuestionId: '',
  activeQuestionTitle: ''
})

export function setUserSession(user: {
  email: string
  name?: string
  picture?: string
  idToken: string
  role?: string | UserRole
  provider?: string
}) {
  const normalizedRole = normalizeRole(user.role)
  authState.isLoggedIn = true
  authState.userEmail = user.email.toLowerCase().trim()
  authState.userName = user.name || user.email
  authState.userPicture = user.picture || ''
  authState.idToken = user.idToken
  authState.role = normalizedRole
  authState.isAdmin = checkIsAdmin(normalizedRole)

  localStorage.setItem('fp_auth_token', user.idToken)
  localStorage.setItem('fp_auth_email', authState.userEmail)
  localStorage.setItem('fp_auth_name', authState.userName)
  localStorage.setItem('fp_auth_picture', authState.userPicture)
  localStorage.setItem('fp_auth_role', normalizedRole)
  if (user.provider) {
    localStorage.setItem('fp_auth_provider', user.provider)
  }
}

export function logout() {
  authState.isLoggedIn = false
  authState.userEmail = ''
  authState.userName = ''
  authState.userPicture = ''
  authState.idToken = ''
  authState.role = 'student'
  authState.isAdmin = false
  authState.showAdminPanel = false
  authState.showQuestionAdmin = false
  authState.registeredUsers = []

  localStorage.removeItem('fp_auth_token')
  localStorage.removeItem('fp_auth_email')
  localStorage.removeItem('fp_auth_name')
  localStorage.removeItem('fp_auth_picture')
  localStorage.removeItem('fp_auth_role')
  localStorage.removeItem('fp_auth_provider')
  localStorage.removeItem('fp_allowed_emails')
  localStorage.removeItem('fp_registered_users')

  // Reload page to reset slidev slides to initial state
  window.location.reload()
}
