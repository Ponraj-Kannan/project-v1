<template>
  <div class="edu-page-container" @wheel.stop="handleScrollWheel" @touchmove.stop>
    <!-- ── Top Navigation Bar (Pastel & Minimal, Single Slide Focused) ───── -->
    <header class="edu-top-navbar" v-if="!hideTopNavbar">
      <div class="edu-nav-left">
        <!-- Minimal Platform Brand -->
        <div class="edu-brand-badge">
          <span class="edu-brand-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="edu-icon-svg">
              <path d="M16 18l6-6-6-6"/>
              <path d="M8 6l-6 6 6 6"/>
            </svg>
          </span>
          <span class="edu-brand-name">CodeLab</span>
        </div>

        <div class="edu-nav-divider"></div>

        <!-- Clean Breadcrumb Navigation -->
        <nav class="edu-breadcrumbs" aria-label="Breadcrumb">
          <span class="edu-crumb">Practice</span>
          <span class="edu-crumb-sep">/</span>
          <span class="edu-crumb">{{ (editorLang || effectiveLanguage).toUpperCase() }}</span>
          <span class="edu-crumb-sep">/</span>
          <span class="edu-crumb edu-crumb--active">{{ effectiveTopic }}</span>
        </nav>
      </div>

      <div class="edu-nav-right">
        <!-- Metadata -->
        <div class="edu-meta-group">
          <div class="edu-meta-item">
            <span class="edu-meta-label">Score</span>
            <span class="edu-meta-val">{{ effectiveScore }} pts</span>
          </div>

          <div class="edu-meta-divider"></div>

          <div class="edu-meta-item edu-meta-item--desktop">
            <span class="edu-meta-label">Success Rate</span>
            <span class="edu-meta-val">{{ successRate || '98.5%' }}</span>
          </div>
        </div>

        <div class="edu-nav-divider"></div>

        <!-- Clean Section Jump Buttons -->
        <div class="edu-jump-group">
          <button
            class="edu-jump-btn"
            :class="{ 'edu-jump-btn--active': activeNavTab === 'problem' }"
            @click="navigateToTab('problem')"
          >Problem</button>
          <button
            class="edu-jump-btn"
            :class="{ 'edu-jump-btn--active': activeNavTab === 'editor' }"
            @click="navigateToTab('editor')"
          >Editor</button>
          <button
            class="edu-jump-btn"
            :class="{ 'edu-jump-btn--active': activeNavTab === 'tests' }"
            @click="navigateToTab('tests')"
          >Tests</button>
        </div>
      </div>
    </header>

    <!-- ── Main Sequential Document Flow (Scrollable without visible scrollbar) ── -->
    <main
      class="edu-main-scroll"
      ref="scrollContainerRef"
      @scroll.passive="handleScroll"
      @wheel.stop="handleScrollWheel"
      @touchmove.stop
    >
      <div class="edu-doc-stack">
        <!-- ═════════════════════════════════════════════════════════════════
             1. PROBLEM & QUESTION DESCRIPTION (Appears First)
             ═════════════════════════════════════════════════════════════════ -->
        <section class="edu-card" ref="problemSectionRef" id="sec-problem">
          <!-- Clean Problem Navigation Tabs -->
          <div class="edu-tab-bar">
            <button
              class="edu-tab-btn"
              :class="{ 'edu-tab-btn--active': activeTab === 'problem' }"
              @click="activeTab = 'problem'"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="edu-tab-icon">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              <span>Problem</span>
            </button>

            <button
              class="edu-tab-btn"
              :class="{ 'edu-tab-btn--active': activeTab === 'submissions' }"
              @click="activeTab = 'submissions'"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="edu-tab-icon">
                <polyline points="9 11 12 14 22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
              <span>Submissions</span>
              <span v-if="submissionList.length > 0" class="edu-count-badge">{{ submissionList.length }}</span>
            </button>
          </div>

          <!-- Problem Tab Content -->
          <div v-show="activeTab === 'problem'" class="edu-card-content">
            <div class="edu-problem-header">
              <div class="edu-problem-title-row">
                <div class="edu-problem-title">{{ problemDisplayTitle }}</div>
                <!-- Solved badge on the rightmost side of the title row -->
                <span v-if="isSolved" class="edu-tag edu-tag--solved">
                  <span>Solved</span>
                  <svg viewBox="0 0 24 24" fill="none" class="edu-solved-icon">
                    <circle cx="12" cy="12" r="9" stroke="#16a34a" stroke-width="2" fill="none"/>
                    <path d="M8 12l3 3 5-5" stroke="#16a34a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </span>
              </div>

              <div class="edu-problem-tags">
                <!-- 1. Difficulty badge (Easy/Medium/Hard) FIRST -->
                <span class="edu-tag edu-tag--difficulty" :class="`edu-tag--${effectiveDifficulty.toLowerCase()}`">
                  {{ effectiveDifficulty.toLowerCase() }}
                </span>
                <!-- 2. Language tag SECOND -->
                <span class="edu-tag">{{ (editorLang || effectiveLanguage).toUpperCase() }}</span>
                <!-- 3. Category tag ("Core Concepts") THIRD -->
                <span class="edu-tag">Core Concepts</span>
              </div>
            </div>

            <!-- Structured Content Sections -->
            <div class="edu-content-flow">
              <!-- Task / Problem Description (No TASK label) -->
              <div v-if="parsedProblem.task" class="edu-section-block">
                <div class="edu-prose" v-html="parsedProblem.task"></div>
              </div>

              <!-- General Content Items -->
              <template v-for="(item, idx) in parsedProblem.otherContents" :key="idx">
                <div v-if="item.codeEditor" class="edu-code-snippet">
                  <div class="edu-snippet-header">{{ item.lang || 'text' }}</div>
                  <pre class="edu-snippet-pre"><code>{{ item.text }}</code></pre>
                </div>
                <div
                  v-else
                  class="edu-info-banner"
                  :class="{ 'edu-info-banner--highlight': item.highlight }"
                  v-html="item.text"
                />
              </template>

              <!-- Input Format -->
              <div v-if="parsedProblem.inputFormat" class="edu-section-block">
                <div class="edu-section-label">Input Format</div>
                <div class="edu-prose" v-html="parsedProblem.inputFormat"></div>
              </div>

              <!-- Constraints -->
              <div v-if="parsedProblem.constraints" class="edu-section-block">
                <div class="edu-section-label">Constraints</div>
                <div class="edu-constraints-box" v-html="parsedProblem.constraints"></div>
              </div>

              <!-- Output Format -->
              <div v-if="parsedProblem.outputFormat" class="edu-section-block">
                <div class="edu-section-label">Output Format</div>
                <div class="edu-prose" v-html="parsedProblem.outputFormat"></div>
              </div>

              <!-- Sample Cases (Grouped: "Sample 1", "Sample 2", etc. with Input & Output sub-labels) -->
              <div v-if="parsedProblem.sampleCases && parsedProblem.sampleCases.length > 0" class="edu-samples-wrap">
                <div v-for="(sample, sIdx) in parsedProblem.sampleCases" :key="sIdx" class="edu-sample-group">
                  <!-- Group Heading: Sample 1, Sample 2 -->
                  <div class="edu-sample-group-title">Sample {{ sIdx + 1 }}</div>

                  <!-- Sub-sections: Input & Output stacked vertically -->
                  <div class="edu-sample-fields">
                    <!-- Input Sub-section -->
                    <div class="edu-sample-field">
                      <div class="edu-sample-field-header">
                        <span class="edu-sample-sublabel">Input</span>
                      </div>
                      <pre class="edu-code-box"><code>{{ sample.input || '(No input)' }}</code></pre>
                    </div>

                    <!-- Output Sub-section -->
                    <div class="edu-sample-field">
                      <div class="edu-sample-field-header">
                        <span class="edu-sample-sublabel">Output</span>
                      </div>
                      <pre class="edu-code-box"><code>{{ sample.output || '(No output)' }}</code></pre>
                    </div>
                  </div>

                  <!-- Optional Sample Explanation -->
                  <div v-if="sample.explanation" class="edu-explanation-card">
                    <div class="edu-explanation-title">Explanation {{ sIdx + 1 }}</div>
                    <div class="edu-prose" v-html="sample.explanation"></div>
                  </div>
                </div>
              </div>

              <slot name="sidebar" />
            </div>
          </div>

          <!-- Submissions Tab Content -->
          <div v-show="activeTab === 'submissions'" class="edu-card-content">
            <div class="edu-problem-header">
              <div class="edu-problem-title">Submission History</div>
              <p class="edu-tab-sub">View your previous evaluations and test results from Supabase.</p>
            </div>
            <div v-if="submissionList.length === 0" class="edu-empty-subs">
              <p>No submissions recorded yet for this question. Run your code and click "Submit Code" to test and save your progress.</p>
            </div>
            <div v-else class="edu-table-container">
              <table class="edu-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Cases Passed</th>
                    <th>Language</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(sub, i) in submissionList" :key="i">
                    <td>
                      <span class="edu-status-badge" :class="`edu-status-badge--${sub.status}`">
                        {{ sub.status === 'passed' ? 'Accepted' : (sub.status === 'partial' ? 'Partial' : 'Wrong Answer') }}
                      </span>
                    </td>
                    <td><span class="edu-score-text">{{ sub.score }}</span></td>
                    <td>{{ sub.language }}</td>
                    <td class="edu-text-muted">{{ sub.time }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- ═════════════════════════════════════════════════════════════════
             2. CODE EDITOR & COMPILER (Directly Below Question)
             ═════════════════════════════════════════════════════════════════ -->
        <section class="edu-card edu-card--editor" ref="editorSectionRef" id="sec-compiler">
          <slot
            name="editor"
            :code="editorCode"
            :language="editorLang"
            :set-code="(c) => (editorCode = c)"
          >
            <JavaRunner
              :language="editorLang || effectiveLanguage"
              :starter-code="effectiveStarterCode"
              :code-key="codeKey || effectiveSlug"
              theme="light"
              v-model:code="editorCode"
              @update:code="(c) => (editorCode = c)"
              @update:language="(l) => (editorLang = l)"
            />
          </slot>
        </section>

        <!-- ═════════════════════════════════════════════════════════════════
             3. TEST CASES & EXECUTION CONSOLE (Directly Below Compiler)
             ═════════════════════════════════════════════════════════════════ -->
        <section class="edu-card edu-card--tests" ref="testsSectionRef" id="sec-testcases">
          <TestCaseRunner
            ref="testCaseRunnerRef"
            :test-cases="effectiveTestCases"
            :code="editorCode"
            :language="editorLang || effectiveLanguage"
            @update:results="handleResultsUpdate"
            @submit="handleSubmission"
          />
        </section>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import JavaRunner from './JavaRunner.vue'
import TestCaseRunner from './TestCaseRunner.vue'
import { authState } from '../auth'

const props = defineProps({
  hideTopNavbar: {
    type: Boolean,
    default: false,
  },
  questionId: {
    type: String,
    default: '',
  },
  questionSlug: {
    type: String,
    default: '',
  },
  topic: {
    type: String,
    default: '',
  },
  subTopic: {
    type: String,
    default: '',
  },
  difficulty: {
    type: String,
    default: '',
  },
  score: {
    type: [Number, String],
    default: null,
  },
  successRate: {
    type: String,
    default: '98.5%',
  },
  contents: {
    type: Array,
    default: () => [],
  },
  testCases: {
    type: Array,
    default: () => [],
  },
  language: {
    type: String,
    default: '',
  },
  starterCode: {
    type: String,
    default: '',
  },
  codeKey: {
    type: String,
    default: '',
  },
  task: {
    type: String,
    default: '',
  },
  inputFormat: {
    type: String,
    default: '',
  },
  constraints: {
    type: String,
    default: '',
  },
  outputFormat: {
    type: String,
    default: '',
  },
  explanation: {
    type: String,
    default: '',
  },
});

const loadedQuestionData = ref(null);
const isLoadingQuestion = ref(Boolean(props.questionSlug || props.questionId));

const activeTab = ref('problem');
const activeNavTab = ref('problem');
const editorCode = ref(props.starterCode || '');
const editorLang = ref(props.language || 'java');
const copiedKey = ref(null);
const testCaseRunnerRef = ref(null);
const scrollContainerRef = ref(null);
const problemSectionRef = ref(null);
const editorSectionRef = ref(null);
const testsSectionRef = ref(null);
const isLocallySolved = ref(false);
const isSubmissionsLoaded = ref(false);

// Effective question fields (merging props + database loaded data)
const effectiveSlug = computed(() => props.questionSlug || loadedQuestionData.value?.slug || '');
const effectiveTopic = computed(() => props.topic || loadedQuestionData.value?.topic || 'Decision-making statements');
const effectiveSubTopic = computed(() => props.subTopic || loadedQuestionData.value?.sub_topic || loadedQuestionData.value?.title || '');
const effectiveTitle = computed(() => loadedQuestionData.value?.title || props.subTopic || props.topic || 'Practice Problem');
const effectiveDifficulty = computed(() => props.difficulty || loadedQuestionData.value?.difficulty || 'Easy');
const effectiveScore = computed(() => props.score ?? loadedQuestionData.value?.score ?? 10);
const effectiveLanguage = computed(() => props.language || loadedQuestionData.value?.language || 'java');
const effectiveStarterCode = computed(() => props.starterCode || loadedQuestionData.value?.starter_code || '');
const effectiveContents = computed(() => {
  if (props.contents && props.contents.length > 0) return props.contents;
  if (loadedQuestionData.value?.contents && loadedQuestionData.value.contents.length > 0) {
    return loadedQuestionData.value.contents;
  }
  return [];
});
const effectiveTestCases = computed(() => {
  if (props.testCases && props.testCases.length > 0) {
    return props.testCases;
  }
  if (loadedQuestionData.value?.test_cases && loadedQuestionData.value.test_cases.length > 0) {
    return loadedQuestionData.value.test_cases.map((tc, idx) => ({
      id: tc.id || idx + 1,
      name: tc.name || `Case ${idx + 1}`,
      input: tc.input || tc.stdin || '',
      expectedOutput: tc.expected_output || tc.expectedOutput || tc.output || '',
      isHidden: !!(tc.is_hidden || tc.isHidden)
    }));
  }
  return [];
});
const effectiveTask = computed(() => props.task || loadedQuestionData.value?.task || loadedQuestionData.value?.description || '');
const effectiveInputFormat = computed(() => props.inputFormat || loadedQuestionData.value?.input_format || '');
const effectiveConstraints = computed(() => props.constraints || loadedQuestionData.value?.constraints || '');
const effectiveOutputFormat = computed(() => props.outputFormat || loadedQuestionData.value?.output_format || '');
const effectiveExplanation = computed(() => props.explanation || loadedQuestionData.value?.explanation || '');

// Solved state key and persistence (strictly unique per question)
const questionIdentifier = computed(() => {
  return props.questionSlug || props.questionId || loadedQuestionData.value?.slug || loadedQuestionData.value?.id || props.codeKey || (props.subTopic && props.subTopic.toLowerCase() !== 'practice problem' ? props.subTopic.toLowerCase().replace(/[^a-z0-9]/g, '-') : '');
});

const storageSolvedKey = computed(() => {
  return questionIdentifier.value ? `solved_problem_${questionIdentifier.value}` : '';
});

const isSolved = computed(() => {
  const currentQId = props.questionId || loadedQuestionData.value?.id;
  const currentSlug = props.questionSlug || loadedQuestionData.value?.slug;

  // 1. If submissions have been loaded, validate strictly against submission history
  if (isSubmissionsLoaded.value) {
    return submissionList.value.some(s => {
      if (s.question_id && (currentQId || currentSlug)) {
        if (s.question_id !== currentQId && s.question_id !== currentSlug) {
          return false;
        }
      }
      return s.status === 'passed' || (s.casesPassed === s.totalCases && s.totalCases > 0);
    });
  }

  // 2. If locally marked solved in current session (e.g. freshly submitted)
  if (isLocallySolved.value) return true;

  // 3. Fallback to localStorage only while initial network fetch is pending
  if (typeof window !== 'undefined' && storageSolvedKey.value) {
    if (localStorage.getItem(storageSolvedKey.value) === 'true') {
      return true;
    }
  }
  return false;
});

// Wheel scroll handler that prevents Slidev from capturing slide navigation
function handleScrollWheel(e) {
  if (!scrollContainerRef.value) return;
  e.stopPropagation();
  scrollContainerRef.value.scrollTop += e.deltaY;
}

function navigateToTab(tabName) {
  activeNavTab.value = tabName;
  if (!scrollContainerRef.value) return;

  let targetEl = null;
  if (tabName === 'problem') targetEl = problemSectionRef.value;
  else if (tabName === 'editor') targetEl = editorSectionRef.value;
  else if (tabName === 'tests') targetEl = testsSectionRef.value;

  if (targetEl && scrollContainerRef.value) {
    const topPos = targetEl.offsetTop - 8;
    scrollContainerRef.value.scrollTo({
      top: Math.max(0, topPos),
      behavior: 'smooth'
    });
  }
}

function handleScroll() {
  if (!scrollContainerRef.value) return;
  const scrollTop = scrollContainerRef.value.scrollTop;
  const editorTop = editorSectionRef.value ? editorSectionRef.value.offsetTop - 70 : 9999;
  const testsTop = testsSectionRef.value ? testsSectionRef.value.offsetTop - 70 : 9999;

  if (scrollTop >= testsTop) {
    activeNavTab.value = 'tests';
  } else if (scrollTop >= editorTop) {
    activeNavTab.value = 'editor';
  } else {
    activeNavTab.value = 'problem';
  }
}

const problemDisplayTitle = computed(() => {
  let raw = ''
  if (effectiveSubTopic.value && effectiveSubTopic.value.toLowerCase() !== 'practice problem') {
    raw = effectiveSubTopic.value
  } else if (effectiveTitle.value && effectiveTitle.value.toLowerCase() !== 'practice problem') {
    raw = effectiveTitle.value
  } else {
    raw = props.topic || ''
  }
  // Strip out "Practice Problem:" or "Practice Problem" prefix cleanly
  const cleaned = raw.replace(/^Practice\s*Problem\s*:\s*/i, '').replace(/^Practice\s*Problem\s*/i, '').trim()
  return cleaned || raw || 'Problem'
});

// Submissions state
const submissionList = ref([]);



function formatTimeAgo(dateStr) {
  if (!dateStr) return 'Just now'
  const diff = Date.now() - new Date(dateStr).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'Just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  return `${days}d ago`
}

async function fetchQuestionData() {
  if (!props.questionSlug && !props.questionId) {
    isLoadingQuestion.value = false;
    return;
  }
  if (props.testCases && props.testCases.length > 0 && props.starterCode) {
    isLoadingQuestion.value = false;
    return;
  }

  try {
    isLoadingQuestion.value = true;
    const param = props.questionSlug
      ? `slug=${encodeURIComponent(props.questionSlug)}`
      : `id=${encodeURIComponent(props.questionId)}`;

    const res = await fetch(`/api/questions?${param}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.question) {
        loadedQuestionData.value = data.question;
        const qStarter = data.question.starter_code || '';
        const qLang = data.question.language || 'java';
        const qKey = `oc-code-${qLang}-${data.question.slug || data.question.id}`;

        let hasCustomUserCode = false;
        if (typeof window !== 'undefined') {
          const saved = localStorage.getItem(qKey);
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              if (parsed.code && !parsed.code.includes('HelloWorld') && !parsed.code.includes('Hello, World!')) {
                hasCustomUserCode = true;
                editorCode.value = parsed.code;
              }
            } catch (e) {}
          }
        }

        if (!hasCustomUserCode && qStarter) {
          editorCode.value = qStarter;
        }

        if (data.question.language) {
          editorLang.value = data.question.language;
        }

        // Set active question in authState for contextual admin insertion
        authState.activeQuestionSlug = data.question.slug || props.questionSlug || '';
        authState.activeQuestionId = data.question.id || props.questionId || '';
        authState.activeQuestionTitle = data.question.title || effectiveTitle.value || '';
      }
    }
  } catch (err) {
    console.warn('[Slide] Could not fetch question details:', err);
  } finally {
    isLoadingQuestion.value = false;
  }
}

async function fetchSubmissions() {
  const targetId = props.questionId || loadedQuestionData.value?.id
  const targetSlug = props.questionSlug || loadedQuestionData.value?.slug
  if (!targetId && !targetSlug) {
    submissionList.value = []
    isLocallySolved.value = false
    isSubmissionsLoaded.value = true
    return
  }

  try {
    const qParam = targetId
      ? `question_id=${encodeURIComponent(targetId)}`
      : `question_slug=${encodeURIComponent(targetSlug)}`

    const headers = {}
    if (authState.idToken) {
      headers['Authorization'] = `Bearer ${authState.idToken}`
    }
    if (authState.userEmail) {
      headers['x-user-email'] = authState.userEmail
    }

    const res = await fetch(`/api/submissions?${qParam}`, { headers })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data.submissions)) {
        submissionList.value = data.submissions.map(sub => ({
          id: sub.id,
          question_id: sub.question_id,
          status: sub.status,
          score: `${sub.cases_passed} / ${sub.total_cases}`,
          casesPassed: sub.cases_passed,
          totalCases: sub.total_cases,
          language: (editorLang.value || 'java').toUpperCase(),
          time: formatTimeAgo(sub.created_at),
          code: sub.submitted_code
        }))

        const hasPassed = submissionList.value.some(s => {
          if (s.question_id && (targetId || targetSlug)) {
            if (s.question_id !== targetId && s.question_id !== targetSlug) {
              return false
            }
          }
          return s.status === 'passed' || (s.casesPassed === s.totalCases && s.totalCases > 0)
        })

        isLocallySolved.value = hasPassed
        if (typeof window !== 'undefined' && storageSolvedKey.value) {
          try {
            if (hasPassed) {
              localStorage.setItem(storageSolvedKey.value, 'true');
            } else {
              localStorage.removeItem(storageSolvedKey.value);
            }
          } catch (e) {}
        }
      } else {
        submissionList.value = []
        isLocallySolved.value = false
        if (typeof window !== 'undefined' && storageSolvedKey.value) {
          try { localStorage.removeItem(storageSolvedKey.value) } catch (e) {}
        }
      }
    } else {
      submissionList.value = []
      isLocallySolved.value = false
      if (typeof window !== 'undefined' && storageSolvedKey.value) {
        try { localStorage.removeItem(storageSolvedKey.value) } catch (e) {}
      }
    }
  } catch (err) {
    console.warn('[Slide] Could not fetch submissions:', err)
  } finally {
    isSubmissionsLoaded.value = true
  }
}

async function handleSubmission(eventData) {
  const { casesPassed, totalCases, status, code } = eventData
  const scoreText = `${casesPassed} / ${totalCases}`
  const isFullPass = (status === 'passed' || (casesPassed === totalCases && totalCases > 0))

  if (isFullPass) {
    isLocallySolved.value = true;
    if (typeof window !== 'undefined' && storageSolvedKey.value) {
      try {
        localStorage.setItem(storageSolvedKey.value, 'true');
      } catch (e) {}
    }
  }

  // Optimistic UI update
  submissionList.value.unshift({
    id: `sub-temp-${Date.now()}`,
    question_id: props.questionId || loadedQuestionData.value?.id || props.questionSlug || loadedQuestionData.value?.slug,
    status,
    score: scoreText,
    casesPassed,
    totalCases,
    language: (editorLang.value || 'java').toUpperCase(),
    time: 'Just now',
    code
  })

  // Post to backend
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (authState.idToken) headers['Authorization'] = `Bearer ${authState.idToken}`
    if (authState.userEmail) headers['x-user-email'] = authState.userEmail

    const payload = {
      questionId: props.questionId || loadedQuestionData.value?.id,
      questionSlug: props.questionSlug || loadedQuestionData.value?.slug,
      casesPassed,
      totalCases,
      submittedCode: code || null
    }

    const res = await fetch('/api/submissions', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    })

    if (res.ok) {
      const result = await res.json()
      if (result && result.submission) {
        submissionList.value[0].id = result.submission.id
        submissionList.value[0].status = result.submission.status
      }
    }
  } catch (err) {
    console.error('[Slide] Failed to record submission:', err)
  }
}

function handleResultsUpdate(results) {
  // Results updated
}

watch(
  [() => props.questionId, () => props.questionSlug, () => authState.isLoggedIn],
  async () => {
    isSubmissionsLoaded.value = false
    isLocallySolved.value = false
    await fetchQuestionData()
    await fetchSubmissions()
  }
)

watch(
  () => props.starterCode,
  (newCode) => {
    if (newCode) {
      editorCode.value = newCode
    }
  }
)

watch(
  () => effectiveLanguage.value,
  (newLang) => {
    if (newLang) {
      editorLang.value = newLang.toLowerCase().trim()
    }
  },
  { immediate: true }
)

onMounted(async () => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('solved_problem_Decision-making statements')
      localStorage.removeItem('solved_problem_')
      localStorage.removeItem('solved_problem_undefined')
      localStorage.removeItem('solved_problem_null')
    } catch (e) {}
  }
  await fetchQuestionData()
  await fetchSubmissions()
})

// Copy helper
async function copyText(text, key) {
  try {
    const plainText = text.replace(/<[^>]*>?/gm, '').trim();
    await navigator.clipboard.writeText(plainText);
    copiedKey.value = key;
    setTimeout(() => {
      if (copiedKey.value === key) copiedKey.value = null;
    }, 2000);
  } catch (e) {}
}

// Intelligent content parser
const parsedProblem = computed(() => {
  let rawTask = effectiveTask.value || '';
  // Clean leading Task: or Problem: prefixes
  let task = rawTask.replace(/^(?:<b>)?(?:Problem|Task)(?::|<b>:|<\/b>:|<\/b>)?\s*/gi, '').trim();
  let inputFormat = effectiveInputFormat.value || '';
  let constraints = effectiveConstraints.value || '';
  let outputFormat = effectiveOutputFormat.value || '';
  let sampleInput = null;
  let sampleOutput = null;
  let explanation = effectiveExplanation.value || '';
  const otherContents = [];

  const sampleCases = [];
  const testCasesList = effectiveTestCases.value || [];

  if (testCasesList.length > 0) {
    const visibleList = testCasesList.filter(tc => !tc.isHidden);
    visibleList.forEach((tc, idx) => {
      sampleCases.push({
        input: tc.input,
        output: tc.expectedOutput,
        explanation: idx === 0 ? explanation : ''
      });
    });
  }

  const contentsList = effectiveContents.value || [];
  if (contentsList.length > 0) {
    contentsList.forEach(item => {
      const txt = item.text || '';
      if (txt.includes('<b>Problem:</b>') || txt.includes('<b>Task:</b>') || txt.includes('Problem:') || txt.includes('Task:')) {
        task = txt.replace(/<b>Problem:<\/b>|<b>Task:<\/b>|Problem:|Task:/gi, '').trim();
      } else if (txt.includes('<b>Sample Input:</b>') || txt.includes('Sample Input:')) {
        const match = txt.replace(/<b>Sample Input:<\/b>|Sample Input:/i, '').trim();
        sampleInput = match.replace(/<[^>]*>?/gm, '').trim();
      } else if (txt.includes('<b>Expected Output:</b>') || txt.includes('Expected Output:')) {
        const match = txt.replace(/<b>Expected Output:<\/b>|Expected Output:/i, '').trim();
        sampleOutput = match.replace(/<[^>]*>?/gm, '').trim();
      } else if (txt.includes('<b>Input Format:</b>')) {
        inputFormat = txt.replace(/<b>Input Format:<\/b>/i, '').trim();
      } else if (txt.includes('<b>Constraints:</b>')) {
        constraints = txt.replace(/<b>Constraints:<\/b>/i, '').trim();
      } else if (txt.includes('<b>Output Format:</b>')) {
        outputFormat = txt.replace(/<b>Output Format:<\/b>/i, '').trim();
      } else if (txt.includes('<b>Explanation:</b>')) {
        explanation = txt.replace(/<b>Explanation:<\/b>/i, '').trim();
      } else {
        otherContents.push(item);
      }
    });
  }

  if (sampleCases.length === 0 && (sampleInput !== null || sampleOutput !== null)) {
    sampleCases.push({
      input: sampleInput || '',
      output: sampleOutput || '',
      explanation
    });
  }

  if (!inputFormat && sampleCases.length > 0) {
    inputFormat = 'A single line containing input values passed to standard input (<code>stdin</code>).';
  }
  if (!constraints) {
    constraints = '-10<sup>9</sup> &le; num &le; 10<sup>9</sup>';
  }
  if (!outputFormat && sampleCases.length > 0) {
    outputFormat = 'Print the evaluated output to standard output (<code>stdout</code>).';
  }

  return {
    task,
    inputFormat,
    constraints,
    outputFormat,
    sampleCases,
    sampleInput,
    sampleOutput,
    explanation,
    otherContents
  };
});
</script>

<style scoped>
/* ── Top Level Layout (Clean Pastel) ─────────────────────────────────── */
.edu-page-container {
  display: flex;
  flex-direction: column;
  width: calc(100% + 64px);
  height: calc(100% + 32px);
  margin-left: -32px;
  margin-top: -16px;
  background: #f8fafc;
  color: #0f172a;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  overflow: hidden;
  box-sizing: border-box;
  font-size: 0.74rem;
}

/* ── Top Navigation Bar ──────────────────────────────────────────────── */
.edu-top-navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 14px;
  height: 38px;
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
  z-index: 10;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
}

.edu-nav-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.edu-brand-badge {
  display: flex;
  align-items: center;
  gap: 5px;
}

.edu-brand-icon {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background: #eff6ff;
  color: #2563eb;
  display: flex;
  align-items: center;
  justify-content: center;
}

.edu-icon-svg {
  width: 11px;
  height: 11px;
}

.edu-brand-name {
  font-size: 0.78rem;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.01em;
}

.edu-nav-divider {
  width: 1px;
  height: 14px;
  background: #e2e8f0;
}

.edu-breadcrumbs {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.66rem;
}

.edu-crumb {
  color: #64748b;
  font-weight: 500;
}

.edu-crumb-sep {
  color: #cbd5e1;
  font-size: 0.62rem;
}

.edu-crumb--active {
  color: #0f172a;
  font-weight: 600;
}

.edu-question-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 7px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
}

.edu-q-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #3b82f6;
}

.edu-q-title {
  font-size: 0.65rem;
  font-weight: 700;
  color: #1e293b;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.edu-nav-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.edu-pill {
  font-size: 0.62rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.edu-pill--easy {
  background: #f0fdf4;
  color: #15803d;
  border: 1px solid #bbf7d0;
}

.edu-pill--medium {
  background: #fffbeb;
  color: #b45309;
  border: 1px solid #fde68a;
}

.edu-pill--hard {
  background: #fff1f2;
  color: #be123c;
  border: 1px solid #fecdd3;
}

.edu-meta-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.edu-meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.66rem;
}

.edu-meta-item--desktop {
  display: flex;
}

@media (max-width: 900px) {
  .edu-meta-item--desktop {
    display: none;
  }
}

.edu-meta-label {
  color: #64748b;
  font-weight: 500;
}

.edu-meta-val {
  font-weight: 700;
  color: #0f172a;
}

.edu-meta-divider {
  width: 1px;
  height: 10px;
  background: #e2e8f0;
}

.edu-jump-group {
  display: flex;
  align-items: center;
  gap: 3px;
}

.edu-jump-btn {
  background: #fff5f5;
  border: 1px solid #F09191;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 0.62rem;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  transition: all 0.15s ease;
}

.edu-jump-btn:hover {
  background: #F3CFCE;
  border-color: #F09191;
  color: #EC5353;
}

.edu-jump-btn--active {
  background: #EC5353 !important;
  border-color: #EC5353 !important;
  color: #ffffff !important;
  font-weight: 700 !important;
  box-shadow: 0 1px 3px rgba(236, 83, 83, 0.25) !important;
}

.edu-jump-btn--active:hover {
  background: #EE7272 !important;
  border-color: #EE7272 !important;
  color: #ffffff !important;
}

/* ── Main Scrollable Canvas (Scrollable with NO visible scrollbar) ───── */
.edu-main-scroll {
  flex: 1;
  width: 100%;
  height: calc(100% - 38px);
  overflow-y: auto !important;
  overflow-x: hidden !important;
  overscroll-behavior: contain !important;
  padding: 12px 16px 36px;
  box-sizing: border-box;
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
}

.edu-main-scroll::-webkit-scrollbar {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
  background: transparent !important;
}

.edu-doc-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-sizing: border-box;
}

/* ── Cards & Containers ──────────────────────────────────────────────── */
.edu-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
  flex-shrink: 0;
}

.edu-card--editor {
  height: 400px;
  min-height: 400px;
}

.edu-card--tests {
  min-height: 280px;
}

/* ── Tab Bar ─────────────────────────────────────────────────────────── */
.edu-tab-bar {
  display: flex;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  padding: 0 6px;
  flex-shrink: 0;
}

.edu-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 14px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: #64748b;
  font-size: 0.7rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.edu-tab-btn:hover {
  color: #EC5353;
}

.edu-tab-btn--active {
  color: #EC5353;
  border-bottom-color: #EC5353;
  background: #ffffff;
  font-weight: 700;
}

.edu-tab-icon {
  width: 13px;
  height: 13px;
}

.edu-count-badge {
  background: #f3cfcea3;
  color: #EC5353;
  /* border: 1px solid #F09191; */
  font-size: 0.58rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 10px;
}

/* ── Problem Header & Prose ──────────────────────────────────────────── */
.edu-card-content {
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.edu-problem-header {
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 8px;
}

.edu-problem-title-row {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 12px !important;
  margin-bottom: 4px !important;
  width: 100% !important;
}

.edu-problem-title,
div.edu-problem-title {
  margin: 0 !important;
  font-size: 1.15rem !important;
  font-weight: 800 !important;
  color: #0f172a !important;
  letter-spacing: -0.015em !important;
  line-height: 1.35 !important;
}

.edu-problem-tags {
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
  margin-top: 4px !important;
}

.edu-tag {
  font-size: 0.64rem !important;
  color: #64748b !important;
  background: #f1f5f9 !important;
  padding: 2px 7px !important;
  border-radius: 4px !important;
  font-weight: 600 !important;
  line-height: 1.2 !important;
  display: inline-flex !important;
  align-items: center !important;
  gap: 4px !important;
}

.edu-tag--difficulty {
  font-weight: 700 !important;
  text-transform: capitalize !important;
}

.edu-tag--easy {
  background: #f0fdf4 !important;
  color: #15803d !important;
  border: 1px solid #bbf7d0 !important;
}

.edu-tag--medium {
  background: #fffbeb !important;
  color: #b45309 !important;
  border: 1px solid #fde68a !important;
}

.edu-tag--hard {
  background: #fff1f2 !important;
  color: #be123c !important;
  border: 1px solid #fecdd3 !important;
}

.edu-tag--solved {
  background: #f8fafc !important;
  border: 1px solid #e2e8f0 !important;
  color: #334155 !important;
  font-weight: 700 !important;
}

.edu-solved-icon {
  width: 14px !important;
  height: 14px !important;
  display: inline-block !important;
  vertical-align: middle !important;
}

.edu-content-flow {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.edu-section-block {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.edu-section-label,
div.edu-section-label {
  margin: 0 0 3px 0 !important;
  font-size: 0.64rem !important;
  font-weight: 700 !important;
  color: #475569 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.05em !important;
  line-height: 1.3 !important;
}

.edu-prose {
  font-size: 0.74rem !important;
  color: #334155 !important;
  line-height: 1.55 !important;
}

.edu-prose :deep(b),
.edu-prose :deep(strong) {
  color: #0f172a !important;
  font-weight: 600 !important;
}

.edu-prose :deep(code) {
  background: #eff6ff !important;
  border: 1px solid #dbeafe !important;
  color: #1e40af !important;
  font-family: 'JetBrains Mono', 'Fira Code', monospace !important;
  font-size: 0.7rem !important;
  padding: 1px 5px !important;
  border-radius: 3px !important;
  font-weight: 500 !important;
}

.edu-constraints-box {
  background: #f8fafc !important;
  border: 1px solid #e2e8f0 !important;
  border-radius: 5px !important;
  padding: 6px 10px !important;
  font-family: 'JetBrains Mono', 'Fira Code', monospace !important;
  font-size: 0.7rem !important;
  color: #1e293b !important;
  width: 50% !important;
  box-sizing: border-box !important;
}

@media (max-width: 768px) {
  .edu-constraints-box {
    width: 100% !important;
  }
}

/* ── Sample Blocks (Grouped: Sample 1, Sample 2 with Input/Output) ─── */
.edu-samples-wrap {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-top: 12px;
}

.edu-sample-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  
}

.edu-sample-group-title {
  font-size: 0.74rem;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.01em;
}

.edu-sample-fields {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  background: #f1f5f9;
  padding: 10px;
  border-radius: 5px;
  border: 1px solid #e2e8f0 !important;
}

.edu-sample-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 50%;
}

@media (max-width: 768px) {
  .edu-sample-field {
    width: 100%;
  }
}

.edu-sample-field-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.edu-sample-sublabel {
  font-size: 0.62rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.edu-code-box {
  margin: 0;
  padding: 6px 10px;
  background: #ffffff;
  color: #0f172a;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.7rem;
  line-height: 1.45;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-word;
  box-sizing: border-box;
}

.edu-explanation-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 8px 12px;
}

.edu-explanation-title,
div.edu-explanation-title {
  margin: 0 0 3px 0 !important;
  font-size: 0.66rem !important;
  font-weight: 700 !important;
  color: #334155 !important;
}

/* ── Code Snippet and Info Banner ────────────────────────────────────── */
.edu-code-snippet {
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  overflow: hidden;
  background: #ffffff;
}

.edu-snippet-header {
  padding: 4px 10px;
  background: #f1f5f9;
  border-bottom: 1px solid #e2e8f0;
  font-size: 0.6rem;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
}

.edu-snippet-pre {
  margin: 0;
  padding: 8px 10px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.72rem;
  color: #0f172a;
  background: #ffffff;
  line-height: 1.45;
  overflow-x: auto;
}

.edu-info-banner {
  background: #f8fafc;
  border-left: 3px solid #cbd5e1;
  padding: 8px 12px;
  border-radius: 0 5px 5px 0;
  font-size: 0.72rem;
  color: #334155;
  line-height: 1.45;
}

.edu-info-banner--highlight {
  background: #eff6ff;
  border-left-color: #3b82f6;
  color: #1e40af;
}

/* ── Submissions Table ───────────────────────────────────────────────── */
.edu-tab-sub {
  margin: 2px 0 0 0;
  font-size: 0.66rem;
  color: #64748b;
}

.edu-empty-subs {
  padding: 24px;
  text-align: center;
  color: #64748b;
  background: #f8fafc;
  border-radius: 6px;
  border: 1px dashed #cbd5e1;
  font-size: 0.72rem;
}

.edu-table-container {
  overflow-x: auto;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}

.edu-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.7rem;
  text-align: left;
}

.edu-table th {
  background: #f8fafc;
  padding: 6px 12px;
  font-weight: 700;
  color: #475569;
  border-bottom: 1px solid #e2e8f0;
}

.edu-table td {
  padding: 7px 12px;
  border-bottom: 1px solid #f1f5f9;
  color: #1e293b;
}

.edu-status-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.62rem;
  font-weight: 700;
}

.edu-status-badge--passed {
  background: #dcfce7;
  color: #15803d;
}

.edu-status-badge--partial {
  background: #fef3c7;
  color: #b45309;
}

.edu-status-badge--failed {
  background: #fee2e2;
  color: #be123c;
}

.edu-score-text {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-weight: 700;
}

.edu-text-muted {
  color: #94a3b8;
}

.edu-text-success {
  color: #15803d;
}

/* ── Leaderboard ─────────────────────────────────────────────────────── */
.edu-table-row--top td {
  background: #fffdf5;
}

.edu-rank-tag {
  font-weight: 700;
  color: #64748b;
}

.edu-rank-tag--top {
  color: #d97706;
}

.edu-user-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.edu-avatar {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #3b82f6;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.58rem;
  font-weight: 700;
}

.edu-user-name {
  font-weight: 600;
}

/* ── Editorial ───────────────────────────────────────────────────────── */
.edu-editorial-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.edu-editorial-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 10px 14px;
}

.edu-badge-hint {
  display: inline-block;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 0.58rem;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 3px;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.edu-editorial-title,
div.edu-editorial-title {
  margin: 0 0 4px 0 !important;
  font-size: 0.8rem !important;
  font-weight: 700 !important;
  color: #0f172a !important;
}

.edu-complexity-grid {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.edu-complexity-chip {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  padding: 4px 8px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.edu-comp-label {
  font-size: 0.55rem;
  color: #64748b;
  text-transform: uppercase;
}

.edu-comp-val {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  font-size: 0.72rem;
  color: #2563eb;
}
</style>