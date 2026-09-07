/**
 * Centralized Role-Based Access Control (RBAC) definitions and helpers.
 *
 * Role Hierarchy:
 *   admin (3) > trainer (2) > student (1)
 */

export type UserRole = 'admin' | 'trainer' | 'student'

export const ROLES: readonly UserRole[] = ['admin', 'trainer', 'student'] as const

export const ROLE_HIERARCHY: Readonly<Record<UserRole, number>> = {
  admin: 3,
  trainer: 2,
  student: 1
} as const

export const ROLE_LABELS: Readonly<Record<UserRole, string>> = {
  admin: 'Admin',
  trainer: 'Trainer',
  student: 'Student'
} as const

/**
 * Normalizes a role string to a valid UserRole or fallback.
 */
export function normalizeRole(role?: string | null): UserRole {
  if (!role) return 'student'
  const clean = role.toLowerCase().trim()
  if (clean === 'admin' || clean === 'trainer' || clean === 'student') {
    return clean as UserRole
  }
  return 'student'
}

/**
 * Checks if a string is a valid UserRole.
 */
export function isValidRole(role: unknown): role is UserRole {
  return typeof role === 'string' && (role === 'admin' || role === 'trainer' || role === 'student')
}

/**
 * Returns numeric weight for role hierarchy comparisons.
 */
export function getRoleWeight(role?: string | null): number {
  const normalized = normalizeRole(role)
  return ROLE_HIERARCHY[normalized] ?? 1
}

/**
 * Priority hierarchy check: returns true if `userRole` has at least the permission level of `minRole`.
 * E.g., hasMinRole('admin', 'trainer') === true, hasMinRole('student', 'trainer') === false.
 */
export function hasMinRole(userRole: string | null | undefined, minRole: UserRole): boolean {
  return getRoleWeight(userRole) >= getRoleWeight(minRole)
}

/**
 * Role convenience checkers.
 */
export function isAdmin(userRole: string | null | undefined): boolean {
  return hasMinRole(userRole, 'admin')
}

export function isTrainer(userRole: string | null | undefined): boolean {
  return hasMinRole(userRole, 'trainer')
}

export function isStudent(userRole: string | null | undefined): boolean {
  return hasMinRole(userRole, 'student')
}
