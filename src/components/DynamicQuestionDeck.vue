<template>
  <div class="dynamic-deck-container">
    <!-- ── Unified Sleek Top Navigation Bar ────────────────────────────── -->
    <header class="deck-top-navbar">
      <div class="deck-nav-left">
        <!-- Minimal Platform Brand -->
        <div class="deck-brand-badge">
          <span class="deck-brand-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="deck-icon-svg">
              <path d="M16 18l6-6-6-6"/>
              <path d="M8 6l-6 6 6 6"/>
            </svg>
          </span>
          <span class="deck-brand-name">CodeLab</span>
        </div>

        <div class="deck-nav-divider"></div>

        <!-- Topic Display -->
        <div class="deck-topic-badge">
          <span class="deck-topic-text">{{ props.topic || currentQuestion?.topic || 'Practice' }}</span>
        </div>
      </div>

      <div class="deck-nav-right">
        <!-- Metadata -->
        <div class="deck-meta-group">
          <!-- Progress Summary -->
          <div class="deck-meta-item" v-if="questions.length > 0">
            <span class="deck-meta-label">Solved</span>
            <span class="deck-meta-val">{{ solvedCount }} / {{ questions.length }}</span>
            <span class="deck-percent">({{ completionPercent }}%)</span>
          </div>
        </div>

        <div class="deck-nav-divider"></div>

        <!-- Custom Question Picker Button (Appears after questions solved) -->
        <button
          class="deck-custom-btn"
          :class="{ 'deck-custom-btn--active': isCustomModalOpen }"
          @click="toggleCustomModal"
          title="Pick a custom question from the list"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="deck-custom-icon">
            <rect x="3" y="3" width="7" height="7" rx="1.5"/>
            <rect x="14" y="3" width="7" height="7" rx="1.5"/>
            <rect x="14" y="14" width="7" height="7" rx="1.5"/>
            <rect x="3" y="14" width="7" height="7" rx="1.5"/>
          </svg>
          <span class="deck-custom-text">Custom</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="deck-chevron-icon" :class="{ 'deck-chevron-icon--open': isCustomModalOpen }">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        <div class="deck-nav-divider"></div>

        <!-- Clean Section Jump Buttons -->
        <div class="deck-jump-group">
          <button 
            class="deck-jump-btn" 
            :class="{ 'deck-jump-btn--active': activeNavTab === 'problem' }"
            @click="scrollToTab('problem')"
          >Problem</button>
          <button 
            class="deck-jump-btn" 
            :class="{ 'deck-jump-btn--active': activeNavTab === 'editor' }"
            @click="scrollToTab('editor')"
          >Editor</button>
          <button 
            class="deck-jump-btn" 
            :class="{ 'deck-jump-btn--active': activeNavTab === 'tests' }"
            @click="scrollToTab('tests')"
          >Tests</button>
        </div>

        <div class="deck-nav-divider"></div>

        <!-- Question Navigation Controls -->
        <div class="deck-nav-btn-group">
          <button
            class="deck-step-btn"
            :disabled="currentQuestionIndex <= 0"
            @click="prevQuestion"
            title="Previous Question (Left Arrow)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="deck-arrow-svg">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            <span>Prev</span>
          </button>

          <button
            class="deck-step-btn deck-step-btn--primary"
            :disabled="currentQuestionIndex >= questions.length - 1"
            @click="nextQuestion"
            title="Next Question (Right Arrow)"
          >
            <span>Next</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="deck-arrow-svg">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>
      </div>
    </header>

    <!-- ── Loading & Error States ───────────────────────────────────────── -->
    <div v-if="isLoading" class="deck-state-panel">
      <div class="deck-spinner"></div>
      <p class="deck-state-text">Loading question bank from database...</p>
    </div>

    <div v-else-if="errorMessage" class="deck-state-panel deck-state-panel--error">
      <p class="deck-error-title">Unable to Load Questions</p>
      <p class="deck-error-msg">{{ errorMessage }}</p>
      <button class="deck-retry-btn" @click="fetchQuestions">Retry</button>
    </div>

    <div v-else-if="questions.length === 0" class="deck-state-panel">
      <p class="deck-empty-title">No Active Questions Found{{ props.topic ? ` for ${props.topic}` : '' }}</p>
      <p class="deck-empty-msg">Questions added under this topic in the question bank will appear here automatically.</p>
    </div>

    <!-- ── Dynamic Question Slide Rendering ─────────────────────────────── -->
    <div v-else-if="currentQuestion" class="deck-slide-frame" :key="currentQuestion.id || currentQuestionIndex">
      <Slide
        ref="slideRef"
        :hide-top-navbar="true"
        @nav-tab-change="handleNavTabChange"
        :question-id="currentQuestion.id"
        :question-slug="currentQuestion.slug"
        :topic="currentQuestion.topic || props.topic || 'Coding Practice'"
        :sub-topic="currentQuestion.sub_topic || currentQuestion.title"
        :difficulty="currentQuestion.difficulty || 'Easy'"
        :score="currentQuestion.score || 10"
        :contents="currentQuestion.contents || []"
        :test-cases="currentQuestion.test_cases || []"
        :language="currentQuestion.language || 'java'"
        :starter-code="''"
        :task="currentQuestion.task || ''"
        :input-format="currentQuestion.input_format || ''"
        :constraints="currentQuestion.constraints || ''"
        :output-format="currentQuestion.output_format || ''"
        :explanation="currentQuestion.explanation || ''"
      />
    </div>

    <!-- ── Custom Question Selection Modal (Teleported to body to avoid overflow clipping) ── -->
    <Teleport to="body">
      <Transition name="custom-modal-fade">
        <div v-if="isCustomModalOpen" class="custom-modal-overlay" @click.self="isCustomModalOpen = false">
          <div class="custom-modal-card">
            <!-- Modal Header -->
            <div class="custom-modal-header">
              <div class="custom-modal-header-left">
                <div class="custom-modal-icon-badge">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                    <rect x="3" y="3" width="7" height="7" rx="1.5"/>
                    <rect x="14" y="3" width="7" height="7" rx="1.5"/>
                    <rect x="14" y="14" width="7" height="7" rx="1.5"/>
                    <rect x="3" y="14" width="7" height="7" rx="1.5"/>
                  </svg>
                </div>
                <div>
                  <h3 class="custom-modal-title">Select Question</h3>
                  <p class="custom-modal-subtitle">Pick any problem to practice &bull; {{ solvedCount }} of {{ questions.length }} solved</p>
                </div>
              </div>
              <button class="custom-modal-close-btn" @click="isCustomModalOpen = false" title="Close (Esc)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="16" height="16">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <!-- Modal Question List -->
            <div class="custom-modal-list">
              <div
                v-for="(q, idx) in questions"
                :key="q.id || idx"
                class="custom-modal-item"
                :class="{ 'custom-modal-item--active': currentQuestionIndex === idx }"
                @click="selectAndClose(idx)"
              >
                <div class="custom-modal-item-left">
                  <span class="custom-item-num">Q{{ idx + 1 }}</span>
                  <div class="custom-item-details">
                    <span class="custom-item-title">{{ q.title }}</span>
                    <span class="custom-item-topic">{{ q.topic || props.topic || 'Practice Problem' }} &bull; {{ (q.language || 'Java').toUpperCase() }}</span>
                  </div>
                </div>

                <div class="custom-modal-item-right">
                  <span
                    class="status-pill"
                    :class="`status-pill--${getQuestionStatus(q.id)}`"
                  >
                    <span class="status-pill-dot"></span>
                    <span>{{ getQuestionStatus(q.id) === 'passed' ? 'Solved' : 'Not Solved' }}</span>
                  </span>
                  <span v-if="currentQuestionIndex === idx" class="current-label">Current</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import Slide from './Slide.vue'
import { authState } from '../auth'

const props = defineProps({
  topic: {
    type: String,
    default: ''
  }
})

const questions = ref([])
const currentQuestionIndex = ref(0)
const userProgressMap = ref({})
const isLoading = ref(true)
const errorMessage = ref('')
const isCustomModalOpen = ref(false)
const slideRef = ref(null)
const activeNavTab = ref('problem')

const currentQuestion = computed(() => {
  if (questions.value.length === 0) return null
  return questions.value[currentQuestionIndex.value] || questions.value[0]
})

const solvedCount = computed(() => {
  let count = 0
  for (const q of questions.value) {
    if (getQuestionStatus(q.id) === 'passed') count++
  }
  return count
})

const completionPercent = computed(() => {
  if (questions.value.length === 0) return 0
  return Math.round((solvedCount.value / questions.value.length) * 100)
})

function getQuestionStatus(questionId) {
  if (!questionId) return 'unattempted'
  const record = userProgressMap.value[questionId]
  if (!record) return 'unattempted'
  return record.status || 'unattempted'
}

function handleNavTabChange(tab) {
  if (tab) {
    activeNavTab.value = tab
  }
}

function scrollToTab(tabName) {
  activeNavTab.value = tabName
  if (slideRef.value?.navigateToTab) {
    slideRef.value.navigateToTab(tabName)
  } else {
    const container = document.querySelector('.edu-main-scroll')
    const idMap = { problem: 'sec-problem', editor: 'sec-compiler', tests: 'sec-testcases' }
    const targetEl = document.getElementById(idMap[tabName])
    if (container && targetEl) {
      container.scrollTo({
        top: Math.max(0, targetEl.offsetTop - 8),
        behavior: 'smooth'
      })
    }
  }
}

async function fetchQuestions() {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const url = props.topic && props.topic.trim()
      ? `/api/questions?topic=${encodeURIComponent(props.topic.trim())}`
      : '/api/questions'

    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch questions`)

    const data = await res.json()
    let rawList = Array.isArray(data.questions) ? data.questions : []

    // Client-side filtering safeguard if topic prop is provided
    if (props.topic && props.topic.trim()) {
      const targetTopic = props.topic.trim().toLowerCase()
      rawList = rawList.filter(q => (q.topic || '').trim().toLowerCase() === targetTopic)
    }

    // Client-side sorting safeguard: arrange strictly based on priority
    rawList.sort((a, b) => {
      const pA = a.priority ?? a.display_order ?? 0
      const pB = b.priority ?? b.display_order ?? 0
      return pA - pB
    })

    questions.value = rawList
    if (currentQuestionIndex.value >= rawList.length) {
      currentQuestionIndex.value = Math.max(0, rawList.length - 1)
    }
  } catch (err) {
    console.error('[DynamicQuestionDeck] fetchQuestions error:', err)
    errorMessage.value = err.message || 'Error loading question bank.'
  } finally {
    isLoading.value = false
  }
}

async function fetchProgress() {
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
      if (data && data.progress) {
        userProgressMap.value = data.progress
      }
    }
  } catch (err) {
    console.warn('[DynamicQuestionDeck] Could not fetch progress:', err)
  }
}

function selectQuestion(idx) {
  if (idx >= 0 && idx < questions.value.length) {
    currentQuestionIndex.value = idx
    activeNavTab.value = 'problem'
    scrollToTab('problem')
  }
}

function toggleCustomModal() {
  isCustomModalOpen.value = !isCustomModalOpen.value
}

function selectAndClose(idx) {
  selectQuestion(idx)
  isCustomModalOpen.value = false
}

function prevQuestion() {
  if (currentQuestionIndex.value > 0) {
    currentQuestionIndex.value--
    activeNavTab.value = 'problem'
    scrollToTab('problem')
  }
}

function nextQuestion() {
  if (currentQuestionIndex.value < questions.value.length - 1) {
    currentQuestionIndex.value++
    activeNavTab.value = 'problem'
    scrollToTab('problem')
  }
}

function isUserTypingOrEditing(e) {
  const active = typeof document !== 'undefined' ? document.activeElement : null
  const target = e.target

  const checkElement = (el) => {
    if (!el || typeof el !== 'object') return false

    const tag = (el.tagName || '').toUpperCase()
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'IFRAME') {
      return true
    }

    if (el.isContentEditable || el.getAttribute?.('contenteditable') === 'true') {
      return true
    }

    if (typeof el.closest === 'function') {
      if (
        el.closest('input, textarea, select, iframe') ||
        el.closest('[contenteditable="true"]') ||
        el.closest('.monaco-editor, .cm-editor, .ace_editor, .view-lines, .inputarea') ||
        el.closest('.edu-editor-container, .edu-editor-frame-wrap, .testcase-custom-input, #sec-compiler, .edu-card--editor')
      ) {
        return true
      }
    }
    return false
  }

  if (checkElement(active) || checkElement(target)) {
    return true
  }

  if (typeof e.composedPath === 'function') {
    const path = e.composedPath()
    for (const node of path) {
      if (node && node.nodeType === 1 && checkElement(node)) {
        return true
      }
    }
  }

  return false
}

function handleKeyNavigation(e) {
  if (e.key === 'Escape' && isCustomModalOpen.value) {
    isCustomModalOpen.value = false
    return
  }

  // If modal is open, do not trigger arrow navigation
  if (isCustomModalOpen.value) {
    return
  }

  // If the user is typing code in the editor or inside any input, do not navigate!
  if (isUserTypingOrEditing(e)) {
    return
  }

  // Avoid interfering with browser or OS combinations (Cmd+Arrow, Ctrl+Arrow, Shift+Arrow)
  if (e.ctrlKey || e.metaKey || e.shiftKey) {
    return
  }

  if (e.key === 'ArrowRight') {
    e.preventDefault()
    e.stopPropagation()
    if (typeof e.stopImmediatePropagation === 'function') {
      e.stopImmediatePropagation()
    }
    nextQuestion()
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    e.stopPropagation()
    if (typeof e.stopImmediatePropagation === 'function') {
      e.stopImmediatePropagation()
    }
    prevQuestion()
  }
}

watch(currentQuestion, (q) => {
  if (q) {
    authState.activeQuestionSlug = q.slug || ''
    authState.activeQuestionId = q.id || ''
    authState.activeQuestionTitle = q.title || ''
  }
}, { immediate: true })

watch(() => authState.isLoggedIn, () => {
  fetchProgress()
})

watch(() => props.topic, async () => {
  currentQuestionIndex.value = 0
  await fetchQuestions()
  await fetchProgress()
})

async function onQuestionsUpdated() {
  await fetchQuestions()
  await fetchProgress()
}

async function onQuestionSolved() {
  await fetchProgress()
}

onMounted(async () => {
  await fetchQuestions()
  await fetchProgress()
  window.addEventListener('keydown', handleKeyNavigation, { capture: true })
  window.addEventListener('questions-updated', onQuestionsUpdated)
  window.addEventListener('question-solved', onQuestionSolved)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyNavigation, { capture: true })
  window.removeEventListener('questions-updated', onQuestionsUpdated)
  window.removeEventListener('question-solved', onQuestionSolved)
})
</script>

<style scoped>
.dynamic-deck-container {
  display: flex;
  flex-direction: column;
  width: calc(100% + 64px);
  height: calc(100% + 32px);
  margin-left: -32px;
  margin-top: -16px;
  background: #f8fafc;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  overflow: hidden;
  font-size: 0.74rem;
  box-sizing: border-box;
}

/* ── Unified Top Navigation Bar ───────────────────────────────────────── */
.deck-top-navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  height: 38px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
  z-index: 20;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
  gap: 8px;
}

.deck-nav-left {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
}

.deck-nav-left::-webkit-scrollbar {
  display: none;
}

.deck-brand-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
}

.deck-brand-icon {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background: #eff6ff;
  color: #2563eb;
  display: flex;
  align-items: center;
  justify-content: center;
}

.deck-icon-svg {
  width: 11px;
  height: 11px;
}

.deck-brand-name {
  font-size: 0.78rem;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.01em;
}

.deck-nav-divider {
  width: 1px;
  height: 14px;
  background: #e2e8f0;
  flex-shrink: 0;
}

.deck-topic-badge {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.deck-topic-text {
  font-size: 0.74rem;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.01em;
  white-space: nowrap;
}

.deck-breadcrumbs {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.66rem;
  flex-shrink: 0;
}

.deck-crumb {
  color: #64748b;
  font-weight: 500;
  white-space: nowrap;
}

.deck-crumb-sep {
  color: #cbd5e1;
  font-size: 0.62rem;
}

.deck-crumb--active {
  color: #0f172a;
  font-weight: 600;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Custom Button in Navbar ───────────────────────────────────────── */
.deck-custom-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 700;
  color: #1e293b;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.deck-custom-btn:hover {
  background: #eff6ff;
  border-color: #3b82f6;
  color: #1d4ed8;
}

.deck-custom-btn--active {
  background: #eff6ff;
  border-color: #2563eb;
  color: #1d4ed8;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
}

.deck-custom-icon {
  width: 12px;
  height: 12px;
  color: #2563eb;
  flex-shrink: 0;
}

.deck-custom-text {
  letter-spacing: 0.01em;
}

.deck-chevron-icon {
  width: 11px;
  height: 11px;
  color: #64748b;
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.deck-chevron-icon--open {
  transform: rotate(180deg);
  color: #2563eb;
}

/* ── Custom Question Selection Modal Overlay ───────────────────────── */
.custom-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999999;
  padding: 20px;
  box-sizing: border-box;
}

.custom-modal-card {
  width: 100%;
  max-width: 520px;
  max-height: 85vh;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  animation: modalScaleIn 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modalScaleIn {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(-8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.custom-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.custom-modal-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.custom-modal-icon-badge {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #eff6ff;
  color: #2563eb;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.custom-modal-title {
  margin: 0;
  font-size: 0.92rem;
  font-weight: 700;
  color: #0f172a;
}

.custom-modal-subtitle {
  margin: 2px 0 0 0;
  font-size: 0.72rem;
  color: #64748b;
}

.custom-modal-close-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
}

.custom-modal-close-btn:hover {
  background: #fee2e2;
  border-color: #fca5a5;
  color: #dc2626;
}

.custom-modal-list {
  padding: 12px;
  overflow-y: auto;
  max-height: 60vh;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.custom-modal-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 14px;
  border-radius: 8px;
  border: 1px solid #f1f5f9;
  background: #ffffff;
  cursor: pointer;
  transition: all 0.15s ease;
  gap: 12px;
}

.custom-modal-item:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
}

.custom-modal-item--active {
  background: #eff6ff !important;
  border-color: #93c5fd !important;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15) !important;
}

.custom-modal-item-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.custom-item-num {
  font-size: 0.76rem;
  font-weight: 800;
  color: #2563eb;
  padding: 4px 8px;
  background: #eff6ff;
  border-radius: 6px;
  border: 1px solid #dbeafe;
  flex-shrink: 0;
}

.custom-item-details {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.custom-item-title {
  font-size: 0.82rem;
  font-weight: 700;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.custom-item-topic {
  font-size: 0.68rem;
  color: #64748b;
  margin-top: 2px;
}

.custom-modal-item-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 20px;
  font-size: 0.68rem;
  font-weight: 600;
}

.status-pill--passed {
  background: #dcfce7;
  color: #15803d;
  border: 1px solid #bbf7d0;
}

.status-pill--partial {
  background: #fef3c7;
  color: #b45309;
  border: 1px solid #fde68a;
}

.status-pill--unattempted,
.status-pill--failed {
  background: #f1f5f9;
  color: #64748b;
  border: 1px solid #e2e8f0;
}

.status-pill-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-pill--passed .status-pill-dot {
  background: #16a34a;
}

.status-pill--partial .status-pill-dot {
  background: #d97706;
}

.status-pill--unattempted .status-pill-dot,
.status-pill--failed .status-pill-dot {
  background: #94a3b8;
}

.current-label {
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #2563eb;
  padding: 2px 6px;
  background: #dbeafe;
  border-radius: 4px;
}

/* Modal Fade Transition */
.custom-modal-fade-enter-active,
.custom-modal-fade-leave-active {
  transition: opacity 0.18s ease;
}

.custom-modal-fade-enter-from,
.custom-modal-fade-leave-to {
  opacity: 0;
}

.deck-nav-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* Pastel Difficulty Pill */
.deck-pill {
  font-size: 0.62rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.deck-pill--easy {
  background: #f0fdf4;
  color: #15803d;
  border: 1px solid #bbf7d0;
}

.deck-pill--medium {
  background: #fffbeb;
  color: #b45309;
  border: 1px solid #fde68a;
}

.deck-pill--hard {
  background: #fff1f2;
  color: #be123c;
  border: 1px solid #fecdd3;
}

.deck-meta-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.deck-meta-item {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 0.65rem;
}

.deck-meta-label {
  color: #64748b;
}

.deck-meta-val {
  color: #0f172a;
  font-weight: 700;
}

.deck-percent {
  color: #2563eb;
  font-weight: 600;
}

.deck-jump-group {
  display: flex;
  align-items: center;
  gap: 3px;
}

.deck-jump-btn {
  background: #fff5f5;
  border: 1px solid #F09191;
  border-radius: 4px;
  padding: 2px 7px;
  font-size: 0.62rem;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  transition: all 0.15s ease;
}

.deck-jump-btn:hover {
  background: #F3CFCE;
  border-color: #F09191;
  color: #EC5353;
}

.deck-jump-btn--active {
  background: #EC5353 !important;
  border-color: #EC5353 !important;
  color: #ffffff !important;
  font-weight: 700 !important;
  box-shadow: 0 1px 3px rgba(236, 83, 83, 0.25) !important;
}

.deck-jump-btn--active:hover {
  background: #EE7272 !important;
  border-color: #EE7272 !important;
  color: #ffffff !important;
}

.deck-nav-btn-group {
  display: flex;
  align-items: center;
  gap: 3px;
}

.deck-step-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 7px;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #475569;
  font-size: 0.64rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.deck-step-btn:hover:not(:disabled) {
  background: #f1f5f9;
  color: #0f172a;
}

.deck-step-btn--primary {
  background: #2563eb;
  color: #ffffff;
  border-color: #2563eb;
}

.deck-step-btn--primary:hover:not(:disabled) {
  background: #1d4ed8;
  color: #ffffff;
}

.deck-step-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.deck-arrow-svg {
  width: 10px;
  height: 10px;
}

/* ── Slide Frame ─────────────────────────────────────────────────────── */
.deck-slide-frame {
  flex: 1;
  width: 100%;
  height: calc(100% - 38px);
  overflow: hidden;
}

.deck-slide-frame :deep(.edu-page-container) {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
}

.deck-slide-frame :deep(.edu-main-scroll) {
  height: 100%;
}

/* ── State Panels (Loading / Error / Empty) ──────────────────────────── */
.deck-state-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  text-align: center;
  gap: 8px;
}

.deck-spinner {
  width: 24px;
  height: 24px;
  border: 2.5px solid #e2e8f0;
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.deck-state-text {
  font-size: 0.76rem;
  color: #64748b;
}

.deck-error-title,
.deck-empty-title {
  font-size: 0.88rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.deck-error-msg,
.deck-empty-msg {
  font-size: 0.72rem;
  color: #64748b;
  margin: 0;
}

.deck-retry-btn {
  margin-top: 6px;
  padding: 4px 12px;
  background: #2563eb;
  color: #ffffff;
  border: none;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
}
</style>
