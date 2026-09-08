<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  /** Array of test cases: [{ id, name, input, expectedOutput, isHidden }] */
  testCases: {
    type: Array,
    default: () => []
  },
  /** Current user code to test */
  code: {
    type: String,
    default: ''
  },
  /** Programming language */
  language: {
    type: String,
    default: 'java'
  }
})

const emit = defineEmits(['update:results', 'submit'])

// Custom input mode checkbox toggle
const isCustomInputEnabled = ref(false)

// Active tab inside runner: 'testcases' | 'custom'
const activeTab = ref('testcases')

const visibleTestCases = computed(() => {
  const visible = props.testCases.filter((tc) => !tc.isHidden)
  return visible.length > 0 ? visible : props.testCases
})

const hiddenTestCases = computed(() => {
  return props.testCases.filter((tc) => tc.isHidden)
})

const hiddenPassedCount = computed(() => {
  return hiddenTestCases.value.filter((tc) => results.value[tc.id]?.status === 'passed').length
})

const hasSubmitted = ref(false)

const selectedTestCaseId = ref(props.testCases.find(tc => !tc.isHidden)?.id || props.testCases[0]?.id || 1)

// Test case execution results map: id -> { status, actualOutput, stderr, error, executionTime }
// status: 'idle' | 'running' | 'passed' | 'failed' | 'error'
const results = ref({})
const copiedId = ref(null)

// Custom input runner state
const customInput = ref('')
const customOutput = ref('')
const customError = ref('')
const customTime = ref(null)
const isRunningCustom = ref(false)

// Overall last execution state: null | 'running_visible' | 'running_all' | 'passed_visible' | 'passed_all' | 'failed' | 'error'
const lastRunState = ref(null)
const lastRunMessage = ref('')

// Normalize string for robust output comparison (trim whitespace, normalize line breaks)
function normalizeOutput(str) {
  if (str === null || str === undefined) return ''
  return String(str)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
}

// Helper to get latest code from props or localStorage
function getEffectiveCode() {
  if (props.code && props.code.trim()) return props.code
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('oc-code-')) {
        const item = localStorage.getItem(key)
        if (item) {
          const parsed = JSON.parse(item)
          if (parsed.code && parsed.code.trim()) return parsed.code
        }
      }
    }
  } catch (e) {}
  return props.code || ''
}

// Helper to detect language from code, props, or localStorage
function getEffectiveLanguage() {
  const code = getEffectiveCode()
  if (code) {
    if (code.includes('#include') || code.includes('std::') || code.includes('using namespace std')) {
      return 'cpp'
    }
    if (code.includes('#include <stdio.h>') || (code.includes('printf(') && !code.includes('System.out'))) {
      return 'c'
    }
    if (code.includes('def ') || (code.includes('print(') && !code.includes(';') && !code.includes('System.out'))) {
      return 'python'
    }
  }

  if (props.language && props.language.trim()) {
    return props.language.toLowerCase()
  }

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('oc-code-')) {
        const item = localStorage.getItem(key)
        if (item) {
          const parsed = JSON.parse(item)
          if (parsed.lang) return parsed.lang.toLowerCase()
        }
      }
    }
  } catch (e) {}

  return 'java'
}

// Core execution helper — calls /api/run
async function executeCode(codeToRun, inputStr, lang) {
  const normLang = (lang || 'java').toLowerCase()
  const payload = {
    code: codeToRun,
    input: inputStr || '',
    language: normLang
  }

  const res = await fetch('/api/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  let data
  try {
    data = await res.json()
  } catch (e) {
    throw new Error(`Server returned HTTP ${res.status}`)
  }

  if (!data.success && data.error) {
    return {
      stdout: data.stdout || '',
      stderr: data.stderr || '',
      exception: data.error || data.exception || 'Execution error',
      executionTime: data.executionTime || 0
    }
  }

  return {
    stdout: data.stdout || '',
    stderr: data.stderr || '',
    exception: data.exception || null,
    executionTime: data.executionTime || 0
  }
}

// ── Toast Notification System (Pastel & Clean) ──────────────────────────────
const toasts = ref([])
let toastIdCounter = 0

function showToast({ type = 'info', title, message = '', duration = 3000 }) {
  const id = ++toastIdCounter
  const toast = {
    id,
    type,
    title,
    message,
    timer: null
  }

  toast.timer = setTimeout(() => {
    removeToast(id)
  }, duration)

  toasts.value.push(toast)
}

function removeToast(id) {
  const index = toasts.value.findIndex((t) => t.id === id)
  if (index !== -1) {
    if (toasts.value[index].timer) {
      clearTimeout(toasts.value[index].timer)
    }
    toasts.value.splice(index, 1)
  }
}

// State tracking for execution
const isRunningVisible = ref(false)
const isRunningAll = ref(false)
const lastTestedCode = ref('')

// Invalidate tested code when editor code changes
watch(
  () => props.code,
  (newCode, oldCode) => {
    if (newCode !== oldCode) {
      lastTestedCode.value = ''
    }
  }
)

/**
 * Execute a single test case without throwing, updating reactive state.
 */
async function runSingleTestCase(tc) {
  const codeToRun = getEffectiveCode()
  if (!codeToRun || !codeToRun.trim()) {
    results.value[tc.id] = {
      status: 'error',
      actualOutput: '',
      error: 'Please write code in the editor before running test cases.',
      executionTime: null
    }
    emit('update:results', results.value)
    return { passed: false, error: 'No code in editor' }
  }

  results.value[tc.id] = {
    status: 'running',
    actualOutput: '',
    error: '',
    executionTime: null
  }
  emit('update:results', results.value)

  try {
    const res = await executeCode(codeToRun, tc.input, getEffectiveLanguage())
    const rawStdout = res.stdout || ''
    const normActual = normalizeOutput(rawStdout)
    const normExpected = normalizeOutput(tc.expectedOutput)

    if (res.exception || (res.stderr && !rawStdout)) {
      results.value[tc.id] = {
        status: 'error',
        actualOutput: rawStdout,
        error: res.exception || res.stderr || 'Runtime error',
        executionTime: res.executionTime
      }
      emit('update:results', results.value)
      return { passed: false, error: res.exception || res.stderr || 'Runtime error' }
    } else {
      const isPassed = normActual === normExpected
      results.value[tc.id] = {
        status: isPassed ? 'passed' : 'failed',
        actualOutput: rawStdout,
        error: res.stderr || '',
        executionTime: res.executionTime
      }
      emit('update:results', results.value)
      return { passed: isPassed }
    }
  } catch (err) {
    results.value[tc.id] = {
      status: 'error',
      actualOutput: '',
      error: err.message || 'Execution failed',
      executionTime: null
    }
    emit('update:results', results.value)
    return { passed: false, error: err.message || 'Execution failed' }
  }
}

/**
 * 1. "Run Code" Button: Concurrently runs visible (sample) test cases.
 */
async function runVisibleTestCases() {
  if (isCustomInputEnabled.value) {
    return runCustomInput()
  }

  const codeToRun = getEffectiveCode()
  if (!codeToRun || !codeToRun.trim()) {
    showToast({
      type: 'error',
      title: 'No Code Found',
      message: 'Please write code in the editor before executing test cases.',
      duration: 3000
    })
    return
  }

  if (lastTestedCode.value !== codeToRun) {
    results.value = {}
    lastTestedCode.value = codeToRun
  }

  const visibleCases = props.testCases.filter((tc) => !tc.isHidden)
  const targetCases = visibleCases.length > 0 ? visibleCases : props.testCases

  isRunningVisible.value = true
  activeTab.value = 'testcases'
  lastRunState.value = 'running_visible'

  // Mark all target cases as running immediately
  for (const tc of targetCases) {
    results.value[tc.id] = {
      status: 'running',
      actualOutput: '',
      error: '',
      executionTime: null
    }
  }
  emit('update:results', results.value)

  // Run all visible test cases concurrently in parallel
  const promises = targetCases.map((tc) => runSingleTestCase(tc))
  const testResults = await Promise.all(promises)

  const passedCount = testResults.filter((r) => r.passed).length
  const allPassed = passedCount === targetCases.length

  isRunningVisible.value = false

  if (allPassed) {
    const isEntireQuestionPassed = (props.testCases.length > 0 && passedCount === props.testCases.length)
    if (isEntireQuestionPassed) {
      emit('submit', {
        casesPassed: passedCount,
        totalCases: props.testCases.length,
        allPassed: true,
        status: 'passed',
        code: codeToRun,
        results: results.value
      })
      lastRunState.value = 'passed_all'
      lastRunMessage.value = `All ${passedCount}/${passedCount} Test Cases Passed. Question Solved!`
      showToast({
        type: 'success',
        title: 'Question Solved!',
        message: `All ${passedCount} test cases passed.`,
        duration: 4000
      })
    } else {
      lastRunState.value = 'passed_visible'
      lastRunMessage.value = `All ${passedCount} sample test cases passed successfully. Click "Submit Code" to test hidden evaluation cases.`
      showToast({
        type: 'success',
        title: 'Sample Test Cases Passed',
        message: `All ${passedCount} sample cases passed. Submit to verify all test cases.`,
        duration: 3000
      })
    }
  } else {
    const firstFailed = targetCases.find(
      (tc) => results.value[tc.id]?.status === 'failed' || results.value[tc.id]?.status === 'error'
    )
    if (firstFailed) {
      selectedTestCaseId.value = firstFailed.id
    }
    lastRunState.value = 'failed'
    lastRunMessage.value = `Sample test case failed (${firstFailed?.name || `Case ${firstFailed?.id || 1}`}).`
    showToast({
      type: 'error',
      title: 'Test Case Mismatch',
      message: `Review output in ${currentTestCase.value?.name || 'test case'}.`,
      duration: 3500
    })
  }
}

/**
 * 2. "Submit Code" Button: Concurrently evaluates all test cases (including hidden cases).
 */
async function runAllTestCases() {
  const codeToRun = getEffectiveCode()
  if (!codeToRun || !codeToRun.trim()) {
    showToast({
      type: 'error',
      title: 'No Code to Submit',
      message: 'Please write code in the editor before submitting.',
      duration: 3000
    })
    return
  }

  if (lastTestedCode.value !== codeToRun) {
    results.value = {}
    lastTestedCode.value = codeToRun
  }

  hasSubmitted.value = true
  isRunningAll.value = true
  activeTab.value = 'testcases'
  lastRunState.value = 'running_all'
  lastRunMessage.value = 'Evaluating test cases in parallel...'

  // Filter cases that still need execution
  const casesToRun = props.testCases.filter((tc) => results.value[tc.id]?.status !== 'passed')

  // Mark pending cases as running
  for (const tc of casesToRun) {
    results.value[tc.id] = {
      status: 'running',
      actualOutput: '',
      error: '',
      executionTime: null
    }
  }
  emit('update:results', results.value)

  // Execute all test cases concurrently in parallel
  const promises = casesToRun.map((tc) => runSingleTestCase(tc))
  await Promise.all(promises)

  // Ensure selected tab remains on a visible case
  if (!visibleTestCases.value.some((tc) => tc.id === selectedTestCaseId.value)) {
    selectedTestCaseId.value = visibleTestCases.value[0]?.id || 1
  }

  isRunningAll.value = false

  const totalCount = props.testCases.length
  const passedCount = props.testCases.filter((tc) => results.value[tc.id]?.status === 'passed').length
  const totalHidden = hiddenTestCases.value.length
  const passedHidden = hiddenPassedCount.value
  const allPassed = passedCount === totalCount && totalCount > 0
  const status = allPassed ? 'passed' : passedCount === 0 ? 'failed' : 'partial'

  emit('submit', {
    casesPassed: passedCount,
    totalCases: totalCount,
    allPassed,
    status,
    code: codeToRun,
    results: results.value
  })

  const hiddenSummaryStr = totalHidden > 0 ? `${passedHidden}/${totalHidden} Hidden Test Cases Passed.` : ''

  if (allPassed) {
    lastRunState.value = 'passed_all'
    lastRunMessage.value = totalHidden > 0
      ? `All ${totalCount}/${totalCount} Test Cases Passed (${hiddenSummaryStr}) Question Solved!`
      : `All ${totalCount}/${totalCount} Test Cases Passed. Question Solved!`
    showToast({
      type: 'success',
      title: 'Question Solved!',
      message: totalHidden > 0 ? `${hiddenSummaryStr} All test cases passed.` : `All ${totalCount} test cases passed.`,
      duration: 4000
    })
  } else {
    // If a visible case failed, select it so the user can inspect it
    const firstFailedVisible = visibleTestCases.value.find(
      (tc) => results.value[tc.id]?.status === 'failed' || results.value[tc.id]?.status === 'error'
    )
    if (firstFailedVisible) {
      selectedTestCaseId.value = firstFailedVisible.id
    }

    lastRunState.value = 'failed'
    lastRunMessage.value = totalHidden > 0
      ? `${hiddenSummaryStr} (${passedCount}/${totalCount} total cases passed)`
      : `${passedCount}/${totalCount} test cases passed.`
    showToast({
      type: 'error',
      title: 'Test Cases Incomplete',
      message: totalHidden > 0 ? `${hiddenSummaryStr}` : `${passedCount}/${totalCount} test cases passed.`,
      duration: 3500
    })
  }
}

// Run custom input
async function runCustomInput() {
  const codeToRun = getEffectiveCode()
  if (!codeToRun || !codeToRun.trim()) {
    customError.value = 'Please write code in the editor before running.'
    return
  }

  isRunningCustom.value = true
  customOutput.value = ''
  customError.value = ''
  customTime.value = null
  activeTab.value = 'custom'

  try {
    const res = await executeCode(codeToRun, customInput.value, getEffectiveLanguage())
    customOutput.value = res.stdout || ''
    if (res.exception || res.stderr) {
      customError.value = res.exception || res.stderr
    }
    customTime.value = res.executionTime
  } catch (err) {
    customError.value = err.message || 'Execution error'
  } finally {
    isRunningCustom.value = false
  }
}

// Copy helper
async function copyInput(text, id) {
  try {
    await navigator.clipboard.writeText(text)
    copiedId.value = id
    setTimeout(() => {
      if (copiedId.value === id) copiedId.value = null
    }, 2000)
  } catch (e) {}
}

// Current selected test case object (always visible test case)
const currentTestCase = computed(() => {
  return visibleTestCases.value.find((tc) => tc.id === selectedTestCaseId.value) || visibleTestCases.value[0] || props.testCases[0]
})

// Watch custom input toggle
watch(isCustomInputEnabled, (enabled) => {
  if (enabled) {
    activeTab.value = 'custom'
  } else {
    activeTab.value = 'testcases'
  }
})

// Watch test cases prop to reset selection if needed
watch(
  () => props.testCases,
  (newVal) => {
    if (newVal && newVal.length > 0 && !visibleTestCases.value.some((tc) => tc.id === selectedTestCaseId.value)) {
      selectedTestCaseId.value = visibleTestCases.value[0]?.id || newVal[0].id
    }
  },
  { immediate: true }
)

defineExpose({
  runAllTestCases,
  runVisibleTestCases,
  runSingleTestCase
})
</script>

<template>
  <div class="edu-tc-container">
    <!-- ── Soft Pastel Status Banner ──────────────────────────────────────── -->
    <div v-if="lastRunState" class="edu-status-banner" :class="`edu-status-banner--${lastRunState}`">
      <div class="edu-status-icon">
        <svg v-if="lastRunState === 'passed_all' || lastRunState === 'passed_visible'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="edu-status-svg">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <svg v-else-if="lastRunState === 'failed' || lastRunState === 'error'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="edu-status-svg">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
        <span v-else class="edu-spinner-xs"></span>
      </div>
      <div class="edu-status-text">
        <span class="edu-status-title">
          {{
            lastRunState === 'passed_all' ? 'All Test Cases Passed' :
            lastRunState === 'passed_visible' ? 'Sample Test Cases Passed' :
            lastRunState === 'failed' ? 'Wrong Answer' :
            lastRunState === 'error' ? 'Execution Error' :
            'Running Tests...'
          }}
        </span>
        <span v-if="lastRunMessage" class="edu-status-sub">{{ lastRunMessage }}</span>
      </div>
    </div>

    <!-- ── Mode 1: Test Cases Tab ─────────────────────────────────────────── -->
    <div v-if="activeTab === 'testcases'" class="edu-tc-body">
      <!-- Horizontal Test Case Pills (Only Visible/Sample Test Cases) + Hidden Summary Pill -->
      <div class="edu-tc-tabs">
        <button
          v-for="(tc, idx) in visibleTestCases"
          :key="tc.id"
          class="edu-tc-pill"
          :class="{
            'edu-tc-pill--active': selectedTestCaseId === tc.id,
            'edu-tc-pill--passed': results[tc.id]?.status === 'passed',
            'edu-tc-pill--failed': results[tc.id]?.status === 'failed' || results[tc.id]?.status === 'error',
            'edu-tc-pill--running': results[tc.id]?.status === 'running'
          }"
          @click="selectedTestCaseId = tc.id"
        >
          <!-- Status Icon -->
          <span class="edu-pill-icon">
            <span v-if="results[tc.id]?.status === 'running'" class="edu-spinner-xs"></span>
            <svg v-else-if="results[tc.id]?.status === 'passed'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class="edu-pill-svg edu-pill-svg--green">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <svg v-else-if="results[tc.id]?.status === 'failed' || results[tc.id]?.status === 'error'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class="edu-pill-svg edu-pill-svg--red">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            <span v-else class="edu-pill-dot"></span>
          </span>
          <span class="edu-pill-title">Case {{ idx + 1 }}</span>
        </button>

        <!-- Hidden Test Cases Summary Pill (Inline right after Case tabs) -->
        <div v-if="hasSubmitted && hiddenTestCases.length > 0" class="edu-hidden-summary-pill" :class="{
          'edu-hidden-summary-pill--passed': hiddenPassedCount === hiddenTestCases.length,
          'edu-hidden-summary-pill--failed': hiddenPassedCount < hiddenTestCases.length
        }">
          <svg v-if="hiddenPassedCount === hiddenTestCases.length" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="edu-summary-svg edu-text-green">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="edu-summary-svg edu-text-red">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          <span class="edu-summary-title">
            <strong>{{ hiddenPassedCount }}/{{ hiddenTestCases.length }}</strong> Hidden Test Cases Passed
          </span>
        </div>
      </div>

      <!-- Active Test Case Card (Clean Light Pastel) -->
      <div v-if="currentTestCase" class="edu-tc-card">
        <div class="edu-tc-card-top">
          <div class="edu-tc-title-wrap">
            <span class="edu-tc-name">{{ currentTestCase.name || `Case ${currentTestCase.id}` }}</span>
          </div>
          <div v-if="results[currentTestCase.id]?.executionTime !== null && results[currentTestCase.id]?.executionTime !== undefined" class="edu-time-badge">
            <span>Runtime:</span> <strong>{{ results[currentTestCase.id].executionTime }} ms</strong>
          </div>
        </div>

        <!-- Input (stdin) -->
        <div class="edu-field-block">
          <div class="edu-field-header">
            <span class="edu-field-label">Input (stdin)</span>
            <!-- <button v-if="currentTestCase.input" class="edu-copy-action" @click="copyInput(currentTestCase.input, currentTestCase.id)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="edu-copy-icon">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              <span>{{ copiedId === currentTestCase.id ? 'Copied' : 'Copy' }}</span>
            </button> -->
          </div>
          <pre class="edu-code-field"><code>{{ currentTestCase.input || '(Empty / No input)' }}</code></pre>
        </div>

        <!-- Your Output (stdout) if executed -->
        <div v-if="results[currentTestCase.id]?.status && results[currentTestCase.id]?.status !== 'running'" class="edu-field-block">
          <div class="edu-field-header">
            <span class="edu-field-label">
              Your Output (stdout)
              <span class="edu-result-tag" :class="`edu-result-tag--${results[currentTestCase.id]?.status}`">
                {{ results[currentTestCase.id]?.status === 'passed' ? 'Pass' : 'Fail' }}
              </span>
            </span>
          </div>
          <pre class="edu-code-field" :class="{
            'edu-code-field--passed': results[currentTestCase.id]?.status === 'passed',
            'edu-code-field--failed': results[currentTestCase.id]?.status === 'failed' || results[currentTestCase.id]?.status === 'error'
          }"><code>{{ results[currentTestCase.id]?.actualOutput || '(No output produced)' }}</code></pre>

          <div v-if="results[currentTestCase.id]?.error" class="edu-error-box">
            <div class="edu-error-header">Compiler Message:</div>
            <pre class="edu-error-pre">{{ results[currentTestCase.id].error }}</pre>
          </div>
        </div>

        <!-- Expected Output -->
        <div class="edu-field-block">
          <div class="edu-field-header">
            <span class="edu-field-label">Expected Output</span>
          </div>
          <pre class="edu-code-field edu-code-field--expected"><code>{{ currentTestCase.expectedOutput || '(Empty / No expected output)' }}</code></pre>
        </div>
      </div>
    </div>

    <!-- ── Mode 2: Custom Input Tab ───────────────────────────────────────── -->
    <div v-if="activeTab === 'custom'" class="edu-tc-body">
      <div class="edu-custom-wrap">
        <div class="edu-field-block">
          <div class="edu-field-header">
            <span class="edu-field-label">Custom Standard Input (stdin)</span>
          </div>
          <textarea
            v-model="customInput"
            class="edu-custom-input"
            placeholder="Enter input values here..."
            rows="2"
          ></textarea>
        </div>

        <div v-if="customOutput || customError || customTime !== null" class="edu-field-block">
          <div class="edu-field-header">
            <span class="edu-field-label">Your Output (stdout)</span>
            <span v-if="customTime !== null" class="edu-time-badge">Runtime: <strong>{{ customTime }} ms</strong></span>
          </div>
          <pre v-if="customOutput" class="edu-code-field"><code>{{ customOutput }}</code></pre>
          <div v-if="customError" class="edu-error-box">
            <div class="edu-error-header">Error Trace:</div>
            <pre class="edu-error-pre">{{ customError }}</pre>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Clean Bottom Action Bar (Pastel) ───────────────────────────────── -->
    <div class="edu-bottom-bar">
      <!-- Left: Custom Input Toggle -->
      <label class="edu-toggle-label" title="Enable custom standard input">
        <input type="checkbox" v-model="isCustomInputEnabled" class="edu-checkbox" />
        <span>Custom input</span>
      </label>

      <!-- Right: Action Buttons (No emojis) -->
      <div class="edu-btn-group">
        <button
          class="edu-btn edu-btn--secondary"
          :class="{ 'edu-btn--loading': isRunningVisible || isRunningCustom }"
          :disabled="isRunningVisible || isRunningAll || isRunningCustom"
          @click="runVisibleTestCases"
          title="Run solution against sample cases"
        >
          <span v-if="isRunningVisible || isRunningCustom" class="edu-spinner-xs"></span>
          <svg v-else viewBox="0 0 24 24" fill="currentColor" class="edu-btn-svg">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          <span>Run Code</span>
        </button>

        <button
          class="edu-btn edu-btn--primary"
          :class="{ 'edu-btn--loading': isRunningAll }"
          :disabled="isRunningVisible || isRunningAll || isRunningCustom"
          @click="runAllTestCases"
          title="Submit solution for final evaluation"
        >
          <span v-if="isRunningAll" class="edu-spinner-xs"></span>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="edu-btn-svg">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span>Submit Code</span>
        </button>
      </div>
    </div>

    <!-- ── Toast Notifications (Pastel) ───────────────────────────────────── -->
    <Teleport to="body">
      <div class="edu-toast-stack">
        <TransitionGroup name="edu-toast">
          <div
            v-for="toast in toasts"
            :key="toast.id"
            class="edu-toast-card"
            :class="`edu-toast-card--${toast.type}`"
          >
            <div class="edu-toast-icon">
              <svg v-if="toast.type === 'success'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="edu-toast-svg">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <svg v-else-if="toast.type === 'error'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="edu-toast-svg">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="edu-toast-svg">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>

            <div class="edu-toast-body">
              <div class="edu-toast-title">{{ toast.title }}</div>
              <div v-if="toast.message" class="edu-toast-msg">{{ toast.message }}</div>
            </div>

            <button class="edu-toast-close" @click="removeToast(toast.id)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </TransitionGroup>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* ── Container (Pastel & Clean) ──────────────────────────────────────── */
.edu-tc-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: #ffffff;
  border-radius: 8px;
  font-family: 'Inter', system-ui, sans-serif;
  overflow: hidden;
}

/* ── Status Banner (Soft Pastel) ─────────────────────────────────────── */
.edu-status-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
  animation: eduFadeIn 0.2s ease;
}

.edu-status-banner--passed_all,
.edu-status-banner--passed_visible {
  /* border-bottom: 1px solid #bbf7d0; */
  color: #15803d;
}

.edu-status-banner--failed,
.edu-status-banner--error {
  /* border-bottom: 1px solid #fecdd3; */
  color: #be123c;
}

.edu-status-icon {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: currentColor;
  color: #f8fafc;
  flex-shrink: 0;
}

.edu-status-svg {
  width: 11px;
  height: 11px;
  stroke: #ffffff;
}

.edu-status-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.edu-status-title {
  font-size: 0.72rem;
  font-weight: 700;
}

.edu-status-sub {
  font-size: 0.64rem;
  color: #64748b;
}

/* ── Body ────────────────────────────────────────────────────────────── */
.edu-tc-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
  gap: 8px;
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 #ffffff;
}

/* ── Testcase Tabs (Pastel Pills) ────────────────────────────────────── */
.edu-tc-tabs {
  display: flex;
  gap: 5px;
  overflow-x: auto;
  padding: 2px 0 4px;
  flex-shrink: 0;
  scrollbar-width: none;
}

.edu-tc-tabs::-webkit-scrollbar {
  display: none;
}

.edu-tc-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #475569;
  font-size: 0.65rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.edu-tc-pill:hover {
  border: 1px solid #475569;
  background: #f8fafc;
  color: #475569;
}

.edu-tc-pill--active {
  border: 1px solid #475569;
  background: #f8fafc;
  color: #475569;
  font-weight: 700;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.15);
}

.edu-tc-pill--active .edu-pill-dot {
  background: #475569;
}

.edu-tc-pill--passed {
  border-color: #bbf7d0;
  color: #15803d;
  background: #f0fdf4;
}

.edu-tc-pill--failed {
  border-color: #fecdd3;
  color: #be123c;
  background: #fff1f2;
}

.edu-pill-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.edu-pill-svg {
  width: 10px;
  height: 10px;
}

.edu-pill-svg--green { color: #15803d; }
.edu-pill-svg--red { color: #be123c; }
.edu-pill-svg--gray { color: #94a3b8; }

.edu-pill-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #94a3b8;
}

/* ── Testcase Details Card (Pastel & Clean) ───────────────────────────── */
.edu-tc-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 8px 10px;
}

.edu-tc-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.edu-tc-title-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}

.edu-tc-name {
  font-size: 0.72rem;
  font-weight: 700;
  color: #0f172a;
}

.edu-badge-hidden {
  font-size: 0.58rem;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  color: #64748b;
  padding: 1px 5px;
  border-radius: 3px;
  font-weight: 600;
}

.edu-time-badge {
  font-size: 0.64rem;
  color: #64748b;
}

.edu-time-badge strong {
  color: #0f172a;
}

/* ── Code Display Boxes (Soft Light Monospace, Stacked Vertically) ──── */
.edu-field-block {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
}

.edu-field-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.edu-field-label {
  font-size: 0.62rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  display: flex;
  align-items: center;
  gap: 6px;
}

.edu-copy-action {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: none;
  border: none;
  color: #64748b;
  font-size: 0.62rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}

.edu-copy-action:hover {
  color: #0f172a;
  text-decoration: underline;
}

.edu-copy-icon {
  width: 10px;
  height: 10px;
}

.edu-code-field {
  margin: 0;
  padding: 6px 9px;
  border-radius: 4px;
  background: #ffffff;
  color: #0f172a;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.7rem;
  line-height: 1.4;
  border: 1px solid #e2e8f0;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 70px;
  overflow-y: auto;
  width: 50%;
}

.edu-code-field--passed {
  border-color: #bbf7d0;
  background: #f0fdf4;
  color: #15803d;
}

.edu-code-field--failed {
  border-color: #fecdd3;
  background: #fff1f2;
  color: #be123c;
}

.edu-code-field--expected {
  border-color: #e2e8f0;
  background: #ffffff;
  color: #0f172a;
}

.edu-result-tag {
  font-size: 0.56rem;
  padding: 1px 5px;
  border-radius: 3px;
  font-weight: 700;
  text-transform: uppercase;
}

.edu-result-tag--passed {
  background: #f0fdf4;
  color: #15803d;
  border: 1px solid #bbf7d0;
}

.edu-result-tag--failed,
.edu-result-tag--error {
  background: #fff1f2;
  color: #be123c;
  border: 1px solid #fecdd3;
}

/* ── Hidden Test Cases Summary Pill (Inline in Tabs) ───────────────── */
.edu-hidden-summary-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  border-radius: 4px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  font-size: 0.65rem;
  font-weight: 600;
  white-space: nowrap;
  animation: eduFadeIn 0.2s ease;
  user-select: none;
}

.edu-hidden-summary-pill--passed {
  background: #f0fdf4;
  border-color: #bbf7d0;
  color: #15803d;
}

.edu-hidden-summary-pill--failed {
  background: #fff1f2;
  border-color: #fecdd3;
  color: #be123c;
}

.edu-summary-svg {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
}

.edu-summary-title strong {
  font-weight: 700;
}

/* ── Hidden Test Case Message (Clean Pastel) ─────────────────────────── */
.edu-hidden-panel {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 5px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
}

.edu-hidden-panel--passed {
  border-color: #bbf7d0;
  background: #f0fdf4;
}

.edu-hidden-panel--failed,
.edu-hidden-panel--error {
  border-color: #fecdd3;
  background: #fff1f2;
}

.edu-hidden-icon-wrap {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.edu-hidden-svg {
  width: 12px;
  height: 12px;
  color: #64748b;
}

.edu-hidden-desc-wrap {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.edu-hidden-status-title {
  font-size: 0.72rem;
  font-weight: 700;
  color: #0f172a;
}

.edu-hidden-text {
  margin: 0;
  font-size: 0.66rem;
  color: #64748b;
  line-height: 1.4;
}

.edu-text-green { color: #15803d; }
.edu-text-red { color: #be123c; }

/* ── Error Box ───────────────────────────────────────────────────────── */
.edu-error-box {
  background: #fff1f2;
  border: 1px solid #fecdd3;
  border-radius: 4px;
  padding: 5px 8px;
  margin-top: 3px;
  width: 50%;
}

.edu-error-header {
  font-size: 0.62rem;
  font-weight: 700;
  color: #be123c;
  margin-bottom: 1px;
}

.edu-error-pre {
  margin: 0;
  font-family: monospace;
  font-size: 0.65rem;
  color: #9f1239;
  white-space: pre-wrap;
  word-break: break-all;
}

/* ── Custom Input ────────────────────────────────────────────────────── */
.edu-custom-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.edu-custom-input {
  width: 100%;
  box-sizing: border-box;
  padding: 6px 9px;
  border-radius: 4px;
  background: #ffffff;
  color: #0f172a;
  border: 1px solid #cbd5e1;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.7rem;
  resize: vertical;
}

.edu-custom-input:focus {
  outline: none;
  border-color: #3b82f6;
}

/* ── Bottom Action Bar (Pastel & Clean) ──────────────────────────────── */
.edu-bottom-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 12px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  flex-shrink: 0;
  gap: 8px;
}

.edu-toggle-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.68rem;
  color: #475569;
  cursor: pointer;
  user-select: none;
}

.edu-checkbox {
  accent-color: #2563eb;
  cursor: pointer;
  width: 13px;
  height: 13px;
}

.edu-btn-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ── Buttons (No Emojis) ─────────────────────────────────────────────── */
.edu-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 4px;
  font-size: 0.68rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  border: none;
}

.edu-btn-svg {
  width: 11px;
  height: 11px;
}

.edu-btn--secondary {
  background: #ffffff;
  color: #334155;
  border: 1px solid #cbd5e1;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}

.edu-btn--secondary:hover:not(:disabled) {
  background: #f1f5f9;
  color: #0f172a;
  border-color: #94a3b8;
}

.edu-btn--primary {
  background: #EC5353;
  color: #ffffff;
  box-shadow: 0 1px 3px rgba(236, 83, 83, 0.2);
}

.edu-btn--primary:hover:not(:disabled) {
  background: #EE7272;
  box-shadow: 0 2px 5px rgba(236, 83, 83, 0.3);
}

.edu-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── Spinners ────────────────────────────────────────────────────────── */
.edu-spinner-xs {
  width: 8px;
  height: 8px;
  border: 1.5px solid rgba(0, 0, 0, 0.15);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: eduSpin 0.6s linear infinite;
  display: inline-block;
}

@keyframes eduSpin {
  to { transform: rotate(360deg); }
}

@keyframes eduFadeIn {
  from { opacity: 0; transform: translateY(-2px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ── Toast Notifications (Pastel) ────────────────────────────────────── */
.edu-toast-stack {
  position: fixed;
  top: 14px;
  right: 14px;
  z-index: 999999;
  display: flex;
  flex-direction: column;
  gap: 6px;
  pointer-events: none;
  max-width: 320px;
  width: calc(100vw - 28px);
}

.edu-toast-card {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
  font-family: 'Inter', system-ui, sans-serif;
}

.edu-toast-card--success {
  border-left: 3px solid #10b981;
}

.edu-toast-card--error {
  border-left: 3px solid #ef4444;
}

.edu-toast-icon {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
}

.edu-toast-card--success .edu-toast-icon {
  background: #f0fdf4;
  color: #15803d;
}

.edu-toast-card--error .edu-toast-icon {
  background: #fff1f2;
  color: #be123c;
}

.edu-toast-svg {
  width: 11px;
  height: 11px;
}

.edu-toast-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 1px;
}

.edu-toast-title {
  font-size: 0.74rem;
  font-weight: 700;
  color: #0f172a;
}

.edu-toast-msg {
  font-size: 0.66rem;
  color: #64748b;
  line-height: 1.3;
}

.edu-toast-close {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 1px;
}

.edu-toast-close:hover {
  color: #0f172a;
}

.edu-toast-enter-active,
.edu-toast-leave-active {
  transition: all 0.2s ease;
}

.edu-toast-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.edu-toast-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
