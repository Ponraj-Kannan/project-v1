<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { authState } from '../auth'

const activeTab = ref('create') // 'create' | 'list'
const isSaving = ref(false)
const isDeleting = ref(false)
const isReordering = ref(false)
const isLoadingQuestions = ref(false)
const successMessage = ref('')
const errorMessage = ref('')
const questionsList = ref([])
const isQuestionAdminRoute = ref(false)

function checkRoute() {
  if (typeof window !== 'undefined') {
    const hash = window.location.hash
    const search = window.location.search
    isQuestionAdminRoute.value = hash === '#admin-questions' || search.includes('admin=questions')
  }
}

const isVisible = computed(() => {
  return authState.isLoggedIn && authState.isAdmin && (authState.showQuestionAdmin || isQuestionAdminRoute.value)
})

function closePanel() {
  authState.showQuestionAdmin = false
  if (isQuestionAdminRoute.value && typeof window !== 'undefined') {
    window.history.pushState(null, '', window.location.pathname)
    isQuestionAdminRoute.value = false
  }
}

// Edit state
const editingQuestionId = ref(null)
const editingQuestionOrder = ref(null)

// Contextual Insertion State: Target question to insert right after
const insertAfterSlug = ref('')

// Initialize insertAfterSlug whenever active question changes or panel opens
watch(
  [() => authState.activeQuestionSlug, () => isVisible.value],
  ([activeSlug, visible]) => {
    if (visible && !editingQuestionId.value && activeSlug) {
      insertAfterSlug.value = activeSlug
    }
  },
  { immediate: true }
)

const currentInsertTarget = computed(() => {
  if (!insertAfterSlug.value) return null
  return questionsList.value.find(q => q.slug === insertAfterSlug.value || q.id === insertAfterSlug.value) || null
})

const calculatedInsertionOrder = computed(() => {
  if (currentInsertTarget.value) {
    return (currentInsertTarget.value.display_order || 0) + 1
  }
  return questionsList.value.length + 1
})

function startAddQuestionAfter(question) {
  cancelEdit()
  insertAfterSlug.value = question.slug || question.id
  activeTab.value = 'create'
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// Delete confirmation modal state
const showDeleteConfirm = ref(false)
const questionToDelete = ref(null)

// Default boilerplate starter code per language
const STARTER_TEMPLATES = {
  java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (!sc.hasNext()) return;
        
        // Write your solution here
        
    }
}`,
  python: `import sys

def main():
    input_data = sys.stdin.read().split()
    if not input_data:
        return
    
    # Write your solution here

if __name__ == '__main__':
    main()`,
  cpp: `#include <iostream>
#include <vector>
using namespace std;

int main() {
    // Write your solution here
    
    return 0;
}`,
  c: `#include <stdio.h>

int main() {
    // Write your solution here
    
    return 0;
}`,
  javascript: `const fs = require('fs');

function main() {
    const input = fs.readFileSync('/dev/stdin', 'utf-8');
    // Write your solution here
}

main();`
}

// Initial form state
const form = reactive({
  title: '',
  difficulty: 'easy',
  topic: 'Arrays',
  subTopic: '',
  language: 'java',
  description: '',
  constraints: '• 1 <= nums.length <= 10^5\n• -10^9 <= nums[i] <= 10^9',
  inputFormat: 'A single line containing input values passed to standard input (stdin).',
  outputFormat: 'Print the evaluated result to standard output (stdout).',
  explanation: '',
  starterCode: STARTER_TEMPLATES.java,
  samples: [
    { input: '', output: '', explanation: '' }
  ],
  testCases: [
    { input: '', expectedOutput: '', isHidden: false },
    { input: '', expectedOutput: '', isHidden: true }
  ]
})

// Auto slug generation helper
const autoSlug = computed(() => {
  if (!form.title) return ''
  return form.title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
})

// Watch language change to update starter boilerplate if pristine
watch(
  () => form.language,
  (newLang) => {
    if (!form.starterCode || Object.values(STARTER_TEMPLATES).includes(form.starterCode)) {
      form.starterCode = STARTER_TEMPLATES[newLang] || STARTER_TEMPLATES.java
    }
  }
)

// ── Dynamic Sample Cases ──────────────────────────────────────────────────────
function addSample() {
  form.samples.push({ input: '', output: '', explanation: '' })
}

function removeSample(index) {
  if (form.samples.length <= 1) return
  form.samples.splice(index, 1)
}

// ── Dynamic Test Cases ────────────────────────────────────────────────────────
function addTestCase(isHidden = false) {
  form.testCases.push({ input: '', expectedOutput: '', isHidden })
}

function removeTestCase(index) {
  if (form.testCases.length <= 1) return
  form.testCases.splice(index, 1)
}

function syncFromSamples() {
  if (!form.samples || form.samples.length === 0) return
  
  const hiddenCases = form.testCases.filter(tc => tc.isHidden)
  const sampleTestCases = form.samples.map(s => ({
    input: s.input || '',
    expectedOutput: s.output || '',
    isHidden: false
  }))

  form.testCases = [...sampleTestCases, ...hiddenCases]
  successMessage.value = `Synced ${sampleTestCases.length} sample case(s) to test cases.`
  setTimeout(() => { successMessage.value = '' }, 2500)
}

// ── Broadcast questions update event to DynamicQuestionDeck ────────────────
function notifyQuestionsUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('questions-updated'))
  }
}

// ── Fetch Questions for Management Tab ────────────────────────────────────────
async function fetchQuestions() {
  isLoadingQuestions.value = true
  try {
    const res = await fetch('/api/questions?include_inactive=true')
    if (res.ok) {
      const data = await res.json()
      const list = data.questions || []
      list.sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
      questionsList.value = list
    }
  } catch (err) {
    console.warn('Could not load questions list:', err)
  } finally {
    isLoadingQuestions.value = false
  }
}

// ── Topic Management State & Methods ──────────────────────────────────────────
const topicsList = ref([])
const isLoadingTopics = ref(false)
const showAddTopicModal = ref(false)
const newTopicName = ref('')
const isCreatingTopic = ref(false)

async function fetchTopics() {
  isLoadingTopics.value = true
  try {
    const res = await fetch('/api/topics')
    if (res.ok) {
      const data = await res.json()
      topicsList.value = (data.topics || []).sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
    } else {
      const resFallback = await fetch('/api/questions?topics=true')
      if (resFallback.ok) {
        const data = await resFallback.json()
        topicsList.value = (data.topics || []).sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
      }
    }
  } catch (err) {
    console.warn('[AdminQuestionPanel] Could not load topics:', err)
  } finally {
    isLoadingTopics.value = false
  }
}

async function handleCreateTopic() {
  const name = newTopicName.value.trim()
  if (!name) return
  isCreatingTopic.value = true
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (authState.idToken) headers['Authorization'] = `Bearer ${authState.idToken}`
    if (authState.userEmail) headers['x-user-email'] = authState.userEmail

    const res = await fetch('/api/topics', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name })
    })

    if (res.ok) {
      const data = await res.json()
      if (data.topic) {
        const existingIdx = topicsList.value.findIndex(t => t.name.toLowerCase() === data.topic.name.toLowerCase())
        if (existingIdx >= 0) {
          topicsList.value[existingIdx] = data.topic
        } else {
          topicsList.value.push(data.topic)
        }
        form.topic = data.topic.name
        newTopicName.value = ''
        showAddTopicModal.value = false
        successMessage.value = `Topic '${data.topic.name}' added and selected.`
        setTimeout(() => { successMessage.value = '' }, 3000)
      }
    } else {
      const err = await res.json()
      errorMessage.value = err.error || 'Failed to create topic.'
      setTimeout(() => { errorMessage.value = '' }, 4000)
    }
  } catch (err) {
    errorMessage.value = 'Failed to create topic.'
  } finally {
    isCreatingTopic.value = false
  }
}

// ── Edit Question ─────────────────────────────────────────────────────────────
function startEditQuestion(question) {
  editingQuestionId.value = question.id || question.slug
  editingQuestionOrder.value = question.display_order || 1

  form.title = question.title || ''
  form.difficulty = question.difficulty || 'easy'
  form.topic = question.topic || ''
  if (form.topic && !topicsList.value.some(t => t.name.toLowerCase() === form.topic.toLowerCase())) {
    topicsList.value.push({
      id: question.topic_id || `temp-${Date.now()}`,
      name: form.topic,
      display_order: 99
    })
  }
  form.subTopic = question.sub_topic || ''
  form.language = question.language || 'java'
  form.description = (question.description || question.task || '').replace(/<br\s*\/?>/gi, '\n')
  form.constraints = (question.constraints || '').replace(/<br\s*\/?>/gi, '\n')
  form.inputFormat = (question.input_format || '').replace(/<br\s*\/?>/gi, '\n')
  form.outputFormat = (question.output_format || '').replace(/<br\s*\/?>/gi, '\n')
  form.explanation = (question.explanation || '').replace(/<br\s*\/?>/gi, '\n')
  form.starterCode = question.starter_code || STARTER_TEMPLATES[question.language] || STARTER_TEMPLATES.java

  // Parse Test cases
  if (Array.isArray(question.test_cases) && question.test_cases.length > 0) {
    form.testCases = question.test_cases.map(tc => ({
      input: tc.input || tc.stdin || '',
      expectedOutput: tc.expectedOutput || tc.expected_output || tc.output || '',
      isHidden: Boolean(tc.isHidden !== undefined ? tc.isHidden : tc.is_hidden)
    }))

    // Extract visible cases as samples
    const visibleCases = form.testCases.filter(tc => !tc.isHidden)
    if (visibleCases.length > 0) {
      form.samples = visibleCases.map(vc => ({
        input: vc.input,
        output: vc.expectedOutput,
        explanation: ''
      }))
    } else {
      form.samples = [{ input: form.testCases[0].input, output: form.testCases[0].expectedOutput, explanation: '' }]
    }
  } else {
    form.samples = [{ input: '', output: '', explanation: '' }]
    form.testCases = [
      { input: '', expectedOutput: '', isHidden: false },
      { input: '', expectedOutput: '', isHidden: true }
    ]
  }

  activeTab.value = 'create'
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function cancelEdit() {
  editingQuestionId.value = null
  editingQuestionOrder.value = null
  resetForm()
}

function resetForm() {
  form.title = ''
  form.topic = topicsList.value.length > 0 ? topicsList.value[0].name : 'Arrays'
  form.subTopic = ''
  form.description = ''
  form.explanation = ''
  form.samples = [{ input: '', output: '', explanation: '' }]
  form.testCases = [
    { input: '', expectedOutput: '', isHidden: false },
    { input: '', expectedOutput: '', isHidden: true }
  ]
  form.starterCode = STARTER_TEMPLATES[form.language] || STARTER_TEMPLATES.java
  insertAfterSlug.value = authState.activeQuestionSlug || ''
}

// ── Save / Update Question ────────────────────────────────────────────────────
async function saveQuestion() {
  errorMessage.value = ''
  successMessage.value = ''

  // Validation
  if (!form.title.trim()) {
    errorMessage.value = 'Question Title is required.'
    return
  }
  if (!form.description.trim()) {
    errorMessage.value = 'Problem Description is required.'
    return
  }
  if (!form.samples || form.samples.length === 0 || !form.samples[0].output.trim()) {
    errorMessage.value = 'At least 1 valid Sample Case with Expected Output is required.'
    return
  }
  if (!form.testCases || form.testCases.length === 0 || !form.testCases[0].expectedOutput.trim()) {
    errorMessage.value = 'At least 1 Test Case with Expected Output is required.'
    return
  }

  isSaving.value = true

  // Format HTML contents
  const contents = [
    { text: `<b>Problem:</b> ${form.description.replace(/\n/g, '<br>')}` }
  ]
  if (form.samples[0].input) {
    contents.push({ text: `<b>Sample Input:</b><br><code>${form.samples[0].input.replace(/\n/g, '<br>')}</code>` })
  }
  if (form.samples[0].output) {
    contents.push({ text: `<b>Expected Output:</b><br><code>${form.samples[0].output.replace(/\n/g, '<br>')}</code>` })
  }

  // Format test cases
  const formattedTestCases = form.testCases.map((tc, idx) => ({
    id: idx + 1,
    name: tc.isHidden ? `Hidden ${idx + 1}` : `Sample ${idx + 1}`,
    input: tc.input || '',
    expectedOutput: tc.expectedOutput || '',
    isHidden: Boolean(tc.isHidden)
  }))

  const payload = {
    title: form.title.trim(),
    slug: autoSlug.value,
    description: form.description.trim(),
    difficulty: form.difficulty,
    topic: form.topic.trim() || 'Core Concepts',
    sub_topic: form.subTopic.trim() || form.title.trim(),
    language: form.language,
    starter_code: form.starterCode,
    task: form.description.replace(/\n/g, '<br>'),
    input_format: form.inputFormat.replace(/\n/g, '<br>'),
    constraints: form.constraints.replace(/\n/g, '<br>'),
    output_format: form.outputFormat.replace(/\n/g, '<br>'),
    explanation: form.samples[0]?.explanation ? form.samples[0].explanation.replace(/\n/g, '<br>') : '',
    test_cases: formattedTestCases,
    total_test_cases: formattedTestCases.length,
    contents,
    score: 10,
    is_active: true
  }

  if (editingQuestionId.value) {
    payload.id = editingQuestionId.value
    if (editingQuestionOrder.value) {
      payload.display_order = editingQuestionOrder.value
    }
  } else if (insertAfterSlug.value) {
    payload.insert_after_slug = insertAfterSlug.value
  }

  try {
    const headers = { 'Content-Type': 'application/json' }
    if (authState.idToken) headers['Authorization'] = `Bearer ${authState.idToken}`
    if (authState.userEmail) headers['x-user-email'] = authState.userEmail

    const res = await fetch('/api/questions', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    })

    const data = await res.json()

    if (!res.ok || data.error) {
      throw new Error(data.error || 'Failed to save question.')
    }

    if (editingQuestionId.value) {
      successMessage.value = `Question "${payload.title}" updated successfully in-place!`
      editingQuestionId.value = null
      editingQuestionOrder.value = null
    } else {
      successMessage.value = `Question "${payload.title}" created successfully and appended to the course deck!`
    }
    
    // Refresh question list and notify dynamic deck
    await fetchQuestions()
    notifyQuestionsUpdated()

    // Reset form after short delay
    setTimeout(() => {
      resetForm()
    }, 1200)

  } catch (err) {
    errorMessage.value = err.message || 'An error occurred while saving the question.'
  } finally {
    isSaving.value = false
  }
}

// ── Rearrange Questions (Up / Down) ───────────────────────────────────────────
async function moveQuestion(index, direction) {
  if (isReordering.value) return
  if (direction === 'up' && index <= 0) return
  if (direction === 'down' && index >= questionsList.value.length - 1) return

  const targetIndex = direction === 'up' ? index - 1 : index + 1
  const list = [...questionsList.value]

  // Swap elements
  const temp = list[index]
  list[index] = list[targetIndex]
  list[targetIndex] = temp

  // Reassign display_order
  list.forEach((q, idx) => {
    q.display_order = idx + 1
  })

  questionsList.value = list
  isReordering.value = true

  try {
    const headers = { 'Content-Type': 'application/json' }
    if (authState.idToken) headers['Authorization'] = `Bearer ${authState.idToken}`
    if (authState.userEmail) headers['x-user-email'] = authState.userEmail

    const orderedIds = list.map(q => q.id || q.slug)

    const res = await fetch('/api/questions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'reorder',
        orderedIds
      })
    })

    const data = await res.json()
    if (!res.ok || data.error) {
      throw new Error(data.error || 'Failed to persist reordering.')
    }

    if (data.questions) {
      data.questions.sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
      questionsList.value = data.questions
    }

    successMessage.value = 'Question order updated and synchronized!'
    setTimeout(() => { successMessage.value = '' }, 2500)
    notifyQuestionsUpdated()
  } catch (err) {
    errorMessage.value = err.message || 'Failed to save question order.'
    setTimeout(() => { errorMessage.value = '' }, 3000)
    await fetchQuestions() // Rollback to server state
  } finally {
    isReordering.value = false
  }
}

// ── Delete Question ───────────────────────────────────────────────────────────
function promptDelete(question) {
  questionToDelete.value = question
  showDeleteConfirm.value = true
}

function cancelDelete() {
  questionToDelete.value = null
  showDeleteConfirm.value = false
}

async function confirmDeleteQuestion() {
  if (!questionToDelete.value) return
  isDeleting.value = true
  errorMessage.value = ''

  const targetTitle = questionToDelete.value.title
  const targetId = questionToDelete.value.id || questionToDelete.value.slug

  try {
    const headers = { 'Content-Type': 'application/json' }
    if (authState.idToken) headers['Authorization'] = `Bearer ${authState.idToken}`
    if (authState.userEmail) headers['x-user-email'] = authState.userEmail

    const res = await fetch('/api/questions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'delete',
        id: targetId,
        slug: questionToDelete.value.slug
      })
    })

    const data = await res.json()
    if (!res.ok || data.error) {
      throw new Error(data.error || 'Failed to delete question.')
    }

    // Immediately remove from list
    questionsList.value = questionsList.value
      .filter(q => q.id !== targetId && q.slug !== targetId)
      .map((q, idx) => ({ ...q, display_order: idx + 1 }))

    showDeleteConfirm.value = false
    questionToDelete.value = null

    successMessage.value = `Question "${targetTitle}" deleted successfully.`
    setTimeout(() => { successMessage.value = '' }, 3000)

    await fetchQuestions()
    notifyQuestionsUpdated()
  } catch (err) {
    errorMessage.value = err.message || 'Failed to delete question.'
  } finally {
    isDeleting.value = false
  }
}

onMounted(() => {
  checkRoute()
  if (typeof window !== 'undefined') {
    window.addEventListener('hashchange', checkRoute)
    window.addEventListener('popstate', checkRoute)
  }
  fetchQuestions()
  fetchTopics()
})
</script>

<template>
  <Transition name="edu-modal-fade">
    <div v-if="isVisible" class="edu-admin-overlay" @click.self="closePanel">
      <div class="edu-admin-modal">
        <!-- ── Modal Header ─────────────────────────────────────────────── -->
        <div class="edu-admin-header">
          <div class="edu-admin-header-title">
            <div class="edu-admin-header-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
            </div>
            <div>
              <h2 class="edu-admin-title">Question Administration</h2>
              <p class="edu-admin-subtitle">Create, edit, reorder, and manage coding questions across the platform</p>
            </div>
          </div>

          <!-- Header Right Actions & Tabs -->
          <div class="edu-admin-header-right">
            <div class="edu-admin-tab-pills">
              <button 
                class="edu-admin-tab-pill" 
                :class="{ 'edu-admin-tab-pill--active': activeTab === 'create' }"
                @click="activeTab = 'create'"
              >
                <svg v-if="!editingQuestionId" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="edu-tab-icon">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="edu-tab-icon">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                <span>{{ editingQuestionId ? 'Edit Question' : 'Add Question' }}</span>
              </button>

              <button 
                class="edu-admin-tab-pill" 
                :class="{ 'edu-admin-tab-pill--active': activeTab === 'list' }"
                @click="activeTab = 'list'; fetchQuestions()"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="edu-tab-icon">
                  <line x1="8" y1="6" x2="21" y2="6"/>
                  <line x1="8" y1="12" x2="21" y2="12"/>
                  <line x1="8" y1="18" x2="21" y2="18"/>
                  <line x1="3" y1="6" x2="3.01" y2="6"/>
                  <line x1="3" y1="12" x2="3.01" y2="12"/>
                  <line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
                <span>Question Bank ({{ questionsList.length }})</span>
              </button>
            </div>

            <button class="edu-admin-close-btn" @click="closePanel" title="Close Panel">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- ── Modal Body ───────────────────────────────────────────────── -->
        <div class="edu-admin-body">
          <!-- Banners -->
          <div v-if="errorMessage" class="edu-alert edu-alert--error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="edu-alert-icon">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{{ errorMessage }}</span>
          </div>

          <div v-if="successMessage" class="edu-alert edu-alert--success">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="edu-alert-icon">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <span>{{ successMessage }}</span>
          </div>

          <!-- Edit Mode Notice Banner -->
          <div v-if="activeTab === 'create' && editingQuestionId" class="edu-edit-banner">
            <div class="edu-edit-banner-left">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="edu-edit-banner-icon">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              <span>Currently editing question #{{ editingQuestionOrder }}: <strong>{{ form.title }}</strong></span>
            </div>
            <button type="button" class="edu-btn-ghost-sm" @click="cancelEdit">
              <span>Cancel Edit / Add New</span>
            </button>
          </div>

          <!-- ── TAB 1: CREATE / EDIT QUESTION FORM ────────────────────── -->
          <form v-if="activeTab === 'create'" @submit.prevent="saveQuestion" class="edu-question-form">
            <!-- Section 1: Basic Information & Insertion Placement -->
            <div class="edu-form-card">
              <div class="edu-card-title">1. Basic Information & Position</div>

              <!-- Insertion Position Selector (Only when creating a new question) -->
              <div v-if="!editingQuestionId" class="edu-insertion-banner">
                <div class="edu-insertion-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </div>
                <div class="edu-insertion-content">
                  <div class="edu-insertion-header-row">
                    <label class="edu-form-label mb-0">
                      Insertion Position
                      <span class="edu-sublabel-hint">(where this new question will appear in the course sequence)</span>
                    </label>
                  </div>
                  <select v-model="insertAfterSlug" class="edu-form-select edu-form-select--compact mt-1">
                    <option 
                      v-if="authState.activeQuestionSlug && questionsList.some(q => q.slug === authState.activeQuestionSlug)" 
                      :value="authState.activeQuestionSlug"
                    >
                      Right after currently viewed question: "{{ authState.activeQuestionTitle || authState.activeQuestionSlug }}"
                    </option>
                    <option value="">At the End of Question Bank (Position #{{ questionsList.length + 1 }})</option>
                    <option 
                      v-for="q in questionsList" 
                      :key="q.id" 
                      :value="q.slug"
                    >
                      After #{{ q.display_order }}: {{ q.title }}
                    </option>
                  </select>
                  <div class="edu-insertion-hint mt-1">
                    <span v-if="currentInsertTarget">
                      Will be inserted at <strong>Position #{{ calculatedInsertionOrder }}</strong> (right after <em>"{{ currentInsertTarget.title }}"</em>). Subsequent questions will shift down.
                    </span>
                    <span v-else>
                      Will be added at the <strong>End of Question Bank (Position #{{ questionsList.length + 1 }})</strong>.
                    </span>
                  </div>
                </div>
              </div>

              <div class="edu-form-grid-4" :class="{ 'mt-3': !editingQuestionId }">
                <div class="edu-form-group span-2">
                  <label class="edu-form-label">Question Title <span class="required">*</span></label>
                  <input
                    v-model="form.title"
                    type="text"
                    placeholder="e.g. Reverse Linked List, Two Sum"
                    required
                    class="edu-form-input"
                  />
                  <span v-if="autoSlug" class="edu-hint-text">Slug: <code>{{ autoSlug }}</code></span>
                </div>

                <div class="edu-form-group">
                  <label class="edu-form-label">Difficulty <span class="required">*</span></label>
                  <select v-model="form.difficulty" class="edu-form-select">
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>

                <div class="edu-form-group">
                  <label class="edu-form-label">Language <span class="required">*</span></label>
                  <select v-model="form.language" class="edu-form-select">
                    <option value="java">JAVA</option>
                    <option value="python">Python</option>
                    <option value="cpp">C++</option>
                    <option value="c">C</option>
                    <option value="javascript">JavaScript</option>
                  </select>
                </div>
              </div>

              <div class="edu-form-grid-2 mt-3">
                <div class="edu-form-group">
                  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                    <label class="edu-form-label" style="margin-bottom: 0;">Topic / Category <span class="required">*</span></label>
                    <button
                      type="button"
                      class="edu-topic-link"
                      @click="showAddTopicModal = true"
                      title="Add a new topic to table"
                    >
                      + Add New Topic
                    </button>
                  </div>
                  <select
                    v-model="form.topic"
                    class="edu-form-select"
                    required
                  >
                    <option value="" disabled>-- Select Topic --</option>
                    <option v-for="t in topicsList" :key="t.id" :value="t.name">
                      {{ t.name }}
                    </option>
                  </select>
                </div>

                <div class="edu-form-group">
                  <label class="edu-form-label">Sub-Topic / Practice Title</label>
                  <input
                    v-model="form.subTopic"
                    type="text"
                    placeholder="e.g. In-place Array Manipulation"
                    class="edu-form-input"
                  />
                </div>
              </div>
            </div>

            <!-- Section 2: Problem Statement & Constraints -->
            <div class="edu-form-card">
              <div class="edu-card-title">2. Problem Description & Specification</div>
              <div class="edu-form-group">
                <label class="edu-form-label">Problem Statement <span class="required">*</span></label>
                <textarea
                  v-model="form.description"
                  placeholder="Describe the task, requirements, and expected behavior in detail..."
                  required
                  rows="4"
                  class="edu-form-textarea"
                ></textarea>
              </div>

              <div class="edu-form-grid-3 mt-3">
                <div class="edu-form-group">
                  <label class="edu-form-label">Constraints</label>
                  <textarea
                    v-model="form.constraints"
                    placeholder="• 1 <= N <= 10^5&#10;• 0 <= nums[i] <= 10^9"
                    rows="3"
                    class="edu-form-textarea font-mono"
                  ></textarea>
                </div>

                <div class="edu-form-group">
                  <label class="edu-form-label">Input Format</label>
                  <textarea
                    v-model="form.inputFormat"
                    placeholder="The first line contains an integer T..."
                    rows="3"
                    class="edu-form-textarea font-mono"
                  ></textarea>
                </div>

                <div class="edu-form-group">
                  <label class="edu-form-label">Output Format</label>
                  <textarea
                    v-model="form.outputFormat"
                    placeholder="Print the evaluated result..."
                    rows="3"
                    class="edu-form-textarea font-mono"
                  ></textarea>
                </div>
              </div>
            </div>

            <!-- Section 3: Dynamic Sample Cases -->
            <div class="edu-form-card">
              <div class="edu-card-header-flex">
                <div>
                  <div class="edu-card-title">3. Sample Cases (Visible on Problem Description)</div>
                  <p class="edu-card-sub">Visible to students in the "Problem" tab as Sample 1, Sample 2, etc.</p>
                </div>
                <button type="button" class="edu-btn-secondary" @click="addSample">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="edu-btn-icon">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  <span>Add Sample</span>
                </button>
              </div>

              <div class="edu-samples-list">
                <div v-for="(sample, idx) in form.samples" :key="idx" class="edu-sample-block">
                  <div class="edu-sample-block-header">
                    <span class="edu-sample-block-title">Sample {{ idx + 1 }}</span>
                    <button
                      v-if="form.samples.length > 1"
                      type="button"
                      class="edu-btn-delete"
                      @click="removeSample(idx)"
                      title="Remove Sample"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                      <span>Delete</span>
                    </button>
                  </div>

                  <div class="edu-sample-block-fields">
                    <div class="edu-form-group">
                      <label class="edu-form-sublabel">Input (stdin)</label>
                      <textarea
                        v-model="sample.input"
                        placeholder="Enter sample input..."
                        rows="2"
                        class="edu-form-textarea font-mono"
                      ></textarea>
                    </div>

                    <div class="edu-form-group">
                      <label class="edu-form-sublabel">Expected Output (stdout) <span class="required">*</span></label>
                      <textarea
                        v-model="sample.output"
                        placeholder="Enter sample output..."
                        required
                        rows="2"
                        class="edu-form-textarea font-mono"
                      ></textarea>
                    </div>
                  </div>

                  <div class="edu-form-group mt-2">
                    <label class="edu-form-sublabel">Explanation (Optional)</label>
                    <input
                      v-model="sample.explanation"
                      type="text"
                      placeholder="e.g. Because 2 + 7 = 9, we return [0, 1]..."
                      class="edu-form-input"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Section 4: Dynamic Test Cases (Visible + Hidden) -->
            <div class="edu-form-card">
              <div class="edu-card-header-flex">
                <div>
                  <div class="edu-card-title">4. Test Cases Suite (Visible & Hidden)</div>
                  <p class="edu-card-sub">Hidden test cases are verified upon submission and not shown in the problem description.</p>
                </div>
                <div class="edu-actions-group">
                  <button type="button" class="edu-btn-ghost" @click="syncFromSamples" title="Copy all Sample cases into Test Cases">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="edu-btn-icon">
                      <polyline points="1 4 1 10 7 10"/>
                      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                    </svg>
                    <span>Sync from Samples</span>
                  </button>

                  <button type="button" class="edu-btn-secondary" @click="addTestCase(false)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="edu-btn-icon">
                      <line x1="12" y1="5" x2="12" y2="19"/>
                      <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    <span>Add Visible Case</span>
                  </button>

                  <button type="button" class="edu-btn-secondary" @click="addTestCase(true)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="edu-btn-icon">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                    <span>Add Hidden Case</span>
                  </button>
                </div>
              </div>

              <div class="edu-tc-grid">
                <div 
                  v-for="(tc, idx) in form.testCases" 
                  :key="idx" 
                  class="edu-tc-card"
                  :class="{ 'edu-tc-card--hidden': tc.isHidden }"
                >
                  <div class="edu-tc-card-header">
                    <div class="edu-tc-header-title">
                      <span class="edu-tc-badge" :class="tc.isHidden ? 'edu-tc-badge--hidden' : 'edu-tc-badge--visible'">
                        {{ tc.isHidden ? 'Hidden Case' : 'Visible Case' }} {{ idx + 1 }}
                      </span>
                    </div>

                    <div class="edu-tc-toggle-wrap">
                      <label class="edu-toggle-label">
                        <input type="checkbox" v-model="tc.isHidden" class="edu-checkbox" />
                        <span>Hidden</span>
                      </label>

                      <button
                        v-if="form.testCases.length > 1"
                        type="button"
                        class="edu-icon-btn-delete"
                        @click="removeTestCase(idx)"
                        title="Delete test case"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div class="edu-tc-card-body">
                    <div class="edu-form-group">
                      <label class="edu-form-sublabel">Input (STDIN)</label>
                      <textarea
                        v-model="tc.input"
                        placeholder="Stdin values..."
                        rows="2"
                        class="edu-form-textarea font-mono text-xs"
                      ></textarea>
                    </div>

                    <div class="edu-form-group">
                      <label class="edu-form-sublabel">Expected Output (STDOUT) <span class="required">*</span></label>
                      <textarea
                        v-model="tc.expectedOutput"
                        placeholder="Expected output..."
                        required
                        rows="2"
                        class="edu-form-textarea font-mono text-xs"
                      ></textarea>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Section 5: Starter Boilerplate Code -->
            <div class="edu-form-card">
              <div class="edu-card-title">5. Starter / Boilerplate Code ({{ form.language.toUpperCase() }})</div>
              <div class="edu-form-group">
                <textarea
                  v-model="form.starterCode"
                  placeholder="Starter template for students..."
                  rows="9"
                  class="edu-form-textarea font-mono"
                  style="tab-size: 4;"
                ></textarea>
              </div>
            </div>

            <!-- Form Actions -->
            <div class="edu-form-footer">
              <div class="edu-footer-info">
                <span v-if="editingQuestionId">Updating existing question #{{ editingQuestionOrder }} in-place.</span>
                <span v-else-if="currentInsertTarget">
                  Will be inserted at <strong>Position #{{ calculatedInsertionOrder }}</strong> (right after <em>"{{ currentInsertTarget.title }}"</em>).
                </span>
                <span v-else>
                  Will be added at the <strong>End of Question Bank (Position #{{ questionsList.length + 1 }})</strong>.
                </span>
              </div>
              <div class="edu-footer-btns">
                <button v-if="editingQuestionId" type="button" class="edu-btn-ghost" @click="cancelEdit">Cancel Edit</button>
                <button v-else type="button" class="edu-btn-ghost" @click="closePanel">Cancel</button>
                <button type="submit" class="edu-btn-primary" :disabled="isSaving">
                  <span v-if="isSaving" class="edu-spinner"></span>
                  <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="edu-btn-icon">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                    <polyline points="17 21 17 13 7 13 7 21"/>
                    <polyline points="7 3 7 8 15 8"/>
                  </svg>
                  <span>{{ isSaving ? 'Saving Question...' : (editingQuestionId ? 'Update Question' : 'Save & Publish Question') }}</span>
                </button>
              </div>
            </div>
          </form>

          <!-- ── TAB 2: EXISTING QUESTIONS LIST ────────────────────────── -->
          <div v-else class="edu-questions-list-view">
            <div v-if="isLoadingQuestions" class="edu-loading-box">
              <span class="edu-spinner-lg"></span>
              <p>Loading questions bank...</p>
            </div>

            <div v-else-if="questionsList.length === 0" class="edu-empty-box">
              <p>No questions found in the database.</p>
            </div>

            <div v-else class="edu-questions-table-wrap">
              <table class="edu-admin-table">
                <thead>
                  <tr>
                    <th style="width: 80px; text-align: center;">Order</th>
                    <th>Title & Slug</th>
                    <th>Topic</th>
                    <th>Difficulty</th>
                    <th>Test Cases</th>
                    <th>Language</th>
                    <th>Status</th>
                    <th style="width: 170px; text-align: center;">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(q, index) in questionsList" :key="q.id">
                    <!-- Order & Reordering buttons -->
                    <td class="text-center">
                      <div class="edu-order-cell">
                        <span class="edu-order-number font-mono font-bold">{{ q.display_order }}</span>
                        <div class="edu-reorder-btns">
                          <button
                            type="button"
                            class="edu-reorder-btn"
                            :disabled="index === 0 || isReordering"
                            @click="moveQuestion(index, 'up')"
                            title="Move Up"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                              <polyline points="18 15 12 9 6 15"/>
                            </svg>
                          </button>
                          <button
                            type="button"
                            class="edu-reorder-btn"
                            :disabled="index === questionsList.length - 1 || isReordering"
                            @click="moveQuestion(index, 'down')"
                            title="Move Down"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                              <polyline points="6 9 12 15 18 9"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    </td>

                    <!-- Title & Slug -->
                    <td>
                      <div class="edu-table-title">{{ q.title }}</div>
                      <div class="edu-table-slug">{{ q.slug }}</div>
                    </td>

                    <!-- Topic -->
                    <td>{{ q.topic || 'General' }}</td>

                    <!-- Difficulty -->
                    <td>
                      <span 
                        class="edu-badge"
                        :class="{
                          'edu-badge--easy': q.difficulty === 'easy',
                          'edu-badge--medium': q.difficulty === 'medium',
                          'edu-badge--hard': q.difficulty === 'hard'
                        }"
                      >
                        {{ q.difficulty ? q.difficulty.toUpperCase() : 'EASY' }}
                      </span>
                    </td>

                    <!-- Test Cases -->
                    <td>
                      <span class="font-mono text-xs">
                        {{ Array.isArray(q.test_cases) ? q.test_cases.length : q.total_test_cases }} cases
                        ({{ Array.isArray(q.test_cases) ? q.test_cases.filter(t => t.isHidden).length : '?' }} hidden)
                      </span>
                    </td>

                    <!-- Language -->
                    <td><span class="edu-lang-tag">{{ (q.language || 'java').toUpperCase() }}</span></td>

                    <!-- Status -->
                    <td>
                      <span class="edu-status-tag" :class="q.is_active ? 'active' : 'inactive'">
                        {{ q.is_active ? 'Active' : 'Inactive' }}
                      </span>
                    </td>

                    <!-- Row Actions (Insert After / Edit / Delete) -->
                    <td class="text-center">
                      <div class="edu-row-actions">
                        <button
                          type="button"
                          class="edu-action-btn edu-action-btn--add"
                          @click="startAddQuestionAfter(q)"
                          title="Insert new question right after this one"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"/>
                            <line x1="5" y1="12" x2="19" y2="12"/>
                          </svg>
                          <span>+ After</span>
                        </button>

                        <button
                          type="button"
                          class="edu-action-btn edu-action-btn--edit"
                          @click="startEditQuestion(q)"
                          title="Edit Question"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                          <span>Edit</span>
                        </button>

                        <button
                          type="button"
                          class="edu-action-btn edu-action-btn--delete"
                          @click="promptDelete(q)"
                          title="Delete Question"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          </svg>
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>

  <!-- ── Delete Confirmation Dialog Modal ─────────────────────────────── -->
  <Transition name="edu-modal-fade">
    <div v-if="showDeleteConfirm" class="edu-confirm-overlay" @click.self="cancelDelete">
      <div class="edu-confirm-modal">
        <div class="edu-confirm-header">
          <div class="edu-confirm-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div>
            <h3 class="edu-confirm-title">Delete Question</h3>
            <p class="edu-confirm-subtitle">This action cannot be undone.</p>
          </div>
        </div>

        <div class="edu-confirm-body">
          <p>
            Are you sure you want to delete <strong>"{{ questionToDelete?.title }}"</strong>?
          </p>
          <p class="edu-confirm-warning">
            This will permanently remove the question, its test cases, and its slide from the platform course deck.
          </p>
        </div>

        <div class="edu-confirm-footer">
          <button type="button" class="edu-btn-ghost" @click="cancelDelete" :disabled="isDeleting">
            Cancel
          </button>
          <button type="button" class="edu-btn-danger" @click="confirmDeleteQuestion" :disabled="isDeleting">
            <span v-if="isDeleting" class="edu-spinner"></span>
            <span v-else>Confirm Delete</span>
          </button>
        </div>
      </div>
    </div>
  </Transition>

  <!-- ── Add New Topic Dialog Modal ────────────────────────────────────── -->
  <Transition name="edu-modal-fade">
    <div v-if="showAddTopicModal" class="edu-confirm-overlay" @click.self="showAddTopicModal = false">
      <div class="edu-confirm-modal">
        <div class="edu-confirm-header">
          <div class="edu-confirm-icon" style="background: #e0e7ff; color: #4338ca;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </div>
          <div>
            <h3 class="edu-confirm-title">Add New Topic</h3>
            <p class="edu-confirm-subtitle">Topic will be saved to the database table</p>
          </div>
        </div>

        <div class="edu-confirm-body">
          <label class="edu-form-label">Topic Name <span class="required">*</span></label>
          <input
            v-model="newTopicName"
            type="text"
            placeholder="e.g. Dynamic Programming, Trees & Graphs"
            class="edu-form-input mt-1"
            @keyup.enter="handleCreateTopic"
            autofocus
          />
          <p class="edu-card-sub mt-2">
            The topic will be available to pick for all new and existing questions.
          </p>
        </div>

        <div class="edu-confirm-footer">
          <button type="button" class="edu-btn-ghost" @click="showAddTopicModal = false" :disabled="isCreatingTopic">
            Cancel
          </button>
          <button 
            type="button" 
            class="edu-btn-primary" 
            @click="handleCreateTopic" 
            :disabled="!newTopicName.trim() || isCreatingTopic"
          >
            <span v-if="isCreatingTopic" class="edu-spinner"></span>
            <span v-else>Save Topic</span>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* ── Overlay & Modal Backdrop ────────────────────────────────────────── */
.edu-admin-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 12px;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  color: #0f172a;
  height: 100%;
  font-size: 0.70rem;
}

.edu-admin-modal {
  background: #ffffff;
  border-radius: 10px;
  width: 95%;
  max-width: 940px;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 40px -12px rgba(0, 0, 0, 0.25);
  border: 1px solid #e2e8f0;
  overflow: hidden;
}

/* ── Modal Header ────────────────────────────────────────────────────── */
.edu-admin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
  gap: 10px;
}

.edu-admin-header-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.edu-admin-header-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: #f3cfce;
  color: #EC5353;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.edu-admin-header-icon svg {
  width: 15px;
  height: 15px;
}

.edu-admin-title {
  font-size: 0.88rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
  line-height: 1.2;
}

.edu-admin-subtitle {
  font-size: 0.64rem;
  color: #64748b;
  margin: 1px 0 0 0;
}

.edu-admin-header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.edu-admin-tab-pills {
  display: flex;
  background: #f1f5f9;
  padding: 2px;
  border-radius: 6px;
  gap: 3px;
}

.edu-admin-tab-pill {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  font-size: 0.68rem;
  font-weight: 600;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s ease;
}

.edu-admin-tab-pill--active {
  background: #ffffff;
  color: #EC5353;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}

.edu-tab-icon {
  width: 12px;
  height: 12px;
}

.edu-admin-close-btn {
  background: transparent;
  border: none;
  width: 26px;
  height: 26px;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  cursor: pointer;
  transition: background 0.15s;
}

.edu-admin-close-btn:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.edu-admin-close-btn svg {
  width: 14px;
  height: 14px;
}

/* ── Modal Body ──────────────────────────────────────────────────────── */
.edu-admin-body {
  padding: 14px 16px;
  overflow-y: auto;
  flex: 1;
  background: #f8fafc;
  height: 100%;
}

/* ── Alert Banners ───────────────────────────────────────────────────── */
.edu-alert {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.70rem;
  margin-bottom: 12px;
}

.edu-alert--error {
  background: #fff1f2;
  border: 1px solid #fecdd3;
  color: #be123c;
}

.edu-alert--success {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #15803d;
}

.edu-alert-icon {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
}

/* ── Edit Mode Banner ────────────────────────────────────────────────── */
.edu-edit-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fffbeb;
  border: 1px solid #fef3c7;
  color: #92400e;
  padding: 8px 12px;
  border-radius: 6px;
  margin-bottom: 12px;
  font-size: 0.70rem;
  gap: 8px;
}

.edu-edit-banner-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.edu-edit-banner-icon {
  width: 14px;
  height: 14px;
  color: #d97706;
}

.edu-btn-ghost-sm {
  background: #ffffff;
  border: 1px solid #fde68a;
  color: #92400e;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.62rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.edu-btn-ghost-sm:hover {
  background: #fef3c7;
}

/* ── Form Layout ─────────────────────────────────────────────────────── */
.edu-question-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.edu-form-card {
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  padding: 12px 14px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
}

.edu-card-title {
  font-size: 0.76rem;
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 8px;
}

.edu-card-sub {
  font-size: 0.64rem;
  color: #64748b;
  margin: 1px 0 0 0;
}

.edu-card-header-flex {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  flex-wrap: wrap;
  gap: 8px;
}

.edu-actions-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.edu-form-grid-4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.edu-form-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.edu-form-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.span-2 {
  grid-column: span 2;
}

.mt-2 { margin-top: 6px; }
.mt-3 { margin-top: 10px; }

.edu-form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.edu-form-label {
  font-size: 0.68rem;
  font-weight: 600;
  color: #334155;
}

.edu-topic-link {
  background: none;
  border: none;
  color: #4f46e5;
  font-size: 0.64rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0 4px;
  border-radius: 4px;
  transition: all 0.15s;
}

.edu-topic-link:hover {
  color: #3730a3;
  text-decoration: underline;
}

.edu-form-sublabel {
  font-size: 0.62rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.required {
  color: #EC5353;
}

.edu-form-input,
.edu-form-select,
.edu-form-textarea {
  width: 100%;
  padding: 5px 8px;
  font-size: 0.70rem;
  color: #0f172a;
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 5px;
  outline: none;
  transition: all 0.15s;
  box-sizing: border-box;
  line-height: 1.4;
}

.edu-form-input:focus,
.edu-form-select:focus,
.edu-form-textarea:focus {
  background: #ffffff;
  border-color: #EC5353;
  box-shadow: 0 0 0 2px rgba(236, 83, 83, 0.12);
}

.font-mono {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}

.text-xs {
  font-size: 0.68rem;
}

.edu-hint-text {
  font-size: 0.60rem;
  color: #64748b;
}

.edu-hint-text code {
  color: #EC5353;
  font-family: monospace;
}

/* ── Sample Blocks ───────────────────────────────────────────────────── */
.edu-samples-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.edu-sample-block {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 10px;
}

.edu-sample-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.edu-sample-block-title {
  font-size: 0.70rem;
  font-weight: 700;
  color: #0f172a;
}

.edu-sample-block-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

/* ── Test Cases Grid ─────────────────────────────────────────────────── */
.edu-tc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 8px;
}

.edu-tc-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.edu-tc-card--hidden {
  background: #fdf2f2;
  border-color: #fecdd3;
}

.edu-tc-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.edu-tc-badge {
  font-size: 0.58rem;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 3px;
}

.edu-tc-badge--visible {
  background: #e2e8f0;
  color: #334155;
}

.edu-tc-badge--hidden {
  background: #f3cfce;
  color: #EC5353;
}

.edu-tc-toggle-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}

.edu-toggle-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.62rem;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
}

.edu-checkbox {
  cursor: pointer;
  accent-color: #EC5353;
  width: 12px;
  height: 12px;
}

.edu-icon-btn-delete {
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 2px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.edu-icon-btn-delete:hover {
  color: #be123c;
  background: #ffe4e6;
}

.edu-icon-btn-delete svg {
  width: 12px;
  height: 12px;
}

.edu-tc-card-body {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

/* ── Buttons (Red Theme - Standard Scaled) ───────────────────────────── */
.edu-btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 5px 12px;
  height: 28px;
  background: #EC5353;
  color: #ffffff;
  border: 1px solid #EC5353;
  border-radius: 5px;
  font-size: 0.70rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  box-sizing: border-box;
}

.edu-btn-primary:hover:not(:disabled) {
  background: #EE7272;
  border-color: #EE7272;
}

.edu-btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.edu-btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px 9px;
  height: 26px;
  background: #f8fafc;
  color: #EC5353;
  border: 1px solid #F09191;
  border-radius: 5px;
  font-size: 0.66rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  box-sizing: border-box;
}

.edu-btn-secondary:hover {
  background: #f3cfce;
  border-color: #EC5353;
}

.edu-btn-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px 9px;
  height: 26px;
  background: transparent;
  color: #475569;
  border: 1px solid #cbd5e1;
  border-radius: 5px;
  font-size: 0.66rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  box-sizing: border-box;
}

.edu-btn-ghost:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.edu-btn-danger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px 12px;
  height: 26px;
  background: #dc2626;
  color: #ffffff;
  border: 1px solid #dc2626;
  border-radius: 5px;
  font-size: 0.68rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.edu-btn-danger:hover:not(:disabled) {
  background: #b91c1c;
  border-color: #b91c1c;
}

.edu-btn-delete {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  height: 20px;
  background: #fff1f2;
  color: #be123c;
  border: 1px solid #fecdd3;
  border-radius: 3px;
  font-size: 0.60rem;
  font-weight: 600;
  cursor: pointer;
}

.edu-btn-delete:hover {
  background: #ffe4e6;
}

.edu-btn-delete svg {
  width: 10px;
  height: 10px;
}

.edu-btn-icon {
  width: 12px;
  height: 12px;
}

/* ── Footer ──────────────────────────────────────────────────────────── */
.edu-form-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  flex-wrap: wrap;
  gap: 8px;
}

.edu-footer-info {
  font-size: 0.64rem;
  color: #64748b;
}

.edu-footer-btns {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ── Spinners ────────────────────────────────────────────────────────── */
.edu-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: edu-spin 0.7s linear infinite;
}

.edu-spinner-lg {
  width: 22px;
  height: 22px;
  border: 2.5px solid rgba(236, 83, 83, 0.2);
  border-top-color: #EC5353;
  border-radius: 50%;
  animation: edu-spin 0.7s linear infinite;
}

@keyframes edu-spin {
  to { transform: rotate(360deg); }
}

/* ── Tab 2: Questions Table ──────────────────────────────────────────── */
.edu-questions-list-view {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}

.edu-questions-table-wrap {
  overflow-x: auto;
}

.edu-admin-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.68rem;
  text-align: left;
}

.edu-admin-table th {
  background: #f8fafc;
  color: #475569;
  font-weight: 600;
  padding: 7px 10px;
  border-bottom: 1px solid #e2e8f0;
  font-size: 0.66rem;
}

.edu-admin-table td {
  padding: 7px 10px;
  border-bottom: 1px solid #f1f5f9;
  color: #1e293b;
  font-size: 0.68rem;
}

.edu-admin-table tr:hover td {
  background: #f8fafc;
}

.text-center {
  text-align: center;
}

/* Order Cell with Reorder Buttons */
.edu-order-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.edu-order-number {
  font-size: 0.72rem;
  color: #0f172a;
  min-width: 16px;
}

.edu-reorder-btns {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.edu-reorder-btn {
  background: transparent;
  border: 1px solid #e2e8f0;
  border-radius: 3px;
  width: 16px;
  height: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #475569;
  padding: 0;
  transition: all 0.15s;
}

.edu-reorder-btn:hover:not(:disabled) {
  background: #f3cfce;
  border-color: #EC5353;
  color: #EC5353;
}

.edu-reorder-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.edu-reorder-btn svg {
  width: 9px;
  height: 9px;
}

/* Row Action Buttons (Edit / Delete) */
.edu-row-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.edu-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 6px;
  border-radius: 4px;
  font-size: 0.60rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.edu-action-btn svg {
  width: 11px;
  height: 11px;
}

.edu-action-btn--add {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #15803d;
}

.edu-action-btn--add:hover {
  background: #dcfce7;
  border-color: #86efac;
  color: #166534;
}

.edu-action-btn--edit {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #334155;
}

.edu-action-btn--edit:hover {
  background: #e2e8f0;
  color: #0f172a;
  border-color: #94a3b8;
}

.edu-action-btn--delete {
  background: #fff1f2;
  border: 1px solid #fecdd3;
  color: #be123c;
}

.edu-action-btn--delete:hover {
  background: #ffe4e6;
  border-color: #f43f5e;
}

/* ── Insertion Position Banner ─────────────────────────────────────────── */
.edu-insertion-banner {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-left: 3px solid #EC5353;
  border-radius: 6px;
  margin-bottom: 8px;
}

.edu-insertion-icon {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff1f2;
  color: #EC5353;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 1px;
}

.edu-insertion-icon svg {
  width: 13px;
  height: 13px;
}

.edu-insertion-content {
  flex: 1;
  min-width: 0;
}

.edu-form-select--compact {
  height: 28px;
  padding: 2px 8px;
  font-size: 0.72rem;
  background-color: #ffffff;
}

.edu-insertion-hint {
  font-size: 0.65rem;
  color: #475569;
  line-height: 1.35;
}

.edu-insertion-hint strong {
  color: #0f172a;
}

.edu-insertion-hint em {
  color: #EC5353;
  font-style: normal;
  font-weight: 600;
}

.edu-table-title {
  font-weight: 600;
  color: #0f172a;
  font-size: 0.70rem;
}

.edu-table-slug {
  font-size: 0.60rem;
  color: #64748b;
  font-family: monospace;
}

.edu-badge {
  display: inline-block;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 0.58rem;
  font-weight: 700;
}

.edu-badge--easy {
  background: #dcfce7;
  color: #15803d;
}

.edu-badge--medium {
  background: #fef9c3;
  color: #854d0e;
}

.edu-badge--hard {
  background: #fee2e2;
  color: #b91c1c;
}

.edu-lang-tag {
  background: #f1f5f9;
  color: #334155;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 0.58rem;
  font-weight: 600;
}

.edu-status-tag {
  display: inline-block;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 0.58rem;
  font-weight: 600;
}

.edu-status-tag.active {
  background: #f0fdf4;
  color: #16a34a;
}

.edu-status-tag.inactive {
  background: #f1f5f9;
  color: #64748b;
}

.edu-loading-box,
.edu-empty-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 36px 16px;
  color: #64748b;
  font-size: 0.74rem;
  gap: 10px;
}

/* ── Confirmation Modal ──────────────────────────────────────────────── */
.edu-confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 16px;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  color: #0f172a;
}

.edu-confirm-modal {
  background: #ffffff;
  border-radius: 8px;
  width: 100%;
  max-width: 400px;
  padding: 16px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
  border: 1px solid #fecdd3;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.edu-confirm-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.edu-confirm-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #fee2e2;
  color: #dc2626;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.edu-confirm-icon svg {
  width: 18px;
  height: 18px;
}

.edu-confirm-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.edu-confirm-subtitle {
  font-size: 0.64rem;
  color: #be123c;
  margin: 1px 0 0 0;
}

.edu-confirm-body {
  font-size: 0.72rem;
  color: #334155;
  line-height: 1.4;
}

.edu-confirm-body p {
  margin: 0 0 6px 0;
}

.edu-confirm-warning {
  font-size: 0.65rem;
  color: #64748b;
}

.edu-confirm-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid #f1f5f9;
}

/* ── Modal Transitions ───────────────────────────────────────────────── */
.edu-modal-fade-enter-active,
.edu-modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.edu-modal-fade-enter-from,
.edu-modal-fade-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .edu-form-grid-4,
  .edu-form-grid-3,
  .edu-form-grid-2,
  .edu-sample-block-fields {
    grid-template-columns: 1fr;
  }
  .span-2 {
    grid-column: span 1;
  }
}
</style>
