<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

// ── Props ─────────────────────────────────────────────────────────────────────
const CODE_LIBRARY = {}

const props = defineProps({
  /** The language to use in OneCompiler. Supported: java, python, cpp, c, javascript */
  language: {
    type: String,
    default: 'java'
  },
  /** Key from CODE_LIBRARY to use as starter code */
  codeKey: {
    type: String,
    default: ''
  },
  /** Direct starter code string — use codeKey when possible */
  starterCode: {
    type: String,
    default: ''
  },
  /** Hide the input panel */
  hideStdin: {
    type: Boolean,
    default: false
  },
  /** Title shown in the header bar */
  title: {
    type: String,
    default: ''
  },
  /** Theme: dark | light */
  theme: {
    type: String,
    default: 'light'
  }
})

const emit = defineEmits(['update:code', 'update:language', 'codeChange', 'languageChange'])

// ── OneCompiler language IDs ──────────────────────────────────────────────────
const OC_LANG_MAP = {
  java: 'java',
  python: 'python',
  python3: 'python',
  cpp: 'cpp',
  'c++': 'cpp',
  c: 'c',
  js: 'javascript',
  javascript: 'javascript'
}

// Track the active language
const activeLang = ref((props.language || 'java').toLowerCase().trim())

watch(
  () => props.language,
  (newLang) => {
    if (newLang) {
      const clean = newLang.toLowerCase().trim()
      if (clean && clean !== activeLang.value) {
        activeLang.value = clean
      }
    }
  },
  { immediate: true }
)

const ocLang = computed(() => {
  const lang = (activeLang.value || props.language || 'java').toLowerCase().trim()
  return OC_LANG_MAP[lang] || lang
})

// Default standard boilerplate templates per language
const DEFAULT_BOILERPLATES = {
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

const defaultLanguageBoilerplate = computed(() => {
  const lang = ocLang.value
  return DEFAULT_BOILERPLATES[lang] || DEFAULT_BOILERPLATES.java
})

// Resolved code: do not inject starter or boilerplate code into the editor
const resolvedCode = computed(() => '')

// Supported languages in Python Tutor
const ptLang = computed(() => {
  const lang = ocLang.value
  if (lang === 'python') return '3'
  if (lang === 'java') return 'java'
  if (lang === 'cpp') return 'cpp'
  if (lang === 'c') return 'c'
  if (lang === 'javascript') return 'js'
  return null
})

const isVisualizerSupported = computed(() => ptLang.value !== null)

const langLabel = computed(() => {
  const l = ocLang.value
  if (l === 'cpp') return 'C++'
  if (l === 'c') return 'C'
  if (l === 'javascript') return 'JavaScript'
  return l.charAt(0).toUpperCase() + l.slice(1)
})

const activeFileName = computed(() => {
  const l = ocLang.value
  if (l === 'python') return 'main.py'
  if (l === 'cpp') return 'Main.cpp'
  if (l === 'c') return 'main.c'
  if (l === 'javascript') return 'index.js'
  return 'Main.java'
})

// ── OneCompiler iframe URL ──────────────────────────────────────────────────
const storageKey = computed(() => `oc-code-${ocLang.value}-${props.codeKey || 'default'}`)

const getSavedCode = () => {
  if (typeof window === 'undefined') return null
  const saved = localStorage.getItem(storageKey.value)
  if (!saved) return null
  try {
    const parsed = JSON.parse(saved)
    if (!parsed || !parsed.code) return null
    return parsed.code
  } catch (e) {
    return null
  }
}

const oneCompilerUrl = computed(() => {
  const base = `https://onecompiler.com/embed/${ocLang.value}`
  const params = new URLSearchParams({
    theme: props.theme || 'light',
    hideNewFileOption: 'true',
    hideRun: 'true',
    hideTitle: 'true',
    listenToEvents: 'true',
    codeChangeEvent: 'true',
    disableCopyPaste: 'true',
    fontSize: '12',
  })
  if (props.hideStdin) {
    params.set('hideStdin', 'true')
  }

  // Do not set code param with starter/boilerplate code
  return `${base}?${params.toString()}`
})

// ── Python Tutor Visualizer & Fullscreen Compiler ────────────────────────────
const showVisualizer = ref(false)
const showVisualizerWarning = ref(false)
const showCompiler = ref(false)
const isExecuting = ref(false)

const visualizerCode = ref('')
const visualizerStdin = ref('')
const ocFrameRef = ref(null)
const fsOcFrameRef = ref(null)

let runTimeout = null

const sendBoilerplateToOneCompiler = (codeToInject) => {
  if (!codeToInject) return

  const payload = {
    eventType: 'populateCode',
    language: ocLang.value,
    files: [
      {
        name: activeFileName.value,
        content: codeToInject
      }
    ]
  }

  try {
    ocFrameRef.value?.contentWindow?.postMessage(payload, '*')
    fsOcFrameRef.value?.contentWindow?.postMessage(payload, '*')
  } catch (e) {}
}

const triggerRun = () => {
  isExecuting.value = true
  if (runTimeout) clearTimeout(runTimeout)
  const target = showCompiler.value ? fsOcFrameRef.value : ocFrameRef.value
  target?.contentWindow?.postMessage({ eventType: 'triggerRun' }, '*')
  runTimeout = setTimeout(() => {
    isExecuting.value = false
  }, 4000)
}

function handleLanguageSelect(newLang) {
  if (!newLang) return
  const clean = newLang.toLowerCase().trim()
  activeLang.value = clean
  emit('update:language', clean)
  emit('languageChange', clean)
}

const openVisualizer = () => {
  const code = visualizerCode.value || ''
  if (!code.trim()) {
    showVisualizerWarning.value = true
    return
  }
  showVisualizer.value = true
}

const openCompiler = () => {
  showCompiler.value = true
  showVisualizer.value = false
}

const visualizerUrl = computed(() => {
  if (!ptLang.value) return ''
  const encodedCode = encodeURIComponent(visualizerCode.value || '')
  const inputLines = visualizerStdin.value ? visualizerStdin.value.split('\n') : []
  const encodedInput = encodeURIComponent(JSON.stringify(inputLines))
  return `https://pythontutor.com/iframe-embed.html#code=${encodedCode}&cumulative=false&heapPrimitives=nevernest&mode=display&origin=opt-frontend.js&py=${ptLang.value}&rawInputLstJSON=${encodedInput}&textReferences=false`
})

const fullscreenCompilerUrl = computed(() => {
  const base = `https://onecompiler.com/embed/${ocLang.value}`
  const params = new URLSearchParams({
    theme: props.theme || 'light',
    hideNewFileOption: 'true',
    hideRun: 'true',
    hideTitle: 'true',
    listenToEvents: 'true',
    codeChangeEvent: 'true',
    disableCopyPaste: 'true',
    fontSize: '12',
  })
  if (props.hideStdin) {
    params.set('hideStdin', 'true')
  }
  const liveCode = visualizerCode.value
  if (liveCode) {
    params.set('code', liveCode)
  }
  return `${base}?${params.toString()}`
})

const onIframeLoad = () => {
  try {
    ocFrameRef.value?.contentWindow?.postMessage(
      { type: 'settings', fontSize: 12 },
      '*'
    )
  } catch(e) {}
}

if (typeof window !== 'undefined') {
  window.addEventListener('message', (event) => {
    if (!event.data) return
    if (event.data.source === 'vue-devtools-proxy') return
    if (
      ocFrameRef.value &&
      event.source &&
      event.source !== ocFrameRef.value.contentWindow &&
      (!fsOcFrameRef.value || event.source !== fsOcFrameRef.value.contentWindow)
    ) {
      return
    }

    // Reset isExecuting when output or completion event arrives
    if (
      event.data.type === 'result' ||
      event.data.action === 'runComplete' ||
      event.data.event === 'runComplete' ||
      event.data.eventType === 'runComplete' ||
      event.data.type === 'output' ||
      event.data.status !== undefined ||
      event.data.stdout !== undefined ||
      event.data.stderr !== undefined ||
      event.data.result !== undefined ||
      (event.data.data && typeof event.data.data === 'object' && (event.data.data.status || event.data.data.stdout !== undefined))
    ) {
      isExecuting.value = false
      if (runTimeout) {
        clearTimeout(runTimeout)
        runTimeout = null
      }
    }

    if (event.data.language && typeof event.data.language === 'string') {
      const receivedLang = event.data.language.toLowerCase().trim()
      if (receivedLang && receivedLang !== activeLang.value) {
        activeLang.value = receivedLang
        emit('update:language', activeLang.value)
        emit('languageChange', activeLang.value)
      }
    }

    if (event.data.files && Array.isArray(event.data.files) && event.data.files.length > 0) {
      const fname = (event.data.files[0].name || '').toLowerCase()
      let detectedLang = null
      if (fname.endsWith('.cpp') || fname.endsWith('.cxx') || fname.endsWith('.cc')) detectedLang = 'cpp'
      else if (fname.endsWith('.c')) detectedLang = 'c'
      else if (fname.endsWith('.py')) detectedLang = 'python'
      else if (fname.endsWith('.java')) detectedLang = 'java'
      else if (fname.endsWith('.js')) detectedLang = 'javascript'

      if (detectedLang && detectedLang !== activeLang.value) {
        activeLang.value = detectedLang
        emit('update:language', detectedLang)
        emit('languageChange', detectedLang)
      }
    }
    
    let newCode = null
    if (event.data.files && Array.isArray(event.data.files) && event.data.files.length > 0 && event.data.files[0].content !== undefined) {
      newCode = event.data.files[0].content
    } else if (typeof event.data.code === 'string') {
      newCode = event.data.code
    } else if (typeof event.data.data === 'string' && event.data.type !== 'result') {
      newCode = event.data.data
    }

    if (newCode !== null && newCode !== undefined && newCode !== '') {
      visualizerCode.value = newCode
      try {
        localStorage.setItem(storageKey.value, JSON.stringify({
          code: newCode,
          lang: activeLang.value,
          savedAt: new Date().toISOString()
        }))
      } catch (e) {}
      emit('update:code', newCode)
      emit('codeChange', newCode)
    }

    if (typeof event.data.stdin === 'string') {
      visualizerStdin.value = event.data.stdin
    }

    if (event.data.type === 'result') {
      try {
        localStorage.setItem(storageKey.value, JSON.stringify({
          code: visualizerCode.value,
          lang: activeLang.value,
          savedAt: new Date().toISOString()
        }))
      } catch (e) {}
    }
  })
}

// ── Paste Prevention & Notice ────────────────────────────────────────────────
const showPasteNotice = ref(false)
let pasteNoticeTimeout = null

function triggerPasteBlockedNotice() {
  showPasteNotice.value = true
  if (pasteNoticeTimeout) clearTimeout(pasteNoticeTimeout)
  pasteNoticeTimeout = setTimeout(() => {
    showPasteNotice.value = false
  }, 2500)
}

function handleWindowKeyDown(e) {
  if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
    const active = typeof document !== 'undefined' ? document.activeElement : null
    if (!active || active === document.body || active.tagName === 'IFRAME' || active.closest?.('.edu-editor-container, .edu-card--compiler')) {
      e.preventDefault()
      e.stopPropagation()
      triggerPasteBlockedNotice()
    }
  }
}

function handleWindowPaste(e) {
  const active = typeof document !== 'undefined' ? document.activeElement : null
  if (!active || active === document.body || active.tagName === 'IFRAME' || active.closest?.('.edu-editor-container, .edu-card--compiler')) {
    e.preventDefault()
    e.stopPropagation()
    triggerPasteBlockedNotice()
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleWindowKeyDown, true)
    window.addEventListener('paste', handleWindowPaste, true)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleWindowKeyDown, true)
    window.removeEventListener('paste', handleWindowPaste, true)
  }
  if (pasteNoticeTimeout) clearTimeout(pasteNoticeTimeout)
})

defineExpose({
  getCode: () => visualizerCode.value || '',
  getLanguage: () => activeLang.value || props.language
})
</script>

<template style="width:100%; height:100%;">
  <div class="edu-editor-container" @paste.prevent.stop="triggerPasteBlockedNotice">
    <!-- Paste Disabled Floating Notice -->
    <transition name="edu-toast-pop">
      <div v-if="showPasteNotice" class="edu-paste-notice">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" class="edu-paste-notice-icon">
          <circle cx="12" cy="12" r="10"/>
          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
        </svg>
        <span>Pasting is disabled. Please type the code manually.</span>
      </div>
    </transition>
    <!-- ── Professional Pastel Editor Header ───────────────────────────── -->
    <div class="edu-editor-header">
      <div class="edu-editor-left"></div>

      <div class="edu-editor-right">
        <!-- Sleek Standard-sized Run Button -->
        <button
          class="edu-action-btn edu-action-btn--run"
          :class="{ 'edu-action-btn--running': isExecuting }"
          @click="triggerRun"
          title="Run code (supports custom STDIN & prints output)"
        >
          <span v-if="isExecuting" class="edu-spinner-xs"></span>
          <svg v-else class="edu-btn-icon" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          <span>{{ isExecuting ? 'Running...' : 'Run' }}</span>
        </button>

        <!-- Visualize Button -->
        <button 
          class="edu-action-btn edu-action-btn--visualize" 
          :class="{ 'edu-action-btn--disabled': !isVisualizerSupported }"
          @click="isVisualizerSupported ? openVisualizer() : null" 
          :title="isVisualizerSupported ? 'Step-by-step memory visualization (Python Tutor)' : 'Visualizer not available for this language'"
        >
          <svg class="edu-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          <span>Visualize Memory</span>
        </button>

        <!-- Fullscreen Button -->
        <button 
          @click="openCompiler" 
          class="edu-action-btn"
          title="Expand editor to full screen modal"
        >
          <svg class="edu-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
          </svg>
          <span>Full Screen</span>
        </button>
      </div>
    </div>

    <!-- ── OneCompiler Editor Frame ───────────────────────────────────── -->
    <div class="edu-editor-frame-wrap" :key="ocLang">
      <iframe
        ref="ocFrameRef"
        :src="oneCompilerUrl"
        class="edu-editor-frame"
        frameborder="0"
        allowfullscreen
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
        id="compiler-text-area"
        @load="onIframeLoad"
      ></iframe>
    </div>

    <!-- ── Python Tutor Modal Overlay ─────────────────────────────────── -->
    <Teleport to="body">
      <Transition name="edu-modal-fade">
        <div v-if="showVisualizer" class="edu-modal-overlay" @click.self="showVisualizer = false">
          <div class="edu-modal-card">
            <div class="edu-modal-header">
              <div class="edu-modal-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="edu-modal-icon">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <path d="M3 9h18M9 21V9"/>
                </svg>
                <span>Memory Visualizer</span>
                <span class="edu-modal-subtag">Python Tutor Engine</span>
              </div>
              <button class="edu-modal-close" @click="showVisualizer = false">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
                <span>Close</span>
              </button>
            </div>
            <iframe :src="visualizerUrl" class="edu-modal-iframe" frameborder="0"></iframe>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ── Fullscreen Compiler Modal Overlay ───────────────────────────── -->
    <Teleport to="body">
      <Transition name="edu-modal-fade">
        <div v-if="showCompiler" class="edu-modal-overlay" @click.self="showCompiler = false">
          <div class="edu-modal-card edu-modal-card--fullscreen">
            <div class="edu-modal-header">
              <div class="edu-modal-title">
                <span class="edu-brand-logo-text">CodeLab</span>
                <span>Editor & Compiler</span>
              </div>
              <div class="edu-modal-actions">
                <button
                  class="edu-action-btn edu-action-btn--run"
                  :class="{ 'edu-action-btn--running': isExecuting }"
                  @click="triggerRun"
                  title="Run code"
                >
                  <span v-if="isExecuting" class="edu-spinner-xs"></span>
                  <svg v-else class="edu-btn-icon" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                  <span>{{ isExecuting ? 'Running...' : 'Run' }}</span>
                </button>
                <button 
                  class="edu-action-btn edu-action-btn--visualize" 
                  :class="{ 'edu-action-btn--disabled': !isVisualizerSupported }"
                  @click="isVisualizerSupported ? openVisualizer() : null" 
                >
                  <svg class="edu-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.35-4.35"/>
                  </svg>
                  <span>Visualize</span>
                </button>
                <button class="edu-modal-close" @click="showCompiler = false">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                  <span>Close</span>
                </button>
              </div>
            </div>
            <iframe
              ref="fsOcFrameRef"
              :src="fullscreenCompilerUrl"
              class="edu-editor-frame edu-editor-frame--fs"
              frameborder="0"
              allowfullscreen
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
              @load="onIframeLoad"
            ></iframe>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ── Warning Modal ─────────────────────────────────────────────── -->
    <Teleport to="body">
      <Transition name="edu-modal-fade">
        <div v-if="showVisualizerWarning" class="edu-modal-overlay" @click.self="showVisualizerWarning = false" style="z-index: 999999;">
          <div class="edu-warning-card">
            <div class="edu-warn-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="edu-warn-icon">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <p class="edu-warn-title">No Code to Visualize</p>
            <p class="edu-warn-text">Please write your code in the editor first before starting visualization.</p>
            <button class="edu-warn-btn" @click="showVisualizerWarning = false">Understood</button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* ── Container (Pastel & Clean) ──────────────────────────────────────── */
.edu-editor-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: #ffffff;
  border-radius: 8px;
  overflow: hidden;
}

/* ── Editor Header Bar (Compact & Sleek) ─────────────────────────────── */
.edu-editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 8px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  height: 26px;
  min-height: 26px;
  flex-shrink: 0;
  gap: 6px;
  box-sizing: border-box;
}

.edu-editor-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ── Language Picker ─────────────────────────────────────────────────── */
.edu-lang-picker {
  position: relative;
  display: flex;
  align-items: center;
  gap: 3px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 3px;
  padding: 0 4px;
  height: 20px;
  box-sizing: border-box;
  transition: all 0.15s ease;
}

.edu-lang-picker:hover,
.edu-lang-picker:focus-within {
  border-color: #3b82f6;
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.2);
}

.edu-lang-icon {
  width: 10px;
  height: 10px;
  color: #2563eb;
  flex-shrink: 0;
}

.edu-lang-select {
  appearance: none;
  background: transparent;
  border: none;
  font-size: 0.62rem;
  font-weight: 700;
  color: #0f172a;
  cursor: pointer;
  padding-right: 12px;
  outline: none;
  font-family: inherit;
  line-height: 1;
}

.edu-select-arrow {
  position: absolute;
  right: 3px;
  width: 8px;
  height: 8px;
  color: #64748b;
  pointer-events: none;
}

.edu-file-pill {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 3px;
  padding: 0 5px;
  height: 20px;
  box-sizing: border-box;
  color: #0f172a;
}

.edu-file-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #cbd5e1;
}

.edu-file-dot--java { background: #ea580c; }
.edu-file-dot--cpp { background: #0284c7; }
.edu-file-dot--c { background: #64748b; }
.edu-file-dot--python { background: #16a34a; }
.edu-file-dot--javascript { background: #ca8a04; }

.edu-file-name {
  font-size: 0.62rem;
  font-weight: 600;
  color: #0f172a;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  line-height: 1;
}

.edu-editor-right {
  display: flex;
  align-items: center;
  gap: 5px;
}

/* ── Action Buttons (Compact) ────────────────────────────────────────── */
.edu-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 7px;
  height: 20px;
  box-sizing: border-box;
  border-radius: 3px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #475569;
  font-size: 0.6rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  line-height: 1;
}

.edu-action-btn:hover {
  background: #f1f5f9;
  color: #0f172a;
  border-color: #cbd5e1;
}

.edu-action-btn--run {
  background: #EC5353;
  border-color: #EC5353;
  color: #ffffff;
  font-weight: 700;
  box-shadow: 0 1px 2px rgba(236, 83, 83, 0.2);
}

.edu-action-btn--run:hover:not(.edu-action-btn--disabled) {
  background: #EE7272;
  border-color: #EE7272;
  color: #ffffff;
}

.edu-action-btn--running {
  opacity: 0.85;
  cursor: wait;
}

.edu-spinner-xs {
  width: 9px;
  height: 9px;
  border: 1.5px solid #ffffff;
  border-top-color: transparent;
  border-radius: 50%;
  animation: edu-spin 0.6s linear infinite;
  display: inline-block;
}

.edu-action-btn--visualize {
  background: #f8fafc;
  border-color: #cbd5e1;
  color: #334155;
  font-weight: 600;
}

.edu-action-btn--visualize:hover:not(.edu-action-btn--disabled) {
  background: #f1f5f9;
  border-color: #94a3b8;
  color: #0f172a;
}

.edu-action-btn--disabled {
  opacity: 0.45;
  cursor: not-allowed;
  pointer-events: none;
}

.edu-btn-icon {
  width: 10px;
  height: 10px;
}

/* ── Editor Frame (Proportionally scaled to match question description font size) ── */
.edu-editor-frame-wrap {
  flex: 1;
  width: 100%;
  height: calc(100% - 26px);
  position: relative;
  background: #ffffff;
  overflow: hidden;
}

.edu-editor-frame {
  width: 114.5%;
  height: 114.5%;
  transform: scale(0.873);
  transform-origin: 0 0;
  border: none;
  display: block;
}

.edu-paste-notice {
  position: absolute;
  top: 36px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(15, 23, 42, 0.95);
  color: #f8fafc;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 6px 14px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
  z-index: 999;
  pointer-events: none;
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.edu-paste-notice-icon {
  width: 14px;
  height: 14px;
  color: #f87171;
  flex-shrink: 0;
}

.edu-toast-pop-enter-active,
.edu-toast-pop-leave-active {
  transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.edu-toast-pop-enter-from,
.edu-toast-pop-leave-to {
  opacity: 0;
  transform: translate(-50%, -8px);
}

/* ── Modals ──────────────────────────────────────────────────────────── */
.edu-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.edu-modal-card {
  background: #ffffff;
  border-radius: 10px;
  width: 90vw;
  max-width: 1100px;
  height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.edu-modal-card--fullscreen {
  width: 96vw;
  max-width: 1400px;
  height: 92vh;
}

.edu-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  height: 44px;
}

.edu-modal-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  font-weight: 700;
  color: #0f172a;
}

.edu-brand-logo-text {
  font-size: 0.85rem;
  font-weight: 800;
  color: #2563eb;
  letter-spacing: -0.02em;
}

.edu-modal-subtag {
  font-size: 0.64rem;
  color: #64748b;
  background: #e2e8f0;
  padding: 1px 6px;
  border-radius: 4px;
}

.edu-modal-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.edu-modal-close {
  display: flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 0.7rem;
  color: #64748b;
  cursor: pointer;
}

.edu-modal-close:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.edu-modal-iframe {
  flex: 1;
  width: 100%;
  height: calc(100% - 44px);
  border: none;
}

.edu-editor-frame--fs {
  flex: 1;
  width: 100%;
  height: calc(100% - 44px);
}

.edu-warning-card {
  background: #ffffff;
  border-radius: 10px;
  padding: 24px;
  max-width: 360px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.edu-warn-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #fef2f2;
  color: #ef4444;
  display: flex;
  align-items: center;
  justify-content: center;
}

.edu-warn-icon {
  width: 22px;
  height: 22px;
}

.edu-warn-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.edu-warn-text {
  font-size: 0.78rem;
  color: #64748b;
  margin: 0;
}

.edu-warn-btn {
  margin-top: 6px;
  padding: 6px 18px;
  background: #2563eb;
  color: #ffffff;
  border: none;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

@keyframes edu-spin {
  to { transform: rotate(360deg); }
}
</style>