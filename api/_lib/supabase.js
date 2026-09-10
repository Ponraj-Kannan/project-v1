/**
 * api/_lib/supabase.js
 *
 * Server-side Supabase client, user store, question bank, and submission operations.
 * Uses SUPABASE_SERVICE_ROLE_KEY for privileged operations (never exposed to client).
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import dotenv from 'dotenv'

export function getProjectRoot() {
  if (fs.existsSync(path.join(process.cwd(), 'package.json'))) {
    return process.cwd()
  }
  if (fs.existsSync(path.resolve(process.cwd(), '..', 'package.json'))) {
    return path.resolve(process.cwd(), '..')
  }
  try {
    const fileDir = path.dirname(new URL(import.meta.url).pathname)
    return path.resolve(fileDir, '..', '..')
  } catch (e) {
    return process.cwd()
  }
}

const projectRoot = getProjectRoot()
dotenv.config({ path: path.join(projectRoot, '.env') })

let supabaseInstance = null

export function getSupabaseClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

  if (!url || !key) {
    return null
  }
  if (!supabaseInstance) {
    supabaseInstance = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })
  }
  return supabaseInstance
}

// ── Local Fallback Store Paths ────────────────────────────────────────────────
const localFilePath = path.join(projectRoot, 'allowed-emails.json')
const localTopicsPath = path.join(projectRoot, 'topics-store.json')
const localQuestionsPath = path.join(projectRoot, 'questions-store.json')
const localSolvedQuestionsPath = path.join(projectRoot, 'solved-questions-store.json')
const legacySubmissionsPath = path.join(projectRoot, 'submissions-store.json')

// ── Default Seed Topics (Only id, name, display_order) ────────────────────────
const DEFAULT_TOPICS = [
  { id: '66d11752-20ab-48fe-88f2-9c335262ef57', name: 'Inputs', display_order: 1 },
  { id: '0ca140b9-a466-434e-8f76-d11832c35751', name: 'Outputs', display_order: 2 },
  { id: '6d7bbce7-23de-44a3-8bbf-fa68a3f689f9', name: 'Operators', display_order: 3 },
  { id: '8a1cb44b-a608-4729-8db3-e38def002dba', name: 'Type Casting', display_order: 4 },
  { id: '8b03f493-6051-4aee-91d7-065e941a85f9', name: 'Decision-making Statements', display_order: 5 },
  { id: '8c146688-03b9-4afb-8668-d382b78b9d5e', name: 'Control Statements', display_order: 6 },
  { id: '9963ab60-2f29-46b4-ab6d-a670253649e0', name: 'Arrays', display_order: 7 },
  { id: 'a7bbae11-253c-4cdd-bb75-10ffd7fdd668', name: 'Strings', display_order: 8 },
  { id: 'c2b281ab-f9f5-41a0-b9dd-2632a30c19ba', name: 'Methods / Functions', display_order: 9 },
  { id: 'aa998cdd-cc76-48cd-89cc-7ed0d5887e22', name: 'Recursion', display_order: 10 }
]

// ── Default Seed Questions ────────────────────────────────────────────────────
const DEFAULT_QUESTIONS = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Positive Number Checker',
    slug: 'check-positive-number',
    description: 'Write a Java program that takes an integer num as input and checks if it is a Positive Number using an if statement.',
    difficulty: 'easy',
    total_test_cases: 5,
    display_order: 1,
    priority: 1,
    is_active: true,
    topic: 'Decision-making Statements',
    sub_topic: 'Practice Problem: Positive Number Check',
    language: 'java',
    starter_code: `import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int num = sc.nextInt();\n        \n        // Write your if condition here\n        if (num > 0) {\n            System.out.println(num + " is a positive number.");\n        }\n    }\n}`,
    test_cases: [
      { id: 1, name: 'Sample 1', input: '12', expectedOutput: '12 is a positive number.', isHidden: false },
      { id: 2, name: 'Sample 2', input: '-25', expectedOutput: '', isHidden: false },
      { id: 3, name: 'Hidden 1', input: '-5', expectedOutput: '', isHidden: true },
      { id: 4, name: 'Hidden 2', input: '0', expectedOutput: '', isHidden: true },
      { id: 5, name: 'Hidden 3', input: '100', expectedOutput: '100 is a positive number.', isHidden: true }
    ],
    task: 'Write a Java program that takes an integer <code>num</code> as input and checks if it is a <b>Positive Number</b> using an <code>if</code> statement.',
    input_format: 'A single integer <code>num</code>.',
    constraints: '-10<sup>9</sup> &le; num &le; 10<sup>9</sup>',
    output_format: 'Print <code>&lt;num&gt; is a positive number.</code> if positive, otherwise print nothing.',
    explanation: 'Since 12 is greater than 0, it is identified as a positive number.',
    contents: [
      { text: '<b>Problem:</b> Write a Java program that takes an integer <code>num</code> as input and checks if it is a <b>Positive Number</b> using an <code>if</code> statement.' },
      { text: '<b>Sample Input:</b> <code>12</code>' },
      { text: '<b>Expected Output:</b><br><code>12 is a positive number.</code>' }
    ],
    score: 10,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    title: 'Sum of Digits',
    slug: 'sum-of-digits',
    description: 'Write a Java program that takes an integer num as input and prints the Sum of its Digits.',
    difficulty: 'easy',
    total_test_cases: 6,
    display_order: 1,
    priority: 1,
    is_active: true,
    topic: 'Control Statements',
    sub_topic: 'Practice Problem: Sum of Digits',
    language: 'java',
    starter_code: `import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int num = sc.nextInt();\n        int sum = 0;\n        \n        // Write your logic here to calculate sum of digits\n        int temp = Math.abs(num);\n        while (temp > 0) {\n            sum += temp % 10;\n            temp /= 10;\n        }\n        \n        System.out.println("Sum of digits = " + sum);\n    }\n}`,
    test_cases: [
      { id: 1, name: 'Sample 1', input: '123', expectedOutput: 'Sum of digits = 6', isHidden: false },
      { id: 2, name: 'Sample 2', input: '9', expectedOutput: 'Sum of digits = 9', isHidden: false },
      { id: 3, name: 'Hidden 1', input: '1000', expectedOutput: 'Sum of digits = 1', isHidden: true },
      { id: 4, name: 'Hidden 2', input: '0', expectedOutput: 'Sum of digits = 0', isHidden: true },
      { id: 5, name: 'Hidden 3', input: '987654', expectedOutput: 'Sum of digits = 39', isHidden: true },
      { id: 6, name: 'Hidden 4', input: '505', expectedOutput: 'Sum of digits = 10', isHidden: true }
    ],
    task: 'Write a Java program that takes an integer <code>num</code> as input and prints the <b>Sum of its Digits</b>.',
    input_format: 'A single integer <code>num</code>.',
    constraints: '0 &le; num &le; 10<sup>9</sup>',
    output_format: 'Print <code>Sum of digits = &lt;sum&gt;</code>.',
    explanation: '1 + 2 + 3 = 6.',
    contents: [
      { text: '<b>Problem:</b> Write a Java program that takes an integer <code>num</code> as input and prints the <b>Sum of its Digits</b>.' },
      { text: '<b>Sample Input:</b> <code>123</code>' },
      { text: '<b>Expected Output:</b><br><code>Sum of digits = 6</code>' }
    ],
    score: 10,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '33333333-3333-3333-3333-333333333331',
    title: 'Find Maximum Element in Array',
    slug: 'find-maximum-in-array',
    description: 'Write a Java program to find and print the maximum element present in an integer array.',
    difficulty: 'easy',
    total_test_cases: 4,
    display_order: 1,
    priority: 1,
    is_active: true,
    topic: 'Arrays',
    sub_topic: 'Practice Problem: Maximum Element',
    language: 'java',
    starter_code: `import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int[] arr = new int[n];\n        for (int i = 0; i < n; i++) {\n            arr[i] = sc.nextInt();\n        }\n        \n        // Write logic to find the maximum element\n        int max = arr[0];\n        for (int i = 1; i < n; i++) {\n            if (arr[i] > max) max = arr[i];\n        }\n        System.out.println(max);\n    }\n}`,
    test_cases: [
      { id: 1, name: 'Sample 1', input: '5\n10 24 5 89 42', expectedOutput: '89', isHidden: false },
      { id: 2, name: 'Sample 2', input: '3\n-5 -12 -1', expectedOutput: '-1', isHidden: false },
      { id: 3, name: 'Hidden 1', input: '1\n99', expectedOutput: '99', isHidden: true },
      { id: 4, name: 'Hidden 2', input: '4\n100 200 50 150', expectedOutput: '200', isHidden: true }
    ],
    task: 'Write a Java program that reads an integer <code>n</code>, followed by <code>n</code> array elements, and outputs the <b>maximum element</b> in the array.',
    input_format: 'First line: integer <code>n</code>.<br>Second line: <code>n</code> space-separated integers.',
    constraints: '1 &le; n &le; 10<sup>5</sup><br>-10<sup>9</sup> &le; arr[i] &le; 10<sup>9</sup>',
    output_format: 'Print the maximum value.',
    explanation: 'Among 10, 24, 5, 89, 42, the maximum value is 89.',
    contents: [
      { text: '<b>Problem:</b> Find and print the maximum element in the given integer array.' },
      { text: '<b>Sample Input:</b><br><code>5<br>10 24 5 89 42</code>' },
      { text: '<b>Expected Output:</b><br><code>89</code>' }
    ],
    score: 10,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '33333333-3333-3333-3333-333333333332',
    title: 'Sum of Array Elements',
    slug: 'sum-of-array-elements',
    description: 'Write a Java program to compute the total sum of all elements in an integer array.',
    difficulty: 'easy',
    total_test_cases: 3,
    display_order: 2,
    priority: 2,
    is_active: true,
    topic: 'Arrays',
    sub_topic: 'Practice Problem: Array Sum',
    language: 'java',
    starter_code: `import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int[] arr = new int[n];\n        long sum = 0;\n        for (int i = 0; i < n; i++) {\n            arr[i] = sc.nextInt();\n            sum += arr[i];\n        }\n        System.out.println(sum);\n    }\n}`,
    test_cases: [
      { id: 1, name: 'Sample 1', input: '4\n1 2 3 4', expectedOutput: '10', isHidden: false },
      { id: 2, name: 'Sample 2', input: '3\n10 -5 20', expectedOutput: '25', isHidden: false },
      { id: 3, name: 'Hidden 1', input: '5\n0 0 0 0 0', expectedOutput: '0', isHidden: true }
    ],
    task: 'Write a Java program that reads an integer <code>n</code>, followed by <code>n</code> array elements, and outputs the <b>total sum</b>.',
    input_format: 'First line: integer <code>n</code>.<br>Second line: <code>n</code> space-separated integers.',
    constraints: '1 &le; n &le; 10<sup>5</sup><br>-10<sup>9</sup> &le; arr[i] &le; 10<sup>9</sup>',
    output_format: 'Print the sum.',
    explanation: '1 + 2 + 3 + 4 = 10.',
    contents: [
      { text: '<b>Problem:</b> Compute the sum of all elements in the integer array.' },
      { text: '<b>Sample Input:</b><br><code>4<br>1 2 3 4</code>' },
      { text: '<b>Expected Output:</b><br><code>10</code>' }
    ],
    score: 10,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    title: 'Reverse an Array',
    slug: 'reverse-an-array',
    description: 'Write a Java program to reverse the elements of an array and print them separated by space.',
    difficulty: 'easy',
    total_test_cases: 3,
    display_order: 3,
    priority: 3,
    is_active: true,
    topic: 'Arrays',
    sub_topic: 'Practice Problem: Array Reversal',
    language: 'java',
    starter_code: `import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        int[] arr = new int[n];\n        for (int i = 0; i < n; i++) {\n            arr[i] = sc.nextInt();\n        }\n        for (int i = n - 1; i >= 0; i--) {\n            System.out.print(arr[i] + (i > 0 ? " " : ""));\n        }\n        System.out.println();\n    }\n}`,
    test_cases: [
      { id: 1, name: 'Sample 1', input: '4\n1 2 3 4', expectedOutput: '4 3 2 1', isHidden: false },
      { id: 2, name: 'Sample 2', input: '3\n10 20 30', expectedOutput: '30 20 10', isHidden: false },
      { id: 3, name: 'Hidden 1', input: '1\n5', expectedOutput: '5', isHidden: true }
    ],
    task: 'Write a Java program that reads an integer <code>n</code>, followed by <code>n</code> array elements, and outputs the elements in <b>reverse order</b> separated by space.',
    input_format: 'First line: integer <code>n</code>.<br>Second line: <code>n</code> space-separated integers.',
    constraints: '1 &le; n &le; 10<sup>5</sup>',
    output_format: 'Print reversed array elements separated by single space.',
    explanation: 'Reverse of [1, 2, 3, 4] is 4 3 2 1.',
    contents: [
      { text: '<b>Problem:</b> Output the array in reverse order.' },
      { text: '<b>Sample Input:</b><br><code>4<br>1 2 3 4</code>' },
      { text: '<b>Expected Output:</b><br><code>4 3 2 1</code>' }
    ],
    score: 10,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
]

// ── Local Fallback Helpers ───────────────────────────────────────────────────

function loadLocalUsers() {
  try {
    if (fs.existsSync(localFilePath)) {
      const data = JSON.parse(fs.readFileSync(localFilePath, 'utf8'))
      if (Array.isArray(data)) {
        return data.map((item, idx) => {
          if (typeof item === 'string') {
            return {
              id: `local-user-${idx + 1}`,
              email: item.toLowerCase(),
              role: idx === 0 ? 'admin' : 'student',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          }
          return {
            id: item.id || `local-user-${idx + 1}`,
            email: (item.email || '').toLowerCase(),
            role: item.role || (idx === 0 ? 'admin' : 'student'),
            created_at: item.created_at || new Date().toISOString(),
            updated_at: item.updated_at || new Date().toISOString()
          }
        })
      }
    }
  } catch (err) {
    console.warn('[Supabase Lib] Failed to read local fallback users:', err.message)
  }
  return []
}

function saveLocalUsers(users) {
  try {
    const formatted = users.map(u => ({
      id: u.id,
      email: u.email.toLowerCase(),
      role: u.role || 'student',
      created_at: u.created_at,
      updated_at: u.updated_at
    }))
    fs.writeFileSync(localFilePath, JSON.stringify(formatted, null, 2), 'utf8')
  } catch (err) {
    console.warn('[Supabase Lib] Failed to write local fallback users:', err.message)
  }
}

function loadLocalQuestions() {
  try {
    if (fs.existsSync(localQuestionsPath)) {
      const data = JSON.parse(fs.readFileSync(localQuestionsPath, 'utf8'))
      if (Array.isArray(data) && data.length > 0) {
        return data
      }
    }
  } catch (err) {
    console.warn('[Supabase Lib] Failed to read local fallback questions:', err.message)
  }
  saveLocalQuestions(DEFAULT_QUESTIONS)
  return DEFAULT_QUESTIONS
}

function saveLocalQuestions(questions) {
  try {
    fs.writeFileSync(localQuestionsPath, JSON.stringify(questions, null, 2), 'utf8')
  } catch (err) {
    console.warn('[Supabase Lib] Failed to write local fallback questions:', err.message)
  }
}

function loadLocalSolvedQuestions() {
  try {
    if (fs.existsSync(localSolvedQuestionsPath)) {
      const data = JSON.parse(fs.readFileSync(localSolvedQuestionsPath, 'utf8'))
      if (Array.isArray(data)) {
        return data
      }
    } else if (fs.existsSync(legacySubmissionsPath)) {
      // Auto-migrate passed submissions from legacy store
      const data = JSON.parse(fs.readFileSync(legacySubmissionsPath, 'utf8'))
      if (Array.isArray(data)) {
        const passedOnly = data
          .filter(s => s.status === 'passed' || (s.cases_passed === s.total_cases && s.total_cases > 0))
          .map(s => ({
            id: `local-solved-${s.id}`,
            user_id: s.user_id,
            question_id: s.question_id,
            is_solved: true,
            solved_at: s.created_at || new Date().toISOString()
          }))
        saveLocalSolvedQuestions(passedOnly)
        return passedOnly
      }
    }
  } catch (err) {
    console.warn('[Supabase Lib] Failed to read local fallback solved questions:', err.message)
  }
  return []
}

function saveLocalSolvedQuestions(solvedQuestions) {
  try {
    fs.writeFileSync(localSolvedQuestionsPath, JSON.stringify(solvedQuestions, null, 2), 'utf8')
  } catch (err) {
    console.warn('[Supabase Lib] Failed to write local fallback solved questions:', err.message)
  }
}

// ── Local Topics Store (Only id, name, display_order) ─────────────────────────
function loadLocalTopics() {
  try {
    if (fs.existsSync(localTopicsPath)) {
      const data = JSON.parse(fs.readFileSync(localTopicsPath, 'utf8'))
      if (Array.isArray(data) && data.length > 0) {
        return data.map(t => ({
          id: t.id,
          name: t.name,
          display_order: t.display_order ?? 0
        }))
      }
    }
  } catch (err) {
    console.warn('[Supabase Lib] Failed to read local topics:', err.message)
  }
  saveLocalTopics(DEFAULT_TOPICS)
  return DEFAULT_TOPICS
}

function saveLocalTopics(topics) {
  try {
    const cleaned = (topics || []).map(t => ({
      id: t.id,
      name: t.name,
      display_order: t.display_order ?? 0
    }))
    fs.writeFileSync(localTopicsPath, JSON.stringify(cleaned, null, 2), 'utf8')
  } catch (err) {
    console.warn('[Supabase Lib] Failed to write local topics:', err.message)
  }
}

export async function getTopics() {
  const client = getSupabaseClient()
  if (client) {
    try {
      const { data, error } = await client
        .from('topics')
        .select('id, name, display_order')
        .order('display_order', { ascending: true })

      if (!error && Array.isArray(data) && data.length > 0) {
        const mapped = data.map(t => ({
          id: t.id,
          name: t.name,
          display_order: t.display_order ?? 0
        }))
        saveLocalTopics(mapped)
        return mapped
      }

      // If table exists but empty, try seeding default topics
      if (!error && Array.isArray(data) && data.length === 0) {
        try {
          await client.from('topics').upsert(DEFAULT_TOPICS, { onConflict: 'name' })
          const res = await client.from('topics').select('id, name, display_order').order('display_order', { ascending: true })
          if (res.data && res.data.length > 0) {
            saveLocalTopics(res.data)
            return res.data
          }
        } catch (seedErr) {}
      }
    } catch (err) {
      console.warn('[Supabase Lib] getTopics remote error:', err.message)
    }
  }

  return loadLocalTopics()
}

export async function createTopic({ name, display_order }) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('Topic name is required.')
  }

  const cleanName = name.trim()
  const existingTopics = await getTopics()
  const duplicate = existingTopics.find(t => t.name.toLowerCase() === cleanName.toLowerCase())
  if (duplicate) {
    return duplicate
  }

  const order = Number.isInteger(display_order) && display_order > 0
    ? display_order
    : (existingTopics.reduce((max, t) => Math.max(max, t.display_order || 0), 0) + 1)

  const payload = {
    id: crypto.randomUUID(),
    name: cleanName,
    display_order: order
  }

  const client = getSupabaseClient()
  if (client) {
    try {
      const { data, error } = await client
        .from('topics')
        .insert(payload)
        .select('id, name, display_order')
        .single()

      if (!error && data) {
        const local = loadLocalTopics()
        local.push({
          id: data.id,
          name: data.name,
          display_order: data.display_order ?? 0
        })
        saveLocalTopics(local)
        return data
      }
    } catch (err) {
      console.warn('[Supabase Lib] createTopic remote error:', err.message)
    }
  }

  const local = loadLocalTopics()
  local.push(payload)
  saveLocalTopics(local)
  return payload
}

export async function deleteTopic(id) {
  if (!id) return false
  const client = getSupabaseClient()
  if (client) {
    try {
      await client.from('topics').delete().eq('id', id)
    } catch (err) {
      console.warn('[Supabase Lib] deleteTopic remote error:', err.message)
    }
  }

  const local = loadLocalTopics()
  const updated = local.filter(t => t.id !== id)
  saveLocalTopics(updated)
  return true
}

// ── Core User Operations ─────────────────────────────────────────────────────

export async function findUserByEmail(email) {
  if (!email || typeof email !== 'string') return null
  const cleanEmail = email.trim().toLowerCase()

  const client = getSupabaseClient()
  if (client) {
    try {
      const { data, error } = await client
        .from('users')
        .select('id, email, role, created_at, updated_at')
        .ilike('email', cleanEmail)
        .maybeSingle()

      if (error) {
        console.error('[Supabase Lib] findUserByEmail error:', error.message)
      } else {
        if (data) {
          return {
            id: data.id,
            email: data.email.toLowerCase(),
            role: data.role,
            created_at: data.created_at,
            updated_at: data.updated_at
          }
        }
        return null
      }
    } catch (err) {
      console.error('[Supabase Lib] Supabase query failed:', err.message)
    }
  }

  // Fallback to local user store only when client is not available or threw an error
  const localUsers = loadLocalUsers()
  return localUsers.find(u => u.email.toLowerCase() === cleanEmail) || null
}

export async function getAllUsers() {
  const client = getSupabaseClient()
  if (client) {
    try {
      const { data, error } = await client
        .from('users')
        .select('id, email, role, created_at, updated_at')
        .order('created_at', { ascending: true })

      if (error) {
        console.error('[Supabase Lib] getAllUsers error:', error.message)
      } else if (Array.isArray(data)) {
        return data.map(u => ({
          id: u.id,
          email: u.email.toLowerCase(),
          role: u.role,
          created_at: u.created_at,
          updated_at: u.updated_at
        }))
      }
    } catch (err) {
      console.error('[Supabase Lib] Supabase getAllUsers query failed:', err.message)
    }
  }

  return loadLocalUsers()
}

export async function addUsers(items) {
  const normalized = []
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const now = new Date().toISOString()

  for (const item of items) {
    const rawEmail = typeof item === 'string' ? item : item?.email
    const rawRole = (typeof item === 'object' && item?.role) ? item.role : 'student'
    const role = ['admin', 'trainer', 'student'].includes(rawRole) ? rawRole : 'student'

    if (typeof rawEmail === 'string') {
      const cleanEmail = rawEmail.trim().toLowerCase()
      if (emailRegex.test(cleanEmail)) {
        normalized.push({
          email: cleanEmail,
          role,
          updated_at: now
        })
      }
    }
  }

  if (normalized.length === 0) {
    return { count: 0, users: await getAllUsers() }
  }

  const client = getSupabaseClient()
  if (client) {
    try {
      const { data, error } = await client
        .from('users')
        .upsert(normalized, { onConflict: 'email', ignoreDuplicates: false })
        .select('id, email, role, created_at, updated_at')

      if (error) throw error

      const allUsers = await getAllUsers()
      return { count: normalized.length, users: allUsers }
    } catch (err) {
      console.error('[Supabase Lib] addUsers error:', err.message)
      throw err
    }
  }

  // Fallback local update
  const localUsers = loadLocalUsers()
  for (const item of normalized) {
    const existing = localUsers.find(u => u.email === item.email)
    if (existing) {
      existing.role = item.role
      existing.updated_at = now
    } else {
      localUsers.push({
        id: `local-user-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        email: item.email,
        role: item.role,
        created_at: now,
        updated_at: now
      })
    }
  }
  saveLocalUsers(localUsers)
  return { count: normalized.length, users: localUsers }
}

export async function deleteUser(email) {
  if (!email) return { success: false, error: 'Email required' }
  const cleanEmail = email.trim().toLowerCase()

  const client = getSupabaseClient()
  if (client) {
    try {
      const { error } = await client
        .from('users')
        .delete()
        .ilike('email', cleanEmail)

      if (error) throw error

      const allUsers = await getAllUsers()
      return { success: true, users: allUsers }
    } catch (err) {
      console.error('[Supabase Lib] deleteUser error:', err.message)
      throw err
    }
  }

  // Fallback local delete
  let localUsers = loadLocalUsers()
  localUsers = localUsers.filter(u => u.email !== cleanEmail)
  saveLocalUsers(localUsers)
  return { success: true, users: localUsers }
}

export async function updateUserRole(email, role) {
  if (!email || !role) throw new Error('Email and role are required')
  const cleanEmail = email.trim().toLowerCase()
  const validRole = ['admin', 'trainer', 'student'].includes(role) ? role : 'student'
  const now = new Date().toISOString()

  const client = getSupabaseClient()
  if (client) {
    const { data, error } = await client
      .from('users')
      .update({ role: validRole, updated_at: now })
      .ilike('email', cleanEmail)
      .select()

    if (error) throw error
    return data
  }

  const localUsers = loadLocalUsers()
  const target = localUsers.find(u => u.email === cleanEmail)
  if (target) {
    target.role = validRole
    target.updated_at = now
    saveLocalUsers(localUsers)
  }
  return target
}

export async function verifyGoogleToken(idToken) {
  if (!idToken) return null

  try {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    )
    if (!response.ok) {
      return null
    }
    const payload = await response.json()
    const expectedClientId = '207254417956-cgi3av80ac090nqrurpjkdhj19nievvp.apps.googleusercontent.com'
    if (payload.aud !== expectedClientId) {
      console.warn('[Supabase Lib] Token aud does not match expected client ID')
      return null
    }
    return payload
  } catch (error) {
    console.error('[Supabase Lib] Error verifying Google token:', error.message)
    return null
  }
}

// ── Question Bank Operations ──────────────────────────────────────────────────

/**
 * Retrieves questions from the questions table, filtered optionally by topic and ordered by priority and display_order.
 * @param {Object} options - { includeInactive: boolean, topic: string }
 */
export async function getQuestions({ includeInactive = false, topic = null } = {}) {
  const client = getSupabaseClient()
  if (client) {
    try {
      let query = client
        .from('questions')
        .select('*')

      if (!includeInactive) {
        query = query.eq('is_active', true)
      }

      if (topic && typeof topic === 'string' && topic.trim()) {
        query = query.ilike('topic', topic.trim())
      }

      // Try sorting by priority first, then display_order
      try {
        query = query
          .order('priority', { ascending: true, nullsFirst: false })
          .order('display_order', { ascending: true })
          .order('created_at', { ascending: true })
      } catch (e) {
        query = query
          .order('display_order', { ascending: true })
          .order('created_at', { ascending: true })
      }

      let { data, error } = await query

      if (error && error.message && error.message.includes('priority')) {
        let retryQuery = client.from('questions').select('*')
        if (!includeInactive) retryQuery = retryQuery.eq('is_active', true)
        if (topic && typeof topic === 'string' && topic.trim()) {
          retryQuery = retryQuery.ilike('topic', topic.trim())
        }
        retryQuery = retryQuery.order('display_order', { ascending: true }).order('created_at', { ascending: true })
        const retryRes = await retryQuery
        data = retryRes.data
        error = retryRes.error
      }

      if (error) {
        console.error('[Supabase Lib] getQuestions error:', error.message)
      } else if (Array.isArray(data)) {
        data.sort((a, b) => {
          const pA = a.priority ?? a.display_order ?? 0
          const pB = b.priority ?? b.display_order ?? 0
          return pA - pB
        })
        return data
      }
    } catch (err) {
      console.error('[Supabase Lib] getQuestions failed:', err.message)
    }
  }

  // Fallback to local questions store only if Supabase is unavailable
  const localQuestions = loadLocalQuestions()
  let filtered = includeInactive ? localQuestions : localQuestions.filter(q => q.is_active !== false)
  if (topic && typeof topic === 'string' && topic.trim()) {
    const norm = topic.trim().toLowerCase()
    filtered = filtered.filter(q => (q.topic || '').trim().toLowerCase() === norm)
  }
  filtered.sort((a, b) => {
    const pA = a.priority ?? a.display_order ?? 0
    const pB = b.priority ?? b.display_order ?? 0
    return pA - pB
  })
  return filtered
}

/**
 * Retrieves a single question by its ID or slug.
 */
export async function getQuestionByIdOrSlug(idOrSlug) {
  if (!idOrSlug) return null

  const isUid = isUUID(idOrSlug)
  const client = getSupabaseClient()

  if (client) {
    try {
      let query = client.from('questions').select('*')
      if (isUid) {
        query = query.eq('id', idOrSlug)
      } else {
        query = query.eq('slug', idOrSlug)
      }
      const { data, error } = await query.maybeSingle()

      if (error) {
        console.error('[Supabase Lib] getQuestionByIdOrSlug error:', error.message)
        return null
      } else {
        return data || null
      }
    } catch (err) {
      console.error('[Supabase Lib] getQuestionByIdOrSlug failed:', err.message)
      return null
    }
  }

  // Fallback to local questions store only when client is not available or threw an error
  const localQuestions = loadLocalQuestions()
  return localQuestions.find(q => q.id === idOrSlug || q.slug === idOrSlug) || null
}

/**
 * Inserts or updates a question in the questions table.
 * Supports contextual insertion: `insert_after_id` / `insert_after_slug` / `insert_after_order`.
 */
export async function upsertQuestion(questionData) {
  if (!questionData || !questionData.title) {
    throw new Error('Title is required for question')
  }

  const slug = questionData.slug || questionData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  
  // Normalize test cases ensuring consistent format
  const normalizedTestCases = Array.isArray(questionData.test_cases)
    ? questionData.test_cases.map((tc, idx) => ({
        id: tc.id || idx + 1,
        name: tc.name || (tc.isHidden || tc.is_hidden ? `Hidden ${idx + 1}` : `Sample ${idx + 1}`),
        input: tc.input || tc.stdin || '',
        expectedOutput: tc.expectedOutput || tc.expected_output || tc.output || '',
        isHidden: Boolean(tc.isHidden !== undefined ? tc.isHidden : tc.is_hidden)
      }))
    : []

  const totalTestCases = normalizedTestCases.length > 0 ? normalizedTestCases.length : (parseInt(questionData.total_test_cases, 10) || 5)

  const existingQuestions = await getQuestions({ includeInactive: true })
  existingQuestions.sort((a, b) => (a.display_order || 0) - (b.display_order || 0))

  const isExisting = existingQuestions.find(q => (questionData.id && q.id === questionData.id) || q.slug === slug)

  let displayOrder = questionData.display_order

  if (isExisting) {
    // If editing existing question, preserve its display_order unless explicitly provided
    if (!Number.isInteger(displayOrder) || displayOrder <= 0) {
      displayOrder = isExisting.display_order || 1
    }
  } else {
    // Brand new question insertion
    const insertAfterId = questionData.insert_after_id || questionData.insertAfterId
    const insertAfterSlug = questionData.insert_after_slug || questionData.insertAfterSlug
    const insertAfterOrder = questionData.insert_after_order || questionData.insertAfterOrder

    let targetIdx = -1
    if (insertAfterId || insertAfterSlug || insertAfterOrder) {
      targetIdx = existingQuestions.findIndex(q =>
        (insertAfterId && q.id === insertAfterId) ||
        (insertAfterSlug && q.slug === insertAfterSlug) ||
        (insertAfterOrder && q.display_order === insertAfterOrder)
      )
    }

    if (targetIdx !== -1) {
      // Insert right after the target question
      displayOrder = targetIdx + 2
    } else if (Number.isInteger(displayOrder) && displayOrder > 0) {
      // Custom displayOrder specified
    } else {
      // Default fallback: append to the end
      const maxOrder = existingQuestions.reduce((max, q) => Math.max(max, q.display_order || 0), 0)
      displayOrder = maxOrder + 1
    }
  }

  const priority = Number.isInteger(Number(questionData.priority)) && Number(questionData.priority) > 0
    ? Number(questionData.priority)
    : displayOrder

  const payload = {
    title: questionData.title.trim(),
    slug,
    description: questionData.description || questionData.task || '',
    difficulty: questionData.difficulty || 'easy',
    total_test_cases: totalTestCases,
    display_order: displayOrder,
    priority,
    is_active: questionData.is_active !== undefined ? Boolean(questionData.is_active) : true,
    topic: questionData.topic || '',
    sub_topic: questionData.sub_topic || '',
    language: questionData.language || 'java',
    starter_code: questionData.starter_code || '',
    test_cases: normalizedTestCases,
    task: questionData.task || questionData.description || '',
    input_format: questionData.input_format || questionData.inputFormat || '',
    constraints: questionData.constraints || '',
    output_format: questionData.output_format || questionData.outputFormat || '',
    explanation: questionData.explanation || '',
    contents: Array.isArray(questionData.contents) ? questionData.contents : [],
    score: Number.isInteger(Number(questionData.score)) ? Number(questionData.score) : 10,
    updated_at: new Date().toISOString()
  }

  if (questionData.id && isUUID(questionData.id)) {
    payload.id = questionData.id
  } else {
    payload.id = crypto.randomUUID()
  }

  let resolvedTopicId = questionData.topic_id || null
  if (!resolvedTopicId && payload.topic) {
    try {
      const allTopics = await getTopics()
      const found = allTopics.find(t => t.name.toLowerCase() === payload.topic.toLowerCase())
      if (found) resolvedTopicId = found.id
    } catch (e) {}
  }
  if (resolvedTopicId) {
    payload.topic_id = resolvedTopicId
  }

  const client = getSupabaseClient()
  if (client) {
    try {
      let { data, error } = await client
        .from('questions')
        .upsert(payload, { onConflict: 'slug' })
        .select()
        .single()

      if (error && (error.message.includes('topic_id') || error.message.includes('priority'))) {
        // Fallback if remote schema hasn't executed migration yet
        const safePayload = { ...payload }
        if (error.message.includes('topic_id')) delete safePayload.topic_id
        if (error.message.includes('priority')) delete safePayload.priority
        const retryRes = await client
          .from('questions')
          .upsert(safePayload, { onConflict: 'slug' })
          .select()
          .single()
        data = retryRes.data
        error = retryRes.error
      }

      if (error) throw error

      await syncQuestionSlidesToFile()
      return data
    } catch (err) {
      console.warn('[Supabase Lib] upsertQuestion remote warning:', err.message)
    }
  }

  // Fallback local update
  const localQuestions = loadLocalQuestions()
  localQuestions.sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
  const existingIdx = localQuestions.findIndex(q => (payload.id && q.id === payload.id) || q.slug === payload.slug)

  if (existingIdx !== -1) {
    localQuestions[existingIdx] = { ...localQuestions[existingIdx], ...payload }
  } else {
    payload.created_at = new Date().toISOString()
    const insertIndex = Math.max(0, Math.min(localQuestions.length, displayOrder - 1))
    localQuestions.splice(insertIndex, 0, payload)
    localQuestions.forEach((q, idx) => {
      q.display_order = idx + 1
    })
  }
  saveLocalQuestions(localQuestions)

  await syncQuestionSlidesToFile()
  return payload
}

/**
 * Deletes a question from Supabase questions table and local fallback store.
 */
export async function deleteQuestion(idOrSlug) {
  if (!idOrSlug) throw new Error('Question ID or Slug is required for deletion')

  const client = getSupabaseClient()
  if (client) {
    try {
      const isUid = isUUID(idOrSlug)
      const query = client.from('questions').delete()
      const { error } = isUid ? await query.eq('id', idOrSlug) : await query.eq('slug', idOrSlug)
      if (error) throw error
    } catch (err) {
      console.warn('[Supabase Lib] deleteQuestion remote warning:', err.message)
    }
  }

  const localQuestions = loadLocalQuestions()
  const filtered = localQuestions.filter(q => q.id !== idOrSlug && q.slug !== idOrSlug)
  filtered.sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
  filtered.forEach((q, idx) => { q.display_order = idx + 1 })
  saveLocalQuestions(filtered)

  await syncQuestionSlidesToFile()
  return filtered
}

/**
 * Updates the display_order of multiple questions based on an ordered array of IDs/slugs.
 */
export async function reorderQuestions(orderedIdsOrSlugs) {
  if (!Array.isArray(orderedIdsOrSlugs) || orderedIdsOrSlugs.length === 0) {
    throw new Error('orderedIdsOrSlugs array is required')
  }

  const questions = await getQuestions({ includeInactive: true })
  const questionMap = new Map()
  questions.forEach(q => {
    questionMap.set(q.id, q)
    questionMap.set(q.slug, q)
  })

  const updatedList = []
  orderedIdsOrSlugs.forEach((identifier, index) => {
    const q = questionMap.get(identifier)
    if (q) {
      q.display_order = index + 1
      q.updated_at = new Date().toISOString()
      if (!updatedList.includes(q)) {
        updatedList.push(q)
      }
    }
  })

  const client = getSupabaseClient()
  if (client) {
    try {
      for (const q of updatedList) {
        await client.from('questions').update({ display_order: q.display_order, updated_at: q.updated_at }).eq('id', q.id)
      }
    } catch (err) {
      console.warn('[Supabase Lib] reorderQuestions remote warning:', err.message)
    }
  }

  saveLocalQuestions(updatedList)
  await syncQuestionSlidesToFile()
  return updatedList
}

// ── Solved Questions & Progress Operations ───────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUUID(str) {
  return typeof str === 'string' && UUID_REGEX.test(str.trim())
}

/**
 * Records that a user has solved a question.
 * A question is solved when all test cases are passed.
 * Automatically upserts into Supabase `solved_questions` table,
 * with graceful fallback to `submissions` or local store.
 */
export async function recordQuestionSolved({
  userId,
  userEmail,
  questionId,
  questionSlug
}) {
  const client = getSupabaseClient()

  let resolvedUserId = userId
  if (!resolvedUserId && userEmail) {
    let user = await findUserByEmail(userEmail)
    if (!user && client) {
      try {
        const cleanEmail = userEmail.trim().toLowerCase()
        const { data: newUser } = await client
          .from('users')
          .insert([{ email: cleanEmail, role: 'student', updated_at: new Date().toISOString() }])
          .select('id, email, role, created_at, updated_at')
          .maybeSingle()
        if (newUser) {
          user = newUser
        }
      } catch (err) {
        console.warn('[Supabase Lib] Auto-create user on solved notice:', err.message)
      }
    }
    if (user) {
      resolvedUserId = user.id
    } else {
      resolvedUserId = `user-${userEmail.trim().toLowerCase().replace(/[^a-zA-Z0-9]/g, '_')}`
    }
  }

  if (!resolvedUserId) {
    throw new Error('Valid userId or userEmail is required to record solved question')
  }

  let resolvedQuestionId = questionId
  if (!resolvedQuestionId && questionSlug) {
    const q = await getQuestionByIdOrSlug(questionSlug)
    if (q) resolvedQuestionId = q.id
  } else if (resolvedQuestionId) {
    const q = await getQuestionByIdOrSlug(resolvedQuestionId)
    if (q) resolvedQuestionId = q.id
  }

  if (!resolvedQuestionId) {
    throw new Error('Valid questionId or questionSlug is required to record solved question')
  }

  const nowIso = new Date().toISOString()
  const solvedPayload = {
    user_id: resolvedUserId,
    question_id: resolvedQuestionId,
    is_solved: true,
    solved_at: nowIso,
    updated_at: nowIso
  }

  // 1. Attempt Supabase DB upsert if both user_id and question_id are valid UUIDs
  if (client && isUUID(resolvedUserId) && isUUID(resolvedQuestionId)) {
    try {
      const { data, error } = await client
        .from('solved_questions')
        .upsert([solvedPayload], { onConflict: 'user_id,question_id' })
        .select()
        .maybeSingle()

      if (!error && data) {
        return data
      }

      if (error) {
        // If solved_questions table does not exist in schema yet (code PGRST205),
        // fallback gracefully to updating submissions table with status='passed'
        if (error.code === 'PGRST205') {
          console.info('[Supabase Lib] Table solved_questions not found, falling back to submissions table until migration is run.')
          const { data: subData } = await client
            .from('submissions')
            .insert([{
              user_id: resolvedUserId,
              question_id: resolvedQuestionId,
              cases_passed: 5,
              total_cases: 5,
              status: 'passed',
              created_at: nowIso
            }])
            .select()
            .maybeSingle()
          if (subData) {
            return {
              id: subData.id,
              user_id: resolvedUserId,
              question_id: resolvedQuestionId,
              is_solved: true,
              solved_at: subData.created_at
            }
          }
        } else {
          console.warn('[Supabase Lib] recordQuestionSolved upsert warning:', error.message)
        }
      }
    } catch (err) {
      console.warn('[Supabase Lib] recordQuestionSolved failed:', err.message)
    }
  }

  // 2. Local fallback store
  const localSolved = loadLocalSolvedQuestions()
  const existingIdx = localSolved.findIndex(s => s.user_id === resolvedUserId && s.question_id === resolvedQuestionId)
  const record = {
    id: `local-solved-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    ...solvedPayload
  }
  if (existingIdx >= 0) {
    localSolved[existingIdx] = { ...localSolved[existingIdx], ...solvedPayload }
  } else {
    localSolved.unshift(record)
  }
  saveLocalSolvedQuestions(localSolved)
  return record
}

/**
 * Retrieves solved questions for a given user and/or question.
 */
export async function getSolvedQuestions({ userId, userEmail, questionId, questionSlug } = {}) {
  let resolvedUserId = userId
  if (!resolvedUserId && userEmail) {
    const user = await findUserByEmail(userEmail)
    if (user) {
      resolvedUserId = user.id
    } else {
      resolvedUserId = `user-${userEmail.trim().toLowerCase().replace(/[^a-zA-Z0-9]/g, '_')}`
    }
  }

  let resolvedQuestionId = questionId
  let resolvedQuestionSlug = questionSlug
  if (questionSlug || questionId) {
    const q = await getQuestionByIdOrSlug(questionSlug || questionId)
    if (q) {
      resolvedQuestionId = q.id
      resolvedQuestionSlug = q.slug
    }
  }

  const client = getSupabaseClient()
  const canQuerySupabase = client &&
    (!resolvedUserId || isUUID(resolvedUserId)) &&
    (!resolvedQuestionId || isUUID(resolvedQuestionId))

  if (canQuerySupabase) {
    try {
      let query = client
        .from('solved_questions')
        .select('id, user_id, question_id, is_solved, solved_at, created_at')
        .eq('is_solved', true)

      if (resolvedUserId && isUUID(resolvedUserId)) {
        query = query.eq('user_id', resolvedUserId)
      }
      if (resolvedQuestionId && isUUID(resolvedQuestionId)) {
        query = query.eq('question_id', resolvedQuestionId)
      }

      const { data, error } = await query

      if (!error && Array.isArray(data)) {
        return data
      }

      // If table solved_questions not yet migrated, fall back to passed submissions
      if (error && error.code === 'PGRST205') {
        let subQuery = client
          .from('submissions')
          .select('id, user_id, question_id, status, created_at')
          .eq('status', 'passed')
        if (resolvedUserId && isUUID(resolvedUserId)) subQuery = subQuery.eq('user_id', resolvedUserId)
        if (resolvedQuestionId && isUUID(resolvedQuestionId)) subQuery = subQuery.eq('question_id', resolvedQuestionId)

        const { data: subData } = await subQuery
        if (Array.isArray(subData)) {
          return subData.map(s => ({
            id: s.id,
            user_id: s.user_id,
            question_id: s.question_id,
            is_solved: true,
            solved_at: s.created_at
          }))
        }
      }
    } catch (err) {
      console.warn('[Supabase Lib] getSolvedQuestions failed:', err.message)
    }
  }

  // Local fallback
  const localSolved = loadLocalSolvedQuestions()
  return localSolved.filter(s => {
    if (resolvedUserId && s.user_id !== resolvedUserId) return false
    if (questionId || questionSlug || resolvedQuestionId) {
      const matches = s.question_id === resolvedQuestionId ||
                      (resolvedQuestionSlug && s.question_id === resolvedQuestionSlug) ||
                      (questionId && s.question_id === questionId) ||
                      (questionSlug && s.question_id === questionSlug)
      if (!matches) return false
    }
    return !!s.is_solved
  })
}

/**
 * Retrieves per-question solved progress for a user across all active questions.
 */
export async function getUserProgress({ userId, userEmail }) {
  let resolvedUserId = userId
  if (!resolvedUserId && userEmail) {
    const user = await findUserByEmail(userEmail)
    if (user) {
      resolvedUserId = user.id
    } else {
      resolvedUserId = `user-${userEmail.trim().toLowerCase().replace(/[^a-zA-Z0-9]/g, '_')}`
    }
  }

  const questions = await getQuestions({ includeInactive: false })
  const solvedList = resolvedUserId ? await getSolvedQuestions({ userId: resolvedUserId }) : []
  const solvedQuestionIds = new Set(solvedList.map(s => s.question_id))

  const progressByQuestion = {}
  for (const q of questions) {
    const isSolved = solvedQuestionIds.has(q.id) || (q.slug && solvedQuestionIds.has(q.slug))
    const solvedRecord = solvedList.find(s => s.question_id === q.id || (q.slug && s.question_id === q.slug))

    progressByQuestion[q.id] = {
      questionId: q.id,
      questionSlug: q.slug,
      questionTitle: q.title,
      displayOrder: q.display_order,
      difficulty: q.difficulty,
      totalCases: q.total_test_cases,
      status: isSolved ? 'passed' : 'unattempted',
      isSolved: !!isSolved,
      solvedAt: solvedRecord?.solved_at || null
    }
  }

  const totalQuestions = questions.length
  const completedQuestions = Object.values(progressByQuestion).filter(p => p.isSolved || p.status === 'passed').length

  return {
    userId: resolvedUserId,
    totalQuestions,
    completedQuestions,
    completionPercentage: totalQuestions > 0 ? Math.round((completedQuestions / totalQuestions) * 100) : 0,
    progress: progressByQuestion
  }
}

// ── Backward-compatible Wrappers ─────────────────────────────────────────────

export async function recordSubmission({
  userId,
  userEmail,
  questionId,
  questionSlug,
  casesPassed,
  totalCases,
  submittedCode = ''
}) {
  const passed = Math.max(0, parseInt(casesPassed, 10) || 0)
  const total = Math.max(1, parseInt(totalCases, 10) || 5)

  if (passed >= total && total > 0) {
    const solved = await recordQuestionSolved({ userId, userEmail, questionId, questionSlug })
    return {
      ...solved,
      cases_passed: passed,
      total_cases: total,
      status: 'passed'
    }
  }

  return {
    user_id: userId,
    question_id: questionId,
    cases_passed: passed,
    total_cases: total,
    status: passed > 0 ? 'partial' : 'failed'
  }
}

export async function getSubmissions(params = {}) {
  return getSolvedQuestions(params)
}

/**
 * Automatically synchronizes database question rows from Supabase to src/slides/arrays/main.md
 * ensuring each active question in Supabase has its own dedicated slide.
 */
export async function syncQuestionSlidesToFile() {
  // Option 1: DynamicQuestionDeck renders questions dynamically at runtime.
  // Markdown file writing is disabled unless FORCE_SYNC_SLIDES === 'true'.
  if (process.env.FORCE_SYNC_SLIDES !== 'true') {
    return
  }

  try {
    const questions = await getQuestions({ includeInactive: false })

    const slidesMarkdownPath = path.join(projectRoot, 'src', 'slides', 'arrays', 'main.md')

    if (!fs.existsSync(path.dirname(slidesMarkdownPath))) {
      fs.mkdirSync(path.dirname(slidesMarkdownPath), { recursive: true })
    }

    if (!questions || questions.length === 0) {
      fs.writeFileSync(slidesMarkdownPath, '---\ntransition: slide-up\n---\n\n<Slide />\n', 'utf8')
      return
    }

    // Stable sort by display_order, then created_at
    questions.sort((a, b) => {
      const orderDiff = (a.display_order || 0) - (b.display_order || 0)
      if (orderDiff !== 0) return orderDiff
      return (a.created_at || '').localeCompare(b.created_at || '')
    })

    const slideEntries = questions.map((q) => {
      return `---
transition: slide-up
---

<Slide question-slug="${q.slug}" />`
    })

    try {
      const markdownContent = slideEntries.join('\n\n') + '\n'
      fs.writeFileSync(slidesMarkdownPath, markdownContent, 'utf8')
      console.log(`[Supabase Lib] Successfully synced ${questions.length} question slide(s) from Supabase to ${slidesMarkdownPath}`)
    } catch (writeErr) {
      console.warn('[Supabase Lib] Filesystem is read-only (expected on Vercel serverless functions):', writeErr.message)
    }
  } catch (err) {
    console.warn('[Supabase Lib] Could not sync question slides to file:', err.message)
  }
}
