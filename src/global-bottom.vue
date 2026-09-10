<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useNav, useSlideContext } from '@slidev/client'
import LoginOverlay from './components/LoginOverlay.vue'
import AdminQuestionPanel from './components/AdminQuestionPanel.vue'
import { authState, logout } from './auth'
import { isAdmin } from './roles'

const { currentPage, total, currentSlideRoute, go } = useNav()
const { $frontmatter } = useSlideContext()

const sessionLabel = computed(() => $frontmatter.value?.sessionLabel || 'Session')
const sessionTitle = computed(() => $frontmatter.value?.sessionTitle || $frontmatter.value?.title || 'Untitled Deck')

// ── Info Button state ──────────────────────────────────────────────────────
const showInfoPopover = ref(false)

/** Resolve the source file path for the current slide.
 *  Priority:
 *  1. currentSlideRoute.meta?.slide?.filepath  — resolved absolute path set by Slidev parser
 *  2. $frontmatter.src                         — raw `src:` value from the slide's frontmatter
 *  3. Friendly fallback message
 */
const currentFilePath = computed(() => {
  const routeMeta = currentSlideRoute.value?.meta?.slide
  if (routeMeta?.filepath) return routeMeta.filepath
  if ($frontmatter.value?.src) return $frontmatter.value.src
  return 'File path not available'
})

/** Split path into { prefix, highlight } where highlight = last 2 segments (Folder/file.md) */
const currentFilePathParts = computed(() => {
  const full = currentFilePath.value
  // Normalise separators
  const normalised = full.replace(/\\/g, '/')
  const parts = normalised.split('/')
  if (parts.length >= 2) {
    const highlight = parts.slice(-2).join('/')
    const prefix = parts.slice(0, -2).join('/') + '/'
    return { prefix, highlight }
  }
  return { prefix: '', highlight: normalised }
})

function toggleInfoPopover() {
  showInfoPopover.value = !showInfoPopover.value
}

function closeInfoPopover() {
  showInfoPopover.value = false
}

/** Only show slide file info on local dev — hide on Vercel / any production host */
const isLocalhost = typeof window !== 'undefined'
  && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

async function handleLogout() {
  try {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      await (document.exitFullscreen?.() || document.webkitExitFullscreen?.())
    }
  } catch (e) {
    // ignore fullscreen errors
  } finally {
    logout()
  }
}

// ── Overall Question Solved Progress ───────────────────────────────────────
const overallSolved = ref(0)
const overallTotal = ref(0)
const overallPercent = computed(() => {
  if (overallTotal.value === 0) return 0
  return Math.round((overallSolved.value / overallTotal.value) * 100)
})

async function fetchOverallProgress() {
  if (!authState.isLoggedIn) return
  try {
    const headers = {}
    if (authState.idToken) {
      headers['Authorization'] = `Bearer ${authState.idToken}`
    }
    if (authState.userEmail) {
      headers['x-user-email'] = authState.userEmail
    }

    const res = await fetch('/api/submissions?progress=true', { headers })
    if (res.ok) {
      const data = await res.json()
      if (data) {
        overallTotal.value = Number(data.totalQuestions) || 0
        overallSolved.value = Number(data.completedQuestions) || 0
      }
    }
  } catch (err) {
    console.warn('[global-bottom] Could not fetch overall progress:', err)
  }
}

watch(() => [authState.isLoggedIn, authState.userEmail], ([loggedIn]) => {
  if (loggedIn) {
    fetchOverallProgress()
  }
}, { immediate: true })

// ── Alt+T — jump to roadmap (slide 1) from anywhere ───────────────────────
function handleAltT(e) {
  if (e.altKey && (e.key === 't' || e.key === 'T')) {
    e.preventDefault()
    go(2)
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleAltT)
  window.addEventListener('question-solved', fetchOverallProgress)
  window.addEventListener('questions-updated', fetchOverallProgress)
  if (authState.isLoggedIn) {
    fetchOverallProgress()
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleAltT)
  window.removeEventListener('question-solved', fetchOverallProgress)
  window.removeEventListener('questions-updated', fetchOverallProgress)
})
</script>

<template>
  <div>
    <!-- Authentication Overlay -->
    <LoginOverlay />

    <!-- Question Administration Panel -->
    <AdminQuestionPanel />

    <!-- Slides Footer - only visible when logged in -->
    <div class="fp-footer" v-if="authState.isLoggedIn" >
      <!-- Left: Overall Question Solved Progress -->
      <div class="fp-left-section">
        <div 
          v-if="overallTotal > 0" 
          class="fp-overall-progress" 
          :class="{ 'fp-overall-progress--active': overallSolved > 0, 'fp-overall-progress--done': overallPercent === 100 }"
          :title="`Overall Practice Progress: ${overallSolved} of ${overallTotal} questions solved (${overallPercent}%)`"
        >
          <span class="fp-progress-icon-wrap">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" class="fp-progress-icon">
              <circle cx="8" cy="8" r="6.25"/>
              <path d="m5.2 8 2 2 3.6-4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>

          <span class="fp-progress-label">Overall Solved</span>

          <span class="fp-progress-dot"></span>

          <span class="fp-progress-counts">
            <span class="fp-progress-solved">{{ overallSolved }}</span>
            <span class="fp-progress-slash">/</span>
            <span class="fp-progress-total">{{ overallTotal }}</span>
          </span>

          <div class="fp-progress-track">
            <div class="fp-progress-bar" :style="{ width: `${overallPercent}%` }"></div>
          </div>

          <span 
            class="fp-progress-pct" 
            :class="{ 'fp-progress-pct--active': overallSolved > 0, 'fp-progress-pct--done': overallPercent === 100 }"
          >
            {{ overallPercent }}%
          </span>
        </div>
      </div>

      <div class="fp-right-section">
        <!-- Roadmap Home Button -->
        <button
          @click="go(2)"
          class="fp-admin-btn"
          :class="{ 'fp-admin-btn--active': currentPage === 1 }"
          title="Course Roadmap (Alt+T)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="fp-icon">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </button>

        <!-- Question Administration Button (Admin Only) -->
        <button 
          v-if="authState.isAdmin" 
          @click="authState.showQuestionAdmin = !authState.showQuestionAdmin" 
          class="fp-admin-btn"
          :class="{ 'fp-admin-btn--active': authState.showQuestionAdmin }"
          title="Add Question / Question Management"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="fp-icon">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
        </button>

        <!-- Whitelist Admin Panel Button -->
        <button 
          v-if="authState.isAdmin" 
          @click="authState.showAdminPanel = !authState.showAdminPanel" 
          class="fp-admin-btn"
          :class="{ 'fp-admin-btn--active': authState.showAdminPanel }"
          title="Whitelist Administration"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="fp-icon">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>

        <!-- User profile and logout -->
        <div class="fp-user-badge" :title="`${authState.userName} (${authState.userEmail})`">
          <img v-if="authState.userPicture" :src="authState.userPicture" class="fp-avatar" referrerpolicy="no-referrer" />
          <div v-else class="fp-avatar-placeholder">
            {{ authState.userName ? authState.userName.charAt(0).toUpperCase() : authState.userEmail.charAt(0).toUpperCase() }}
          </div>
          <button @click="handleLogout" class="fp-logout-btn" title="Sign Out">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="fp-logout-icon">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>

        <!-- Page numbers + Info Button -->
        <div class="fp-page-group">
          <div class="fp-page">
            <span class="fp-page-num">{{ currentPage }}</span>
            <span class="fp-page-sep">/</span>
            <span class="fp-page-total">{{ total }}</span>
          </div>

          <!-- Info Button (localhost only) -->
          <div v-if="isLocalhost" class="fp-info-wrap">
            <button
              class="fp-info-btn"
              :class="{ 'fp-info-btn--active': showInfoPopover }"
              @click.stop="toggleInfoPopover"
              title="Show current slide file path"
              aria-label="Slide file info"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="fp-icon">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="8" stroke-linecap="round" stroke-width="2.5"/>
                <line x1="12" y1="12" x2="12" y2="16"/>
              </svg>
            </button>

            <!-- File path popover -->
            <transition name="fp-pop">
              <div
                v-if="showInfoPopover"
                class="fp-info-popover"
                @click.stop
              >
                <div class="fp-info-popover-header">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="fp-info-popover-icon">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <span>Current Slide File</span>
                </div>
                <div class="fp-info-popover-path">
                  <span class="fp-path-prefix">{{ currentFilePathParts.prefix }}</span><span class="fp-path-highlight">{{ currentFilePathParts.highlight }}</span>
                </div>
              </div>
            </transition>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fp-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 38px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.5rem;
  z-index: 100;
  font-family: 'Inter', system-ui, sans-serif;
  width: 95%;
  margin-left: 2.5%;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  background-color: rgba(255, 255, 255, 0.95);
  box-shadow: 0 -1px 3px rgba(0, 0, 0, 0.02);
}

.fp-left-section {
  display: flex;
  align-items: center;
}

.fp-overall-progress {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 26px;
  padding: 0 8px 0 8px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 9999px;
  font-size: 0.72rem;
  color: #475569;
  user-select: none;
  cursor: default;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.fp-overall-progress:hover {
  border-color: #cbd5e1;
  box-shadow: 0 2px 5px rgba(15, 23, 42, 0.06);
}

.fp-overall-progress--done {
  border-color: #a7f3d0;
  background: #f0fdf4;
}

.fp-progress-icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  transition: color 0.2s ease;
  line-height: 0;
}

.fp-overall-progress--active .fp-progress-icon-wrap {
  color: #10b981;
}

.fp-progress-icon {
  width: 14px;
  height: 14px;
}

.fp-progress-label {
  font-weight: 500;
  color: #64748b;
  letter-spacing: -0.01em;
}

.fp-progress-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #cbd5e1;
  flex-shrink: 0;
}

.fp-progress-counts {
  display: inline-flex;
  align-items: baseline;
  font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
  font-size: 0.72rem;
  letter-spacing: -0.02em;
}

.fp-progress-solved {
  font-weight: 700;
  color: #0f172a;
}

.fp-progress-slash {
  margin: 0 2px;
  color: #cbd5e1;
  font-weight: 400;
}

.fp-progress-total {
  color: #64748b;
  font-weight: 500;
}

.fp-progress-track {
  width: 46px;
  height: 4px;
  background: #e2e8f0;
  border-radius: 9999px;
  overflow: hidden;
  flex-shrink: 0;
}

.fp-progress-bar {
  height: 100%;
  background: #10b981;
  border-radius: 9999px;
  transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.fp-progress-pct {
  font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
  font-size: 0.67rem;
  font-weight: 600;
  color: #64748b;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 9999px;
  padding: 1px 6px;
  line-height: 1.25;
  letter-spacing: -0.02em;
  transition: all 0.2s ease;
}

.fp-progress-pct--active {
  color: #047857;
  background: #ecfdf5;
  border-color: #d1fae5;
}

.fp-progress-pct--done {
  color: #065f46;
  background: #d1fae5;
  border-color: #a7f3d0;
}

.fp-module {
  color: #64748b;
  font-size: 0.75rem;
  font-weight: 500;
}

/* Auth enhancements */
.fp-right-section {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.fp-admin-btn {
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

.fp-admin-btn:hover,
.fp-admin-btn--active {
  color: #2563eb;
  background: #eff6ff;
}

.fp-icon {
  width: 16px;
  height: 16px;
}

.fp-user-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  padding: 3px 6px 3px 4px;
}

.fp-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  object-fit: cover;
}

.fp-avatar-placeholder {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #2563eb;
  color: #ffffff;
  font-size: 0.7rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fp-logout-btn {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.fp-logout-btn:hover {
  color: #ef4444;
}

.fp-logout-icon {
  width: 14px;
  height: 14px;
}

.fp-page-group {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.fp-page {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: right;
  gap: 0.25rem;
  width: 70px;
}

.fp-page-num {
  color: #2563eb;
  font-weight: 700;
  font-size: 0.85rem;
}

.fp-page-sep {
  color: #94a3b8;
  font-size: 0.75rem;
}

.fp-page-total {
  color: #64748b;
  font-size: 0.8rem;
}

/* ── Info Button ─────────────────────────────────────────────────────────── */
.fp-info-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.fp-info-btn {
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
  line-height: 0;
}

.fp-info-btn:hover,
.fp-info-btn--active {
  color: #2563eb;
  background: #eff6ff;
}

/* ── File path popover (light mode) ─────────────────────────────────────── */
.fp-info-popover {
  position: absolute;
  bottom: calc(100% + 10px);
  right: 0;
  min-width: 280px;
  max-width: 480px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 14px 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.06);
  z-index: 200;
}

.fp-info-popover-header {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #2563eb;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin-bottom: 8px;
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 6px;
}

.fp-info-popover-icon {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
}

.fp-info-popover-path {
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 0.72rem;
  word-break: break-all;
  line-height: 1.6;
  user-select: all;
}

.fp-path-prefix {
  color: #64748b;
}

.fp-path-highlight {
  color: #2563eb;
  font-weight: 700;
}

/* ── Popover transition ──────────────────────────────────────────────────── */
.fp-pop-enter-active,
.fp-pop-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.fp-pop-enter-from,
.fp-pop-leave-to {
  opacity: 0;
  transform: translateY(4px) scale(0.97);
}
</style>