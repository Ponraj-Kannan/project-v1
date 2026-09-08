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

        <!-- Clean Breadcrumb Navigation -->
        <nav class="deck-breadcrumbs" aria-label="Breadcrumb">
          <span class="deck-crumb">Practice</span>
          <span class="deck-crumb-sep">/</span>
          <span class="deck-crumb">{{ (currentQuestion?.language || 'JAVA').toUpperCase() }}</span>
          <span class="deck-crumb-sep">/</span>
          <span class="deck-crumb deck-crumb--active">{{ currentQuestion?.topic || 'Practice Problem' }}</span>
        </nav>

        <div class="deck-nav-divider"></div>

        <!-- Question Pills / Stepper -->
        <div class="question-pills-list">
          <button
            v-for="(q, idx) in questions"
            :key="q.id || idx"
            class="question-pill"
            :class="{
              'question-pill--active': currentQuestionIndex === idx,
              'question-pill--passed': getQuestionStatus(q.id) === 'passed',
              'question-pill--partial': getQuestionStatus(q.id) === 'partial',
              'question-pill--failed': getQuestionStatus(q.id) === 'failed'
            }"
            @click="selectQuestion(idx)"
            :title="`${q.title} (${q.difficulty || 'Easy'})`"
          >
            <span class="pill-status-dot" :class="`pill-status-dot--${getQuestionStatus(q.id)}`"></span>
            <span class="pill-number">Q{{ idx + 1 }}</span>
            <span class="pill-title">{{ q.title }}</span>
          </button>
        </div>
      </div>

      <div class="deck-nav-right">
        <!-- Metadata -->
        <div class="deck-meta-group">
          <div class="deck-meta-item">
            <span class="deck-meta-label">Score</span>
            <span class="deck-meta-val">{{ currentQuestion?.score || 10 }} pts</span>
          </div>

          <div class="deck-meta-divider"></div>

          <!-- Progress Summary -->
          <div class="deck-meta-item" v-if="questions.length > 0">
            <span class="deck-meta-label">Solved</span>
            <span class="deck-meta-val">{{ solvedCount }} / {{ questions.length }}</span>
            <span class="deck-percent">({{ completionPercent }}%)</span>
          </div>
        </div>

        <div class="deck-nav-divider"></div>

        <!-- Clean Section Jump Buttons -->
        <div class="deck-jump-group">
          <button class="deck-jump-btn" @click="scrollToSection('sec-problem')">Problem</button>
          <button class="deck-jump-btn" @click="scrollToSection('sec-compiler')">Editor</button>
          <button class="deck-jump-btn" @click="scrollToSection('sec-testcases')">Tests</button>
        </div>

        <div class="deck-nav-divider"></div>

        <!-- Question Navigation Controls -->
        <div class="deck-nav-btn-group">
          <button
            class="deck-step-btn"
            :disabled="currentQuestionIndex <= 0"
            @click="prevQuestion"
            title="Previous Question (Alt+Left)"
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
            title="Next Question (Alt+Right)"
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
      <p class="deck-empty-title">No Active Questions Found</p>
      <p class="deck-empty-msg">Questions added to the Supabase <code>questions</code> table will appear here automatically.</p>
    </div>

    <!-- ── Dynamic Question Slide Rendering ─────────────────────────────── -->
    <div v-else-if="currentQuestion" class="deck-slide-frame" :key="currentQuestion.id || currentQuestionIndex">
      <Slide
        :hide-top-navbar="true"
        :question-id="currentQuestion.id"
        :question-slug="currentQuestion.slug"
        :topic="currentQuestion.topic || 'Coding Practice'"
        :sub-topic="currentQuestion.sub_topic || currentQuestion.title"
        :difficulty="currentQuestion.difficulty || 'Easy'"
        :score="currentQuestion.score || 10"
        :contents="currentQuestion.contents || []"
        :test-cases="currentQuestion.test_cases || []"
        :language="currentQuestion.language || 'java'"
        :starter-code="currentQuestion.starter_code || ''"
        :task="currentQuestion.task || ''"
        :input-format="currentQuestion.input_format || ''"
        :constraints="currentQuestion.constraints || ''"
        :output-format="currentQuestion.output_format || ''"
        :explanation="currentQuestion.explanation || ''"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import Slide from './Slide.vue'
import { authState } from '../auth'

const questions = ref([])
const currentQuestionIndex = ref(0)
const userProgressMap = ref({})
const isLoading = ref(true)
const errorMessage = ref('')

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

function scrollToSection(sectionId) {
  const el = document.getElementById(sectionId)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

async function fetchQuestions() {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const res = await fetch('/api/questions')
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch questions`)

    const data = await res.json()
    if (Array.isArray(data.questions) && data.questions.length > 0) {
      questions.value = data.questions
    } else {
      questions.value = []
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
  }
}

function prevQuestion() {
  if (currentQuestionIndex.value > 0) {
    currentQuestionIndex.value--
  }
}

function nextQuestion() {
  if (currentQuestionIndex.value < questions.value.length - 1) {
    currentQuestionIndex.value++
  }
}

function handleKeyNavigation(e) {
  if (e.altKey && e.key === 'ArrowRight') {
    e.preventDefault()
    nextQuestion()
  } else if (e.altKey && e.key === 'ArrowLeft') {
    e.preventDefault()
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

async function onQuestionsUpdated() {
  await fetchQuestions()
  await fetchProgress()
}

onMounted(async () => {
  await fetchQuestions()
  await fetchProgress()
  window.addEventListener('keydown', handleKeyNavigation)
  window.addEventListener('questions-updated', onQuestionsUpdated)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyNavigation)
  window.removeEventListener('questions-updated', onQuestionsUpdated)
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

.question-pills-list {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
}

.question-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 0.64rem;
  color: #475569;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.question-pill:hover {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #1d4ed8;
}

.question-pill--active {
  background: #eff6ff;
  border-color: #3b82f6;
  color: #1d4ed8;
  font-weight: 700;
  box-shadow: 0 1px 2px rgba(37, 99, 235, 0.08);
}

.pill-number {
  font-weight: 700;
}

.pill-title {
  max-width: 130px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pill-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #cbd5e1;
}

.pill-status-dot--passed {
  background: #10b981;
  box-shadow: 0 0 0 2px #d1fae5;
}

.pill-status-dot--partial {
  background: #f59e0b;
  box-shadow: 0 0 0 2px #fef3c7;
}

.pill-status-dot--failed {
  background: #ef4444;
  box-shadow: 0 0 0 2px #fee2e2;
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
